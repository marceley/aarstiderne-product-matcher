import type { ActionFunctionArgs } from "react-router";
import { ensureDatabaseSetup, pool } from "../utils/db";
import { getEmbeddings } from "../utils/embeddings";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  await ensureDatabaseSetup();

  const body = await request.json();
  const ingredients = (body?.ingredients ?? []) as string[];
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return new Response("Bad Request", { status: 400 });
  }

  const embeddings = await getEmbeddings(ingredients);
  const client = await pool.connect();
  try {
    const results: { ingredient: string; matches: { id: string; title: string | null; score: number }[] }[] = [];
    for (let i = 0; i < ingredients.length; i++) {
      const emb = embeddings[i];
      const rows = await client.sql<any>`
        SELECT id_text, title, 1 - (embedding <=> ${(client as any).vector(emb)}) AS score
        FROM products
        WHERE embedding IS NOT NULL
        ORDER BY embedding <-> ${(client as any).vector(emb)}
        LIMIT 5;
      `;
      const matches = rows.rows.map((r: any) => ({ id: r.id_text as string, title: (r.title as string) ?? null, score: Number(r.score) }))
      results.push({ ingredient: ingredients[i], matches });
    }

    const simplified = results.map((r) => ({ ingredient: r.ingredient, matches: r.matches.map((m) => ({ id: m.id, title: m.title })) }));
    return Response.json({ results: simplified });
  } finally {
    client.release();
  }
}

export const loader = () => new Response("Not Found", { status: 404 });

EOF
