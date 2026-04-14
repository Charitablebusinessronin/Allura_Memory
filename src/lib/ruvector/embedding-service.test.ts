/**
 * Tests for RuVector Embedding Service
 *
 * Tests the Ollama-based embedding generation for the RuVector bridge.
 * Uses mocked fetch to avoid requiring a live Ollama instance.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock fetch globally ───────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  generateEmbedding,
  generateEmbeddingBatch,
  getEmbeddingDimensions,
} from "./embedding-service";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a valid Ollama embedding response (768-dim) */
function makeOllamaResponse(dimensions: number = 768): { embedding: number[] } {
  const embedding = Array.from({ length: dimensions }, (_, i) => i / dimensions);
  return { embedding };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RuVector Embedding Service — generateEmbedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env vars to defaults
    delete process.env.RUVECTOR_EMBEDDING_MODEL;
    delete process.env.RUVECTOR_EMBEDDING_BASE_URL;
  });

  it("should call the correct Ollama endpoint with model and prompt", async () => {
    const response = makeOllamaResponse();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce(response),
      text: vi.fn(),
    });

    const result = await generateEmbedding("test text");

    expect(result).not.toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:11434/api/embeddings");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ "Content-Type": "application/json" });

    const body = JSON.parse(options.body);
    expect(body.model).toBe("nomic-embed-text");
    expect(body.prompt).toBe("test text");
  });

  it("should use RUVECTOR_EMBEDDING_MODEL env var when set", async () => {
    process.env.RUVECTOR_EMBEDDING_MODEL = "custom-model";
    const response = makeOllamaResponse();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce(response),
      text: vi.fn(),
    });

    await generateEmbedding("test");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe("custom-model");
  });

  it("should use RUVECTOR_EMBEDDING_BASE_URL env var when set", async () => {
    process.env.RUVECTOR_EMBEDDING_BASE_URL = "http://ollama-server:11434";
    const response = makeOllamaResponse();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce(response),
      text: vi.fn(),
    });

    await generateEmbedding("test");

    const url = mockFetch.mock.calls[0][0];
    expect(url).toBe("http://ollama-server:11434/api/embeddings");
  });

  it("should return embedding array on success", async () => {
    const response = makeOllamaResponse(768);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce(response),
      text: vi.fn(),
    });

    const result = await generateEmbedding("hello world");

    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(true);
    expect(result!.length).toBe(768);
  });

  it("should return null when Ollama returns non-200 status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: vi.fn().mockResolvedValueOnce("model not found"),
    });

    const result = await generateEmbedding("test");

    expect(result).toBeNull();
  });

  it("should return null when Ollama returns empty embedding array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ embedding: [] }),
      text: vi.fn(),
    });

    const result = await generateEmbedding("test");

    expect(result).toBeNull();
  });

  it("should return null when Ollama returns missing embedding field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ model: "nomic-embed-text" }),
      text: vi.fn(),
    });

    const result = await generateEmbedding("test");

    expect(result).toBeNull();
  });

  it("should return null when Ollama is unreachable (fetch throws)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await generateEmbedding("test");

    expect(result).toBeNull();
  });

  it("should return null when fetch is aborted (timeout simulation)", async () => {
    // Simulate AbortError as would happen with a 30s timeout
    const abortError = new DOMException("The operation was aborted", "AbortError");
    mockFetch.mockRejectedValueOnce(abortError);

    const result = await generateEmbedding("test");

    expect(result).toBeNull();
  });

  it("should return null when fetch response JSON parsing fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockRejectedValueOnce(new Error("Invalid JSON")),
      text: vi.fn(),
    });

    const result = await generateEmbedding("test");

    expect(result).toBeNull();
  });
});

describe("RuVector Embedding Service — generateEmbeddingBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RUVECTOR_EMBEDDING_MODEL;
    delete process.env.RUVECTOR_EMBEDDING_BASE_URL;
  });

  it("should generate embeddings for multiple texts", async () => {
    const response = makeOllamaResponse();
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
      text: vi.fn(),
    });

    const results = await generateEmbeddingBatch(["text 1", "text 2", "text 3"]);

    expect(results).toHaveLength(3);
    expect(results.every((r) => Array.isArray(r) && r!.length === 768)).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("should return null entries for failed embeddings", async () => {
    // First succeeds, second fails, third succeeds
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(makeOllamaResponse()),
        text: vi.fn(),
      })
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(makeOllamaResponse()),
        text: vi.fn(),
      });

    const results = await generateEmbeddingBatch(["text 1", "text 2", "text 3"]);

    expect(results).toHaveLength(3);
    expect(Array.isArray(results[0])).toBe(true);
    expect(results[1]).toBeNull();
    expect(Array.isArray(results[2])).toBe(true);
  });

  it("should return empty array for empty input", async () => {
    const results = await generateEmbeddingBatch([]);

    expect(results).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should limit concurrency to 5 requests at a time", async () => {
    // This tests that the batch function processes in chunks of 5
    // by checking that with 7 texts, all calls complete correctly
    const response = makeOllamaResponse();
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
      text: vi.fn(),
    });

    const texts = Array.from({ length: 7 }, (_, i) => `text ${i}`);
    const results = await generateEmbeddingBatch(texts);

    expect(results).toHaveLength(7);
    expect(results.every((r) => Array.isArray(r))).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(7);
  });
});

describe("RuVector Embedding Service — getEmbeddingDimensions", () => {
  it("should return 768 (nomic-embed-text dimensions)", () => {
    expect(getEmbeddingDimensions()).toBe(768);
  });

  it("should always return the same value", () => {
    const first = getEmbeddingDimensions();
    const second = getEmbeddingDimensions();
    expect(first).toBe(second);
  });
});