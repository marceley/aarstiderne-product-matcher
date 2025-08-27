import { createPool } from "@vercel/postgres";

function resolveDatabaseUrl(): string | undefined {
  // Prefer Vercel Postgres defaults
  if (process.env.POSTGRES_URL && process.env.POSTGRES_URL.trim().length > 0) {
    return process.env.POSTGRES_URL;
  }
  // Explicit connection string fallback (custom)
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
    return process.env.DATABASE_URL;
  }
  // Individual parts (Vercel naming)
  const pgHost = process.env.POSTGRES_HOST;
  const pgPort = process.env.POSTGRES_PORT || "5432";
  const pgUser = process.env.POSTGRES_USER;
  const pgPassword = process.env.POSTGRES_PASSWORD;
  const pgDb = process.env.POSTGRES_DATABASE;
  if (pgHost && pgUser && pgPassword && pgDb) {
    return `postgres://${encodeURIComponent(pgUser)}:${encodeURIComponent(pgPassword)}@${pgHost}:${pgPort}/${pgDb}`;
  }
  // Individual parts (custom DATABASE_* naming)
  const host = process.env.DATABASE_HOST;
  const port = process.env.DATABASE_PORT || "5432";
  const user = process.env.DATABASE_USER;
  const password = process.env.DATABASE_PASSWORD;
  const dbName = process.env.DATABASE_NAME;
  if (host && user && password && dbName) {
    return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${dbName}`;
  }
  return undefined;
}

const connectionString = resolveDatabaseUrl();

export const pool = createPool({ connectionString });

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

