import type { ActionFunctionArgs } from "react-router";
import pkg from "he";
const { decode } = pkg;

export async function action({ request }: ActionFunctionArgs) {
  // Check API key
  const apiKey = request.headers.get('X-Api-Key');
  const expectedKey = process.env.BASIC_API_KEY;
  
  if (!expectedKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (!apiKey || apiKey !== expectedKey) {
    return new Response(JSON.stringify({ error: "Invalid API key" }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return new Response("Invalid URL", { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return new Response("Invalid URL format", { status: 400 });
    }

    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RecipeExtractor/1.0)',
      },
    });

    if (!response.ok) {
      return new Response(`Failed to fetch webpage: ${response.status}`, { status: 400 });
    }

    const html = await response.text();

    // Extract ingredients using the specified selectors
    const ingredients = extractIngredients(html);

    return Response.json({ 
      success: true, 
      ingredients,
      count: ingredients.length 
    });

  } catch (error) {
    console.error('Recipe extraction error:', error);
    return new Response("Internal server error", { status: 500 });
  }
}

function extractIngredients(html: string): string[] {
  try {
    console.log('Extracting ingredients from HTML...');
    
    // First, let's try multiple approaches to find ingredients
    const ingredients: string[] = [];
    
    // Approach 1: Look for itemprop="recipeIngredient" with nested data-property="Name"
    const approach1Regex = /<[^>]*itemprop="recipeIngredient"[^>]*>[\s\S]*?<[^>]*data-property="Name"[^>]*>([^<]+)<\/[^>]*>/gi;
    let match;
    
    while ((match = approach1Regex.exec(html)) !== null) {
      const ingredient = decodeHtmlEntities(match[1].trim());
      if (ingredient && !ingredients.includes(ingredient)) {
        ingredients.push(ingredient);
      }
    }
    
    console.log(`Approach 1 found ${ingredients.length} ingredients`);
    
    // Approach 2: Look for any element with itemprop="recipeIngredient" and extract text content
    if (ingredients.length === 0) {
      const approach2Regex = /<[^>]*itemprop="recipeIngredient"[^>]*>([^<]+)<\/[^>]*>/gi;
      
      while ((match = approach2Regex.exec(html)) !== null) {
        const ingredient = decodeHtmlEntities(match[1].trim());
        if (ingredient && !ingredients.includes(ingredient)) {
          ingredients.push(ingredient);
        }
      }
      
      console.log(`Approach 2 found ${ingredients.length} ingredients`);
    }
    
    // Approach 3: Look for any element with itemprop="recipeIngredient" (more flexible)
    if (ingredients.length === 0) {
      const approach3Regex = /<[^>]*itemprop="recipeIngredient"[^>]*>([\s\S]*?)<\/[^>]*>/gi;
      
      while ((match = approach3Regex.exec(html)) !== null) {
        const text = match[1].replace(/<[^>]*>/g, '').trim(); // Remove any nested HTML tags
        const ingredient = decodeHtmlEntities(text);
        if (ingredient && !ingredients.includes(ingredient)) {
          ingredients.push(ingredient);
        }
      }
      
      console.log(`Approach 3 found ${ingredients.length} ingredients`);
    }
    
    // Approach 4: Look for any element containing "recipeIngredient" (case insensitive)
    if (ingredients.length === 0) {
      const approach4Regex = /<[^>]*recipeIngredient[^>]*>([\s\S]*?)<\/[^>]*>/gi;
      
      while ((match = approach4Regex.exec(html)) !== null) {
        const text = match[1].replace(/<[^>]*>/g, '').trim();
        const ingredient = decodeHtmlEntities(text);
        if (ingredient && !ingredients.includes(ingredient)) {
          ingredients.push(ingredient);
        }
      }
      
      console.log(`Approach 4 found ${ingredients.length} ingredients`);
    }
    
    // Debug: Log a sample of the HTML to see what we're working with
    if (ingredients.length === 0) {
      console.log('No ingredients found. Sample HTML around "recipeIngredient":');
      const sampleMatch = html.match(/[\s\S]{0,200}recipeIngredient[\s\S]{0,200}/i);
      if (sampleMatch) {
        console.log(sampleMatch[0]);
      } else {
        console.log('No "recipeIngredient" found in HTML');
      }
    }

    return ingredients;
  } catch (error) {
    console.error('Error extracting ingredients:', error);
    return [];
  }
}

function decodeHtmlEntities(text: string): string {
  // Use the 'he' library for proper HTML entity decoding
  return decode(text);
}

export const loader = () => new Response("Not Found", { status: 404 });
