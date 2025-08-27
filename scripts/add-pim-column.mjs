import { createPool } from "@vercel/postgres";

async function main() {
  const connectionString = process.env.DATABASE_POSTGRES_URL?.trim() || process.env.DATABASE_URL?.trim();
  const pool = connectionString ? createPool({ connectionString }) : createPool();
  const client = await pool.connect();
  try {
    console.log("Adding pimId column to products table...");
    await client.sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS pimId text;`;
    console.log("Column added successfully!");
    
    // Check if column exists
    const res = await client.sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name ILIKE 'pimId';`;
    console.log("Column exists:", res.rows.length > 0);
    console.log("Found columns:", res.rows.map(r => r.column_name));
  } finally {
    client.release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
