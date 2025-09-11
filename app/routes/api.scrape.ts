import type { ActionFunctionArgs } from "react-router";
import { ensureDatabaseSetup, pool } from "../utils/db";
import { getEmbeddings } from "../utils/embeddings";

function cleanTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  
  // Get removal words from environment variable
  const removeWords = process.env.TITLE_REMOVE_WORDS;
  if (!removeWords) return title.toLowerCase();
  
  let cleanedTitle = title.toLowerCase();
  
  // Split by semicolon and remove each word/phrase (also lowercase for consistency)
  const wordsToRemove = removeWords.split(';').map(word => word.trim().toLowerCase()).filter(word => word.length > 0);
  
  for (const word of wordsToRemove) {
    // Remove the word/phrase (case insensitive) - try both word boundary and simple replacement
    const wordBoundaryRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const simpleRegex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    
    const beforeReplace = cleanedTitle;
    cleanedTitle = cleanedTitle.replace(wordBoundaryRegex, '').trim();
    
    // If word boundary didn't work, try simple replacement
    if (cleanedTitle === beforeReplace) {
      cleanedTitle = cleanedTitle.replace(simpleRegex, '').trim();
    }
  }
  
  // Clean up multiple spaces
  cleanedTitle = cleanedTitle.replace(/\s+/g, ' ').trim();
  
  return cleanedTitle.length > 0 ? cleanedTitle : null;
}

async function runScrape(): Promise<Response> {
  // Basic auth for external feed
  const url = "https://productfeed.aarstiderne.com/output/productfeed110.json";
  // TODO: move to .env
  const auth = "Basic " + Buffer.from("ProductFeed:Vinter2019").toString("base64");

  await ensureDatabaseSetup();

  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) return new Response("Fetch failed", { status: 502 });
  
  // Stream the JSON response
  const reader = res.body?.getReader();
  if (!reader) return new Response("No response body", { status: 500 });
  
  let buffer = '';
  const products: any[] = [];
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += new TextDecoder().decode(value);
      
      // Try to parse complete JSON objects
      let braceCount = 0;
      let startIndex = -1;
      
      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === '{') {
          if (braceCount === 0) startIndex = i;
          braceCount++;
        } else if (buffer[i] === '}') {
          braceCount--;
          if (braceCount === 0 && startIndex !== -1) {
            try {
              const jsonStr = buffer.slice(startIndex, i + 1);
              const product = JSON.parse(jsonStr);
              if (product.Id && product.Title) {
                products.push(product);
              }
            } catch (e) {
              // Skip malformed JSON
            }
            startIndex = -1;
          }
        }
      }
      
      // Keep only unprocessed part of buffer
      if (startIndex !== -1) {
        buffer = buffer.slice(startIndex);
      } else {
        buffer = '';
      }
    }
  } finally {
    reader.releaseLock();
  }

  console.log(`Processed ${products.length} products`);

  // Process in batches of 100
  const batchSize = 100;
  const client = await pool.connect();
  
  try {
    await client.sql`BEGIN`;
    
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      // Extract titles and IDs for this batch
      const titles: string[] = batch.map((d: any) => d?.Title || "");
      const ids: string[] = batch.map((d: any) => String(d?.Id || ""));
      
      // Get embeddings for this batch
      const embeddings = await getEmbeddings(titles);
      
      // Insert batch
      for (let j = 0; j < batch.length; j++) {
        const id = ids[j];
        if (!id) continue;
        
        const titleOriginal = titles[j] || null;
        const title = cleanTitle(titles[j]) || null;
        const embedding = embeddings[j] ?? null;
        const embeddingLiteral = embedding && embedding.length > 0 ? `[${embedding.join(",")}]` : null;
        
        // Extract PIM ID from image URL (updated regex to handle product names with hyphens)
        const imageUrl = batch[j]?.Image || "";
        let pimId = null;
        if (imageUrl) {
          const match = imageUrl.match(/product\/.*?-(\d{1,4})-\d+-\d+-\d+\.png/);
          pimId = match ? match[1] : null;
        }
        
        await client.sql`
          INSERT INTO products (id_text, title, title_original, pimid, raw, embedding)
          VALUES (${id}, ${title}, ${titleOriginal}, ${pimId}, ${JSON.stringify(batch[j])}, ${embeddingLiteral}::vector)
          ON CONFLICT (id_text)
          DO UPDATE SET title = EXCLUDED.title, title_original = EXCLUDED.title_original, pimid = EXCLUDED.pimid, raw = EXCLUDED.raw, embedding = EXCLUDED.embedding;
        `;
      }
      
      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)}`);
    }
    
    await client.sql`COMMIT`;
  } catch (e) {
    await client.sql`ROLLBACK`;
    console.error(e);
    return new Response("DB error", { status: 500 });
  } finally {
    client.release();
  }

  return Response.json({ ok: true, count: products.length });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  return runScrape();
}


