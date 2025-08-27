import { createPool } from "@vercel/postgres";

async function main() {
  const connectionString = process.env.DATABASE_POSTGRES_URL?.trim() || process.env.DATABASE_URL?.trim();
  const pool = connectionString ? createPool({ connectionString }) : createPool();
  const client = await pool.connect();
  try {
    const res = await client.sql`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS with_embeddings, COUNT(*) FILTER (WHERE embedding IS NULL)::int AS without_embeddings FROM products;`;
    const row = res.rows[0] ?? { total: 0, with_embeddings: 0, without_embeddings: 0 };
    console.log(JSON.stringify(row));
  } finally {
    client.release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


