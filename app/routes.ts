import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("api/scrape", "routes/api.scrape.ts"),
  route("api/match", "routes/api.match.ts"),
  route("products", "routes/products.tsx"),
] satisfies RouteConfig;
