import type { ActionFunctionArgs } from "react-router";
import { calculateTokensForIngredients, calculateCost } from "../utils/token-calculator";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await request.json();
    const { ingredients, instructions } = body;

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return new Response("Invalid ingredients", { status: 400 });
    }

    const result = calculateTokensForIngredients(ingredients, instructions);
    const cost = calculateCost(result.totalTokens);

    return Response.json({
      totalTokens: result.totalTokens,
      cost: cost,
      costFormatted: `$${cost.toFixed(6)}`,
      breakdown: result.breakdown
    });

  } catch (error) {
    console.error('Token calculation error:', error);
    return new Response("Internal server error", { status: 500 });
  }
}

export const loader = () => new Response("Not Found", { status: 404 });
