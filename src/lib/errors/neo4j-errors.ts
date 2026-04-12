/**
 * Neo4j Domain Error Hierarchy
 *
 * Typed errors for Neo4j operations. Used instead of letting raw
 * Neo4j driver errors propagate — callers get actionable context.
 *
 * Hierarchy:
 *   Neo4jError (base)
 *     ├── Neo4jConnectionError  — driver / session failures
 *     ├── Neo4jQueryError       — query execution failures
 *     └── Neo4jPromotionError   — insight promotion write failures
 */

/**
 * Base error for all Neo4j domain errors.
 * Never thrown directly — use a specific subclass.
 */
export class Neo4jError extends Error {
  public readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "Neo4jError";
    this.cause = cause;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the Neo4j driver cannot establish or use a connection.
 *
 * Typical causes: wrong credentials, Neo4j down, network partition.
 */
export class Neo4jConnectionError extends Neo4jError {
  constructor(cause?: Error) {
    super("Failed to connect to Neo4j", cause);
    this.name = "Neo4jConnectionError";

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an insight promotion write to Neo4j fails.
 *
 * Carries the insight_id so callers can log / audit which insight
 * was being promoted at the time of failure.
 */
export class Neo4jPromotionError extends Neo4jError {
  public readonly insightId: string;

  constructor(insightId: string, cause?: Error) {
    super(`Failed to promote insight ${insightId} to Neo4j`, cause);
    this.name = "Neo4jPromotionError";
    this.insightId = insightId;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a Neo4j read or write query fails (non-promotion).
 *
 * Carries the query text (truncated) for diagnostics.
 */
export class Neo4jQueryError extends Neo4jError {
  public readonly query: string;

  constructor(query: string, cause?: Error) {
    super("Neo4j query failed", cause);
    this.name = "Neo4jQueryError";
    this.query = query.length > 200 ? query.slice(0, 200) + "…" : query;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}