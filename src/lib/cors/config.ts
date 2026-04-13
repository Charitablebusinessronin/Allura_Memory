/**
 * CORS Configuration for Allura Memory
 *
 * Environment-driven CORS policy with safe defaults:
 * - Development mode (no ALLURA_CORS_ORIGINS): allows all origins
 * - Production mode (ALLURA_CORS_ORIGINS set): enforces allowlist
 *
 * All env vars are validated with Zod at the boundary.
 */

import { z } from "zod";

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const corsOriginsSchema = z
  .string()
  .min(1)
  .transform((val) =>
    val
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0)
  )
  .pipe(z.array(z.string().min(1)));

const corsMethodsSchema = z
  .string()
  .default("GET,POST,DELETE,OPTIONS")
  .transform((val) =>
    val
      .split(",")
      .map((m) => m.trim().toUpperCase())
      .filter((m) => m.length > 0)
  )
  .pipe(z.array(z.string().min(1)));

const corsHeadersSchema = z
  .string()
  .default("Content-Type,Authorization")
  .transform((val) =>
    val
      .split(",")
      .map((h) => h.trim())
      .filter((h) => h.length > 0)
  )
  .pipe(z.array(z.string().min(1)));

const corsMaxAgeSchema = z.coerce.number().int().min(0).default(86400);

const corsCredentialsSchema = z
  .string()
  .default("true")
  .transform((val) => val === "true")
  .pipe(z.boolean());

// ── Types ────────────────────────────────────────────────────────────────────

export interface CorsConfig {
  /** Allowed origins — empty array means "allow all" (dev mode) */
  origins: string[];
  /** Allowed HTTP methods */
  methods: string[];
  /** Allowed request headers */
  headers: string[];
  /** Preflight cache duration in seconds */
  maxAge: number;
  /** Whether to include credentials (cookies, auth headers) */
  credentials: boolean;
  /** Whether running in development mode (no origin allowlist) */
  isDevelopment: boolean;
}

// ── Configuration Loader ─────────────────────────────────────────────────────

/**
 * Load and validate CORS configuration from environment variables.
 *
 * When `ALLURA_CORS_ORIGINS` is not set, the server runs in development mode
 * and allows all origins. When set, only the listed origins are permitted.
 *
 * Regex patterns are supported — prefix with `/` and suffix with `/`:
 *   ALLURA_CORS_ORIGINS=https://*.example.com,/^https:\/\/[a-z]+\.example\.com$/
 */
export function loadCorsConfig(env: Record<string, string | undefined> = process.env): CorsConfig {
  const rawOrigins = env.ALLURA_CORS_ORIGINS;
  const isDevelopment = !rawOrigins || rawOrigins.trim() === "";

  const origins = isDevelopment ? [] : corsOriginsSchema.parse(rawOrigins);
  const methods = corsMethodsSchema.parse(env.ALLURA_CORS_METHODS);
  const headers = corsHeadersSchema.parse(env.ALLURA_CORS_HEADERS);
  const maxAge = corsMaxAgeSchema.parse(env.ALLURA_CORS_MAX_AGE);
  const credentials = corsCredentialsSchema.parse(env.ALLURA_CORS_CREDENTIALS);

  return {
    origins,
    methods,
    headers,
    maxAge,
    credentials,
    isDevelopment,
  };
}

// ── Origin Validation ────────────────────────────────────────────────────────

/**
 * Compile an array of origin patterns into a validation function.
 *
 * Patterns can be:
 * - Exact strings: "https://app.example.com"
 * - Regex patterns: "/^https:\\/\\/[a-z]+\\.example\\.com$/"
 *
 * Returns a function that checks whether a given origin matches any pattern.
 */
export function compileOriginValidator(
  patterns: string[]
): (origin: string) => boolean {
  const matchers: Array<{ type: "exact"; value: string } | { type: "regex"; regex: RegExp }> = [];

  for (const pattern of patterns) {
    if (pattern.startsWith("/") && pattern.endsWith("/")) {
      // Regex pattern: /pattern/
      const regexStr = pattern.slice(1, -1);
      try {
        matchers.push({ type: "regex", regex: new RegExp(regexStr) });
      } catch {
        console.warn(`[cors] Invalid regex pattern in CORS origins: ${pattern}`);
      }
    } else {
      matchers.push({ type: "exact", value: pattern });
    }
  }

  return (origin: string): boolean => {
    return matchers.some((matcher) => {
      if (matcher.type === "exact") {
        return matcher.value === origin;
      }
      return matcher.regex.test(origin);
    });
  };
}