import { encoding_for_model } from "tiktoken";

// Get the encoding for the embedding model we use
const encoding = encoding_for_model("text-embedding-3-small");

export function calculateTokens(text: string): number {
  return encoding.encode(text).length;
}

export function calculateTokensForIngredients(ingredients: string[], instructions?: string): {
  totalTokens: number;
  breakdown: { ingredient: string; tokens: number; textWithContext: string }[];
} {
  const defaultInstruction = "Prioriter match på titel og derefter description.";
  
  const breakdown = ingredients.map(ingredient => {
    const normalized = ingredient.trim().toLowerCase();
    const allInstructions = instructions 
      ? `${defaultInstruction}\n\nAdditional instructions: ${instructions}`
      : defaultInstruction;
    const textWithContext = `${allInstructions}\n\nIngredient: ${normalized}`;
    const tokens = calculateTokens(textWithContext);
    
    return {
      ingredient: normalized,
      tokens,
      textWithContext
    };
  });
  
  const totalTokens = breakdown.reduce((sum, item) => sum + item.tokens, 0);
  
  return {
    totalTokens,
    breakdown
  };
}

// Cost calculation (as of 2024)
export function calculateCost(tokens: number): number {
  // text-embedding-3-small: $0.00002 per 1K tokens
  return (tokens / 1000) * 0.00002;
}
