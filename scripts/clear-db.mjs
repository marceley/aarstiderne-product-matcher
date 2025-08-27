import { createPool } from "@vercel/postgres";

async function main() {
  const connectionString = process.env.DATABASE_POSTGRES_URL?.trim() || process.env.DATABASE_URL?.trim();
  const pool = connectionString ? createPool({ connectionString }) : createPool();
  const client = await pool.connect();
  try {
    // First count rows
    const countRes = await client.sql`SELECT COUNT(*)::int AS total FROM products;`;
    const total = countRes.rows[0]?.total || 0;
    console.log(`Found ${total} rows to delete`);
    
    if (total === 0) {
      console.log("No rows to delete");
      return;
    }
    
    // Delete all rows
    const deleteRes = await client.sql`DELETE FROM products;`;
    console.log(`Deleted ${deleteRes.rowCount} rows`);
    
    // Verify deletion
    const verifyRes = await client.sql`SELECT COUNT(*)::int AS remaining FROM products;`;
    const remaining = verifyRes.rows[0]?.remaining || 0;
    console.log(`Remaining rows: ${remaining}`);
    
  } finally {
    client.release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
