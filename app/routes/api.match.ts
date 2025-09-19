import type { ActionFunctionArgs } from "react-router";
import { ensureDatabaseSetup, pool } from "../utils/db";
import { getEmbeddings } from "../utils/embeddings";
import { getCachedRecipe, setCachedRecipe } from "../utils/recipe-cache";
import { validateApiKey, createAuthErrorResponse } from "../utils/auth";
import { gzipSync } from "zlib";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  
  // Check API key authentication
  if (!validateApiKey(request)) {
    return createAuthErrorResponse();
  }
  
  const startTime = Date.now();
  console.log(`[MATCH] Starting request at ${new Date().toISOString()}`);

  const body = await request.json();
  const ingredients = (body?.ingredients ?? []) as string[];
  const instructions = body?.instructions as string | undefined;
  const recipeSlug = body?.recipeSlug as string | undefined;
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return new Response("Bad Request", { status: 400 });
  }

  // Check recipe cache if recipeSlug is provided
  if (recipeSlug) {
    const cached = await getCachedRecipe(recipeSlug);
    if (cached) {
      console.log(`[MATCH] Cache hit for recipe ${recipeSlug} (${cached.hit_count + 1} hits)`);
      return new Response(JSON.stringify({ results: cached.results }), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'X-Cache-Hits': cached.hit_count.toString(),
        },
      });
    }
  }

  const embeddingStart = Date.now();
  const embeddings = await getEmbeddings(ingredients, instructions);
  console.log(`[MATCH] Embeddings took ${Date.now() - embeddingStart}ms`);
  
  const dbStart = Date.now();
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
      // Use single optimized query with UNION for better performance
      const unionQueries = validEmbeddings.map(({ embedding, index }) => {
        const embLiteral = `[${embedding.join(",")}]`;
        return `(
          SELECT ${index} as query_index, id_text, title, title_original, pimid, 
                 1 - (embedding <=> '${embLiteral}'::vector) AS score
          FROM products
          WHERE embedding IS NOT NULL
          ORDER BY embedding <-> '${embLiteral}'::vector
          LIMIT 3
        )`;
      });
      
      const unionQuery = unionQueries.join(' UNION ALL ');
      const queryResult = await client.query(unionQuery);
      
      // Group results by query index
      const resultsByIndex = new Map<number, any[]>();
      for (const row of queryResult.rows) {
        const index = row.query_index;
        if (!resultsByIndex.has(index)) {
          resultsByIndex.set(index, []);
        }
        resultsByIndex.get(index)!.push(row);
      }
      
      // Process results in original order
      for (const { index, ingredient } of validEmbeddings) {
        const rows = resultsByIndex.get(index) || [];
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
    console.log(`[MATCH] Database query took ${Date.now() - dbStart}ms`);
    
    // Cache the results if recipeSlug is provided
    if (recipeSlug) {
      try {
        await setCachedRecipe(recipeSlug, simplified);
        console.log(`[MATCH] Cached results for recipe ${recipeSlug}`);
      } catch (error) {
        console.error(`[MATCH] Failed to cache results for recipe ${recipeSlug}:`, error);
      }
    }
    
    const jsonResponse = JSON.stringify({ results: simplified });
    
    const totalTime = Date.now() - startTime;
    console.log(`[MATCH] Total request time: ${totalTime}ms, response size: ${jsonResponse.length} bytes`);
    
    return new Response(jsonResponse, {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
      },
    });
  } finally {
    client.release();
  }
}

export const loader = () => new Response("Not Found", { status: 404 });

