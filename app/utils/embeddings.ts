import { embedMany } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { encoding_for_model } from "tiktoken";
 
// Centralized embedding model name for easy changes
const EMBEDDING_MODEL = "text-embedding-3-small";

// Require Vercel AI Gateway to be configured
const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
if (!gatewayKey) {
  throw new Error("AI_GATEWAY_API_KEY environment variable is required");
}

// Simple in-memory cache for embeddings with size limit
const embeddingCache = new Map<string, number[]>();
const MAX_CACHE_SIZE = 1000; // Limit cache size to prevent memory issues

export async function getEmbeddings(texts: string[], instructions?: string): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  const startTime = Date.now();

  // Default instruction that's always applied
  const defaultInstruction = "Prioriter match på feltet title og derefter feltet description.";
  
  // Prepare inputs: embed only non-empty strings to satisfy API validation
  const normalized = texts.map((t) => (t ?? "").toString().trim().toLowerCase());
  const indicesToEmbed: number[] = [];
  const valuesToEmbed: string[] = [];
  
  for (let i = 0; i < normalized.length; i++) {
    if (normalized[i].length > 0) {
      indicesToEmbed.push(i);
      // Combine default instruction with optional custom instructions
      const allInstructions = instructions 
        ? `${defaultInstruction}\n\nAdditional instructions: ${instructions}`
        : defaultInstruction;
      const textWithContext = `${allInstructions}\n\nIngrediens: ${normalized[i]}`;
      valuesToEmbed.push(textWithContext);
    }
  }
  
  let uncachedValues: string[] = [];

  let embedded: (number[] | null)[] = [];
  if (valuesToEmbed.length > 0) {
    // Check cache first and separate cached vs uncached
    const uncachedIndices: number[] = [];
    const cachedEmbeddings: (number[] | null)[] = Array(valuesToEmbed.length).fill(null);
    
    for (let i = 0; i < valuesToEmbed.length; i++) {
      const value = valuesToEmbed[i];
      const cached = embeddingCache.get(value);
      if (cached) {
        cachedEmbeddings[i] = cached;
      } else {
        uncachedValues.push(value);
        uncachedIndices.push(i);
      }
    }
    
    // Get embeddings for uncached values in a single batch request
    if (uncachedValues.length > 0) {
      console.log(`Batch embedding request for ${uncachedValues.length} uncached ingredients`);
      const { embeddings } = await embedMany({
        model: `openai/${EMBEDDING_MODEL}`,
        values: uncachedValues,
      });
      
      // Cache the new embeddings and add to results
      for (let i = 0; i < uncachedValues.length; i++) {
        const embedding = embeddings[i] as unknown as number[];
        
        // Add to cache with size limit
        if (embeddingCache.size >= MAX_CACHE_SIZE) {
          // Remove oldest entry (simple LRU)
          const firstKey = embeddingCache.keys().next().value;
          if (firstKey) {
            embeddingCache.delete(firstKey);
          }
        }
        embeddingCache.set(uncachedValues[i], embedding);
        cachedEmbeddings[uncachedIndices[i]] = embedding;
      }
    }
    
    embedded = cachedEmbeddings;
  }

  // Reconstruct result aligned to original input order
  const result: (number[] | null)[] = Array(texts.length).fill(null);
  for (let i = 0; i < indicesToEmbed.length; i++) {
    result[indicesToEmbed[i]] = embedded[i] ?? null;
  }

  // Replace nulls with empty arrays to match return type number[][]
  const finalResult = result.map((e) => e ?? []);
  
  // Calculate token usage
  const encoding = encoding_for_model(EMBEDDING_MODEL);
  const totalTokens = valuesToEmbed.reduce((sum, text) => sum + encoding.encode(text).length, 0);
  const newTokens = uncachedValues.reduce((sum, text) => sum + encoding.encode(text).length, 0);
  
  // Log performance metrics
  const totalTime = Date.now() - startTime;
  const cacheHitRate = (valuesToEmbed.length - uncachedValues.length) / valuesToEmbed.length * 100;
  console.log(`Embedding performance: ${totalTime}ms total, ${uncachedValues.length} new, ${Math.round(cacheHitRate)}% cache hit rate, ${totalTokens} total tokens, ${newTokens} new tokens`);
  
  return finalResult;
}