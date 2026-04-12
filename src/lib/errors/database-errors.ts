/**
 * Database Error Types
 *
 * Typed errors for database failures. Distinguishes between
 * "database is unreachable" and "query failed" so callers can
 * respond appropriately (503 vs 500).
 *
 * Iron Law: No silent failures. If the database is down, the caller
 * must know — returning empty results hides fires.
 */

/**
 * Thrown when the database cannot be reached at all.
 *
 * Causes: ECONNREFUSED, connection timeout, auth failure,
 * pool exhaustion, DNS resolution failure.
 *
 * Callers should treat this as 503 Service Unavailable.
 */
export class DatabaseUnavailableError extends Error {
  public readonly operation: string;

  constructor(operation: string, cause?: Error) {
    super(`Database unavailable for operation: ${operation}`);
    this.name = "DatabaseUnavailableError";
    this.operation = operation;
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Thrown when the database is reachable but the query itself fails.
 *
 * Causes: syntax errors, constraint violations, permission denied
 * on a specific table, schema mismatch.
 *
 * Callers should treat this as 500 Internal Server Error.
 */
export class DatabaseQueryError extends Error {
  public readonly operation: string;
  public readonly query: string;

  constructor(operation: string, query: string, cause?: Error) {
    super(`Database query failed for operation: ${operation}`);
    this.name = "DatabaseQueryError";
    this.operation = operation;
    this.query = query;
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Classify a PostgreSQL error as either connection or query failure.
 *
 * pg (node-postgres) errors carry a `code` property. Connection-level
 * errors use codes like ECONNREFUSED, ENOTFOUND, or have
 * error.code starting with "57" (operator intervention) or
 * "08" (connection exception) per the PostgreSQL error code spec.
 *
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export function classifyPostgresError(
  err: Error,
  operation: string,
  query: string
): DatabaseUnavailableError | DatabaseQueryError {
  const anyErr = err as Error & { code?: string; syscall?: string };

  // Network / OS-level connection failures
  const connectionCodes = [
    "ECONNREFUSED",
    "ECONNRESET",
    "ENOTFOUND",
    "ETIMEDOUT",
    "EPIPE",
    "EAI_AGAIN",
    "CONN_TIMEOUT",
  ];

  if (
    anyErr.code &&
    (connectionCodes.includes(anyErr.code) ||
      anyErr.code.startsWith("08") || // PG connection exception
      anyErr.code.startsWith("57") ||  // PG operator intervention
      anyErr.code === "3D000" ||       // invalid catalog name (wrong DB)
      anyErr.code === "28000" ||       // invalid authorization specification
      anyErr.code === "28P01")         // invalid password
  ) {
    return new DatabaseUnavailableError(operation, err);
  }

  // Anything else is a query-level failure
  return new DatabaseQueryError(operation, query, err);
}