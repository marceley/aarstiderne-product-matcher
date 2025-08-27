import type { LoaderFunctionArgs } from "react-router";
import { pool } from "../utils/db";

export async function loader(_args: LoaderFunctionArgs) {
  const client = await pool.connect();
  try {
    const rows = await client.sql<any>`
      SELECT id_text, title, raw->>'Title' as product_title, (embedding IS NOT NULL) AS has_embedding
      FROM products
      ORDER BY id_text
      LIMIT 100;
    `;
    return Response.json({ products: rows.rows });
  } finally {
    client.release();
  }
}

export default function Products() {
  const data = (typeof window !== "undefined" && (window as any).__remixContext?.data) || undefined;
  // Fallback for server render via useLoaderData pattern at runtime
  // but keep a minimal client-friendly render without importing hooks here.
  const products = (data?.products as any[]) || [];
  return (
    <div style={{ padding: 16 }}>
      <h1>Products (first 100)</h1>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>ID</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Title (DB)</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Title (JSON)</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Has Embedding</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id_text}>
              <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{p.id_text}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{p.title ?? ""}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{p.product_title ?? ""}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{p.has_embedding ? "yes" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


