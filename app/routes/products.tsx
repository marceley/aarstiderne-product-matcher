import { useEffect, useState } from "react";

type Product = {
  id_text: string;
  title: string | null;
  pimid: string | null;
  product_title: string | null;
  has_embedding: boolean;
};

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await fetch('/api/products');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.success) {
          setProducts(data.products);
        } else {
          setError(data.error || 'Failed to load products');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load products');
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <h1>Products</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <h1>Products</h1>
        <p style={{ color: 'red' }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Products (first 10)</h1>
      <p>Total products: {products.length}</p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>ID</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>PIM ID</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Title (DB)</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Title (JSON)</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Has Embedding</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id_text}>
              <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{p.id_text}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{p.pimid ?? ""}</td>
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


