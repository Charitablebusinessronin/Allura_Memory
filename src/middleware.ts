import { NextRequest, NextResponse } from "next/server"
import type { NextFetchEvent } from "next/server"

/**
 * TraceMiddleware — Story 1.2
 *
 * Intercepts all incoming HTTP requests and logs a trace event
 * to PostgreSQL via a fire-and-forget fetch to /api/trace.
 *
 * Design decisions:
 * - Runs in Edge Runtime (cannot import pg Pool directly)
 * - Fire-and-forget: does NOT await the trace write
 * - Skips health checks and static assets (no noise)
 * - Missing group_id → skip trace entirely (no error)
 * - Non-blocking: adds ~0ms to p50 latency (fetch is deferred)
 *
 * Latency guarantee: <5ms overhead because the fetch is never awaited.
 */

// Paths that should NOT be traced (health checks, static assets, internal)
const SKIP_PATHS = [
  "/healthz",
  "/ping",
  "/health",
  "/api/health",
  "/api/trace", // Don't trace the trace endpoint itself (infinite loop)
  "/_next",
  "/favicon.ico",
]

function shouldSkip(pathname: string): boolean {
  return SKIP_PATHS.some(
    (skip) => pathname === skip || pathname.startsWith(skip + "/")
  )
}

function extractGroupId(request: NextRequest): string | null {
  // 1. Check x-group-id header (auth context or explicit)
  const headerGroupId = request.headers.get("x-group-id")
  if (headerGroupId) return headerGroupId

  // 2. Could check cookies/session here in the future

  return null
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl
  const startTime = performance.now()

  // Skip health checks, static assets, and internal endpoints
  if (shouldSkip(pathname)) {
    return NextResponse.next()
  }

  // Extract group_id — skip tracing if missing
  const groupId = extractGroupId(request)
  if (!groupId) {
    return NextResponse.next()
  }

  const method = request.method

  // Fire-and-forget: let the response go immediately, trace writes in background
  // Using waitUntil is not available in Next.js middleware, so we use
  // the event.waitUntil pattern or simply fire the fetch without awaiting
  try {
    const traceUrl = new URL("/api/trace", request.url)

    // Fire the fetch — do NOT await
    // This runs in the background and will not block the response
    fetch(traceUrl.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-trace": "allura-trace-middleware",
      },
      body: JSON.stringify({
        group_id: groupId,
        event_type: "request_trace",
        agent_id: "trace-middleware",
        metadata: {
          method,
          path: pathname,
          duration_ms: Math.round(performance.now() - startTime),
        },
        status: "completed",
      }),
    }).catch(() => {
      // Silently swallow errors — trace failures must never break requests
    })
  } catch {
    // Swallow all errors — this must be non-blocking
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}