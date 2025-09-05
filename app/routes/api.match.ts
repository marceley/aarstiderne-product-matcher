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
  const instructions = body?.instructions as string | undefined;
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return new Response("Bad Request", { status: 400 });
  }

  const embeddings = await getEmbeddings(ingredients, instructions);
  const client = await pool.connect();
  try {
    const results: { ingredient: string; matches: { id: string; title: string | null; title_original: string | null; score: number }[] }[] = [];
    
    // Batch all valid embeddings for a single query
    const validEmbeddings: { index: number; embedding: number[]; ingredient: string }[] = [];
    for (let i = 0; i < ingredients.length; i++) {
      const emb = embeddings[i];
      if (emb && emb.length > 0) {
        validEmbeddings.push({ index: i, embedding: emb, ingredient: ingredients[i] });
      } else {
        results.push({ ingredient: ingredients[i], matches: [] });
      }
    }
    
    if (validEmbeddings.length > 0) {
      // Execute queries in parallel instead of UNION (simpler and more reliable)
      const queryPromises = validEmbeddings.map(async ({ embedding, index, ingredient }) => {
        const embLiteral = `[${embedding.join(",")}]`;
        const rows = await client.sql<any>`
          SELECT id_text, title, title_original, pimid, 1 - (embedding <=> ${embLiteral}::vector) AS score
          FROM products
          WHERE embedding IS NOT NULL
          ORDER BY embedding <-> ${embLiteral}::vector
          LIMIT 3;
        `;
        return { index, ingredient, rows: rows.rows };
      });
      
      const queryResults = await Promise.all(queryPromises);
      
      // Process results in original order
      for (const { index, ingredient, rows } of queryResults) {
        const matches = rows.map((r: any) => ({ 
          id: (r.pimid as string) || r.id_text, 
          title: (r.title as string) ?? null, 
          title_original: (r.title_original as string) ?? null,
          score: Number(r.score) 
        }));
        results.push({ ingredient, matches });
      }
    }

    const simplified = results.map((r) => ({ 
      ingredient: r.ingredient, 
      matches: r.matches.map((m) => ({ 
        id: m.id, 
        title: m.title,
        title_original: m.title_original,
        score: m.score 
      })) 
    }));
    return Response.json({ results: simplified });
  } finally {
    client.release();
  }
}

export const loader = () => new Response("Not Found", { status: 404 });

