/**
 * Sentry Configuration for Allura Memory
 *
 * Environment-driven Sentry configuration with safe defaults:
 * - No DSN configured → all operations are no-ops (dev mode)
 * - DSN configured → full error tracking and performance monitoring
 *
 * All env vars are validated with Zod at the boundary.
 */

import { z } from "zod";

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const sentryDsnSchema = z.string().url().optional().or(z.literal(""));

const sentryEnvironmentSchema = z
  .string()
  .default("development")
  .refine(
    (val) => ["development", "staging", "production"].includes(val),
    { message: "SENTRY_ENVIRONMENT must be development, staging, or production" }
  );

const sentryTracesSampleRateSchema = z.coerce.number().min(0).max(1).default(0.1);

const sentryProfilesSampleRateSchema = z.coerce.number().min(0).max(1).default(0.1);

const sentryReleaseSchema = z.string().optional();

// ── Types ────────────────────────────────────────────────────────────────────

export interface SentryConfig {
  /** Sentry DSN — if empty/undefined, Sentry is disabled */
  dsn: string | undefined;
  /** Environment name (development, staging, production) */
  environment: "development" | "staging" | "production";
  /** Trace sampling rate (0.0 to 1.0) */
  tracesSampleRate: number;
  /** Profile sampling rate (0.0 to 1.0) */
  profilesSampleRate: number;
  /** Release version (optional, defaults to package version) */
  release: string | undefined;
  /** Whether Sentry is enabled (has a valid DSN) */
  enabled: boolean;
}

// ── Configuration Loader ─────────────────────────────────────────────────────

/**
 * Load and validate Sentry configuration from environment variables.
 *
 * When `NEXT_PUBLIC_SENTRY_DSN` is not set, Sentry is disabled and all
 * operations become no-ops. This ensures graceful degradation in development.
 */
export function loadSentryConfig(
  env: Record<string, string | undefined> = process.env
): SentryConfig {
  const rawDsn = env.NEXT_PUBLIC_SENTRY_DSN ?? env.SENTRY_DSN ?? "";
  const dsn = rawDsn || undefined;
  const enabled = !!dsn;

  // Only validate environment if Sentry is enabled
  const environment = enabled
    ? (sentryEnvironmentSchema.parse(env.SENTRY_ENVIRONMENT) as "development" | "staging" | "production")
    : "development";

  const tracesSampleRate = enabled
    ? sentryTracesSampleRateSchema.parse(env.SENTRY_TRACES_SAMPLE_RATE)
    : 0;

  const profilesSampleRate = enabled
    ? sentryProfilesSampleRateSchema.parse(env.SENTRY_PROFILES_SAMPLE_RATE)
    : 0;

  const release = env.SENTRY_RELEASE ?? env.npm_package_version ?? undefined;

  return {
    dsn,
    environment,
    tracesSampleRate,
    profilesSampleRate,
    release,
    enabled,
  };
}