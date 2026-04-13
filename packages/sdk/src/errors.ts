/**
 * @allura/sdk — Custom error classes
 *
 * Hierarchy:
 *   AlluraError
 *   ├── AuthenticationError  (401)
 *   ├── ValidationError       (400)
 *   ├── NotFoundError        (404)
 *   ├── RateLimitError       (429)
 *   ├── ServerError          (500)
 *   └── ConnectionError      (network)
 */

/**
 * Base error class for all Allura SDK errors.
 * Includes machine-readable error code and HTTP status code.
 */
export class AlluraError extends Error {
  /** Machine-readable error code */
  public readonly code: string;
  /** HTTP status code (if applicable) */
  public readonly statusCode: number;
  /** Original response body (if available) */
  public readonly body?: unknown;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    body?: unknown
  ) {
    super(message);
    this.name = "AlluraError";
    this.code = code;
    this.statusCode = statusCode;
    this.body = body;

    // Restore prototype chain (required for extending built-in classes in TS)
    Object.setPrototypeOf(this, AlluraError.prototype);
  }
}

/**
 * Thrown when authentication fails (HTTP 401).
 * The Bearer token is missing, invalid, or expired.
 */
export class AuthenticationError extends AlluraError {
  constructor(message: string = "Unauthorized: Invalid or missing Bearer token", body?: unknown) {
    super(message, "AUTHENTICATION_ERROR", 401, body);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Thrown when request validation fails (HTTP 400).
 * Includes group_id format violations and missing required fields.
 */
export class ValidationError extends AlluraError {
  /** Field-level validation details */
  public readonly fields?: Record<string, string[]>;

  constructor(
    message: string = "Validation error",
    fields?: Record<string, string[]>,
    body?: unknown
  ) {
    super(message, "VALIDATION_ERROR", 400, body);
    this.name = "ValidationError";
    this.fields = fields;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Thrown when a requested resource is not found (HTTP 404).
 * Includes memory not found and unknown tool errors.
 */
export class NotFoundError extends AlluraError {
  constructor(message: string = "Resource not found", body?: unknown) {
    super(message, "NOT_FOUND", 404, body);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Thrown when rate limit is exceeded (HTTP 429).
 * Includes retry-after hint when available.
 */
export class RateLimitError extends AlluraError {
  /** Suggested retry delay in seconds */
  public readonly retryAfter?: number;

  constructor(
    message: string = "Rate limit exceeded",
    retryAfter?: number,
    body?: unknown
  ) {
    super(message, "RATE_LIMIT_ERROR", 429, body);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Thrown when the server encounters an internal error (HTTP 5xx).
 */
export class ServerError extends AlluraError {
  constructor(message: string = "Internal server error", statusCode: number = 500, body?: unknown) {
    super(message, "SERVER_ERROR", statusCode, body);
    this.name = "ServerError";
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

/**
 * Thrown when the SDK cannot connect to the Allura server.
 * Network-level errors: DNS failure, connection refused, timeout.
 */
export class ConnectionError extends AlluraError {
  /** The original cause (if available) */
  public readonly cause?: Error;

  constructor(message: string = "Connection failed", cause?: Error) {
    super(message, "CONNECTION_ERROR", 0);
    this.name = "ConnectionError";
    this.cause = cause;
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

/**
 * Thrown when all retry attempts are exhausted.
 * Wraps the last error that caused the final retry failure.
 */
export class RetryExhaustedError extends AlluraError {
  /** Number of attempts made */
  public readonly attempts: number;
  /** The last error that caused the final retry failure */
  public readonly lastError: Error;

  constructor(attempts: number, lastError: Error) {
    super(
      `All ${attempts} retry attempts exhausted: ${lastError.message}`,
      "RETRY_EXHAUSTED",
      lastError instanceof AlluraError ? lastError.statusCode : 0
    );
    this.name = "RetryExhaustedError";
    this.attempts = attempts;
    this.lastError = lastError;
    Object.setPrototypeOf(this, RetryExhaustedError.prototype);
  }
}

/**
 * Create an appropriate AlluraError from an HTTP response.
 *
 * @internal
 */
export function createErrorFromResponse(
  statusCode: number,
  body: unknown
): AlluraError {
  const message =
    typeof body === "object" && body !== null && "error" in body
      ? String((body as Record<string, unknown>).error)
      : `HTTP ${statusCode}`;

  switch (statusCode) {
    case 400:
      return new ValidationError(message, undefined, body);
    case 401:
      return new AuthenticationError(message, body);
    case 404:
      return new NotFoundError(message, body);
    case 429: {
      const retryAfter =
        typeof body === "object" && body !== null && "retry_after" in body
          ? Number((body as Record<string, unknown>).retry_after)
          : undefined;
      return new RateLimitError(message, retryAfter, body);
    }
    default:
      if (statusCode >= 500) {
        return new ServerError(message, statusCode, body);
      }
      return new AlluraError(message, "UNKNOWN_ERROR", statusCode, body);
  }
}