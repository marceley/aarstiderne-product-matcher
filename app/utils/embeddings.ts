import { embedMany } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function getEmbeddings(texts: string[], instructions?: string): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Default instruction that's always applied
  const defaultInstruction = "Prioriter match på titel og derefter description.";
  
  // Prepare inputs: embed only non-empty strings to satisfy API validation
  const normalized = texts.map((t) => (t ?? "").toString().trim());
  const indicesToEmbed: number[] = [];
  const valuesToEmbed: string[] = [];
  
  for (let i = 0; i < normalized.length; i++) {
    if (normalized[i].length > 0) {
      indicesToEmbed.push(i);
      // Combine default instruction with optional custom instructions
      const allInstructions = instructions 
        ? `${defaultInstruction}\n\nAdditional instructions: ${instructions}`
        : defaultInstruction;
      const textWithContext = `${allInstructions}\n\nIngredient: ${normalized[i]}`;
      valuesToEmbed.push(textWithContext);
    }
  }

  let embedded: number[][] = [];
  if (valuesToEmbed.length > 0) {
    const { embeddings } = await embedMany({
      model: openai.embedding("text-embedding-3-small"),
      values: valuesToEmbed,
    });
    embedded = embeddings.map((e) => e as unknown as number[]);
  }

  // Reconstruct result aligned to original input order
  const result: (number[] | null)[] = Array(texts.length).fill(null);
  for (let i = 0; i < indicesToEmbed.length; i++) {
    result[indicesToEmbed[i]] = embedded[i] ?? null;
  }

  // Replace nulls with empty arrays to match return type number[][]
  return result.map((e) => e ?? []);
}