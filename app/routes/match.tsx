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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const ingredients = formData.get('ingredients') as string;
    const response = await fetch('/api/match', {
      method: 'POST',
      body: JSON.stringify({ 
        ingredients: ingredients.split('\n')
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    setMatches(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <h1>Matches</h1>
        <p>Loading...</p>
      </div>
    );
  }

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
                  className="w-full h-24 p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm" 
                  defaultValue={["tomat", "agurk", "kombucha"].join("\n")}
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
          <div className="bg-white p-4 rounded-lg shadow-sm border min-h-[300px]">
            <h2 className="text-base font-semibold mb-3">Results</h2>
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-gray-500 text-sm">Loading matches...</div>
              </div>
            ) : matches?.results && matches.results.length > 0 ? (
              <div className="space-y-4">
                {matches.results.map((match) => (
                  <div key={match.ingredient} className="border-b border-gray-200 pb-3 last:border-b-0">
                    <h3 className="font-semibold text-base text-gray-800 mb-2">{match.ingredient}</h3>
                    <div className="space-y-1">
                      {match.matches.map((m, index) => (
                        <div key={m.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 text-sm">{m.title}</div>
                            <div className="text-xs text-gray-500">ID: {m.id}</div>
                          </div>
                          <div className="text-xs font-medium text-blue-600">
                            {Math.round(m.score * 100)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
                Enter ingredients and click "Find Matches" to see results
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


