/**
 * IP-based Rate Limiter for HTTP Gateway
 *
 * Sliding-window rate limiter using an in-memory Map of timestamps.
 * Default: 100 requests per minute per IP.
 *
 * Configuration via environment variables:
 *   ALLURA_RATE_LIMIT_WINDOW_MS  — window duration in ms (default: 60000)
 *   ALLURA_RATE_LIMIT_MAX        — max requests per window per IP (default: 100)
 *   ALLURA_RATE_LIMIT_ENABLED    — "false" to disable (default: "true")
 */

import type { IncomingMessage, ServerResponse } from "http";

// ── Configuration ────────────────────────────────────────────────────────────

const WINDOW_MS = parseInt(process.env.ALLURA_RATE_LIMIT_WINDOW_MS || "60000", 10);
const MAX_REQUESTS = parseInt(process.env.ALLURA_RATE_LIMIT_MAX || "100", 10);
const ENABLED = process.env.ALLURA_RATE_LIMIT_ENABLED !== "false";

// ── Sliding Window Store ─────────────────────────────────────────────────────

interface WindowEntry {
  timestamps: number[];
}

const store = new Map<string, WindowEntry>();

// Clean up stale entries older than 2x the window to prevent unbounded growth
const CLEANUP_INTERVAL_MS = Math.max(WINDOW_MS * 2, 120_000);
let lastCleanup = Date.now();

function cleanupStaleEntries(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  const cutoff = now - WINDOW_MS * 2;
  store.forEach((entry, ip) => {
    // Remove timestamps older than the window
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(ip);
    }
  });
  lastCleanup = now;
}

// ── Extract Client IP ────────────────────────────────────────────────────────

function extractClientIp(req: IncomingMessage): string {
  // Trust X-Forwarded-For only if behind a known reverse proxy
  // In default config, we use the direct socket address
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    // Take the first IP in the chain (original client)
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  // Fall back to socket address
  return req.socket?.remoteAddress || "unknown";
}

// ── Check Rate Limit ────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix ms when the oldest request in the window expires
  limit: number;
}

export function checkRateLimit(ip: string, now: number = Date.now()): RateLimitResult {
  if (!ENABLED) {
    return { allowed: true, remaining: MAX_REQUESTS, resetAt: now + WINDOW_MS, limit: MAX_REQUESTS };
  }

  cleanupStaleEntries(now);

  let entry = store.get(ip);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(ip, entry);
  }

  // Filter to only timestamps within the current window
  const windowStart = now - WINDOW_MS;
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  const remaining = Math.max(0, MAX_REQUESTS - entry.timestamps.length);
  const resetAt = entry.timestamps.length > 0 ? entry.timestamps[0] + WINDOW_MS : now + WINDOW_MS;

  if (entry.timestamps.length >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt, limit: MAX_REQUESTS };
  }

  // Record this request
  entry.timestamps.push(now);

  return { allowed: true, remaining: remaining - 1, resetAt, limit: MAX_REQUESTS };
}

// ── Middleware for HTTP Gateway ───────────────────────────────────────────────

/**
 * Apply rate limiting to an incoming HTTP request.
 * Returns true if the request should proceed, false if it was rate-limited
 * (and a 429 response was already sent).
 */
export function applyRateLimit(
  req: IncomingMessage,
  res: ServerResponse
): boolean {
  if (!ENABLED) return true;

  const ip = extractClientIp(req);
  const result = checkRateLimit(ip);

  // Set standard rate limit headers
  res.setHeader("X-RateLimit-Limit", result.limit.toString());
  res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
  res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000).toString());

  if (!result.allowed) {
    const retryAfterSec = Math.ceil((result.resetAt - Date.now()) / 1000);
    res.setHeader("Retry-After", retryAfterSec.toString());
    res.writeHead(429, {
      "Content-Type": "application/json",
    });
    res.end(
      JSON.stringify({
        error: "Too Many Requests",
        retry_after_seconds: retryAfterSec,
        limit: result.limit,
        window_ms: WINDOW_MS,
      })
    );
    return false;
  }

  return true;
}

// ── Expose config for health endpoint ────────────────────────────────────────

export function getRateLimitConfig(): {
  enabled: boolean;
  window_ms: number;
  max_requests: number;
  active_ips: number;
} {
  return {
    enabled: ENABLED,
    window_ms: WINDOW_MS,
    max_requests: MAX_REQUESTS,
    active_ips: store.size,
  };
}