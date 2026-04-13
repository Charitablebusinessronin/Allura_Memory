/**
 * Next.js Instrumentation — Sentry Initialization
 *
 * This file is loaded by Next.js at server startup, before any other code runs.
 * It initializes Sentry for error tracking and performance monitoring.
 *
 * When NEXT_PUBLIC_SENTRY_DSN is not set, Sentry is a complete no-op.
 * This ensures graceful degradation in development and test environments.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 * @see src/lib/observability/sentry.ts — Core Sentry abstraction
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Initialize Sentry via our abstraction layer.
    // This is a no-op when NEXT_PUBLIC_SENTRY_DSN is not configured.
    const { initSentry } = await import("@/lib/observability/sentry");
    initSentry();
  }
}