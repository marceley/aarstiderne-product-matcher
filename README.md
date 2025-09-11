## Aarstiderne Product Matcher

Tiny app with two endpoints:

- POST `/api/scrape`: Fetches daily product feed, embeds titles, upserts to Postgres with pgvector.
- POST `/api/match`: Body `{ "ingredients": ["tomato", "basil"] }` returns best-matching products `{ id, title }`.

### Stack
- React Router 7 (Remix OSS)
- Vercel (deploy), Vercel Cron (11:00 PM UTC)
- Vercel AI SDK + OpenAI embeddings `text-embedding-3-small`
- Postgres (Neon recommended) with `pgvector`

### Setup
1) Create a Postgres DB (Neon) and enable `pgvector` extension.
2) Set environment variables (locally in `.env.local`, on Vercel in Project → Settings → Environment Variables):
   - Preferred via Vercel AI Gateway (recommended):
     - `AI_GATEWAY_API_KEY` (from Vercel Dashboard → AI → Gateways → Your Gateway → Gateway Key)
   - Fallback (legacy direct provider):
     - `OPENAI_API_KEY`
   - Postgres (one of):
     - `DATABASE_URL`
     - or individual vars: `DATABASE_HOST`, `DATABASE_PORT` (default 5432), `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`
3) Run locally:
   - `npm run dev`
4) Deploy on Vercel and set same env vars. Vercel cron is configured in `vercel.json`.

### AI Gateway Migration Notes

- The app now prefers Vercel AI Gateway for embeddings. If `AI_GATEWAY_API_KEY` is set, all embedding requests are routed through the Gateway. If not set, it falls back to direct OpenAI using `OPENAI_API_KEY`.
- Where it's used: `app/utils/embeddings.ts` (used by `/api/scrape`, `/api/match`, `/api/match-production`).
- Benefits: centralized keys, caching, rate limits, observability, and model/provider failover.
- Setup: Install `@ai-sdk/gateway` package (already done) and set `AI_GATEWAY_API_KEY` environment variable.
- Rollout and rollback:
  - To enable: set `AI_GATEWAY_API_KEY` and redeploy.
  - To rollback: unset `AI_GATEWAY_API_KEY` (or set it empty) to automatically fall back to `OPENAI_API_KEY` without code changes.

### Production

- Base URL: https://aarstiderne-product-matcher.vercel.app/
- Cron: GET `https://aarstiderne-product-matcher.vercel.app/api/scrape` runs daily at 23:00 UTC (see `vercel.json`).
- Manual scrape trigger:

```bash
curl -X POST https://aarstiderne-product-matcher.vercel.app/api/scrape
# or GET (compatible with Vercel Cron)
curl https://aarstiderne-product-matcher.vercel.app/api/scrape
```

- Matching API example:

```bash
curl -X POST https://aarstiderne-product-matcher.vercel.app/api/match \
  -H 'Content-Type: application/json' \
  -d '{"ingredients":["tomato","basil"]}'
```

### Utilities

- Count rows in `products` (uses `.env.local`):

```bash
bash -lc 'set -a; source .env.local; set +a; node scripts/check-db.mjs'
```

### Notes
- Table `products(id_text text primary key, title text, raw jsonb, embedding vector(1536))`.
- Vector search uses cosine similarity via `<->` and `<=>` operators.

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
