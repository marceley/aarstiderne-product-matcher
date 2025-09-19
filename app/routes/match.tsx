import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

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

export async function loader({ request }: LoaderFunctionArgs) {
  return {
    excellentThreshold: parseInt(process.env.EXCELLENT_MATCH_THRESHOLD || "95", 10)
  };
}

export default function Match() {
  const { excellentThreshold } = useLoaderData<typeof loader>();
  const [matches, setMatches] = useState<MatchApiResponse>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState("");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [recipeSlug, setRecipeSlug] = useState("");
  const [expandedIngredients, setExpandedIngredients] = useState<Set<string>>(new Set());
  const [showingSuggestions, setShowingSuggestions] = useState<Set<string>>(new Set());

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

  // Function to toggle expanded state for an ingredient
  const toggleExpanded = (ingredient: string) => {
    const newExpanded = new Set(expandedIngredients);
    if (newExpanded.has(ingredient)) {
      newExpanded.delete(ingredient);
    } else {
      newExpanded.add(ingredient);
    }
    setExpandedIngredients(newExpanded);
  };

  // Function to toggle suggestions for an ingredient
  const toggleSuggestions = (ingredient: string) => {
    const newShowing = new Set(showingSuggestions);
    if (newShowing.has(ingredient)) {
      newShowing.delete(ingredient);
    } else {
      newShowing.add(ingredient);
    }
    setShowingSuggestions(newShowing);
  };

  // Function to generate suggestions for Danish ingredients
  const generateSuggestions = (ingredient: string): string[] => {
    const suggestions: string[] = [];
    const lowerIngredient = ingredient.toLowerCase().trim();

    // Split compound ingredients
    if (lowerIngredient.includes(' og ')) {
      const parts = lowerIngredient.split(' og ');
      if (parts.length === 2) {
        // Suggest individual ingredients
        suggestions.push(parts[0].trim());
        suggestions.push(parts[1].trim());
        // Also suggest comma-separated version
        suggestions.push(`${parts[0].trim()}, ${parts[1].trim()}`);
      }
    }

    // Remove measurements
    const measurementPattern = /^\d+\s*(dl|tsk|spsk|g|kg|l|ml|stk|stykker?|både?|fed|fedder?)\s+/i;
    if (measurementPattern.test(lowerIngredient)) {
      const withoutMeasurement = lowerIngredient.replace(measurementPattern, '').trim();
      if (withoutMeasurement) {
        suggestions.push(withoutMeasurement);
      }
    }

    // Remove preparation terms
    const preparationTerms = ['finthakket', 'groft hakket', 'skåret', 'revet', 'presset', 'hældt', 'tilsat', 'blandet'];
    for (const term of preparationTerms) {
      if (lowerIngredient.includes(term)) {
        const withoutPrep = lowerIngredient.replace(new RegExp(term + '\\s*', 'gi'), '').trim();
        if (withoutPrep) {
          suggestions.push(withoutPrep);
        }
      }
    }

    // Remove extra descriptors
    const descriptors = ['frisk', 'tørret', 'røget', 'marineret', 'kogt', 'stegt'];
    for (const desc of descriptors) {
      if (lowerIngredient.includes(desc)) {
        const withoutDesc = lowerIngredient.replace(new RegExp(desc + '\\s*', 'gi'), '').trim();
        if (withoutDesc && withoutDesc !== lowerIngredient) {
          suggestions.push(withoutDesc);
        }
      }
    }

    // Remove parentheses content
    if (lowerIngredient.includes('(') && lowerIngredient.includes(')')) {
      const withoutParens = lowerIngredient.replace(/\([^)]*\)/g, '').trim();
      if (withoutParens) {
        suggestions.push(withoutParens);
      }
    }

    // Capitalize first letter for suggestions
    return suggestions.map(s => s.charAt(0).toUpperCase() + s.slice(1)).filter((s, i, arr) => arr.indexOf(s) === i);
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
        // Keep the URL in the field instead of clearing it
        
        // Automatically run the matching after successful extraction
        setLoading(true);
        setError(null);
        try {
          const matchResponse = await fetch('/api/ingredients/match-dev', {
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
    setError(null);
    const formData = new FormData(e.target as HTMLFormElement);
    const ingredientsText = formData.get('ingredients') as string;
    setIngredients(ingredientsText);
    
    try {
      const response = await fetch('/api/ingredients/match-dev', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          ingredients: ingredientsText.split('\n')
          // Note: Not sending recipeSlug to bypass cache and force fresh search
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setMatches(data);
    } catch (error) {
      console.error('Match error:', error);
      setError(error instanceof Error ? error.message : 'Failed to find matches');
    } finally {
      setLoading(false);
    }
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
    <div className="w-full px-6 py-4">
      <h1 className="text-xl font-bold mb-4">Produkt Matcher</h1>
      
      <div className="flex gap-6">
        {/* Left Column - Form */}
        <div className="flex-1">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <h2 className="text-base font-semibold mb-3">Ingredienser</h2>
            
            {/* Recipe URL Form */}
            <div className="mb-6 pb-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold mb-2 text-gray-800">Udtræk fra Opskrift URL</h3>
              <p className="text-xs text-gray-600 mb-3">
                Indsæt en opskrift URL for automatisk at udtrække ingredienser.
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
                  placeholder="https://eksempel.dk/opskrift"
                  className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                  disabled={extracting}
                />
                <button
                  type="submit"
                  disabled={extracting || !recipeUrl.trim()}
                  className="bg-green-500 text-white py-2 px-3 rounded-md hover:bg-green-600 transition-colors font-medium text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {extracting ? 'Udtrækker...' : 'Udtræk'}
                </button>
              </form>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label htmlFor="recipeSlug" className="block text-sm font-medium mb-1 text-gray-700">
                  Opskrift Slug (bruges som nøgle til caching):
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
                  Slug udtrækkes automatisk fra opskrift URLs ovenfor til caching (1 måned TTL).
                </p>
              </div>
              <div>
                <label htmlFor="ingredients" className="block text-sm font-medium mb-1 text-gray-700">
                  Ingredienser (én per linje):
                </label>
                <textarea 
                  id="ingredients"
                  name="ingredients" 
                  placeholder="Indtast ingredienser, én per linje" 
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
                Søg Matches
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Dette vil omgå cachen og udføre en ny søgning med de aktuelle ingredienser.
              </p>
            </form>
          </div>
        </div>

        {/* Middle Column - High Confidence Results (>=95%) */}
        <div className="flex-1">
          <div className="bg-white p-4 rounded-lg shadow-sm border h-[600px] flex flex-col">
            <h2 className="text-base font-semibold mb-3">
              Fremragende Matches ({excellentThreshold}%+)
              {matches?.results && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  ({matches.results.filter(match => 
                    match.matches.length > 0 && Math.round(match.matches[0].score * 100) >= excellentThreshold
                  ).length} af {matches.results.length} ingredienser)
                </span>
              )}
            </h2>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="text-gray-500 text-sm">Indlæser matches...</div>
              </div>
            ) : matches?.results && matches.results.length > 0 ? (
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {(() => {
                  const highConfidenceResults = matches.results.filter(match => 
                    match.matches.length > 0 && Math.round(match.matches[0].score * 100) >= excellentThreshold
                  );

                  const renderMatchItem = (m: any, index: number) => {
                    const scorePercent = Math.round(m.score * 100);
                    let bgColor = 'bg-gray-50';
                    let textColor = 'text-gray-600';
                    let borderColor = 'border-gray-300';
                    
                    if (scorePercent >= excellentThreshold) {
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
                  };

                  const renderMatchSection = (match: any) => {
                    const isExpanded = expandedIngredients.has(match.ingredient);
                    const hasMultipleMatches = match.matches.length > 1;
                    const visibleMatches = isExpanded ? match.matches : match.matches.slice(0, 1);
                    const topScore = match.matches.length > 0 ? Math.round(match.matches[0].score * 100) : 0;
                    const needsImprovement = topScore < excellentThreshold;
                    const suggestions = needsImprovement ? generateSuggestions(match.ingredient) : [];
                    const hasSuggestions = suggestions.length > 0;
                    const isShowingSuggestions = showingSuggestions.has(match.ingredient);
                    
                    return (
                      <div key={match.ingredient} className="border-b border-gray-200 pb-3 last:border-b-0">
                        <h3 className="font-semibold text-base text-gray-800 mb-2">{match.ingredient}</h3>
                        <div className="space-y-1">
                          {visibleMatches.map((m: any, index: number) => renderMatchItem(m, index))}
                          {hasMultipleMatches && (
                            <div className="flex justify-end mt-2">
                              <button
                                onClick={() => toggleExpanded(match.ingredient)}
                                className="text-xs text-gray-600 hover:text-gray-800 font-medium cursor-pointer"
                              >
                                {isExpanded ? 'Vis mindre' : `Vis ${match.matches.length - 1} flere`}
                              </button>
                            </div>
                          )}
                          {needsImprovement && hasSuggestions && (
                            <div className="mt-2">
                              <div className="flex justify-end mb-2">
                                <button
                                  onClick={() => toggleSuggestions(match.ingredient)}
                                  className="text-xs text-orange-600 hover:text-orange-800 font-medium cursor-pointer"
                                >
                                  {isShowingSuggestions ? 'Skjul forslag' : 'Foreslå forbedringer'}
                                </button>
                              </div>
                              {isShowingSuggestions && (
                                <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                                  <h4 className="text-xs font-semibold text-orange-800 mb-2">Forslag til forbedring:</h4>
                                  <div className="space-y-1">
                                    {suggestions.map((suggestion, index) => (
                                      <div key={index} className="text-sm text-orange-700">
                                        • {suggestion}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  };

                  if (highConfidenceResults.length > 0) {
                    return (
                      <>
                        {highConfidenceResults.map(renderMatchSection)}
                      </>
                    );
                  } else {
                    return (
                      <div className="flex items-center justify-center flex-1 text-gray-500 text-sm">
                        Ingen fremragende matches ({excellentThreshold}%+) fundet
                      </div>
                    );
                  }
                })()}
              </div>
            ) : (
              <div className="flex items-center justify-center flex-1 text-gray-500 text-sm">
                Indtast ingredienser og klik "Søg Matches" for at se resultater
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Lower Confidence Results (<95%) */}
        <div className="flex-1">
          <div className="bg-white p-4 rounded-lg shadow-sm border h-[600px] flex flex-col">
            <h2 className="text-base font-semibold mb-3">
              Andre Matches (&lt;{excellentThreshold}%)
              {matches?.results && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  ({matches.results.filter(match => 
                    match.matches.length === 0 || Math.round(match.matches[0].score * 100) < excellentThreshold
                  ).length} af {matches.results.length} ingredienser)
                </span>
              )}
            </h2>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="text-gray-500 text-sm">Indlæser matches...</div>
              </div>
            ) : matches?.results && matches.results.length > 0 ? (
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {(() => {
                  const lowerConfidenceResults = matches.results.filter(match => 
                    match.matches.length === 0 || Math.round(match.matches[0].score * 100) < excellentThreshold
                  );

                  const renderMatchItem = (m: any, index: number) => {
                    const scorePercent = Math.round(m.score * 100);
                    let bgColor = 'bg-gray-50';
                    let textColor = 'text-gray-600';
                    let borderColor = 'border-gray-300';
                    
                    if (scorePercent >= excellentThreshold) {
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
                  };

                  const renderMatchSection = (match: any) => {
                    const isExpanded = expandedIngredients.has(match.ingredient);
                    const hasMultipleMatches = match.matches.length > 1;
                    const visibleMatches = isExpanded ? match.matches : match.matches.slice(0, 1);
                    const topScore = match.matches.length > 0 ? Math.round(match.matches[0].score * 100) : 0;
                    const needsImprovement = topScore < excellentThreshold;
                    const suggestions = needsImprovement ? generateSuggestions(match.ingredient) : [];
                    const hasSuggestions = suggestions.length > 0;
                    const isShowingSuggestions = showingSuggestions.has(match.ingredient);
                    
                    return (
                      <div key={match.ingredient} className="border-b border-gray-200 pb-3 last:border-b-0">
                        <h3 className="font-semibold text-base text-gray-800 mb-2">{match.ingredient}</h3>
                        <div className="space-y-1">
                          {visibleMatches.map((m: any, index: number) => renderMatchItem(m, index))}
                          {hasMultipleMatches && (
                            <div className="flex justify-end mt-2">
                              <button
                                onClick={() => toggleExpanded(match.ingredient)}
                                className="text-xs text-gray-600 hover:text-gray-800 font-medium cursor-pointer"
                              >
                                {isExpanded ? 'Vis mindre' : `Vis ${match.matches.length - 1} flere`}
                              </button>
                            </div>
                          )}
                          {needsImprovement && hasSuggestions && (
                            <div className="mt-2">
                              <div className="flex justify-end mb-2">
                                <button
                                  onClick={() => toggleSuggestions(match.ingredient)}
                                  className="text-xs text-orange-600 hover:text-orange-800 font-medium cursor-pointer"
                                >
                                  {isShowingSuggestions ? 'Skjul forslag' : 'Foreslå forbedringer'}
                                </button>
                              </div>
                              {isShowingSuggestions && (
                                <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                                  <h4 className="text-xs font-semibold text-orange-800 mb-2">Forslag til forbedring:</h4>
                                  <div className="space-y-1">
                                    {suggestions.map((suggestion, index) => (
                                      <div key={index} className="text-sm text-orange-700">
                                        • {suggestion}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  };

                  if (lowerConfidenceResults.length > 0) {
                    return (
                      <>
                        {lowerConfidenceResults.map(renderMatchSection)}
                      </>
                    );
                  } else {
                    return (
                      <div className="flex items-center justify-center flex-1 text-gray-500 text-sm">
                        Alle matches er fremragende ({excellentThreshold}%+)
                      </div>
                    );
                  }
                })()}
              </div>
            ) : (
              <div className="flex items-center justify-center flex-1 text-gray-500 text-sm">
                Indtast ingredienser og klik "Søg Matches" for at se resultater
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


