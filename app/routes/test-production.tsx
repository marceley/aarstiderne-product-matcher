import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  return {
    apiKey: process.env.API_KEY || null
  };
}

type ProductionApiResponse = {
  status: string;
  ids: number[];
};

export default function TestProduction() {
  const { apiKey } = useLoaderData<typeof loader>();
  const [results, setResults] = useState<ProductionApiResponse>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState("");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [recipeSlug, setRecipeSlug] = useState("");

  // Function to extract slug from URL
  const extractSlugFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
      // Get the last part of the path as the slug, use as-is
      return pathParts[pathParts.length - 1] || '';
    } catch {
      return '';
    }
  };

  const handleRecipeExtract = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!recipeUrl.trim()) return;
    
    // Extract slug from URL and set it
    const extractedSlug = extractSlugFromUrl(recipeUrl);
    if (extractedSlug) {
      setRecipeSlug(extractedSlug);
    }
    
    setExtracting(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const response = await fetch('/api/extract-recipe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: recipeUrl }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to extract recipe: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.ingredients && data.ingredients.length > 0) {
        const ingredientsText = data.ingredients.join('\n');
        setIngredients(ingredientsText);
        // Keep the URL in the field instead of clearing it
        
        // Automatically run the production matching after successful extraction
        setLoading(true);
        setError(null);
        try {
          const matchHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          
          if (apiKey) {
            matchHeaders['Authorization'] = `Bearer ${apiKey}`;
          }
          
          const matchResponse = await fetch('/api/match-production', {
            method: 'POST',
            headers: matchHeaders,
            body: JSON.stringify({ 
              ingredients: data.ingredients,
              recipeSlug: recipeSlug || extractedSlug || undefined
            }),
          });
          
          if (!matchResponse.ok) {
            throw new Error(`HTTP error! status: ${matchResponse.status}`);
          }
          
          const matchData = await matchResponse.json();
          setResults(matchData);
        } catch (matchError) {
          console.error('Production match error:', matchError);
          setError(matchError instanceof Error ? matchError.message : 'Failed to find matches');
        } finally {
          setLoading(false);
        }
      } else {
        alert('No ingredients found in the recipe. Please check the URL or try a different recipe.');
      }
    } catch (error) {
      console.error('Recipe extraction error:', error);
      alert('Failed to extract ingredients from the recipe. Please check the URL and try again.');
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.target as HTMLFormElement);
    const ingredientsText = formData.get('ingredients') as string;
    setIngredients(ingredientsText);
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const response = await fetch('/api/match-production', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          ingredients: ingredientsText.split('\n')
          // Note: Not sending recipeSlug to bypass cache and force fresh search
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Production match error:', error);
      setError(error instanceof Error ? error.message : 'Failed to find matches');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <h1>Production API Test</h1>
        <p style={{ color: 'red' }}>Error: {error}</p>
        <button 
          onClick={() => setError(null)}
          className="bg-blue-500 text-white py-2 px-3 rounded-md hover:bg-blue-600 transition-colors font-medium text-sm mt-2"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Production API Test</h1>
      <p className="text-sm text-gray-600 mb-6">
        Test the <code>/api/match-production</code> endpoint that returns only product IDs for production use.
      </p>
      
      <div className="flex gap-6">
        {/* Left Column - Form */}
        <div className="w-1/2">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <h2 className="text-base font-semibold mb-3">Ingredients</h2>
            
            {/* Recipe URL Form */}
            <div className="mb-6 pb-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold mb-2 text-gray-800">Extract from Recipe URL</h3>
              <p className="text-xs text-gray-600 mb-3">
                Paste a recipe URL to automatically extract ingredients.
              </p>
              <form onSubmit={handleRecipeExtract} className="flex gap-2">
                <input
                  type="url"
                  value={recipeUrl}
                  onChange={(e) => {
                    setRecipeUrl(e.target.value);
                    // Auto-extract slug from URL as user types
                    const extractedSlug = extractSlugFromUrl(e.target.value);
                    if (extractedSlug) {
                      setRecipeSlug(extractedSlug);
                    }
                  }}
                  placeholder="https://example.com/recipe"
                  className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                  disabled={extracting}
                />
                <button
                  type="submit"
                  disabled={extracting || !recipeUrl.trim()}
                  className="bg-green-500 text-white py-2 px-3 rounded-md hover:bg-green-600 transition-colors font-medium text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {extracting ? 'Extracting...' : 'Extract'}
                </button>
              </form>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label htmlFor="recipeSlug" className="block text-sm font-medium mb-1 text-gray-700">
                  Recipe Slug (optional, for caching):
                </label>
                <input
                  id="recipeSlug"
                  name="recipeSlug"
                  type="text"
                  placeholder="e.g., rice-bowl-med-misobagt-aubergine"
                  className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 text-sm"
                  value={recipeSlug}
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">
                  Slug is automatically extracted from recipe URLs above for caching (1 month TTL).
                </p>
              </div>
              <div>
                <label htmlFor="ingredients" className="block text-sm font-medium mb-1 text-gray-700">
                  Ingredients (one per line):
                </label>
                <textarea 
                  id="ingredients"
                  name="ingredients" 
                  placeholder="Enter ingredients, one per line" 
                  className="w-full h-48 p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm" 
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  rows={12}
                />
              </div>
              <button 
                type="submit" 
                className="bg-blue-500 text-white py-2 px-3 rounded-md hover:bg-blue-600 transition-colors font-medium text-sm"
              >
                Test Production API
              </button>
            </form>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="w-1/2">
          <div className="bg-white p-4 rounded-lg shadow-sm border h-[600px] flex flex-col">
            <h2 className="text-base font-semibold mb-3">Production Results</h2>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="text-gray-500 text-sm">Loading production matches...</div>
              </div>
            ) : results && results.ids.length > 0 ? (
              <div className="flex-1 overflow-y-auto">
                <div className="p-2 bg-green-50 rounded text-sm mb-3 border-l-4 border-green-300">
                  <div className="flex justify-between items-center">
                    <span>Found {results.ids.length} product matches</span>
                    <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">
                      Success
                    </span>
                  </div>
                </div>
                
                
                <div className="p-3 bg-gray-100 rounded text-xs">
                  <strong>Product IDs for Production:</strong>
                  <div className="mt-1 text-xs font-mono">
                    [{results.ids.join(', ')}]
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
                  <strong>Raw JSON Response:</strong>
                  <pre className="mt-1 text-xs overflow-x-auto">
                    {JSON.stringify(results, null, 2)}
                  </pre>
                </div>
              </div>
            ) : results && results.ids.length === 0 ? (
              <div className="flex-1 overflow-y-auto">
                <div className="p-2 bg-yellow-50 rounded text-sm mb-3 border-l-4 border-yellow-300">
                  <div className="flex justify-between items-center">
                    <span>No product matches found</span>
                    <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-700">
                      No Matches
                    </span>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
                  <strong>Raw JSON Response:</strong>
                  <pre className="mt-1 text-xs overflow-x-auto">
                    {JSON.stringify(results, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center flex-1 text-gray-500 text-sm">
                Enter ingredients and click "Test Production API" to see results
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
