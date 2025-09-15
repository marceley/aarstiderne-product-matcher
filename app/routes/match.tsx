import { useEffect, useState } from "react";

// Types generated from the example JSON response
type MatchResult = {
  ingredient: string;
  matches: {
    id: string;
    title: string;
    title_original: string;
    score: number;
  }[];
};

type MatchApiResponse = {
  results: MatchResult[];
};

export default function Match() {
  const [matches, setMatches] = useState<MatchApiResponse>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState("løg\nsquash\ningefær\nghee/smør\nmadraskarry\nkikærtemel\nsødmælksyoghurt\nvinterspinat eller anden frisk spinat\nhel spidskommen\nkorianderfrø\nsennepsfrø\nsesamfrø\nnigellafrø");
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
      const response = await fetch('/api/extract-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: recipeUrl }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to extract recipe: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.ingredients && data.ingredients.length > 0) {
        const ingredientsText = data.ingredients.join('\n');
        setIngredients(ingredientsText);
        setRecipeUrl(""); // Clear the URL field
        
        // Automatically run the matching after successful extraction
        setLoading(true);
        setError(null);
        try {
          const matchResponse = await fetch('/api/match', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              ingredients: data.ingredients,
              recipeSlug: recipeSlug || extractedSlug || undefined
            }),
          });
          
          if (!matchResponse.ok) {
            throw new Error(`HTTP error! status: ${matchResponse.status}`);
          }
          
          const matchData = await matchResponse.json();
          setMatches(matchData);
        } catch (matchError) {
          console.error('Match error:', matchError);
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
    const formData = new FormData(e.target as HTMLFormElement);
    const ingredientsText = formData.get('ingredients') as string;
    setIngredients(ingredientsText);
    const response = await fetch('/api/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        ingredients: ingredientsText.split('\n'),
        recipeSlug: recipeSlug || undefined
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    setMatches(data);
    setLoading(false);
  };

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <h1>Matches</h1>
        <p style={{ color: 'red' }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Product Matcher</h1>
      
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
                Find Matches
              </button>
            </form>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="w-1/2">
          <div className="bg-white p-4 rounded-lg shadow-sm border h-[600px] flex flex-col">
            <h2 className="text-base font-semibold mb-3">Results</h2>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="text-gray-500 text-sm">Loading matches...</div>
              </div>
            ) : matches?.results && matches.results.length > 0 ? (
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                <div className="p-2 bg-gray-50 rounded text-sm mb-3 sticky top-0 z-10">
                  {(() => {
                    const topScoreCount = matches.results.filter(match => 
                      match.matches.length > 0 && Math.round(match.matches[0].score * 100) >= 95
                    ).length;
                    const totalIngredients = matches.results.length;
                    return `${topScoreCount} of ${totalIngredients} ingredients found excellent matches (95%+)`;
                  })()}
                </div>
                  {matches.results.map((match) => (
                  <div key={match.ingredient} className="border-b border-gray-200 pb-3 last:border-b-0">
                    <h3 className="font-semibold text-base text-gray-800 mb-2">{match.ingredient}</h3>
                    <div className="space-y-1">
                      {match.matches.map((m, index) => {
                        const scorePercent = Math.round(m.score * 100);
                        let bgColor = 'bg-gray-50';
                        let textColor = 'text-gray-600';
                        let borderColor = 'border-gray-300';
                        
                        if (scorePercent >= 95) {
                          bgColor = 'bg-green-50';
                          textColor = 'text-green-700';
                          borderColor = 'border-green-300';
                        } else if (scorePercent >= 90) {
                          bgColor = 'bg-yellow-50';
                          textColor = 'text-yellow-700';
                          borderColor = 'border-yellow-300';
                        } else {
                          bgColor = 'bg-red-50';
                          textColor = 'text-red-700';
                          borderColor = 'border-red-300';
                        }
                        
                        return (
                          <div key={m.id} className={`flex items-center justify-between p-2 ${bgColor} rounded-md border-l-4 ${borderColor}`}>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 text-sm">{m.title}</div>
                              {m.title_original && m.title_original !== m.title && (
                                <div className="text-xs text-gray-500 italic">Original: {m.title_original}</div>
                              )}
                              <div className="text-xs text-gray-500">ID: {m.id}</div>
                            </div>
                            <div className={`text-xs font-medium ${textColor}`}>
                              {scorePercent}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center flex-1 text-gray-500 text-sm">
                Enter ingredients and click "Find Matches" to see results
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


