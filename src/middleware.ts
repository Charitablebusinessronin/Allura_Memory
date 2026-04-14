/**
 * Next.js Middleware — Route Protection and Authentication
 *
 * Implements Clerk-based authentication with RBAC for Allura Memory.
 * Falls back to DevAuthProvider when Clerk is not configured.
 *
 * Route protection rules:
 *   /admin/*           → requires 'admin' role
 *   /api/curator/approve  → requires 'curator' or 'admin' role
 *   /api/curator/watchdog  → requires 'curator' or 'admin' role
 *   /api/curator/proposals → requires 'viewer' or above role
 *   /api/memory/*      → requires 'viewer' or above role
 *   /memory/*          → requires 'viewer' or above role
 *   /curator/*         → requires 'curator' or above role
 *
 * Public routes (no auth required):
 *   /api/health/*      → health checks
 *   /api/mcp/*         → MCP transport (has its own Bearer token auth)
 *   /auth/*            → login/register pages
 *   /                  → landing page
 *
 * Reference: Phase 7 benchmark — Clerk SSO + RBAC
 */

import { NextRequest, NextResponse } from "next/server";
import {
  PROTECTED_ROUTES,
  PUBLIC_ROUTES,
  AUTH_ROUTES,
  isClerkEnabled,
  getDevAuthConfig,
} from "@/lib/auth/config";
import { hasPermission, parseRole } from "@/lib/auth/roles";
import { getDevUserSync } from "@/lib/auth/dev-auth";
import type { AlluraRole } from "@/lib/auth/types";

// ── Route Matching ──────────────────────────────────────────────────────────

/**
 * Check if a request path matches a route pattern.
 *
 * Supports Next.js matcher syntax:
 *   /admin/:path*  → matches /admin, /admin/users, /admin/settings/roles
 *   /api/memory    → matches exactly /api/memory
 */
function matchesRoute(pathname: string, pattern: string): boolean {
  // Exact match (no wildcards)
  if (!pattern.includes(":path*") && !pattern.includes(":path+")) {
    return pathname === pattern || pathname.startsWith(pattern + "/");
  }

  // Convert Next.js matcher pattern to regex
  // :path* → any path segment (including none)
  // :path+ → one or more path segments
  const regexPattern = pattern
    .replace(/:path\*/g, "(?:/.*)?")
    .replace(/:path\+/g, "(?:/.+)")
    .replace(/\//g, "\\/");

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(pathname);
}

/**
 * Check if a path is a public route (no auth required).
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((pattern) => matchesRoute(pathname, pattern));
}

/**
 * Check if a path is an auth route (login/register — redirect away if authenticated).
 */
function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((pattern) => matchesRoute(pathname, pattern));
}

/**
 * Get the required role for a protected route.
 * Returns null if the route is not protected.
 */
function getRequiredRole(pathname: string): AlluraRole | null {
  for (const route of PROTECTED_ROUTES) {
    if (matchesRoute(pathname, route.pattern)) {
      return route.requiredRole;
    }
  }
  return null;
}

// ── Auth Resolution ─────────────────────────────────────────────────────────

/**
 * Resolve the current user's role from the request.
 *
 * In production with Clerk: reads from auth() headers.
 * In development without Clerk: uses DevAuthProvider.
 *
 * Returns null if no authenticated user is found.
 */
function resolveUserRole(request: NextRequest): { role: AlluraRole; groupId: string; userId: string } | null {
  // Development mode: use DevAuthProvider
  if (!isClerkEnabled()) {
    const devUser = getDevUserSync();
    if (devUser) {
      return {
        role: devUser.role,
        groupId: devUser.groupId,
        userId: devUser.id,
      };
    }
    return null;
  }

  // Production mode: read from Clerk auth headers
  // Clerk middleware sets these headers after authentication
  const authRole = request.headers.get("x-allura-role");
  const authGroupId = request.headers.get("x-allura-group-id");
  const authUserId = request.headers.get("x-allura-user-id");

  if (!authUserId) {
    return null;
  }

  return {
    role: parseRole(authRole, "viewer"),
    groupId: authGroupId || "allura-default",
    userId: authUserId,
  };
}

// ── Middleware Logic ─────────────────────────────────────────────────────────

/**
 * Determine if the request should proceed, be redirected, or be rejected.
 */
function handleRequest(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // 1. Public routes — always allow
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // 2. Static assets and Next.js internals — always allow
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 3. Resolve auth state
  const authState = resolveUserRole(request);

  // 4. Check if route requires protection
  const requiredRole = getRequiredRole(pathname);

  // 5. Unprotected route — allow through
  if (requiredRole === null) {
    return NextResponse.next();
  }

  // 6. Protected route but no auth — redirect to login or return 401
  if (!authState) {
    // API routes return 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required", statusCode: 401 },
        { status: 401 }
      );
    }

    // UI routes redirect to login
    const loginUrl = new URL("/auth/v2/login", request.url);
    loginUrl.searchParams.set("redirect_url", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 7. Check role-based access
  if (!hasPermission(authState.role, requiredRole)) {
    // API routes return 403 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Insufficient permissions",
          statusCode: 403,
          required: requiredRole,
          actual: authState.role,
          message: `Role '${authState.role}' does not have '${requiredRole}' permission. Required: ${requiredRole} or above.`,
        },
        { status: 403 }
      );
    }

    // UI routes redirect to unauthorized page
    const unauthorizedUrl = new URL("/unauthorized", request.url);
    unauthorizedUrl.searchParams.set("required", requiredRole);
    unauthorizedUrl.searchParams.set("actual", authState.role);
    return NextResponse.redirect(unauthorizedUrl);
  }

  // 8. Authenticated and authorized — inject auth headers for downstream use
  const response = NextResponse.next();
  response.headers.set("x-allura-user-id", authState.userId);
  response.headers.set("x-allura-role", authState.role);
  response.headers.set("x-allura-group-id", authState.groupId);

  return response;
}

// ── Export ────────────────────────────────────────────────────────────────────

export function middleware(request: NextRequest): NextResponse {
  return handleRequest(request);
}

/**
 * Configure which routes the middleware runs on.
 * This is more efficient than running on every request.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};