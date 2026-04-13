/**
 * CORS Middleware for Allura Memory
 *
 * Provides a CORS middleware function that:
 * - Validates origin against an allowlist (or allows all in dev mode)
 * - Sets proper CORS headers on all responses
 * - Handles preflight (OPTIONS) requests
 * - Supports dynamic origin validation (regex patterns)
 * - Adds Access-Control-Expose-Headers for custom headers
 * - Adds Access-Control-Max-Age for preflight caching
 */

import type { IncomingMessage } from "http";
import type { CorsConfig } from "./config";
import { loadCorsConfig, compileOriginValidator } from "./config";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CorsResult {
  /** Whether the request was a preflight that was handled */
  isPreflight: boolean;
  /** Whether the origin was allowed */
  originAllowed: boolean;
  /** The resolved origin value (or "*" in dev mode) */
  resolvedOrigin: string;
}

/** Minimal response interface for CORS — avoids coupling to Node ServerResponse */
export interface CorsResponse {
  setHeader(key: string, value: string | number): void;
  writeHead(statusCode: number, headers?: Record<string, string>): void;
  end(data?: string): void;
}

// ── Singleton Config ──────────────────────────────────────────────────────────

let _config: CorsConfig | null = null;

/**
 * Get or initialize the CORS configuration.
 * Caches after first call for the lifetime of the process.
 */
export function getCorsConfig(): CorsConfig {
  if (!_config) {
    _config = loadCorsConfig();
  }
  return _config;
}

/**
 * Reset the cached CORS config (for testing).
 */
export function resetCorsConfig(): void {
  _config = null;
}

/**
 * Override the CORS config (for testing or programmatic setup).
 */
export function setCorsConfig(config: CorsConfig): void {
  _config = config;
}

// ── Custom Headers to Expose ─────────────────────────────────────────────────

/** Headers that clients should be able to read from responses */
const EXPOSE_HEADERS = [
  "X-Request-Id",
  "X-Response-Time",
  "X-Mcp-Session-Id",
] as const;

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * Apply CORS headers to an HTTP response.
 *
 * In development mode (no ALLURA_CORS_ORIGINS), allows all origins with "*".
 * In production mode, validates the request's Origin header against the allowlist.
 *
 * For preflight (OPTIONS) requests, sends a 204 response immediately.
 * For other requests, adds CORS headers and returns control to the caller.
 *
 * @returns CorsResult indicating what happened, so callers can log/audit
 */
export function applyCors(
  req: IncomingMessage,
  res: CorsResponse,
  config?: CorsConfig
): CorsResult {
  const corsConfig = config ?? getCorsConfig();
  const requestOrigin = req.headers["origin"] ?? "";
  const requestMethod = req.headers["access-control-request-method"] ?? "";
  const requestHeaders = req.headers["access-control-request-headers"] ?? "";

  // Determine if this is a preflight request
  const isPreflight = req.method === "OPTIONS";

  // Resolve the allowed origin
  let originAllowed: boolean;
  let resolvedOrigin: string;

  if (corsConfig.isDevelopment) {
    // Development mode: allow all origins
    originAllowed = true;
    resolvedOrigin = requestOrigin || "*";
  } else {
    // Production mode: validate against allowlist
    const validator = compileOriginValidator(corsConfig.origins);
    originAllowed = requestOrigin ? validator(requestOrigin) : false;
    resolvedOrigin = originAllowed ? requestOrigin : "";
  }

  // If origin is not allowed, still set minimal headers
  // but don't include Access-Control-Allow-Origin
  if (!originAllowed && !corsConfig.isDevelopment) {
    if (isPreflight) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("CORS origin not allowed");
      return { isPreflight: true, originAllowed: false, resolvedOrigin: "" };
    }
    // For non-preflight, let the request through but without CORS headers
    // The browser will block the response, but the server still processes it
    return { isPreflight: false, originAllowed: false, resolvedOrigin: "" };
  }

  // Build CORS headers
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": resolvedOrigin,
  };

  // Add credentials header if configured
  if (corsConfig.credentials && resolvedOrigin !== "*") {
    corsHeaders["Access-Control-Allow-Credentials"] = "true";
  }

  // For preflight requests, add full CORS headers
  if (isPreflight) {
    corsHeaders["Access-Control-Allow-Methods"] = corsConfig.methods.join(", ");

    // Use the request's headers if provided, otherwise use configured headers
    const allowHeaders = requestHeaders
      ? requestHeaders
      : corsConfig.headers.join(", ");
    corsHeaders["Access-Control-Allow-Headers"] = allowHeaders;

    corsHeaders["Access-Control-Max-Age"] = String(corsConfig.maxAge);
    corsHeaders["Access-Control-Expose-Headers"] = EXPOSE_HEADERS.join(", ");

    res.writeHead(204, corsHeaders);
    res.end();
    return { isPreflight: true, originAllowed: true, resolvedOrigin };
  }

  // For non-preflight requests, add standard CORS headers
  corsHeaders["Access-Control-Expose-Headers"] = EXPOSE_HEADERS.join(", ");

  // Set headers on the response without ending it
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }

  return { isPreflight: false, originAllowed: true, resolvedOrigin };
}

/**
 * Create a CORS headers object for manual response construction.
 *
 * Use this when you need CORS headers as a plain object (e.g., for
 * JSON-RPC responses that construct headers manually).
 *
 * In development mode, returns { "Access-Control-Allow-Origin": "*" }.
 * In production mode, validates the origin and returns appropriate headers.
 *
 * @returns An object of CORS headers to spread into response headers
 */
export function corsHeaders(
  requestOrigin?: string,
  config?: CorsConfig
): Record<string, string> {
  const corsConfig = config ?? getCorsConfig();
  const origin = requestOrigin ?? "";

  let resolvedOrigin: string;

  if (corsConfig.isDevelopment) {
    resolvedOrigin = "*";
  } else {
    const validator = compileOriginValidator(corsConfig.origins);
    resolvedOrigin = origin && validator(origin) ? origin : "";
  }

  if (!resolvedOrigin) {
    // Origin not allowed — return empty headers (browser will block)
    return {};
  }

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": resolvedOrigin,
  };

  if (corsConfig.credentials && resolvedOrigin !== "*") {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  headers["Access-Control-Allow-Methods"] = corsConfig.methods.join(", ");
  headers["Access-Control-Allow-Headers"] = corsConfig.headers.join(", ");
  headers["Access-Control-Max-Age"] = String(corsConfig.maxAge);
  headers["Access-Control-Expose-Headers"] = EXPOSE_HEADERS.join(", ");

  return headers;
}

/**
 * Check if a preflight request should be handled.
 * Returns true if the request is an OPTIONS request, indicating the caller
 * should not continue processing.
 */
export function isPreflightRequest(req: IncomingMessage): boolean {
  return req.method === "OPTIONS";
}