import { pool } from "./db";

export interface CachedRecipe {
  recipe_slug: string;
  results: any;
  created_at: Date;
  expires_at: Date;
  hit_count: number;
  last_accessed: Date;
}

/**
 * Get cached recipe results if they exist and haven't expired
 */
export async function getCachedRecipe(recipeSlug: string): Promise<CachedRecipe | null> {
  const client = await pool.connect();
  try {
    const result = await client.sql<CachedRecipe>`
      SELECT recipe_slug, results, created_at, expires_at, hit_count, last_accessed
      FROM recipe_cache 
      WHERE recipe_slug = ${recipeSlug} 
        AND expires_at > NOW()
    `;
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const cached = result.rows[0];
    
    // Update hit count and last accessed time
    await client.sql`
      UPDATE recipe_cache 
      SET hit_count = hit_count + 1, last_accessed = NOW()
      WHERE recipe_slug = ${recipeSlug}
    `;
    
    return cached;
  } finally {
    client.release();
  }
}

/**
 * Store recipe results in cache with configurable TTL
 */
export async function setCachedRecipe(recipeSlug: string, results: any): Promise<void> {
  const client = await pool.connect();
  try {
    const expiresAt = new Date();
    const ttlMonths = parseInt(process.env.CACHE_TTL_MONTHS || "1", 10);
    expiresAt.setMonth(expiresAt.getMonth() + ttlMonths);
    
    await client.sql`
      INSERT INTO recipe_cache (recipe_slug, results, expires_at)
      VALUES (${recipeSlug}, ${JSON.stringify(results)}, ${expiresAt.toISOString()})
      ON CONFLICT (recipe_slug) 
      DO UPDATE SET 
        results = EXCLUDED.results,
        expires_at = EXCLUDED.expires_at,
        created_at = NOW(),
        hit_count = 0,
        last_accessed = NOW()
    `;
  } finally {
    client.release();
  }
}

/**
 * Clean up expired cache entries
 */
export async function cleanupExpiredCache(): Promise<number> {
  const client = await pool.connect();
  try {
    const result = await client.sql`
      DELETE FROM recipe_cache 
      WHERE expires_at <= NOW()
    `;
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  expiredEntries: number;
  totalHits: number;
  averageHits: number;
}> {
  const client = await pool.connect();
  try {
    const result = await client.sql`
      SELECT 
        COUNT(*) as total_entries,
        COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_entries,
        SUM(hit_count) as total_hits,
        AVG(hit_count) as average_hits
      FROM recipe_cache
    `;
    
    const row = result.rows[0];
    return {
      totalEntries: parseInt(row.total_entries) || 0,
      expiredEntries: parseInt(row.expired_entries) || 0,
      totalHits: parseInt(row.total_hits) || 0,
      averageHits: parseFloat(row.average_hits) || 0,
    };
  } finally {
    client.release();
  }
}
