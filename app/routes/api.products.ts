import type { LoaderFunctionArgs } from "react-router";
import { pool } from "../utils/db";

export async function loader(_args: LoaderFunctionArgs) {
  try {
    const client = await pool.connect();
    try {
      const rows = await client.sql<any>`
        SELECT id_text, title, pimid, raw->>'Title' as product_title, (embedding IS NOT NULL) AS has_embedding
        FROM products
        ORDER BY id_text
        LIMIT 10;
      `;
      return Response.json({ 
        success: true, 
        count: rows.rows.length, 
        products: rows.rows 
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("API products error:", error);
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
