import { useEffect, useState } from "react";

// Types generated from the example JSON response
type MatchResult = {
  ingredient: string;
  matches: {
    id: string;
    title: string;
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
  const [ingredients, setIngredients] = useState("tomat\nagurk\nkombucha");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const ingredientsText = formData.get('ingredients') as string;
    setIngredients(ingredientsText);
    const response = await fetch('/api/match', {
      method: 'POST',
      body: JSON.stringify({ 
        ingredients: ingredientsText.split('\n')
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
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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


