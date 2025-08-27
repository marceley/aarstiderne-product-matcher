import { createPool } from "@vercel/postgres";

async function main() {
  const connectionString = process.env.DATABASE_POSTGRES_URL?.trim() || process.env.DATABASE_URL?.trim();
  const pool = connectionString ? createPool({ connectionString }) : createPool();
  const client = await pool.connect();
  try {
    const res = await client.sql`SELECT id_text, pimId, raw->>'Image' as image_url FROM products WHERE pimId IS NOT NULL LIMIT 5;`;
    console.log(JSON.stringify(res.rows, null, 2));
  } finally {
    client.release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
