/**
 * Observability Module — Public API
 *
 * Production-grade error tracking and performance monitoring for Allura Memory.
 *
 * - Sentry integration (no-op when DSN is not configured)
 * - API route wrapper with automatic error capture
 * - Performance transaction tracking
 * - Request context enrichment
 */

export type { SentryConfig } from "./config.js";
export { loadSentryConfig } from "./config.js";

export type {
  CaptureContext,
  TransactionContext,
  SentryTransaction,
} from "./sentry.js";
export {
  initSentry,
  isSentryEnabled,
  captureException,
  captureMessage,
  setUser,
  setTag,
  startTransaction,
  extractRequestContext,
  resetSentry,
} from "./sentry.js";

export type { ApiHandler, SentryHandlerOptions } from "./with-sentry.js";
export { withSentry, withSentryHttp } from "./with-sentry.js";