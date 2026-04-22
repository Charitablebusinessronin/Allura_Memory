/**
 * Sentry Integration Tests
 *
 * Tests for the Sentry observability module.
 * Validates initialization, error capture, context propagation,
 * and graceful degradation when DSN is not configured.
 *
 * Usage: bun vitest run src/__tests__/sentry-integration.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  initSentry,
  isSentryEnabled,
  captureException,
  captureMessage,
  setUser,
  setTag,
  startTransaction,
  extractRequestContext,
  resetSentry,
} from "@/lib/observability/sentry.js";
import { loadSentryConfig } from "@/lib/observability/config.js";
import type { CaptureContext } from "@/lib/observability/sentry.js";
import type { IncomingMessage } from "http";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockRequest(
  method = "GET",
  url = "/",
  headers: Record<string, string | undefined> = {}
): IncomingMessage {
  return {
    method,
    url,
    headers,
    httpVersion: "1.1",
  } as unknown as IncomingMessage;
}

// ── Configuration Tests ──────────────────────────────────────────────────────

describe("Sentry Configuration", () => {
  it("should be disabled when DSN is not set", () => {
    const config = loadSentryConfig({});
    expect(config.enabled).toBe(false);
    expect(config.dsn).toBeUndefined();
    expect(config.environment).toBe("development");
  });

  it("should be disabled when DSN is empty string", () => {
    const config = loadSentryConfig({ NEXT_PUBLIC_SENTRY_DSN: "" });
    expect(config.enabled).toBe(false);
  });

  it("should be enabled when DSN is set", () => {
    const config = loadSentryConfig({
      NEXT_PUBLIC_SENTRY_DSN: "https://example@sentry.io/123",
    });
    expect(config.enabled).toBe(true);
    expect(config.dsn).toBe("https://example@sentry.io/123");
  });

  it("should use SENTRY_DSN as fallback", () => {
    const config = loadSentryConfig({
      SENTRY_DSN: "https://fallback@sentry.io/456",
    });
    expect(config.enabled).toBe(true);
    expect(config.dsn).toBe("https://fallback@sentry.io/456");
  });

  it("should prefer NEXT_PUBLIC_SENTRY_DSN over SENTRY_DSN", () => {
    const config = loadSentryConfig({
      NEXT_PUBLIC_SENTRY_DSN: "https://public@sentry.io/123",
      SENTRY_DSN: "https://fallback@sentry.io/456",
    });
    expect(config.dsn).toBe("https://public@sentry.io/123");
  });

  it("should default environment to development", () => {
    const config = loadSentryConfig({
      NEXT_PUBLIC_SENTRY_DSN: "https://example@sentry.io/123",
    });
    expect(config.environment).toBe("development");
  });

  it("should parse valid environments", () => {
    for (const env of ["development", "staging", "production"]) {
      const config = loadSentryConfig({
        NEXT_PUBLIC_SENTRY_DSN: "https://example@sentry.io/123",
        SENTRY_ENVIRONMENT: env,
      });
      expect(config.environment).toBe(env);
    }
  });

  it("should reject invalid environments", () => {
    expect(() =>
      loadSentryConfig({
        NEXT_PUBLIC_SENTRY_DSN: "https://example@sentry.io/123",
        SENTRY_ENVIRONMENT: "invalid",
      })
    ).toThrow();
  });

  it("should default tracesSampleRate to 0.1", () => {
    const config = loadSentryConfig({
      NEXT_PUBLIC_SENTRY_DSN: "https://example@sentry.io/123",
    });
    expect(config.tracesSampleRate).toBe(0.1);
  });

  it("should parse custom tracesSampleRate", () => {
    const config = loadSentryConfig({
      NEXT_PUBLIC_SENTRY_DSN: "https://example@sentry.io/123",
      SENTRY_TRACES_SAMPLE_RATE: "0.5",
    });
    expect(config.tracesSampleRate).toBe(0.5);
  });

  it("should default profilesSampleRate to 0.1", () => {
    const config = loadSentryConfig({
      NEXT_PUBLIC_SENTRY_DSN: "https://example@sentry.io/123",
    });
    expect(config.profilesSampleRate).toBe(0.1);
  });

  it("should set sample rates to 0 when Sentry is disabled", () => {
    const config = loadSentryConfig({});
    expect(config.tracesSampleRate).toBe(0);
    expect(config.profilesSampleRate).toBe(0);
  });

  it("should reject sample rates outside 0-1 range", () => {
    expect(() =>
      loadSentryConfig({
        NEXT_PUBLIC_SENTRY_DSN: "https://example@sentry.io/123",
        SENTRY_TRACES_SAMPLE_RATE: "1.5",
      })
    ).toThrow();
  });
});

// ── Sentry Initialization Tests ──────────────────────────────────────────────

describe("Sentry Initialization", () => {
  beforeEach(() => {
    resetSentry();
  });

  afterEach(() => {
    resetSentry();
  });

  it("should be disabled when no DSN is configured", () => {
    initSentry(
      loadSentryConfig({}) // No DSN
    );
    expect(isSentryEnabled()).toBe(false);
  });

  it("should be a no-op when initialized without DSN", () => {
    // Should not throw
    initSentry(loadSentryConfig({}));
    expect(isSentryEnabled()).toBe(false);
  });

  it("should not re-initialize on subsequent calls", () => {
    initSentry(loadSentryConfig({}));
    const firstInit = isSentryEnabled();

    // Second call should be a no-op
    initSentry(loadSentryConfig({}));
    expect(isSentryEnabled()).toBe(firstInit);
  });

  it("should handle missing @sentry/nextjs gracefully", () => {
    // When @sentry/nextjs is not installed, init should not throw
    // The require() will fail, but we catch it
    const config: CaptureContext = {
      tags: { test: true },
    };

    // captureException should be a no-op when Sentry is not initialized
    expect(() => captureException(new Error("test"), config)).not.toThrow();
  });
});

// ── Error Capture Tests ──────────────────────────────────────────────────────

describe("Error Capture (no-op when disabled)", () => {
  beforeEach(() => {
    resetSentry();
    initSentry(loadSentryConfig({})); // No DSN
  });

  afterEach(() => {
    resetSentry();
  });

  it("should not throw when capturing exceptions without Sentry", () => {
    expect(() =>
      captureException(new Error("test error"))
    ).not.toThrow();
  });

  it("should not throw when capturing exceptions with context", () => {
    expect(() =>
      captureException(new Error("test error"), {
        tags: { component: "test" },
        extra: { detail: "value" },
      })
    ).not.toThrow();
  });

  it("should not throw when capturing messages without Sentry", () => {
    expect(() =>
      captureMessage("test message", "info")
    ).not.toThrow();
  });

  it("should not throw when setting user without Sentry", () => {
    expect(() =>
      setUser({ id: "user-123", email: "test@example.com" })
    ).not.toThrow();
  });

  it("should not throw when setting tags without Sentry", () => {
    expect(() =>
      setTag("component", "mcp-gateway")
    ).not.toThrow();
  });
});

// ── Transaction Tests ─────────────────────────────────────────────────────────

describe("Performance Transactions (no-op when disabled)", () => {
  beforeEach(() => {
    resetSentry();
    initSentry(loadSentryConfig({})); // No DSN
  });

  afterEach(() => {
    resetSentry();
  });

  it("should return a no-op transaction when Sentry is disabled", () => {
    const transaction = startTransaction({
      name: "GET /health",
      op: "http.server",
    });

    // Should not throw
    expect(() => {
      transaction.setTag("method", "GET");
      transaction.setData("path", "/health");
      transaction.finish();
    }).not.toThrow();
  });

  it("should return a no-op transaction with correct interface", () => {
    const transaction = startTransaction({
      name: "POST /mcp",
      op: "http.server",
      tags: { method: "POST" },
    });

    // All methods should be callable
    expect(typeof transaction.setTag).toBe("function");
    expect(typeof transaction.setData).toBe("function");
    expect(typeof transaction.finish).toBe("function");
  });
});

// ── Request Context Tests ────────────────────────────────────────────────────

describe("extractRequestContext", () => {
  it("should extract method and path from request", () => {
    const req = createMockRequest("POST", "/mcp");
    const context = extractRequestContext(req);

    expect(context.tags?.["request.method"]).toBe("POST");
    expect(context.tags?.["request.path"]).toBe("/mcp");
    expect(context.extra?.["request.method"]).toBe("POST");
    expect(context.extra?.["request.url"]).toBe("/mcp");
  });

  it("should extract group_id from URL path", () => {
    const req = createMockRequest("POST", "/mcp?group_id=allura-test");
    const context = extractRequestContext(req);

    expect(context.tags?.["group_id"]).toBe("allura-test");
    expect(context.extra?.["group_id"]).toBe("allura-test");
  });

  it("should extract group_id from URL with MCP path segment", () => {
    const req = createMockRequest("GET", "/mcp?group_id=allura-my-group");
    const context = extractRequestContext(req);

    expect(context.tags?.["group_id"]).toBe("allura-my-group");
  });

  it("should handle requests without group_id", () => {
    const req = createMockRequest("GET", "/health");
    const context = extractRequestContext(req);

    expect(context.tags?.["group_id"]).toBeUndefined();
    expect(context.extra?.["group_id"]).toBeUndefined();
  });

  it("should default method to GET when not set", () => {
    const req = createMockRequest(undefined as any, "/health");
    const context = extractRequestContext(req);

    expect(context.tags?.["request.method"]).toBe("GET");
  });

  it("should strip query string from path", () => {
    const req = createMockRequest("GET", "/health?foo=bar");
    const context = extractRequestContext(req);

    expect(context.tags?.["request.path"]).toBe("/health");
  });
});

// ── Reset Tests ──────────────────────────────────────────────────────────────

describe("Sentry Reset", () => {
  it("should allow re-initialization after reset", () => {
    resetSentry();
    initSentry(loadSentryConfig({}));
    expect(isSentryEnabled()).toBe(false);

    resetSentry();
    initSentry(loadSentryConfig({}));
    expect(isSentryEnabled()).toBe(false);
  });

  it("should clear state on reset", () => {
    initSentry(loadSentryConfig({}));
    resetSentry();

    // After reset, isSentryEnabled should return false until re-initialized
    expect(isSentryEnabled()).toBe(false);
  });
});