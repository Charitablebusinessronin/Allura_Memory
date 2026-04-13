/**
 * @allura/sdk — AlluraClient
 *
 * Main client class for interacting with Allura Memory.
 * Supports both MCP Streamable HTTP and legacy JSON-RPC transports.
 *
 * Usage:
 * ```typescript
 * const client = new AlluraClient({
 *   baseUrl: "http://localhost:3201",
 *   authToken: process.env.ALLURA_AUTH_TOKEN,
 * });
 *
 * // Add a memory
 * const result = await client.memory.add({
 *   group_id: "allura-my-tenant",
 *   user_id: "user-123",
 *   content: "Remember this important fact",
 * });
 *
 * // Search memories
 * const results = await client.memory.search({
 *   query: "important fact",
 *   group_id: "allura-my-tenant",
 * });
 * ```
 */

import type { AlluraClientConfig, HealthResponse } from "./types.js";
import { HealthResponseSchema } from "./types.js";
import { MemoryOperations } from "./memory.js";
import { resolveAuthToken } from "./auth.js";
import {
  AlluraError,
  ConnectionError,
  createErrorFromResponse,
} from "./errors.js";
import {
  DEFAULT_TIMEOUT,
  DEFAULT_RETRIES,
  buildHeaders,
  normalizeBaseUrl,
  withRetry,
} from "./utils.js";

// ── Client State ────────────────────────────────────────────────────────────

type ClientState = "disconnected" | "connected" | "error";

// ── AlluraClient ────────────────────────────────────────────────────────────

export class AlluraClient {
  // Configuration
  private readonly baseUrl: string;
  private readonly authToken: string | undefined;
  private readonly timeout: number;
  private readonly retries: number;
  private readonly customFetch: typeof globalThis.fetch | undefined;

  // State
  private state: ClientState = "disconnected";

  // Operations
  public readonly memory: MemoryOperations;

  constructor(config: AlluraClientConfig) {
    // Validate required config
    if (!config.baseUrl) {
      throw new Error("AlluraClient requires a baseUrl");
    }

    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.authToken = resolveAuthToken(config.authToken);
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.retries = config.retries ?? DEFAULT_RETRIES;
    this.customFetch = config.fetch;

    // Initialize memory operations with bound request function
    this.memory = new MemoryOperations(this.makeRequest.bind(this));
  }

  // ── Connection Management ────────────────────────────────────────────────

  /**
   * Verify connectivity to the Allura Memory server.
   * Calls the /health endpoint and validates the response.
   *
   * @returns Health response from the server
   * @throws {ConnectionError} if the server is unreachable
   * @throws {AlluraError} if the server returns an error
   */
  async health(): Promise<HealthResponse> {
    const fetchFn = this.customFetch ?? globalThis.fetch;
    const url = `${this.baseUrl}/health`;
    const headers = buildHeaders(this.authToken);

    return withRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
          const response = await fetchFn(url, {
            method: "GET",
            headers,
            signal: controller.signal,
          });

          if (!response.ok) {
            const body = await this.parseResponseBody(response);
            throw createErrorFromResponse(response.status, body);
          }

          const body = await this.parseResponseBody(response);
          return HealthResponseSchema.parse(body);
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            throw new ConnectionError(`Request timed out after ${this.timeout}ms`);
          }
          if (error instanceof AlluraError) {
            throw error; // Let withRetry handle retryable errors
          }
          throw new ConnectionError(
            `Failed to connect to Allura Memory at ${this.baseUrl}`,
            error instanceof Error ? error : undefined
          );
        } finally {
          clearTimeout(timeoutId);
        }
      },
      this.retries
    );
  }

  /**
   * Connect to the Allura Memory server.
   * Verifies connectivity by calling the health endpoint.
   *
   * @throws {ConnectionError} if the server is unreachable
   */
  async connect(): Promise<void> {
    try {
      await this.health();
      this.state = "connected";
    } catch (error) {
      this.state = "error";
      throw error;
    }
  }

  /**
   * Disconnect from the server.
   * No-op for HTTP clients (connections are not persistent).
   */
  async disconnect(): Promise<void> {
    this.state = "disconnected";
  }

  /**
   * Get the current connection state.
   */
  getState(): ClientState {
    return this.state;
  }

  /**
   * Check if the client is connected.
   */
  get isConnected(): boolean {
    return this.state === "connected";
  }

  // ── Internal Request Handling ───────────────────────────────────────────

  /**
   * Make a request to the Allura Memory server.
   *
   * Uses the legacy JSON-RPC transport (POST /tools/call) by default.
   * The MCP Streamable HTTP transport (POST /mcp) is available but requires
   * the MCP SDK on the client side, so legacy mode is the default for
   * maximum compatibility.
   *
   * @internal
   */
  private async makeRequest<T>(
    method: string,
    params: Record<string, unknown>,
    responseSchema: { parse: (data: unknown) => T }
  ): Promise<T> {
    const fetchFn = this.customFetch ?? globalThis.fetch;

    return withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const url = `${this.baseUrl}/tools/call`;
        const headers = buildHeaders(this.authToken);

        const body = JSON.stringify({
          name: method,
          arguments: params,
        });

        const response = await fetchFn(url, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });

        // Handle non-OK responses
        if (!response.ok) {
          const responseBody = await this.parseResponseBody(response);
          throw createErrorFromResponse(response.status, responseBody);
        }

        // Parse and validate the response
        const responseBody = await this.parseResponseBody(response);

        // The legacy JSON-RPC endpoint returns the result directly
        // (not wrapped in a content array like MCP)
        const validated = responseSchema.parse(responseBody);
        return validated;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new ConnectionError(`Request timed out after ${this.timeout}ms`);
        }
        if (error instanceof AlluraError) {
          throw error;
        }
        if (error instanceof TypeError && error.message.includes("fetch")) {
          throw new ConnectionError(
            `Failed to connect to Allura Memory at ${this.baseUrl}`,
            error
          );
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    }, this.retries);
  }

  /**
   * Parse the response body as JSON.
   * Handles empty responses and non-JSON content types gracefully.
   *
   * @internal
   */
  private async parseResponseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        return await response.json();
      } catch {
        // Empty body or malformed JSON
        return {};
      }
    }

    // Try to parse as text, then JSON
    try {
      const text = await response.text();
      if (!text) return {};
      return JSON.parse(text);
    } catch {
      return {};
    }
  }
}