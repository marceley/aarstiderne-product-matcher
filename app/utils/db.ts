import { createPool } from "@vercel/postgres";

export const pool = createPool({ connectionString: process.env.DATABASE_URL });

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

EOF
