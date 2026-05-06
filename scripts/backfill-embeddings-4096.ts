/**
 * Embedding upgrade backfill: 768d → 4096d
 * Re-embeds all allura_memories rows with qwen3-embedding:8b
 * Run: npx tsx scripts/backfill-embeddings-4096.ts
 */

import { config } from 'dotenv';
config({ path: '../../docker/.env' });

const PG_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;
if (!process.env.POSTGRES_PASSWORD && !process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
  console.error('[backfill] ERROR: POSTGRES_PASSWORD (or DATABASE_URL) is required. Set it in .env.local');
  process.exit(1);
}
const OLLAMA_URL = process.env.EMBEDDING_BASE_URL || 'http://localhost:11434';
const MODEL = 'qwen3-embedding:8b';
const BATCH_SIZE = 10;

async function embed(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, input: text }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const emb = data.embeddings?.[0] ?? data.embedding;
    if (!emb || !Array.isArray(emb)) return null;
    return emb;
  } catch {
    return null;
  }
}

async function main() {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: PG_URL });
  
  // Get all rows without embeddings
  const { rows } = await pool.query(
    `SELECT id, content FROM allura_memories WHERE embedding IS NULL ORDER BY id`
  );
  
  console.log(`Found ${rows.length} rows to re-embed with ${MODEL}`);
  
  let ok = 0, fail = 0;
  
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(r => embed(r.content)));
    
    for (let j = 0; j < results.length; j++) {
      const emb = results[j];
      if (emb && emb.length === 4096) {
        await pool.query(
          `UPDATE allura_memories SET embedding = $1::vector WHERE id = $2`,
          [JSON.stringify(emb), batch[j].id]
        );
        ok++;
      } else {
        fail++;
        console.warn(`Failed to embed row ${batch[j].id}`);
      }
    }
    process.stdout.write(`\rEmbedded ${ok}/${rows.length} (failed: ${fail})`);
  }
  
  console.log(`\nDone: ${ok} embedded, ${fail} failed`);
  await pool.end();
}

main().catch(console.error);