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
    const instructions = formData.get('instructions') as string;
    const response = await fetch('/api/match', {
      method: 'POST',
      body: JSON.stringify({ 
        ingredients: ingredients.split('\n'),
        instructions: instructions || undefined
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
    <div className="p-4">
      <h1>Match test</h1>
      <div className="flex flex-col gap-2">
        <h2>List matches</h2>
        <div>
          {matches?.results.map((match) => (
            <div key={match.ingredient} className="mb-8">
              <h2 className="font-bold text-lg">{match.ingredient}</h2>
              <ul className="m-0 p-0">
                {match.matches.map((m) => (
                  <li key={m.id}>{m.title} ({m.id}) ({m.score})</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="ingredients" className="block text-sm font-medium mb-2">Ingredients (one per line):</label>
          <textarea 
            id="ingredients"
            name="ingredients" 
            placeholder="Enter ingredients, one per line" 
            className="w-full h-32 p-2 border border-gray-300 rounded-md" 
            defaultValue={["tomat", "agurk", "kombucha"].join("\n")}
          />
        </div>
        <div>
          <label htmlFor="instructions" className="block text-sm font-medium mb-2">Instructions (optional):</label>
          <textarea 
            id="instructions"
            name="instructions" 
            placeholder="e.g., 'Find organic products only' or 'Prefer local Danish products'" 
            className="w-full h-24 p-2 border border-gray-300 rounded-md"
          />
        </div>
        <button type="submit" className="bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600">Match</button>
      </form>
    </div>
  );
}


