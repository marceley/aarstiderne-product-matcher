import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),
  route("api/scrape", "routes/api.scrape.ts"),
  route("api/match", "routes/api.match.ts"),
  route("api/match-production", "routes/api.match-production.ts"),
  route("api/products", "routes/api.products.ts"),
  route("api/extract-recipe", "routes/api.extract-recipe.ts"),
  route("api/tokens", "routes/api.tokens.ts"),
  route("products", "routes/products.tsx"),
  route("match", "routes/match.tsx"),
  route("test-production", "routes/test-production.tsx"),
] satisfies RouteConfig;
