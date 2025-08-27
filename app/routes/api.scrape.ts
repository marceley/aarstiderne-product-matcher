import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { ensureDatabaseSetup, pool } from "../utils/db";
import { getEmbeddings } from "../utils/embeddings";

async function runScrape(): Promise<Response> {
  // Basic auth for external feed
  const url = "https://productfeed.aarstiderne.com/output/productfeed110.json";
  const auth = "Basic " + Buffer.from("ProductFeed:Vinter2019").toString("base64");

  await ensureDatabaseSetup();

  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) return new Response("Fetch failed", { status: 502 });
  const data = (await res.json()) as unknown[];

  // Expect array of products; compute embeddings from title
  const titles: string[] = data.map((d: any) => d?.Title || d?.title || d?.name || "");
  const ids: string[] = data.map((d: any) => String(d?.id ?? d?.productId ?? d?.sku ?? ""));

  const embeddings = await getEmbeddings(titles);

  const client = await pool.connect();
  try {
    await client.sql`BEGIN`;
    for (let i = 0; i < data.length; i++) {
      const id = ids[i] || crypto.randomUUID();
      const title = titles[i] || null;
      const embedding = embeddings[i] ?? null;
      const embeddingLiteral = embedding && embedding.length > 0 ? `[${embedding.join(",")}]` : null;
      await client.sql`
        INSERT INTO products (id_text, title, raw, embedding)
        VALUES (${id}, ${title}, ${JSON.stringify(data[i])}, ${embeddingLiteral}::vector)
        ON CONFLICT (id_text)
        DO UPDATE SET title = EXCLUDED.title, raw = EXCLUDED.raw, embedding = EXCLUDED.embedding;
      `;
    }
    await client.sql`COMMIT`;
  } catch (e) {
    await client.sql`ROLLBACK`;
    console.error(e);
    return new Response("DB error", { status: 500 });
  } finally {
    client.release();
  }

  return Response.json({ ok: true });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  return runScrape();
}

export async function loader(_args: LoaderFunctionArgs) {
  // Allow GET for Vercel Cron
  return runScrape();
}

