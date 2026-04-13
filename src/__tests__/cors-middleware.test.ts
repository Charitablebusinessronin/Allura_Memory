/**
 * CORS Middleware Tests
 *
 * Tests for the CORS configuration and middleware module.
 * Validates origin allowlisting, preflight handling, credential headers,
 * and development vs production mode behavior.
 *
 * Usage: bun vitest run src/__tests__/cors-middleware.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadCorsConfig,
  compileOriginValidator,
  resetCorsConfig,
  setCorsConfig,
  getCorsConfig,
  applyCors,
  corsHeaders,
  isPreflightRequest,
} from "@/lib/cors/index";
import type { CorsConfig, CorsResponse } from "@/lib/cors/index";
import type { IncomingMessage } from "http";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockRequest(
  method = "GET",
  headers: Record<string, string | undefined> = {}
): IncomingMessage {
  return {
    method,
    headers,
    url: "/",
    httpVersion: "1.1",
  } as unknown as IncomingMessage;
}

function createMockResponse(): CorsResponse & { headers: Record<string, string | string[]>; statusCode: number; ended: boolean } {
  const headers: Record<string, string | string[]> = {};
  const resp: CorsResponse & { headers: Record<string, string | string[]>; statusCode: number; ended: boolean } = {
    headers,
    statusCode: 200,
    ended: false,
    setHeader(key: string, value: string | number) {
      headers[key] = String(value);
    },
    writeHead(statusCode: number, headerObj?: Record<string, string>) {
      resp.statusCode = statusCode;
      if (headerObj) {
        for (const [k, v] of Object.entries(headerObj)) {
          headers[k] = v;
        }
      }
    },
    end(_data?: string) {
      resp.ended = true;
    },
  };
  return resp;
}

// ── Configuration Tests ──────────────────────────────────────────────────────

describe("CORS Configuration", () => {
  beforeEach(() => {
    resetCorsConfig();
  });

  afterEach(() => {
    resetCorsConfig();
  });

  it("should default to development mode when ALLURA_CORS_ORIGINS is not set", () => {
    const config = loadCorsConfig({ ALLURA_CORS_ORIGINS: undefined });
    expect(config.isDevelopment).toBe(true);
    expect(config.origins).toEqual([]);
  });

  it("should default to development mode when ALLURA_CORS_ORIGINS is empty", () => {
    const config = loadCorsConfig({ ALLURA_CORS_ORIGINS: "" });
    expect(config.isDevelopment).toBe(true);
    expect(config.origins).toEqual([]);
  });

  it("should parse comma-separated origins", () => {
    const config = loadCorsConfig({
      ALLURA_CORS_ORIGINS: "https://app.example.com,https://admin.example.com",
    });
    expect(config.isDevelopment).toBe(false);
    expect(config.origins).toEqual([
      "https://app.example.com",
      "https://admin.example.com",
    ]);
  });

  it("should trim whitespace from origins", () => {
    const config = loadCorsConfig({
      ALLURA_CORS_ORIGINS: " https://app.example.com , https://admin.example.com ",
    });
    expect(config.origins).toEqual([
      "https://app.example.com",
      "https://admin.example.com",
    ]);
  });

  it("should use default methods when not configured", () => {
    const config = loadCorsConfig({});
    expect(config.methods).toEqual(["GET", "POST", "DELETE", "OPTIONS"]);
  });

  it("should parse custom methods", () => {
    const config = loadCorsConfig({
      ALLURA_CORS_METHODS: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    });
    expect(config.methods).toEqual(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
  });

  it("should use default headers when not configured", () => {
    const config = loadCorsConfig({});
    expect(config.headers).toEqual(["Content-Type", "Authorization"]);
  });

  it("should parse custom headers", () => {
    const config = loadCorsConfig({
      ALLURA_CORS_HEADERS: "Content-Type,Authorization,X-Request-Id,X-Custom-Header",
    });
    expect(config.headers).toEqual([
      "Content-Type",
      "Authorization",
      "X-Request-Id",
      "X-Custom-Header",
    ]);
  });

  it("should default maxAge to 86400", () => {
    const config = loadCorsConfig({});
    expect(config.maxAge).toBe(86400);
  });

  it("should parse custom maxAge", () => {
    const config = loadCorsConfig({ ALLURA_CORS_MAX_AGE: "3600" });
    expect(config.maxAge).toBe(3600);
  });

  it("should default credentials to true", () => {
    const config = loadCorsConfig({});
    expect(config.credentials).toBe(true);
  });

  it("should parse credentials as false", () => {
    const config = loadCorsConfig({ ALLURA_CORS_CREDENTIALS: "false" });
    expect(config.credentials).toBe(false);
  });

  it("should reject invalid maxAge values", () => {
    expect(() => loadCorsConfig({ ALLURA_CORS_MAX_AGE: "-1" })).toThrow();
  });
});

// ── Origin Validation Tests ──────────────────────────────────────────────────

describe("Origin Validation", () => {
  it("should match exact origins", () => {
    const validator = compileOriginValidator([
      "https://app.example.com",
      "https://admin.example.com",
    ]);

    expect(validator("https://app.example.com")).toBe(true);
    expect(validator("https://admin.example.com")).toBe(true);
    expect(validator("https://evil.example.com")).toBe(false);
    expect(validator("http://app.example.com")).toBe(false);
  });

  it("should match regex patterns", () => {
    const validator = compileOriginValidator([
      "/^https:\\/\\/[a-z]+\\.example\\.com$/",
    ]);

    expect(validator("https://app.example.com")).toBe(true);
    expect(validator("https://admin.example.com")).toBe(true);
    expect(validator("https://evil.other.com")).toBe(false);
  });

  it("should handle mixed exact and regex patterns", () => {
    const validator = compileOriginValidator([
      "https://exact.example.com",
      "/^https:\\/\\/.*\\.staging\\.example\\.com$/",
    ]);

    expect(validator("https://exact.example.com")).toBe(true);
    expect(validator("https://test.staging.example.com")).toBe(true);
    expect(validator("https://other.example.com")).toBe(false);
  });

  it("should warn on invalid regex patterns", () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const validator = compileOriginValidator(["/[invalid/"]);

    // Invalid regex should not match anything
    expect(validator("https://example.com")).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid regex pattern")
    );

    consoleWarnSpy.mockRestore();
  });

  it("should return false for empty origin when allowlist is set", () => {
    const validator = compileOriginValidator(["https://app.example.com"]);
    expect(validator("")).toBe(false);
  });
});

// ── CORS Middleware Tests ─────────────────────────────────────────────────────

describe("CORS Middleware (applyCors)", () => {
  const devConfig: CorsConfig = {
    origins: [],
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    headers: ["Content-Type", "Authorization"],
    maxAge: 86400,
    credentials: true,
    isDevelopment: true,
  };

  const prodConfig: CorsConfig = {
    origins: ["https://app.example.com", "https://admin.example.com"],
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    headers: ["Content-Type", "Authorization"],
    maxAge: 86400,
    credentials: true,
    isDevelopment: false,
  };

  beforeEach(() => {
    resetCorsConfig();
  });

  it("should allow all origins in development mode", () => {
    const req = createMockRequest("GET", { origin: "https://any-site.com" });
    const res = createMockResponse();

    const result = applyCors(req, res, devConfig);

    expect(result.isPreflight).toBe(false);
    expect(result.originAllowed).toBe(true);
    expect(result.resolvedOrigin).toBe("https://any-site.com");
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://any-site.com");
  });

  it("should allow wildcard origin in development mode when no origin header", () => {
    const req = createMockRequest("GET", {});
    const res = createMockResponse();

    const result = applyCors(req, res, devConfig);

    expect(result.originAllowed).toBe(true);
    expect(result.resolvedOrigin).toBe("*");
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("should block disallowed origins in production mode", () => {
    const req = createMockRequest("GET", { origin: "https://evil.example.com" });
    const res = createMockResponse();

    const result = applyCors(req, res, prodConfig);

    expect(result.originAllowed).toBe(false);
    expect(result.resolvedOrigin).toBe("");
    // No CORS headers should be set for blocked origins
    expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("should allow listed origins in production mode", () => {
    const req = createMockRequest("GET", { origin: "https://app.example.com" });
    const res = createMockResponse();

    const result = applyCors(req, res, prodConfig);

    expect(result.originAllowed).toBe(true);
    expect(result.resolvedOrigin).toBe("https://app.example.com");
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://app.example.com");
  });

  it("should set credentials header when origin is not wildcard", () => {
    const req = createMockRequest("GET", { origin: "https://app.example.com" });
    const res = createMockResponse();

    applyCors(req, res, prodConfig);

    expect(res.headers["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("should NOT set credentials header when origin is wildcard", () => {
    const req = createMockRequest("GET", {});
    const res = createMockResponse();

    applyCors(req, res, devConfig);

    // When origin is "*", credentials header should not be set
    // (browsers reject Access-Control-Allow-Credentials with wildcard origin)
    expect(res.headers["Access-Control-Allow-Credentials"]).toBeUndefined();
  });

  it("should handle preflight OPTIONS requests", () => {
    const req = createMockRequest("OPTIONS", { origin: "https://app.example.com" });
    const res = createMockResponse();

    const result = applyCors(req, res, prodConfig);

    expect(result.isPreflight).toBe(true);
    expect(result.originAllowed).toBe(true);
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
  });

  it("should include preflight headers on OPTIONS", () => {
    const req = createMockRequest("OPTIONS", {
      origin: "https://app.example.com",
      "access-control-request-method": "POST",
      "access-control-request-headers": "Content-Type,Authorization",
    });
    const res = createMockResponse();

    applyCors(req, res, prodConfig);

    expect(res.headers["Access-Control-Allow-Methods"]).toBe("GET, POST, DELETE, OPTIONS");
    expect(res.headers["Access-Control-Allow-Headers"]).toBe("Content-Type,Authorization");
    expect(res.headers["Access-Control-Max-Age"]).toBe("86400");
    expect(res.headers["Access-Control-Expose-Headers"]).toBeDefined();
  });

  it("should use request headers from preflight when provided", () => {
    const req = createMockRequest("OPTIONS", {
      origin: "https://app.example.com",
      "access-control-request-headers": "Content-Type,Authorization,X-Custom",
    });
    const res = createMockResponse();

    applyCors(req, res, prodConfig);

    expect(res.headers["Access-Control-Allow-Headers"]).toBe(
      "Content-Type,Authorization,X-Custom"
    );
  });

  it("should return 403 for preflight from disallowed origin", () => {
    const req = createMockRequest("OPTIONS", { origin: "https://evil.example.com" });
    const res = createMockResponse();

    const result = applyCors(req, res, prodConfig);

    expect(result.isPreflight).toBe(true);
    expect(result.originAllowed).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.ended).toBe(true);
  });

  it("should expose custom headers on regular responses", () => {
    const req = createMockRequest("GET", { origin: "https://app.example.com" });
    const res = createMockResponse();

    applyCors(req, res, prodConfig);

    expect(res.headers["Access-Control-Expose-Headers"]).toContain("X-Request-Id");
    expect(res.headers["Access-Control-Expose-Headers"]).toContain("X-Response-Time");
  });

  it("should not end response for non-preflight requests", () => {
    const req = createMockRequest("GET", { origin: "https://app.example.com" });
    const res = createMockResponse();

    const result = applyCors(req, res, prodConfig);

    expect(result.isPreflight).toBe(false);
    expect(res.ended).toBe(false);
    // Headers should be set but response should not be ended
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://app.example.com");
  });
});

// ── corsHeaders() Function Tests ─────────────────────────────────────────────

describe("corsHeaders() function", () => {
  const devConfig: CorsConfig = {
    origins: [],
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    headers: ["Content-Type", "Authorization"],
    maxAge: 86400,
    credentials: true,
    isDevelopment: true,
  };

  const prodConfig: CorsConfig = {
    origins: ["https://app.example.com"],
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    headers: ["Content-Type", "Authorization"],
    maxAge: 86400,
    credentials: true,
    isDevelopment: false,
  };

  it("should return wildcard headers in development mode", () => {
    const headers = corsHeaders(undefined, devConfig);
    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("should return empty headers for disallowed origin in production", () => {
    const headers = corsHeaders("https://evil.example.com", prodConfig);
    expect(headers).toEqual({});
  });

  it("should return full headers for allowed origin in production", () => {
    const headers = corsHeaders("https://app.example.com", prodConfig);
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://app.example.com");
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
    expect(headers["Access-Control-Allow-Methods"]).toBe("GET, POST, DELETE, OPTIONS");
    expect(headers["Access-Control-Allow-Headers"]).toBe("Content-Type, Authorization");
    expect(headers["Access-Control-Max-Age"]).toBe("86400");
    expect(headers["Access-Control-Expose-Headers"]).toBeDefined();
  });

  it("should not include credentials header when origin is wildcard", () => {
    const headers = corsHeaders(undefined, devConfig);
    expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
  });
});

// ── isPreflightRequest Tests ──────────────────────────────────────────────────

describe("isPreflightRequest", () => {
  it("should return true for OPTIONS requests", () => {
    const req = createMockRequest("OPTIONS");
    expect(isPreflightRequest(req)).toBe(true);
  });

  it("should return false for GET requests", () => {
    const req = createMockRequest("GET");
    expect(isPreflightRequest(req)).toBe(false);
  });

  it("should return false for POST requests", () => {
    const req = createMockRequest("POST");
    expect(isPreflightRequest(req)).toBe(false);
  });
});

// ── Config Caching Tests ─────────────────────────────────────────────────────

describe("CORS Config Caching", () => {
  afterEach(() => {
    resetCorsConfig();
  });

  it("should cache config after first call", () => {
    const config1 = getCorsConfig();
    const config2 = getCorsConfig();
    expect(config1).toBe(config2); // Same reference
  });

  it("should allow config override", () => {
    const customConfig: CorsConfig = {
      origins: ["https://custom.example.com"],
      methods: ["GET"],
      headers: ["Content-Type"],
      maxAge: 3600,
      credentials: false,
      isDevelopment: false,
    };

    setCorsConfig(customConfig);
    const config = getCorsConfig();
    expect(config).toEqual(customConfig);
  });

  it("should reset config", () => {
    const customConfig: CorsConfig = {
      origins: ["https://custom.example.com"],
      methods: ["GET"],
      headers: ["Content-Type"],
      maxAge: 3600,
      credentials: false,
      isDevelopment: false,
    };

    setCorsConfig(customConfig);
    resetCorsConfig();
    // After reset, getCorsConfig will reload from env
    const config = getCorsConfig();
    expect(config).not.toEqual(customConfig);
  });
});