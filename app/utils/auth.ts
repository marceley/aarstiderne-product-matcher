export function validateApiKey(request: Request): boolean {
  const apiKey = process.env.API_KEY;
  
  // If no API key is set, allow access (for development)
  if (!apiKey) {
    return true;
  }
  
  // Check for API key in Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return token === apiKey;
  }
  
  // Check for API key in X-API-Key header
  const apiKeyHeader = request.headers.get('X-API-Key');
  if (apiKeyHeader) {
    return apiKeyHeader === apiKey;
  }
  
  return false;
}

export function createAuthErrorResponse(): Response {
  return new Response(JSON.stringify({
    status: "error",
    error: {
      code: "UNAUTHORIZED",
      message: "API key required",
      details: "Include your API key in the Authorization header (Bearer <key>) or X-API-Key header"
    },
    timestamp: new Date().toISOString()
  }), { 
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}
