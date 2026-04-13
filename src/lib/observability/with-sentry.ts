/**
 * Sentry API Route Wrapper for Allura Memory
 *
 * Higher-order function that wraps Next.js API route handlers with:
 * - Automatic error capture and reporting
 * - Request context enrichment (method, path, group_id)
 * - Performance transaction tracking
 * - Graceful error responses
 *
 * Usage:
 *   import { withSentry } from "@/lib/observability/with-sentry";
 *
 *   export default withSentry(async (req, res) => {
 *     // Your handler logic
 *     res.status(200).json({ ok: true });
 *   });
 */

import type { IncomingMessage, ServerResponse } from "http";
import {
  captureException,
  extractRequestContext,
  startTransaction,
  isSentryEnabled,
} from "./sentry.js";
import type { CaptureContext, SentryTransaction } from "./sentry.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type ApiHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<void> | void;

export interface SentryHandlerOptions {
  /** Transaction operation name (default: "http.server") */
  operation?: string;
  /** Additional tags to add to the transaction */
  tags?: Record<string, string | number | boolean>;
  /** Additional context for error capture */
  extraContext?: Record<string, unknown>;
}

// ── Wrapper ───────────────────────────────────────────────────────────────────

/**
 * Wrap an API route handler with Sentry error tracking and performance monitoring.
 *
 * When Sentry is not configured, this is a transparent pass-through.
 * When Sentry is configured, it:
 * 1. Starts a performance transaction
 * 2. Captures unhandled errors with request context
 * 3. Returns a 500 error response for unhandled exceptions
 *
 * @param handler - The API route handler to wrap
 * @param options - Optional configuration for the Sentry integration
 */
export function withSentry(
  handler: ApiHandler,
  options?: SentryHandlerOptions
): ApiHandler {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const method = req.method ?? "GET";
    const path = (req.url ?? "/").split("?")[0];
    const transactionName = `${method} ${path}`;
    const operation = options?.operation ?? "http.server";

    // Start a performance transaction (no-op if Sentry is disabled)
    const transaction: SentryTransaction = startTransaction({
      name: transactionName,
      op: operation,
      tags: {
        "request.method": method,
        "request.path": path,
        ...options?.tags,
      },
    });

    try {
      await handler(req, res);
    } catch (error) {
      // Extract request context for Sentry enrichment
      const requestContext: CaptureContext = {
        ...extractRequestContext(req),
        extra: {
          ...extractRequestContext(req).extra,
          ...options?.extraContext,
        },
      };

      // Capture the error with full context
      captureException(error, requestContext);

      // Send a 500 response if headers haven't been sent yet
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Internal server error",
            message: isSentryEnabled()
              ? "An error occurred and has been reported."
              : "An internal error occurred.",
          })
        );
      }
    } finally {
      transaction.finish();
    }
  };
}

/**
 * Wrap a raw HTTP handler (non-Next.js) with Sentry error tracking.
 *
 * This is the same as `withSentry` but with a different name for clarity
 * when used in raw HTTP server contexts (like the MCP gateway).
 */
export const withSentryHttp = withSentry;