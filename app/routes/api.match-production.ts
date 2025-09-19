import type { ActionFunctionArgs } from "react-router";
import { pool } from "../utils/db";
import { getEmbeddings } from "../utils/embeddings";
import { getCachedRecipe, setCachedRecipe } from "../utils/recipe-cache";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    const errorResponse = {
      status: "error",
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Only POST requests are allowed",
        details: "This endpoint only accepts POST requests"
      },
      timestamp: new Date().toISOString()
    };
    return new Response(JSON.stringify(errorResponse), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const startTime = Date.now();
  console.log(`[PROD-MATCH] Starting request at ${new Date().toISOString()}`);
  
  // Get threshold from environment variable, default to 95, convert to decimal
  const productionThreshold = parseFloat(process.env.EXCELLENT_MATCH_THRESHOLD || "95") / 100;
  const thresholdPercent = Math.round(productionThreshold * 100);

  let body;
  try {
    body = await request.json();
  } catch (error) {
    const errorResponse = {
      status: "error",
      error: {
        code: "INVALID_JSON",
        message: "Invalid JSON in request body",
        details: "The request body must be valid JSON"
      },
      timestamp: new Date().toISOString()
    };
    return new Response(JSON.stringify(errorResponse), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const ingredients = (body?.ingredients ?? []) as string[];
  const instructions = body?.instructions as string | undefined;
  const recipeSlug = body?.recipeSlug as string | undefined;
  
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    const errorResponse = {
      status: "error",
      error: {
        code: "INVALID_INPUT",
        message: "Ingredients array is required and must not be empty",
        details: "The request body must contain a non-empty 'ingredients' array"
      },
      timestamp: new Date().toISOString()
    };
    return new Response(JSON.stringify(errorResponse), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check recipe cache if recipeSlug is provided
  if (recipeSlug) {
    const cached = await getCachedRecipe(recipeSlug);
    if (cached) {
      console.log(`[PROD-MATCH] Cache hit for recipe ${recipeSlug} (${cached.hit_count + 1} hits)`);
      
      // Transform cached results to detailed format
      const details = (cached.results as any[]).map(result => {
        const match = result?.matches?.[0];
        const matched = match && match.score >= productionThreshold;
        return {
          ingredient: result.ingredient,
          matched,
          productId: matched ? parseInt(match.id, 10) : null,
          score: match ? match.score : 0
        };
      });
      
      const ids = details
        .filter(detail => detail.matched && detail.productId && !isNaN(detail.productId))
        .map(detail => detail.productId);
      
      const response = {
        status: "success",
        ids
      };
      
      return new Response(JSON.stringify(response), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'X-Cache-Hits': cached.hit_count.toString(),
        },
      });
    }
  }

  const embeddingStart = Date.now();
  let embeddings;
  try {
    embeddings = await getEmbeddings(ingredients, instructions);
    console.log(`[PROD-MATCH] Embeddings took ${Date.now() - embeddingStart}ms`);
  } catch (error) {
    console.error(`[PROD-MATCH] Embedding error:`, error);
    const errorResponse = {
      status: "error",
      error: {
        code: "EMBEDDING_ERROR",
        message: "Failed to generate embeddings for ingredients",
        details: error instanceof Error ? error.message : "Unknown embedding error"
      },
      timestamp: new Date().toISOString()
    };
    return new Response(JSON.stringify(errorResponse), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const dbStart = Date.now();
  let client;
  try {
    client = await pool.connect();
  } catch (error) {
    console.error(`[PROD-MATCH] Database connection error:`, error);
    const errorResponse = {
      status: "error",
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to connect to database",
        details: error instanceof Error ? error.message : "Unknown database connection error"
      },
      timestamp: new Date().toISOString()
    };
    return new Response(JSON.stringify(errorResponse), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
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
    
    // Single optimized query - get only the best match per ingredient with score > 95%
    const unionQueries = validEmbeddings.map(({ embedding, index }) => {
      const embLiteral = `[${embedding.join(",")}]`;
      return `(
        SELECT ${index} as query_index, 
               CAST(pimid AS INTEGER) as product_id,
               1 - (embedding <=> '${embLiteral}'::vector) AS score
        FROM products
        WHERE embedding IS NOT NULL AND pimid IS NOT NULL AND pimid ~ '^[0-9]+$'
          AND 1 - (embedding <=> '${embLiteral}'::vector) >= ${productionThreshold}
        ORDER BY embedding <-> '${embLiteral}'::vector
        LIMIT 1
      )`;
    });
    
    const unionQuery = unionQueries.join(' UNION ALL ');
    let queryResult;
    try {
      queryResult = await client.query(unionQuery);
    } catch (error) {
      console.error(`[PROD-MATCH] Database query error:`, error);
      const errorResponse = {
        status: "error",
        error: {
          code: "DATABASE_ERROR",
          message: "Failed to query product database",
          details: error instanceof Error ? error.message : "Unknown database query error"
        },
        timestamp: new Date().toISOString()
      };
      return new Response(JSON.stringify(errorResponse), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Build detailed results
    const resultsByIndex = new Map<number, { productId: number; score: number }>();
    
    for (const row of queryResult.rows) {
      resultsByIndex.set(row.query_index, {
        productId: row.product_id,
        score: row.score
      });
    }
    
    // Create details array in the same order as input ingredients
    const details = validEmbeddings.map(({ index, ingredient }) => {
      const result = resultsByIndex.get(index);
      const matched = result && result.score >= productionThreshold;
      return {
        ingredient,
        matched,
        productId: matched ? result.productId : null,
        score: result ? result.score : 0
      };
    });
    
    const ids = details
      .filter(detail => detail.matched && detail.productId && !isNaN(detail.productId))
      .map(detail => detail.productId);
    
    console.log(`[PROD-MATCH] Database query took ${Date.now() - dbStart}ms`);
    
    const response = {
      status: "success",
      ids
    };
    
    const totalTime = Date.now() - startTime;
    console.log(`[PROD-MATCH] Total request time: ${totalTime}ms, returning ${ids.length} product IDs`);
    
    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
      },
    });
    
  } catch (error) {
    console.error(`[PROD-MATCH] Unexpected error:`, error);
    const errorResponse = {
      status: "error",
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown internal error"
      },
      timestamp: new Date().toISOString()
    };
    return new Response(JSON.stringify(errorResponse), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

export const loader = () => new Response("Not Found", { status: 404 });
