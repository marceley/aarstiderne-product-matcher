import { createPool } from "@vercel/postgres";

async function main() {
  const connectionString = process.env.DATABASE_POSTGRES_URL?.trim() || process.env.DATABASE_URL?.trim();
  const pool = connectionString ? createPool({ connectionString }) : createPool();
  const client = await pool.connect();
  try {
    const res = await client.sql`SELECT id_text, raw->>'Id' as json_id, title, raw->>'Title' as raw_title FROM products WHERE id_text LIKE '%-STK' LIMIT 5;`;
    console.log(JSON.stringify(res.rows, null, 2));
  } finally {
    client.release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
