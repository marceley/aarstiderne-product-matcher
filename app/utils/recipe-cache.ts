import { pool } from "./db";

// Cache TTL: 1 month
const CACHE_TTL_DAYS = 30;
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface CachedRecipe {
  results: any;
  created_at: Date;
  expires_at: Date;
  hit_count: number;
  last_accessed: Date;
}

/**
 * Get cached recipe results by slug
 */
export async function getCachedRecipe(recipeSlug: string): Promise<CachedRecipe | null> {
  const client = await pool.connect();
  try {
    const result = await client.sql`
      SELECT results, created_at, expires_at, hit_count, last_accessed
      FROM recipe_cache 
      WHERE recipe_slug = ${recipeSlug} AND expires_at > NOW()
    `;
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const cached = result.rows[0] as CachedRecipe;
    
    // Update hit count and last accessed
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
 * Store recipe results in cache
 */
export async function setCachedRecipe(recipeSlug: string, results: any): Promise<void> {
  const client = await pool.connect();
  try {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    
    await client.sql`
      INSERT INTO recipe_cache (recipe_slug, results, expires_at)
      VALUES (${recipeSlug}, ${JSON.stringify(results)}, ${expiresAt})
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
  activeEntries: number;
  expiredEntries: number;
  totalHits: number;
}> {
  const client = await pool.connect();
  try {
    const result = await client.sql`
      SELECT 
        COUNT(*) as total_entries,
        COUNT(*) FILTER (WHERE expires_at > NOW()) as active_entries,
        COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_entries,
        COALESCE(SUM(hit_count), 0) as total_hits
      FROM recipe_cache
    `;
    
    const row = result.rows[0];
    return {
      totalEntries: parseInt(row.total_entries) || 0,
      activeEntries: parseInt(row.active_entries) || 0,
      expiredEntries: parseInt(row.expired_entries) || 0,
      totalHits: parseInt(row.total_hits) || 0,
    };
  } finally {
    client.release();
  }
}
