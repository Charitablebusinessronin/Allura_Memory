/**
 * TraceMiddleware Tests — Story 1.2
 *
 * Tests for the Next.js middleware that intercepts HTTP requests
 * and logs trace events to PostgreSQL via fire-and-forget fetch.
 *
 * Three test cases:
 * 1. Positive: trace event sent on valid request with group_id header
 * 2. Negative: missing group_id → no trace, no error
 * 3. Edge: middleware doesn't block response (latency check)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// Import after mocking
import proxy, { config } from "../proxy"
import { NextRequest } from "next/server"

function createMockRequest(path: string, headers: Record<string, string> = {}): NextRequest {
  const url = `http://localhost:3000${path}`
  return new NextRequest(url, {
    headers: new Headers(headers),
    method: "GET",
  })
}

describe("TraceMiddleware", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ ok: true, status: 201 })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("Positive: trace event on valid request with group_id", () => {
    it("should fire-and-forget a trace fetch when x-group-id header is present", async () => {
      const request = createMockRequest("/api/memory", {
        "x-group-id": "allura-system",
      })

      const mockEvent = { waitUntil: vi.fn() } as unknown as NextFetchEvent

      const response = await proxy(request, mockEvent)

      // Response should be NextResponse.next() — middleware passes through
      expect(response).toBeDefined()
      expect(response.status).toBe(200)

      // fetch should have been called with the trace endpoint
      expect(mockFetch).toHaveBeenCalledTimes(1)

      const [fetchUrl, fetchOptions] = mockFetch.mock.calls[0]
      expect(fetchUrl).toContain("/api/trace")
      expect(fetchOptions.method).toBe("POST")
      expect(fetchOptions.headers["x-internal-trace"]).toBe("allura-trace-middleware")

      const body = JSON.parse(fetchOptions.body)
      expect(body.group_id).toBe("allura-system")
      expect(body.event_type).toBe("request_trace")
      expect(body.agent_id).toBe("trace-middleware")
      expect(body.metadata.method).toBe("GET")
      expect(body.metadata.path).toBe("/api/memory")
      expect(body.metadata.duration_ms).toBeTypeOf("number")
      expect(body.status).toBe("completed")
    })
  })

  describe("Negative: missing group_id → no trace, no error", () => {
    it("should skip tracing when x-group-id header is missing", async () => {
      const request = createMockRequest("/api/memory")

      const mockEvent = { waitUntil: vi.fn() } as unknown as NextFetchEvent

      const response = await proxy(request, mockEvent)

      // Response should still pass through
      expect(response).toBeDefined()

      // No fetch should have been made
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("should skip tracing for health check paths", async () => {
      const paths = ["/healthz", "/ping", "/health", "/api/health/live", "/api/health/metrics"]

      for (const path of paths) {
        mockFetch.mockClear()

        const request = createMockRequest(path, {
          "x-group-id": "allura-system",
        })
        const mockEvent = { waitUntil: vi.fn() } as unknown as NextFetchEvent

        await proxy(request, mockEvent)
        expect(mockFetch).not.toHaveBeenCalled()
      }
    })

    it("should skip tracing for /api/trace (prevent infinite loop)", async () => {
      const request = createMockRequest("/api/trace", {
        "x-group-id": "allura-system",
      })
      const mockEvent = { waitUntil: vi.fn() } as unknown as NextFetchEvent

      await proxy(request, mockEvent)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("should skip tracing for static assets", async () => {
      const request = createMockRequest("/_next/static/chunk.js", {
        "x-group-id": "allura-system",
      })
      const mockEvent = { waitUntil: vi.fn() } as unknown as NextFetchEvent

      await proxy(request, mockEvent)
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe("Edge: middleware does not block response", () => {
    it("should return immediately even if fetch would be slow", async () => {
      // Make fetch take a long time
      mockFetch.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000))
      )

      const request = createMockRequest("/api/memory", {
        "x-group-id": "allura-system",
      })
      const mockEvent = { waitUntil: vi.fn() } as unknown as NextFetchEvent

      const startTime = performance.now()
      const response = await proxy(request, mockEvent)
      const elapsed = performance.now() - startTime

      // Middleware should return in <50ms even though fetch takes 5000ms
      // (fire-and-forget means we don't wait for the fetch)
      expect(elapsed).toBeLessThan(50)
      expect(response).toBeDefined()

      // fetch was initiated (even if not resolved yet)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it("should not throw even if fetch fails", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"))

      const request = createMockRequest("/api/memory", {
        "x-group-id": "allura-system",
      })
      const mockEvent = { waitUntil: vi.fn() } as unknown as NextFetchEvent

      // Should not throw
      const response = await proxy(request, mockEvent)
      expect(response).toBeDefined()
    })
  })

  describe("Config", () => {
    it("should have a matcher that excludes _next/static, _next/image, favicon", () => {
      expect(config.matcher).toBeDefined()
      expect(config.matcher).toHaveLength(1)
      // The matcher should be a regex pattern string
      expect(config.matcher[0]).toContain("_next/static")
      expect(config.matcher[0]).toContain("_next/image")
      expect(config.matcher[0]).toContain("favicon.ico")
    })
  })
})

// Need to import NextFetchEvent type
import type { NextFetchEvent } from "next/server"