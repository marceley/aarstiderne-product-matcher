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
2) Copy `.env.example` to `.env` and set:
   - `DATABASE_URL`
   - `OPENAI_API_KEY`
3) Run locally:
   - `npm run dev`
4) Deploy on Vercel and set same env vars. Vercel cron is configured in `vercel.json`.

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
