import { createPool } from "@vercel/postgres";

async function main() {
  const connectionString = process.env.DATABASE_POSTGRES_URL?.trim() || process.env.DATABASE_URL?.trim();
  const pool = connectionString ? createPool({ connectionString }) : createPool();
  const client = await pool.connect();
  try {
    const res = await client.sql`SELECT COUNT(*)::int AS n FROM products;`;
    console.log(String(res.rows[0]?.n ?? 0));
  } finally {
    client.release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


