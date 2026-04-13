/**
 * Auth Middleware Tests
 *
 * Tests for the Next.js middleware route protection and RBAC.
 *
 * Reference: Phase 7 benchmark — Clerk SSO + RBAC
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Mock Environment ────────────────────────────────────────────────────────

// Set dev auth environment before importing modules
process.env.ALLURA_DEV_AUTH_ENABLED = "true";
process.env.ALLURA_DEV_AUTH_ROLE = "admin";
process.env.ALLURA_DEV_AUTH_GROUP_ID = "allura-roninmemory";
process.env.ALLURA_DEV_AUTH_USER_ID = "dev-user-allura";
process.env.ALLURA_DEV_AUTH_EMAIL = "dev@allura.local";
// @ts-expect-error — NODE_ENV is read-only in Next.js types but must be set for tests
process.env.NODE_ENV = "test";

// Clear Clerk keys to force dev auth mode
delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
delete process.env.CLERK_SECRET_KEY;

// ── Import after env setup ──────────────────────────────────────────────────

import { middleware } from "@/middleware";
import { PROTECTED_ROUTES, PUBLIC_ROUTES } from "@/lib/auth/config";
import { clearAuthConfig } from "@/lib/auth/config";

describe("Auth Middleware", () => {
  beforeEach(() => {
    clearAuthConfig();
  });

  // ── Public Routes ────────────────────────────────────────────────────────

  describe("public routes", () => {
    it.each([
      "/api/health",
      "/api/health/ready",
      "/api/health/live",
      "/api/health/detailed",
      "/api/mcp",
      "/api/mcp/messages",
      "/auth/v1/login",
      "/auth/v2/login",
      "/auth/v1/register",
      "/auth/v2/register",
      "/",
    ])("should allow access to public route %s", (path) => {
      const request = new NextRequest(new URL(path, "http://localhost:3100"));
      const response = middleware(request);
      expect(response.status).toBe(200);
    });
  });

  // ── Protected Routes (Dev Auth — admin role) ──────────────────────────────

  describe("protected routes with dev auth (admin role)", () => {
    it("should allow admin access to /admin routes", () => {
      const request = new NextRequest(new URL("/admin/approvals", "http://localhost:3100"));
      const response = middleware(request);
      // Dev auth defaults to admin, so should pass
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });

    it("should allow admin access to /api/curator/approve", () => {
      const request = new NextRequest(new URL("/api/curator/approve", "http://localhost:3100"), {
        method: "POST",
      });
      const response = middleware(request);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });

    it("should allow admin access to /api/memory", () => {
      const request = new NextRequest(new URL("/api/memory?group_id=allura-test", "http://localhost:3100"));
      const response = middleware(request);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });

    it("should allow admin access to /memory UI", () => {
      const request = new NextRequest(new URL("/memory", "http://localhost:3100"));
      const response = middleware(request);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });

    it("should allow admin access to /curator UI", () => {
      const request = new NextRequest(new URL("/curator", "http://localhost:3100"));
      const response = middleware(request);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });
  });

  // ── Static Assets ─────────────────────────────────────────────────────────

  describe("static assets", () => {
    it.each([
      "/_next/static/chunks/main.js",
      "/_next/image?url=%2Flogo.png",
      "/favicon.ico",
      "/logo.svg",
      "/styles.css",
    ])("should allow access to static asset %s", (path) => {
      const request = new NextRequest(new URL(path, "http://localhost:3100"));
      const response = middleware(request);
      expect(response.status).toBe(200);
    });
  });

  // ── Route Matching ───────────────────────────────────────────────────────

  describe("route matching", () => {
    it("should match nested admin paths", () => {
      const request = new NextRequest(new URL("/admin/settings/roles", "http://localhost:3100"));
      const response = middleware(request);
      // Dev auth is admin, so should pass
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });

    it("should match nested memory API paths", () => {
      const request = new NextRequest(new URL("/api/memory/traces?group_id=allura-test", "http://localhost:3100"));
      const response = middleware(request);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });

    it("should match nested memory UI paths", () => {
      const request = new NextRequest(new URL("/memory/search", "http://localhost:3100"));
      const response = middleware(request);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });
  });

  // ── Auth Headers ──────────────────────────────────────────────────────────

  describe("auth header injection", () => {
    it("should inject x-allura-user-id header for authenticated requests", () => {
      const request = new NextRequest(new URL("/memory", "http://localhost:3100"));
      const response = middleware(request);
      expect(response.headers.get("x-allura-user-id")).toBe("dev-user-allura");
    });

    it("should inject x-allura-role header for authenticated requests", () => {
      const request = new NextRequest(new URL("/memory", "http://localhost:3100"));
      const response = middleware(request);
      expect(response.headers.get("x-allura-role")).toBe("admin");
    });

    it("should inject x-allura-group-id header for authenticated requests", () => {
      const request = new NextRequest(new URL("/memory", "http://localhost:3100"));
      const response = middleware(request);
      expect(response.headers.get("x-allura-group-id")).toBe("allura-roninmemory");
    });
  });

  // ── Role-Based Access (with different dev roles) ──────────────────────────

  describe("role-based access control", () => {
    it("should define correct protected routes", () => {
      expect(PROTECTED_ROUTES).toBeDefined();
      expect(PROTECTED_ROUTES.length).toBeGreaterThan(0);

      // Check admin routes
      const adminRoutes = PROTECTED_ROUTES.filter((r) => r.requiredRole === "admin");
      expect(adminRoutes.some((r) => r.pattern.includes("/admin"))).toBe(true);

      // Check curator routes
      const curatorRoutes = PROTECTED_ROUTES.filter((r) => r.requiredRole === "curator");
      expect(curatorRoutes.some((r) => r.pattern.includes("/curator"))).toBe(true);

      // Check viewer routes
      const viewerRoutes = PROTECTED_ROUTES.filter((r) => r.requiredRole === "viewer");
      expect(viewerRoutes.some((r) => r.pattern.includes("/memory"))).toBe(true);
    });

    it("should define correct public routes", () => {
      expect(PUBLIC_ROUTES).toBeDefined();
      expect(PUBLIC_ROUTES).toContain("/api/health");
      expect(PUBLIC_ROUTES).toContain("/api/mcp");
      expect(PUBLIC_ROUTES).toContain("/");
    });
  });
});