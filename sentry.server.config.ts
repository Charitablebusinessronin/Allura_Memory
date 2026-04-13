/**
 * Sentry Server Configuration for Allura Memory (Node.js)
 *
 * This file is the entry point for Sentry on the server side.
 * It is automatically loaded by @sentry/nextjs for server-side error tracking.
 *
 * When NEXT_PUBLIC_SENTRY_DSN is not set, Sentry is a complete no-op.
 * This ensures graceful degradation in development and test environments.
 *
 * Install @sentry/nextjs to enable Sentry:
 *   bun add @sentry/nextjs
 */

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0.1),
    release: process.env.SENTRY_RELEASE ?? process.env.npm_package_version,
    // Don't send in development
    beforeSend(event) {
      if (process.env.SENTRY_ENVIRONMENT === "development") {
        console.error("[sentry] Captured error in development (not sent):", event);
        return null;
      }
      return event;
    },
  });
}