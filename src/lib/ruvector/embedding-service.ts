/**
 * RuVector Embedding Service
 *
 * Generates 4096-dim vectors via Ollama's /api/embeddings endpoint.
 * Uses qwen3-embedding:8b (4096d) by default.
 *
 * Environment variables:
 * - RUVECTOR_EMBEDDING_MODEL: model name (default: qwen3-embedding:8b)
 * - RUVECTOR_EMBEDDING_BASE_URL: Ollama URL (default: http://localhost:11434)
 *
 * Graceful degradation: if Ollama is unreachable or returns an error,
 * the calling code should still store the memory — just without an
 * embedding vector (NULL). Status becomes "stored_pending_embedding".
 */

// Server-only guard
if (typeof window !== "undefined") {
  throw new Error("RuVector embedding service can only be used server-side");
}

// ── Configuration ────────────────────────────────────────────────────────────

/** Default model — qwen3-embedding:8b produces 4096-dim vectors */
const DEFAULT_MODEL = "qwen3-embedding:8b";

/** Default Ollama endpoint */
const DEFAULT_BASE_URL = "http://localhost:11434";

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 30_000;

/** Max concurrent embedding requests in batch */
const BATCH_CONCURRENCY = 5;

/** Embedding dimensions for qwen3-embedding:8b */
const EMBEDDING_DIMENSIONS = 4096;

/**
 * Read model name from environment (falls back to default).
 */
function getModel(): string {
  return process.env.RUVECTOR_EMBEDDING_MODEL ?? DEFAULT_MODEL;
}

/**
 * Read Ollama base URL from environment (falls back to default).
 */
function getBaseUrl(): string {
  return process.env.RUVECTOR_EMBEDDING_BASE_URL ?? DEFAULT_BASE_URL;
}

// ── Ollama Response Types ────────────────────────────────────────────────────

interface OllamaEmbeddingResponse {
  embedding: number[];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate an embedding vector for a single text string.
 *
 * Calls Ollama's /api/embeddings endpoint with the configured model.
 * Returns null on failure (Ollama down, timeout, invalid response) —
 * graceful degradation so memory storage never blocks on embeddings.
 *
 * @param text - The text to embed
 * @returns Embedding vector (number[]) or null if generation failed
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const baseUrl = getBaseUrl();
  const model = getModel();
  const url = `${baseUrl}/api/embeddings`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.warn(
        `[RuVector Embedding] Ollama returned ${response.status}: ${errorBody.slice(0, 200)}`
      );
      return null;
    }

    const data: OllamaEmbeddingResponse = await response.json();

    if (!data.embedding || !Array.isArray(data.embedding) || data.embedding.length === 0) {
      console.warn(
        `[RuVector Embedding] Invalid response: missing or empty embedding array`
      );
      return null;
    }

    return data.embedding;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[RuVector Embedding] Failed to generate embedding: ${message}`);
    return null;
  }
}

/**
 * Generate embeddings for multiple texts in parallel (max concurrency 5).
 *
 * Calls generateEmbedding for each text, with a concurrency limit
 * to avoid overwhelming Ollama. Returns results in the same order
 * as the input array. Individual failures produce null entries.
 *
 * @param texts - Array of text strings to embed
 * @returns Array of embedding vectors (or null for failures)
 */
export async function generateEmbeddingBatch(texts: string[]): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = new Array(texts.length).fill(null);

  // Process in chunks with bounded concurrency
  for (let i = 0; i < texts.length; i += BATCH_CONCURRENCY) {
    const chunk = texts.slice(i, i + BATCH_CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map((text) => generateEmbedding(text)));

    for (let j = 0; j < chunkResults.length; j++) {
      results[i + j] = chunkResults[j];
    }
  }

  return results;
}

/**
 * Returns the expected embedding dimension count.
 *
 * This matches qwen3-embedding:8b's output (4096 dimensions).
 * Used by callers that need to know the vector size for DB column
 * types or validation.
 *
 * @returns 4096
 */
export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}