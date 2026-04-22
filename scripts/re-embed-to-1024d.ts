#!/usr/bin/env npx tsx
/**
 * Re-embed all memories from 4096d to 1024d
 *
 * Reads all rows with non-null `embedding` but null `embedding_1024`,
 * calls Ollama /v1/embeddings with dimensions: 1024, and updates
 * the embedding_1024 column.
 *
 * Usage: npx tsx scripts/re-embed-to-1024d.ts
 *
 * Environment:
 *   DATABASE_URL         - PostgreSQL connection string
 *   OLLAMA_BASE_URL      - Ollama endpoint (default: http://localhost:11434)
 *   EMBEDDING_MODEL       - Model name (default: qwen3-embedding:8b)
 */

import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/allura";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "qwen3-embedding:8b";
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 100;

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text, dimensions: 1024 }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(`Ollama returned ${response.status}: ${errorBody.slice(0, 200)}`);
      return null;
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;
    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      console.error("Invalid response: missing or empty embedding array");
      return null;
    }

    return embedding;
  } catch (error) {
    console.error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Count rows needing re-embedding
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM allura_memories WHERE embedding IS NOT NULL AND embedding_1024 IS NULL AND deleted_at IS NULL`
    );
    const total = Number(countResult.rows[0].total);
    console.log(`Found ${total} rows to re-embed`);

    if (total === 0) {
      console.log("Nothing to do. All rows already have 1024d embeddings.");
      return;
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let offset = 0;
    const limit = 50; // Fetch in chunks to avoid huge result sets

    while (offset < total) {
      // Fetch batch of rows needing re-embedding
      const result = await pool.query(
        `SELECT id, content FROM allura_memories 
         WHERE embedding IS NOT NULL AND embedding_1024 IS NULL AND deleted_at IS NULL
         ORDER BY id
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      if (result.rows.length === 0) break;

      // Process in sub-batches of BATCH_SIZE
      for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
        const subBatch = result.rows.slice(i, i + BATCH_SIZE);

        const embeddings = await Promise.all(
          subBatch.map(async (row: { id: string; content: string }) => {
            const embedding = await generateEmbedding(row.content);
            return { id: row.id, embedding };
          })
        );

        // Update rows with new embeddings
        for (const { id, embedding } of embeddings) {
          if (embedding) {
            const embeddingStr = `[${embedding.join(",")}]`;
            await pool.query(
              `UPDATE allura_memories SET embedding_1024 = $1::vector WHERE id = $2`,
              [embeddingStr, id]
            );
            succeeded++;
          } else {
            failed++;
            console.error(`Failed to embed row ${id}`);
          }
          processed++;
        }

        // Progress report
        console.log(`Progress: ${processed}/${total} (${((processed / total) * 100).toFixed(1)}%) — succeeded: ${succeeded}, failed: ${failed}`);

        // Delay between batches
        if (i + BATCH_SIZE < result.rows.length) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }

      offset += limit;
    }

    console.log(`\nDone! Re-embedded ${succeeded} rows, ${failed} failures out of ${total} total.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});