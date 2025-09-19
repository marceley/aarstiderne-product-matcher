## Aarstiderne Product Matcher

Tiny app with multiple endpoints:

- **POST `/api/scrape`**: Fetches daily product feed, embeds titles, upserts to Postgres with pgvector
- **POST `/api/match`**: Body `{ "ingredients": ["tomato", "basil"] }` returns best-matching products with scores
- **POST `/api/match-production`**: Production endpoint returning only product IDs for matched ingredients above threshold
- **POST `/api/extract-recipe`**: Extracts ingredients from recipe URLs (Danish recipe sites)
- **GET `/api/products`**: Returns sample products from database

### Stack
- Vercel (deploy), Vercel Cron (11:00 PM UTC)
- Vercel AI SDK + OpenAI embeddings `text-embedding-3-small`
- Postgres (Neon recommended) with `pgvector`

### Setup
1) Create a Postgres DB (Neon) and enable `pgvector` extension.
2) Copy `.env.example` to `.env` and set:
   - `OPENAI_API_KEY`
   - Postgres (one of):
     - `DATABASE_URL`
     - or individual vars: `DATABASE_HOST`, `DATABASE_PORT` (default 5432), `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`
3) Run locally:
   - `npm run dev`
4) Deploy on Vercel and set same env vars. Vercel cron is configured in `vercel.json`.

### Environment Variables

**Required variables:**
- `OPENAI_API_KEY`: Your OpenAI API key for embeddings
- `DATABASE_URL` or individual database variables: `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`

**Optional variables:**
- `EXCELLENT_MATCH_THRESHOLD`: Matching threshold percentage (default: 95)
- `CACHE_TTL_MONTHS`: Cache expiration in months (default: 1)
- `SCRAPE_FEED_URL`: Product feed URL
- `SCRAPE_AUTH_USERNAME`: Feed authentication username
- `SCRAPE_AUTH_PASSWORD`: Feed authentication password
- `SCRAPE_BATCH_SIZE`: Batch size for processing (default: 100)
- `TITLE_REMOVE_WORDS`: Words to remove from product titles (semicolon-separated)

**Getting env vars from Vercel CLI:**
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link your project
vercel link

# Pull environment variables
vercel env pull .env.local
```

This will create a `.env.local` file with all your Vercel environment variables for local development.

### Production

- Base URL: https://aarstiderne-product-matcher.vercel.app/
- Cron: GET `https://aarstiderne-product-matcher.vercel.app/api/scrape` runs daily at 23:00 UTC (see `vercel.json`).
- Manual scrape trigger:

```bash
curl -X POST https://aarstiderne-product-matcher.vercel.app/api/scrape
# or GET (compatible with Vercel Cron)
curl https://aarstiderne-product-matcher.vercel.app/api/scrape
```

### API Examples

**Match ingredients (development/testing):**
```bash
curl -X POST https://aarstiderne-product-matcher.vercel.app/api/match \
  -H 'Content-Type: application/json' \
  -d '{"ingredients":["tomato","basil"]}'
```

**Production matching (returns only product IDs):**
```bash
curl -X POST https://aarstiderne-product-matcher.vercel.app/api/match-production \
  -H 'Content-Type: application/json' \
  -d '{"ingredients":["tomato","basil"]}'
```

**Extract recipe from URL:**
```bash
curl -X POST https://aarstiderne-product-matcher.vercel.app/api/extract-recipe \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/recipe"}'
```

**Check database status:**
```bash
curl https://aarstiderne-product-matcher.vercel.app/api/products
```



### Notes
- Table `products(id_text text primary key, title text, raw jsonb, embedding vector(1536))`.
- Vector search uses cosine similarity via `<->` and `<=>` operators.

## Scrape Cost Analysis

The scraping operation uses OpenAI's `text-embedding-3-small` model to generate embeddings for product titles. Here's the cost breakdown:

### Pricing (2024)
- **Model**: `text-embedding-3-small`
- **Cost**: $0.00002 per 1,000 tokens

### Cost Calculation

| Products | Estimated Tokens | Cost |
|----------|------------------|------|
| 100      | 3,000           | $0.00006 |
| 500      | 15,000          | $0.0003 |
| 1,000    | 30,000          | $0.0006 |
| 5,000    | 150,000         | $0.003 |
| 10,000   | 300,000         | $0.006 |

### Key Factors
- **Product Title Length**: Longer titles = more tokens = higher cost
- **Batch Processing**: Products processed in configurable batches (default: 100)
- **Caching**: In-memory caching prevents re-processing identical titles
- **Text Processing**: Each title includes instruction text (~60 characters)

### Real-World Estimate
For a typical grocery store product feed with ~1,000-2,000 products, the scrape cost is approximately **$0.001-0.002** (1-2 tenths of a cent).

The cost is extremely low due to the efficient embedding model and relatively short product titles.
