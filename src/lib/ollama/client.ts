/**
 * Ollama HTTP Client
 *
 * Provides typed interface to Ollama's REST API for generating completions
 * and managing models. Supports both local Ollama instances and Ollama Cloud.
 *
 * @module lib/ollama/client
 */

import { randomUUID } from "crypto";

// =============================================================================
// Types
// =============================================================================

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: OllamaModelDetails;
}

export interface OllamaModelDetails {
  parent_model?: string;
  format?: string;
  family?: string;
  families?: string[];
  parameter_size?: string;
  quantization_level?: string;
}

export interface GenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  template?: string;
  context?: number[];
  stream?: boolean;
  options?: OllamaOptions;
  keep_alive?: number; // seconds to keep context alive
}

export interface OllamaOptions {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  num_predict?: number; // max tokens
  stop?: string[];
  repeat_penalty?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface GenerateResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaChatResponse {
  model: string;
  message: OllamaMessage;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[]; // base64 encoded images for vision models
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface OllamaCompletion {
  text: string;
  usage: TokenUsage;
  model: string;
  durationMs: number;
  done: boolean;
}

// =============================================================================
// Client
// =============================================================================

export interface OllamaClientConfig {
  baseUrl: string;
  timeoutMs?: number;
  apiKey?: string; // Ollama Cloud API key
}

export class OllamaClient {
  private baseUrl: string;
  private timeoutMs: number;
  private apiKey?: string;

  constructor(config: OllamaClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // strip trailing slash
    this.timeoutMs = config.timeoutMs ?? 120_000; // 2 min default
    this.apiKey = config.apiKey;
  }

  /**
   * Create client from environment variables
   * Supports OLLAMA_BASE_URL for local, or custom cloud endpoints
   */
  static fromEnv(): OllamaClient {
    const baseUrl =
      process.env.OLLAMA_BASE_URL ||
      process.env.OLLAMA_CLOUD_URL ||
      "https://ollama.com";

    return new OllamaClient({ baseUrl });
  }

  // ---------------------------------------------------------------------------
  // Core API
  // ---------------------------------------------------------------------------

  /**
   * List available models
   */
  async listModels(): Promise<OllamaModel[]> {
    const response = await this.request<{ models: OllamaModel[] }>("/api/tags");
    return response.models ?? [];
  }

  /**
   * Generate a completion
   */
  async generate(
    req: GenerateRequest,
    options?: { baseUrl?: string; apiKey?: string }
  ): Promise<GenerateResponse | AsyncGenerator<GenerateResponse>> {
    // Determine effective base URL and auth
    const isCloudModel = req.model.endsWith(":cloud");
    const effectiveBaseUrl = isCloudModel
      ? (process.env.OLLAMA_CLOUD_URL || "https://ollama.com")
      : (options?.baseUrl || this.baseUrl);
    const apiKey = isCloudModel
      ? (options?.apiKey || process.env.OLLAMA_API_KEY || this.apiKey)
      : undefined;

    if (req.stream) {
      return this.streamGenerate(req, effectiveBaseUrl, apiKey);
    }
    // Pass effectiveBaseUrl as baseUrl override to request()
    const response = await this.request<GenerateResponse>(
      "/api/generate",
      {
        method: "POST",
        body: req as unknown as Record<string, unknown>,
        apiKey,
        baseUrl: effectiveBaseUrl,
      }
    );
    return response;
  }

  /**
   * Chat completion (if supported by model)
   */
  async chat(req: {
    model: string;
    messages: OllamaMessage[];
    stream?: boolean;
    options?: OllamaOptions;
  }): Promise<OllamaChatResponse> {
    return this.request<OllamaChatResponse>("/api/chat", {
      method: "POST",
      body: req as unknown as Record<string, unknown>,
    });
  }

  /**
   * Check if a model is available
   */
  async isModelAvailable(modelName: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.some((m) => m.name === modelName || m.model === modelName);
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Utility methods for ADAS
  // ---------------------------------------------------------------------------

  /**
   * Generate with timing and token tracking
   * Used by EvaluationHarness for metrics
   *
   * Routes to cloud or local endpoint based on model name:
   * - Models ending in :cloud → use cloud URL with auth
   * - All other models → use local localhost:11434 (no auth)
   */
  async complete(
    prompt: string,
    model: string,
    options?: OllamaOptions
  ): Promise<OllamaCompletion> {
    const startTime = Date.now();

    const isCloudModel = model.endsWith(":cloud");
    const effectiveBaseUrl = isCloudModel
      ? (process.env.OLLAMA_CLOUD_URL || "https://ollama.com")
      : (process.env.OLLAMA_BASE_URL || "http://localhost:11434");

    const apiKey = isCloudModel
      ? (process.env.OLLAMA_API_KEY || this.apiKey)
      : undefined;

    const response = await this.generate({
      model,
      prompt,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.num_predict ?? 4096,
        ...options,
      },
      stream: false,
    }, {
      baseUrl: effectiveBaseUrl,
      apiKey,
    });

    // Generate returns union type; cast since we pass stream: false
    const genResponse = response as GenerateResponse;

    const durationMs = Date.now() - startTime;

    return {
      text: genResponse.response,
      usage: {
        promptTokens: genResponse.prompt_eval_count ?? 0,
        completionTokens: genResponse.eval_count ?? 0,
        totalTokens:
          (genResponse.prompt_eval_count ?? 0) + (genResponse.eval_count ?? 0),
      },
      model: genResponse.model,
      durationMs,
      done: genResponse.done,
    };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async request<T>(path: string, init?: {
    method?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    apiKey?: string;
    baseUrl?: string; // override baseUrl
  }): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    // Get API key from constructor, init, or environment
    const apiKey = init?.apiKey || this.apiKey || process.env.OLLAMA_API_KEY;
    // Use override baseUrl if provided, otherwise use instance baseUrl
    const baseUrl = init?.baseUrl || this.baseUrl;

    try {
      const url = `${baseUrl}${path}`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...init?.headers,
      };

      // Add API key auth if available
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const response = await fetch(url, {
        method: init?.method ?? "GET",
        headers,
        body: init?.body ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "Unknown error");
        throw new OllamaError(
          `Ollama API error: ${response.status} ${response.statusText} — ${text}`,
          response.status
        );
      }

      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async *streamGenerate(
    req: GenerateRequest,
    baseUrl?: string,
    apiKey?: string
  ): AsyncGenerator<GenerateResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const effectiveBaseUrl = baseUrl || this.baseUrl;

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const response = await fetch(`${effectiveBaseUrl}/api/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...req, stream: true }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new OllamaError(
          `Ollama API error: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const reader = response.body?.getReader();
      if (!reader) throw new OllamaError("No response body", 500);

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              yield JSON.parse(line) as GenerateResponse;
            } catch {
              // Skip malformed lines
            }
          }
        }
      }
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  }
}

// =============================================================================
// Errors
// =============================================================================

export class OllamaError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "OllamaError";
  }
}

// =============================================================================
// Singleton for ADAS
// =============================================================================

let _client: OllamaClient | null = null;

export function getOllamaClient(): OllamaClient {
  if (!_client) {
    _client = OllamaClient.fromEnv();
  }
  return _client;
}

export function resetOllamaClient(): void {
  _client = null;
}
