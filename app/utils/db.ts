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
        raw jsonb NOT NULL,
        embedding vector(1536)
      );
    `;
    await client.sql`CREATE INDEX IF NOT EXISTS products_embedding_idx ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);`;
  } finally {
    client.release();
  }
}

export type DbProduct = {
  id_text: string;
  title: string | null;
  raw: unknown;
};

