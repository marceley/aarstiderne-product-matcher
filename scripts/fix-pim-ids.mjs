import { createPool } from "@vercel/postgres";

async function main() {
  const connectionString = process.env.DATABASE_POSTGRES_URL?.trim() || process.env.DATABASE_URL?.trim();
  const pool = connectionString ? createPool({ connectionString }) : createPool();
  const client = await pool.connect();
  
  try {
    console.log("Fixing PIM IDs for all products...");
    
    // Get all products with image URLs
    const res = await client.sql`SELECT id_text, raw->>'Image' as image_url FROM products WHERE raw->>'Image' IS NOT NULL`;
    const products = res.rows;
    
    console.log(`Found ${products.length} products with image URLs`);
    
    const regex = /product\/.*?-(\d{4})-\d+-\d+-\d+\.png/;
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const product of products) {
      const { id_text, image_url } = product;
      
      if (!image_url) {
        skippedCount++;
        continue;
      }
      
      const match = image_url.match(regex);
      if (match) {
        const pimId = match[1];
        
        // Update the product with the extracted PIM ID
        await client.sql`UPDATE products SET pimid = ${pimId} WHERE id_text = ${id_text}`;
        updatedCount++;
        
        if (updatedCount % 100 === 0) {
          console.log(`Updated ${updatedCount} products...`);
        }
      } else {
        skippedCount++;
        console.log(`No PIM ID found for: ${id_text} - ${image_url}`);
      }
    }
    
    console.log(`\nCompleted!`);
    console.log(`Updated: ${updatedCount} products`);
    console.log(`Skipped: ${skippedCount} products (no PIM ID found)`);
    
    // Verify the results
    const verifyRes = await client.sql`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE pimid IS NOT NULL)::int AS with_pimid, COUNT(*) FILTER (WHERE pimid IS NULL)::int AS without_pimid FROM products;`;
    const stats = verifyRes.rows[0];
    console.log(`\nFinal stats:`);
    console.log(`Total: ${stats.total}`);
    console.log(`With PIM ID: ${stats.with_pimid}`);
    console.log(`Without PIM ID: ${stats.without_pimid}`);
    
  } finally {
    client.release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
