/**
 * Allura Memory — Clerk Proxy Middleware (Next.js 16)
 *
 * Runs before every request. Responsibilities:
 *  1. Allow public routes through without auth
 *  2. Require Clerk authentication on protected routes
 *  3. Extract AlluraRole from Clerk publicMetadata
 *  4. Enforce RBAC — return 401/403 or redirect as appropriate
 *  5. Inject x-allura-* headers for downstream Server Components / API routes
 *
 * Route table lives in src/lib/auth/config.ts.
 * Role helpers live in src/lib/auth/roles.ts.
 * Clerk metadata extraction lives in src/lib/auth/clerk.ts.
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { extractAlluraMetadata } from "@/lib/auth/clerk";
import { hasPermission } from "@/lib/auth/roles";
import type { AlluraRole } from "@/lib/auth/types";
import type { ClerkPublicMetadata } from "@/lib/auth/types";

// ── Route Matchers ────────────────────────────────────────────────────────────

const isPublicRoute = createRouteMatcher([
  "/",
  "/api/health(.*)",
  "/api/mcp(.*)",
  "/auth(.*)",
]);

/** Ordered from most-restrictive to least — first match wins. */
const ROLE_GATES: Array<{ matcher: ReturnType<typeof createRouteMatcher>; role: AlluraRole }> = [
  {
    matcher: createRouteMatcher(["/admin", "/admin/(.*)"]),
    role: "admin",
  },
  {
    matcher: createRouteMatcher([
      "/api/curator/approve",
      "/api/curator/watchdog",
      "/curator",
      "/curator/(.*)",
    ]),
    role: "curator",
  },
  {
    matcher: createRouteMatcher([
      "/api/curator/proposals",
      "/api/memory",
      "/api/memory/(.*)",
      "/memory",
      "/memory/(.*)",
    ]),
    role: "viewer",
  },
];

// ── Middleware ────────────────────────────────────────────────────────────────

export default clerkMiddleware(async (auth, request) => {
  // 1. Public routes — always pass through
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  // 2. Find required role for this route
  let requiredRole: AlluraRole | null = null;
  for (const gate of ROLE_GATES) {
    if (gate.matcher(request)) {
      requiredRole = gate.role;
      break;
    }
  }

  // 3. Unprotected route (dashboard, etc.) — pass through
  if (!requiredRole) {
    return NextResponse.next();
  }

  // 4. Require authentication
  const { userId, sessionClaims } = await auth();
  const { pathname } = request.nextUrl;

  if (!userId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required", statusCode: 401 },
        { status: 401 },
      );
    }
    const loginUrl = new URL("/auth/v2/login", request.url);
    loginUrl.searchParams.set("redirect_url", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Extract AlluraRole from Clerk publicMetadata
  const { role, groupId } = extractAlluraMetadata(
    sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined,
  );

  // 6. RBAC check
  if (!hasPermission(role, requiredRole)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Insufficient permissions",
          statusCode: 403,
          required: requiredRole,
          actual: role,
        },
        { status: 403 },
      );
    }
    const url = new URL("/unauthorized", request.url);
    url.searchParams.set("required", requiredRole);
    url.searchParams.set("actual", role);
    return NextResponse.redirect(url);
  }

  // 7. Inject auth headers for Server Components and API routes
  const response = NextResponse.next();
  response.headers.set("x-allura-user-id", userId);
  response.headers.set("x-allura-role", role);
  response.headers.set("x-allura-group-id", groupId);
  return response;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
