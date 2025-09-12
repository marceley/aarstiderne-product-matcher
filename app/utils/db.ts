import { createPool } from "@vercel/postgres";

// Prefer project convention and Vercel CLI output:
// - DATABASE_POSTGRES_URL (from .env.local / Vercel CLI)
// - fallback to DATABASE_URL for local/dev overrides
// If neither is set, let @vercel/postgres resolve POSTGRES_URL on Vercel.
const connectionString =
  process.env.DATABASE_POSTGRES_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  undefined;

export const pool = connectionString ? createPool({ connectionString }) : createPool();

export async function ensureDatabaseSetup(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.sql`CREATE EXTENSION IF NOT EXISTS vector;`;
    await client.sql`
      CREATE TABLE IF NOT EXISTS products (
        id_text text PRIMARY KEY,
        title text,
        title_original text,
        pimId text,
        raw jsonb NOT NULL,
        embedding vector(1536)
      );
    `;
    // Optimized vector index for better performance
    await client.sql`CREATE INDEX IF NOT EXISTS products_embedding_idx ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 200);`;
    
    // Recipe cache table for storing match results
    await client.sql`
      CREATE TABLE IF NOT EXISTS recipe_cache (
        recipe_slug text PRIMARY KEY,
        results jsonb NOT NULL,
        created_at timestamp DEFAULT NOW(),
        expires_at timestamp NOT NULL,
        hit_count integer DEFAULT 0,
        last_accessed timestamp DEFAULT NOW()
      );
    `;
    // Indexes for fast lookups and cleanup
    await client.sql`CREATE INDEX IF NOT EXISTS idx_recipe_cache_expires ON recipe_cache(expires_at);`;
    await client.sql`CREATE INDEX IF NOT EXISTS idx_recipe_cache_last_accessed ON recipe_cache(last_accessed);`;
  } finally {
    client.release();
  }
}

export type DbProduct = {
  id_text: string;
  title: string | null;
  raw: unknown;
};

