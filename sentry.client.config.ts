/**
 * Sentry Client Configuration for Allura Memory (Browser)
 *
 * This file is the entry point for Sentry in the browser.
 * It is automatically loaded by @sentry/nextjs for client-side error tracking.
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
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Don't send in development
    beforeSend(event) {
      if (process.env.SENTRY_ENVIRONMENT === "development") {
        return null;
      }
      return event;
    },
  });
}