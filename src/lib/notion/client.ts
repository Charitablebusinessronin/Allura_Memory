/**
 * Notion API Client
 * Story 2.5: Synchronize Best Designs to the Notion Registry
 *
 * Implements Notion API integration with authentication, backoff, and retry.
 */

import { env } from "process";

// Server-only guard: throw if imported in browser environment
if (typeof window !== "undefined") {
  throw new Error("Notion client module can only be used server-side");
}

/**
 * Notion API configuration
 */
export interface NotionClientConfig {
  apiKey: string;
  apiVersion: string;
  timeoutMs: number;
  maxRetries: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
}

/**
 * Default configuration matching Notion API limits
 */
const DEFAULT_CONFIG: Omit<NotionClientConfig, "apiKey"> = {
  apiVersion: "2022-06-28",
  timeoutMs: 30000, // 30 seconds
  maxRetries: 5,
  baseRetryDelayMs: 1000, // 1 second
  maxRetryDelayMs: 32000, // 32 seconds
};

/**
 * Notion API error types
 */
export class NotionApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "NotionApiError";
  }
}

/**
 * Rate limit error
 */
export class NotionRateLimitError extends NotionApiError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super("Rate limit exceeded", 429, "rate_limited", true);
    this.retryAfter = retryAfter;
  }
}

/**
 * Authentication error
 */
export class NotionAuthError extends NotionApiError {
  constructor(message: string = "Authentication failed") {
    super(message, 401, "unauthorized", false);
  }
}

/**
 * Not found error
 */
export class NotionNotFoundError extends NotionApiError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "not_found", false);
  }
}

/**
 * Validation error
 */
export class NotionValidationError extends NotionApiError {
  constructor(message: string) {
    super(message, 400, "validation_error", false);
  }
}

/**
 * Page creation result
 */
export interface CreatePageResult {
  id: string;
  url: string;
  createdTime: Date;
  lastEditedTime: Date;
}

/**
 * Page update result
 */
export interface UpdatePageResult {
  id: string;
  url: string;
  lastEditedTime: Date;
}

/**
 * Page retrieval result
 */
export interface GetPageResult {
  id: string;
  url: string;
  createdTime: Date;
  lastEditedTime: Date;
  properties: Record<string, unknown>;
  archived: boolean;
}

/**
 * Database query result
 */
export interface QueryDatabaseResult {
  results: Array<{
    id: string;
    url: string;
    properties: Record<string, unknown>;
    createdTime: Date;
    lastEditedTime: Date;
  }>;
  hasMore: boolean;
  nextCursor: string | null;
}

/**
 * Notion page block
 */
export interface NotionBlockInput {
  object: "block";
  type: string;
  [key: string]: unknown;
}

/**
 * Create page payload
 */
export interface CreatePagePayload {
  parent: { database_id: string } | { page_id: string };
  properties: Record<string, unknown>;
  children?: NotionBlockInput[];
}

/**
 * Update page payload
 */
export interface UpdatePagePayload {
  pageId: string;
  properties?: Record<string, unknown>;
  archived?: boolean;
}

/**
 * Append blocks payload
 */
export interface AppendBlocksPayload {
  blockId: string;
  children: NotionBlockInput[];
}

/**
 * Sleep utility for backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  const delay = baseDelay * Math.pow(2, attempt);
  const jittered = delay + Math.random() * 1000;
  return Math.min(jittered, maxDelay);
}

/**
 * Notion API Client with backoff and retry
 */
export class NotionClient {
  private readonly config: NotionClientConfig;
  private readonly baseUrl = "https://api.notion.com/v1";

  constructor(config?: Partial<NotionClientConfig>) {
    const apiKey = config?.apiKey ?? env.NOTION_API_KEY;

    if (!apiKey) {
      throw new Error("NOTION_API_KEY environment variable is required");
    }

    this.config = {
      apiKey,
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Make an authenticated request to Notion API
   * Implements backoff and retry for AC: Rate limit handling
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(method, path, body);

        if (response.ok) {
          return (await response.json()) as T;
        }

        const errorBody = await this.parseErrorBody(response);
        const error = this.handleError(response, errorBody);

        if (!error.retryable || attempt === this.config.maxRetries) {
          throw error;
        }

        lastError = error;

        const delay = calculateBackoff(
          attempt,
          this.config.baseRetryDelayMs,
          this.config.maxRetryDelayMs
        );

        console.warn(
          `[NotionClient] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
          error.message
        );

        await sleep(delay);
      } catch (error) {
        if (error instanceof NotionApiError) {
          throw error;
        }

        if (attempt === this.config.maxRetries) {
          throw new NotionApiError(
            `Request failed: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }

        lastError = error instanceof Error ? error : new Error("Unknown error");

        const delay = calculateBackoff(
          attempt,
          this.config.baseRetryDelayMs,
          this.config.maxRetryDelayMs
        );

        console.warn(
          `[NotionClient] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
          lastError.message
        );

        await sleep(delay);
      }
    }

    throw lastError ?? new NotionApiError("Max retries exceeded");
  }

  /**
   * Make HTTP request to Notion API
   */
  private async makeRequest(
    method: string,
    path: string,
    body?: unknown
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      "Notion-Version": this.config.apiVersion,
    };

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    return fetch(url, options);
  }

  /**
   * Parse error body from response
   */
  private async parseErrorBody(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Handle error response
   */
  private handleError(response: Response, body: unknown): NotionApiError {
    const statusCode = response.status;
    const errorMessage = this.extractErrorMessage(body);
    const retryable = this.isRetryable(statusCode);

    if (statusCode === 401) {
      return new NotionAuthError(errorMessage);
    }

    if (statusCode === 404) {
      return new NotionNotFoundError(errorMessage);
    }

    if (statusCode === 400) {
      return new NotionValidationError(errorMessage);
    }

    if (statusCode === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") ?? "60", 10);
      return new NotionRateLimitError(retryAfter);
    }

    return new NotionApiError(errorMessage, statusCode, undefined, retryable);
  }

  /**
   * Extract error message from body
   */
  private extractErrorMessage(body: unknown): string {
    if (!body) {
      return "Unknown error";
    }

    if (typeof body === "object" && body !== null) {
      const errorBody = body as { message?: string; error?: string };
      return errorBody.message ?? errorBody.error ?? "Unknown error";
    }

    return "Unknown error";
  }

  /**
   * Check if status code is retryable
   */
  private isRetryable(statusCode: number): boolean {
    return statusCode >= 500 || statusCode === 429;
  }

  /**
   * Create a page in a database
   * AC: Implements page creation
   */
  public async createPage(payload: CreatePagePayload): Promise<CreatePageResult> {
    const response = await this.request<{
      id: string;
      url: string;
      created_time: string;
      last_edited_time: string;
    }>("POST", "/pages", payload);

    return {
      id: response.id,
      url: response.url,
      createdTime: new Date(response.created_time),
      lastEditedTime: new Date(response.last_edited_time),
    };
  }

  /**
   * Update a page
   * AC: Implements page update
   */
  public async updatePage(payload: UpdatePagePayload): Promise<UpdatePageResult> {
    const { pageId, ...updateData } = payload;

    const response = await this.request<{
      id: string;
      url: string;
      last_edited_time: string;
    }>("PATCH", `/pages/${pageId}`, updateData);

    return {
      id: response.id,
      url: response.url,
      lastEditedTime: new Date(response.last_edited_time),
    };
  }

  /**
   * Get a page by ID
   */
  public async getPage(pageId: string): Promise<GetPageResult> {
    const response = await this.request<{
      id: string;
      url: string;
      created_time: string;
      last_edited_time: string;
      properties: Record<string, unknown>;
      archived: boolean;
    }>("GET", `/pages/${pageId}`);

    return {
      id: response.id,
      url: response.url,
      createdTime: new Date(response.created_time),
      lastEditedTime: new Date(response.last_edited_time),
      properties: response.properties,
      archived: response.archived,
    };
  }

  /**
   * Query a database
   */
  public async queryDatabase(
    databaseId: string,
    options?: {
      filter?: Record<string, unknown>;
      sorts?: Array<{ property: string; direction: "ascending" | "descending" }>;
      start_cursor?: string;
      page_size?: number;
    }
  ): Promise<QueryDatabaseResult> {
    const response = await this.request<{
      results: Array<{
        id: string;
        url: string;
        properties: Record<string, unknown>;
        created_time: string;
        last_edited_time: string;
      }>;
      has_more: boolean;
      next_cursor: string | null;
    }>("POST", `/databases/${databaseId}/query`, options ?? {});

    return {
      results: response.results.map((r) => ({
        id: r.id,
        url: r.url,
        properties: r.properties,
        createdTime: new Date(r.created_time),
        lastEditedTime: new Date(r.last_edited_time),
      })),
      hasMore: response.has_more,
      nextCursor: response.next_cursor,
    };
  }

  /**
   * Append blocks to a page
   */
  public async appendBlocks(payload: AppendBlocksPayload): Promise<void> {
    await this.request("PATCH", `/blocks/${payload.blockId}/children`, {
      children: payload.children,
    });
  }

  /**
   * Delete/archive a page
   */
  public async archivePage(pageId: string): Promise<void> {
    await this.updatePage({ pageId, archived: true });
  }

  /**
   * Search for pages by design ID
   */
  public async searchByDesignId(
    databaseId: string,
    designId: string
  ): Promise<QueryDatabaseResult> {
    return this.queryDatabase(databaseId, {
      filter: {
        property: "Design_ID",
        rich_text: {
          equals: designId,
        },
      },
    });
  }

  /**
   * Check if client is healthy (valid API key)
   */
  public async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/users/me`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.config.apiKey}`,
          "Notion-Version": this.config.apiVersion,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Singleton client instance
 */
let clientInstance: NotionClient | null = null;

/**
 * Get or create the singleton Notion client
 */
export function getNotionClient(): NotionClient {
  if (!clientInstance) {
    clientInstance = new NotionClient();
  }

  return clientInstance;
}

/**
 * Close the client (reset singleton)
 */
export function closeNotionClient(): void {
  clientInstance = null;
}

/**
 * Create a Notion client with custom config
 */
export function createNotionClient(config?: Partial<NotionClientConfig>): NotionClient {
  return new NotionClient(config);
}