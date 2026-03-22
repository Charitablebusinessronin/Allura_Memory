/**
 * Trace Reference Validation Utilities
 * Story 1.6: Link Promoted Knowledge Back to Raw Evidence
 * 
 * Validates that trace_refs point to actual PostgreSQL records.
 */

import type { Pool } from "pg";
import { getPool } from "../postgres/connection";

/**
 * Trace reference format: {table}:{id}
 * Examples: events:12345, artifacts:67890
 */
export interface TraceRef {
  /** Table name (e.g., 'events', 'artifacts') */
  table: string;
  /** Record ID in the table */
  id: number | string;
  /** Original string representation */
  raw: string;
}

/**
 * Supported tables for trace references
 */
export const SUPPORTED_TRACE_TABLES = ["events", "artifacts", "task_run", "source_refs"] as const;
export type SupportedTraceTable = (typeof SUPPORTED_TRACE_TABLES)[number];

/**
 * Trace reference validation error
 */
export class TraceRefValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TraceRefValidationError";
  }
}

/**
 * Trace reference validation result
 */
export interface TraceRefValidationResult {
  valid: boolean;
  trace_ref: TraceRef | null;
  error?: string;
  exists?: boolean;
}

/**
 * Parse a trace_ref string into components
 * 
 * @param traceRef - The trace_ref string (e.g., "events:12345")
 * @returns Parsed TraceRef object
 * @throws TraceRefValidationError if format is invalid
 */
export function parseTraceRef(traceRef: string): TraceRef {
  if (!traceRef || typeof traceRef !== "string") {
    throw new TraceRefValidationError("trace_ref must be a non-empty string");
  }

  const trimmed = traceRef.trim();

  if (trimmed.length === 0) {
    throw new TraceRefValidationError("trace_ref cannot be empty or whitespace-only");
  }

  // Check for colon separator
  if (!trimmed.includes(":")) {
    throw new TraceRefValidationError(
      `trace_ref must be in format 'table:id', got: '${trimmed}'`
    );
  }

  const parts = trimmed.split(":");
  if (parts.length !== 2) {
    throw new TraceRefValidationError(
      `trace_ref must have exactly one ':' separator, got: '${trimmed}'`
    );
  }

  const [table, idStr] = parts;
  const id = parseInt(idStr, 10);

  if (isNaN(id)) {
    throw new TraceRefValidationError(
      `trace_ref id must be a number, got: '${idStr}' in '${trimmed}'`
    );
  }

  if (id <= 0) {
    throw new TraceRefValidationError(
      `trace_ref id must be positive, got: ${id} in '${trimmed}'`
    );
  }

  return {
    table: table.toLowerCase(),
    id,
    raw: trimmed,
  };
}

/**
 * Validate that a trace_ref has a supported table
 * 
 * @param traceRef - Parsed trace_ref
 * @returns true if table is supported
 */
export function isSupportedTraceTable(traceRef: TraceRef): boolean {
  return SUPPORTED_TRACE_TABLES.includes(traceRef.table as SupportedTraceTable);
}

/**
 * Format a trace_ref from components
 * 
 * @param table - Table name
 * @param id - Record ID
 * @returns Formatted trace_ref string
 */
export function formatTraceRef(table: string, id: number | string): string {
  return `${table.toLowerCase()}:${id}`;
}

/**
 * Validate a trace_ref string
 * 
 * @param traceRef - The trace_ref to validate
 * @returns Validation result
 */
export function validateTraceRefFormat(traceRef: string): TraceRefValidationResult {
  try {
    const parsed = parseTraceRef(traceRef);

    if (!isSupportedTraceTable(parsed)) {
      return {
        valid: false,
        trace_ref: parsed,
        error: `Unsupported table '${parsed.table}'. Supported tables: ${SUPPORTED_TRACE_TABLES.join(", ")}`,
      };
    }

    return {
      valid: true,
      trace_ref: parsed,
    };
  } catch (error) {
    if (error instanceof TraceRefValidationError) {
      return {
        valid: false,
        trace_ref: null,
        error: error.message,
      };
    }
    return {
      valid: false,
      trace_ref: null,
      error: "Unknown validation error",
    };
  }
}

/**
 * Verify that a trace_ref points to an existing record in PostgreSQL
 * 
 * @param traceRef - The trace_ref to verify
 * @returns Validation result with exists flag
 */
export async function verifyTraceRefExists(traceRef: string): Promise<TraceRefValidationResult> {
  const formatResult = validateTraceRefFormat(traceRef);

  if (!formatResult.valid || !formatResult.trace_ref) {
    return formatResult;
  }

  const parsed = formatResult.trace_ref;
  const pool = getPool();

  try {
    let query: string;
    let params: unknown[];

    switch (parsed.table) {
      case "events":
        query = "SELECT id FROM events WHERE id = $1";
        params = [parsed.id];
        break;

      case "artifacts":
        query = "SELECT id FROM artifacts WHERE id = $1";
        params = [parsed.id];
        break;

      case "task_run":
        query = "SELECT id FROM task_run WHERE id = $1";
        params = [parsed.id];
        break;

      case "source_refs":
        query = "SELECT id FROM source_refs WHERE id = $1";
        params = [parsed.id];
        break;

      default:
        return {
          valid: false,
          trace_ref: parsed,
          error: `Unsupported table '${parsed.table}'`,
        };
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return {
        valid: false,
        trace_ref: parsed,
        error: `No record found in '${parsed.table}' with id ${parsed.id}`,
        exists: false,
      };
    }

    return {
      valid: true,
      trace_ref: parsed,
      exists: true,
    };
  } catch (error) {
    return {
      valid: false,
      trace_ref: parsed,
      error: error instanceof Error ? error.message : "Database query failed",
      exists: false,
    };
  }
}

/**
 * Batch validate multiple trace_refs
 * 
 * @param traceRefs - Array of trace_refs to validate
 * @returns Array of validation results
 */
export async function validateTraceRefs(
  traceRefs: string[]
): Promise<TraceRefValidationResult[]> {
  const results: TraceRefValidationResult[] = [];

  for (const traceRef of traceRefs) {
    const result = await verifyTraceRefExists(traceRef);
    results.push(result);
  }

  return results;
}

/**
 * Extract all trace_refs from a text
 * Useful for finding references in insight content
 * 
 * @param text - Text to search for trace_refs
 * @returns Array of found trace_refs
 */
export function extractTraceRefs(text: string): string[] {
  const pattern = /\b(?:events|artifacts|task_run|source_refs):\d+\b/gi;
  const matches = text.match(pattern) || [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
}

/**
 * Create a trace_ref for an event
 * Convenience function for common use case
 * 
 * @param eventId - The event ID
 * @returns Formatted trace_ref
 */
export function createEventTraceRef(eventId: number): string {
  return formatTraceRef("events", eventId);
}

/**
 * Create a trace_ref for an artifact
 * 
 * @param artifactId - The artifact ID
 * @returns Formatted trace_ref
 */
export function createArtifactTraceRef(artifactId: string): string {
  return formatTraceRef("artifacts", artifactId);
}

/**
 * Check if a string is a valid trace_ref format (without DB verification)
 * 
 * @param value - Value to check
 * @returns true if format is valid
 */
export function isTraceRefFormat(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const parsed = parseTraceRef(value);
    return isSupportedTraceTable(parsed);
  } catch {
    return false;
  }
}

/**
 * Get the table name from a trace_ref
 * 
 * @param traceRef - The trace_ref string
 * @returns Table name or null if invalid
 */
export function getTraceRefTable(traceRef: string): string | null {
  try {
    const parsed = parseTraceRef(traceRef);
    return parsed.table;
  } catch {
    return null;
  }
}

/**
 * Get the ID from a trace_ref
 * 
 * @param traceRef - The trace_ref string
 * @returns ID or null if invalid
 */
export function getTraceRefId(traceRef: string): number | null {
  try {
    const parsed = parseTraceRef(traceRef);
    return typeof parsed.id === "number" ? parsed.id : parseInt(String(parsed.id), 10);
  } catch {
    return null;
  }
}