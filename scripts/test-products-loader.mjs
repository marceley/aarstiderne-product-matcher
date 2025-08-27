import { pool } from "../app/utils/db.ts";

async function main() {
  const client = await pool.connect();
  try {
    console.log("Testing products loader...");
    const rows = await client.sql`
      SELECT id_text, title, raw->>'Title' as product_title, (embedding IS NOT NULL) AS has_embedding
      FROM products
      ORDER BY id_text
      LIMIT 5;
    `;
    console.log("Query successful!");
    console.log("Found rows:", rows.rows.length);
    console.log("First row:", JSON.stringify(rows.rows[0], null, 2));
  } catch (err) {
    console.error("Error in products loader:", err);
  } finally {
    client.release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
