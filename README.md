## Aarstiderne Product Matcher

Lille app med to endpoints:

- POST `/api/scrape`: Henter daglig produktfeed, laver embeddings af titler, indsætter i Postgres med pgvector.
- POST `/api/match`: Body `{ "ingredients": ["tomato", "basil"], "recipeSlug": "optional_slug" }` returnerer bedst matchende produkter `{ id, title }`.

### Stack
- React Router 7 (Remix OSS)
- Vercel (deploy), Vercel Cron (23:00 UTC)
- Vercel AI SDK + OpenAI embeddings `text-embedding-3-small`
- Postgres (Neon anbefalet) med `pgvector`

### Opsætning
1) Opret en Postgres DB (Neon) og aktiver `pgvector` extension.
2) Sæt miljøvariabler (lokalt i `.env.local`, på Vercel i Project → Settings → Environment Variables):
   - `AI_GATEWAY_API_KEY` (fra Vercel Dashboard → AI → Gateways → Your Gateway → Gateway Key)
   - Postgres (en af):
     - `DATABASE_URL`
     - eller individuelle variabler: `DATABASE_HOST`, `DATABASE_PORT` (standard 5432), `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`
3) Kør lokalt:
   - `npm run dev`
4) Deploy på Vercel og sæt samme miljøvariabler. Vercel cron er konfigureret i `vercel.json`.

### AI Gateway Krav

- Appen kræver Vercel AI Gateway til embeddings. Miljøvariablen `AI_GATEWAY_API_KEY` skal være sat.
- Hvor det bruges: `app/utils/embeddings.ts` (bruges af `/api/scrape`, `/api/match`, `/api/match-production`).
- Fordele: centraliserede nøgler, caching, rate limits, observability og model/provider failover.
- Opsætning: Installer `@ai-sdk/gateway` pakke (allerede gjort) og sæt `AI_GATEWAY_API_KEY` miljøvariabel.
- Appen vil fejle ved opstart hvis `AI_GATEWAY_API_KEY` ikke er konfigureret.

### Produktion

- Base URL: https://aarstiderne-product-matcher.vercel.app/
- Cron: GET `https://aarstiderne-product-matcher.vercel.app/api/scrape` kører dagligt kl. 23:00 UTC (se `vercel.json`).
- Manuel scrape trigger:

```bash
curl -X POST https://aarstiderne-product-matcher.vercel.app/api/scrape
# eller GET (kompatibel med Vercel Cron)
curl https://aarstiderne-product-matcher.vercel.app/api/scrape
```

- Matching API eksempel:

```bash
curl -X POST https://aarstiderne-product-matcher.vercel.app/api/match \
  -H 'Content-Type: application/json' \
  -d '{"ingredients":["tomato","basil"],"recipeSlug":"rice-bowl-med-misobagt-aubergine"}'
```

### Værktøjer

- Tæl rækker i `products` (bruger `.env.local`):

```bash
bash -lc 'set -a; source .env.local; set +a; node scripts/check-db.mjs'
```

### Match Flow Beskrivelse

1. **Input**: Liste af ingredienser (f.eks. `["tomato", "basil"]`) og valgfri `recipeSlug`
2. **Cache check**: Hvis `recipeSlug` er angivet, tjekkes database cache først (1 måneds TTL)
3. **Embedding**: Hver ingrediens konverteres til en 1536-dimensionel vektor via OpenAI `text-embedding-3-small`
4. **Kontekst**: Embeddings inkluderer instruktioner: "Prioriter match på feltet title og derefter feltet description. Ingrediens: [ingrediens]"
5. **Database søgning**: Vector similarity search i Postgres med pgvector
   - Bruger cosine similarity (`<=>` operator) 
   - Returnerer top 3 matches per ingrediens
6. **Scoring**: Similarity score beregnes som `1 - (embedding <=> query_vector)`
7. **Cache**: Resultater caches i `recipe_cache` tabel med `recipeSlug` som nøgle (hvis angivet)
8. **Output**: Struktureret JSON med ingredienser og deres bedste matches

### Database Schema

**Products tabel:**
```sql
products(id_text text primary key, title text, raw jsonb, embedding vector(1536))
```

**Recipe Cache tabel:**
```sql
recipe_cache(
  recipe_slug text primary key,
  results jsonb not null,
  created_at timestamp default now(),
  expires_at timestamp not null,
  hit_count integer default 0,
  last_accessed timestamp default now()
)
```

### Noter
- Vector søgning bruger cosine similarity via `<->` og `<=>` operatorer.
- Recipe cache har 1 måneds TTL og track hit counts for analytics.
- Cache headers: `X-Cache: HIT/MISS` og `X-Cache-Hits: N` for monitoring.

# Welcome to React Router!

A modern, production-ready template for building full-stack React applications using React Router.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/remix-run/react-router-templates/tree/main/default)

## Features

- 🚀 Server-side rendering
- ⚡️ Hot Module Replacement (HMR)
- 📦 Asset bundling and optimization
- 🔄 Data loading and mutations
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 📖 [React Router docs](https://reactrouter.com/)

## Getting Started

### Installation

Install the dependencies:

```bash
npm install
```

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

### Docker Deployment

To build and run using Docker:

```bash
docker build -t my-app .

# Run the container
docker run -p 3000:3000 my-app
```

The containerized application can be deployed to any platform that supports Docker, including:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is production-ready.

Make sure to deploy the output of `npm run build`

```
├── package.json
├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using React Router.
