import type { ActionFunctionArgs } from "react-router";
import { pool } from "../utils/db";
import { getEmbeddings } from "../utils/embeddings";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  
  const startTime = Date.now();
  console.log(`[PROD-MATCH] Starting request at ${new Date().toISOString()}`);

  const body = await request.json();
  const ingredients = (body?.ingredients ?? []) as string[];
  const instructions = body?.instructions as string | undefined;
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return new Response("Bad Request", { status: 400 });
  }

  const embeddingStart = Date.now();
  const embeddings = await getEmbeddings(ingredients, instructions);
  console.log(`[PROD-MATCH] Embeddings took ${Date.now() - embeddingStart}ms`);
  
  const dbStart = Date.now();
  const client = await pool.connect();
  try {
    // Get only the best match (highest score) for each ingredient
    const validEmbeddings: { index: number; embedding: number[]; ingredient: string }[] = [];
    for (let i = 0; i < ingredients.length; i++) {
      const emb = embeddings[i];
      if (emb && emb.length > 0) {
        validEmbeddings.push({ index: i, embedding: emb, ingredient: ingredients[i] });
      }
    }
    
    if (validEmbeddings.length === 0) {
      return Response.json([]);
    }
    
    // Single optimized query - get only the best match per ingredient
    const unionQueries = validEmbeddings.map(({ embedding, index }) => {
      const embLiteral = `[${embedding.join(",")}]`;
      return `(
        SELECT ${index} as query_index, 
               CAST(pimid AS INTEGER) as product_id,
               1 - (embedding <=> '${embLiteral}'::vector) AS score
        FROM products
        WHERE embedding IS NOT NULL AND pimid IS NOT NULL AND pimid ~ '^[0-9]+$'
        ORDER BY embedding <-> '${embLiteral}'::vector
        LIMIT 1
      )`;
    });
    
    const unionQuery = unionQueries.join(' UNION ALL ');
    const queryResult = await client.query(unionQuery);
    
    // Extract just the product IDs, sorted by original ingredient order
    const productIds: number[] = [];
    const resultsByIndex = new Map<number, number>();
    
    for (const row of queryResult.rows) {
      resultsByIndex.set(row.query_index, row.product_id);
    }
    
    // Return IDs in the same order as input ingredients
    for (const { index } of validEmbeddings) {
      const productId = resultsByIndex.get(index);
      if (productId) {
        productIds.push(productId);
      }
    }
    
    console.log(`[PROD-MATCH] Database query took ${Date.now() - dbStart}ms`);
    
    const totalTime = Date.now() - startTime;
    console.log(`[PROD-MATCH] Total request time: ${totalTime}ms, returning ${productIds.length} product IDs`);
    
    return Response.json(productIds);
    
  } finally {
    client.release();
  }
}

export const loader = () => new Response("Not Found", { status: 404 });
