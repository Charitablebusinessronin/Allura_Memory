/**
 * Allura Memory — Proxy Middleware (Next.js 16)
 *
 * Runs before every request. Responsibilities:
 *  1. Allow public routes through without auth
 *  2. Require authentication on protected routes
 *  3. Enforce RBAC — return 401/403 or redirect as appropriate
 *  4. Inject x-allura-* headers for downstream use
 *
 * Auth strategy:
 *  - Production: Clerk middleware (SSO + RBAC) — dynamically loaded
 *  - Development: DevAuthProvider fallback (no Clerk needed)
 *
 * CRITICAL: Clerk is imported dynamically to avoid import-time crashes
 * when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. The @clerk/nextjs
 * package throws at import time if publishableKey is missing, making
 * the isClerkEnabled() check useless if Clerk is imported at the top level.
 *
 * Route table lives in src/lib/auth/config.ts.
 * Role helpers live in src/lib/auth/roles.ts.
 */

import { NextRequest, NextResponse } from "next/server"

import { isClerkEnabled, PUBLIC_ROUTES, AUTH_ROUTES, PROTECTED_ROUTES } from "@/lib/auth/config"
import { getDevUserSync } from "@/lib/auth/dev-auth"
import { hasPermission } from "@/lib/auth/roles"
import type { AlluraRole } from "@/lib/auth/types"

// ── Route Classification ─────────────────────────────────────────────────────

function matchesRoute(pathname: string, pattern: string): boolean {
  if (!pattern.includes(":path*") && !pattern.includes(":path+")) {
    return pathname === pattern || pathname.startsWith(pattern + "/")
  }
  const regexPattern = pattern
    .replace(/:path\*/g, "(?:/.*)?")
    .replace(/:path\+/g, "(?:/.+)")
    .replace(/\//g, "\\/")
  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(pathname)
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((pattern) => matchesRoute(pathname, pattern))
}

function getRequiredRole(pathname: string): AlluraRole | null {
  for (const route of PROTECTED_ROUTES) {
    if (matchesRoute(pathname, route.pattern)) {
      return route.requiredRole
    }
  }
  return null
}

// ── Dev Auth Handler ──────────────────────────────────────────────────────────

function handleDevAuth(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  // Public routes — always pass through
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Static assets and Next.js internals
  if (pathname.startsWith("/_next/") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next()
  }

  const devUser = getDevUserSync()
  const requiredRole = getRequiredRole(pathname)

  // Unprotected route — allow through
  if (requiredRole === null) {
    return NextResponse.next()
  }

  // No dev user and route is protected — 401
  if (!devUser) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required", statusCode: 401 }, { status: 401 })
    }
    const loginUrl = new URL("/auth/v2/login", request.url)
    loginUrl.searchParams.set("redirect_url", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // RBAC check
  if (!hasPermission(devUser.role, requiredRole)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Insufficient permissions",
          statusCode: 403,
          required: requiredRole,
          actual: devUser.role,
        },
        { status: 403 }
      )
    }
    const url = new URL("/unauthorized", request.url)
    url.searchParams.set("required", requiredRole)
    url.searchParams.set("actual", devUser.role)
    return NextResponse.redirect(url)
  }

  // Authenticated and authorized — inject headers
  const response = NextResponse.next()
  response.headers.set("x-allura-user-id", devUser.id)
  response.headers.set("x-allura-role", devUser.role)
  response.headers.set("x-allura-group-id", devUser.groupId)
  return response
}

// ── Production Clerk Handler ─────────────────────────────────────────────────

let _clerkHandler: ((request: NextRequest) => Promise<NextResponse>) | null = null

async function handleClerkAuth(request: NextRequest): Promise<NextResponse> {
  // Dynamic import — only loads Clerk when needed.
  // This avoids the import-time crash when publishableKey is missing.
  if (!_clerkHandler) {
    try {
      const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server")
      const { extractAlluraMetadata } = await import("@/lib/auth/clerk")
      type ClerkPublicMetadata = import("@/lib/auth/types").ClerkPublicMetadata

      const isPublicMatcher = createRouteMatcher(["/", "/api/health(.*)", "/api/mcp(.*)", "/auth(.*)"])

      const ROLE_GATES: Array<{
        matcher: ReturnType<typeof createRouteMatcher>
        role: AlluraRole
      }> = [
        {
          matcher: createRouteMatcher(["/admin", "/admin/(.*)"]),
          role: "admin",
        },
        {
          matcher: createRouteMatcher(["/api/curator/approve", "/api/curator/watchdog", "/curator", "/curator/(.*)"]),
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
      ]

      const clerkInstance = clerkMiddleware(async (auth, req) => {
        const { pathname } = req.nextUrl

        // Public routes — always pass through
        if (isPublicMatcher(req)) {
          return NextResponse.next()
        }

        // Static assets and Next.js internals
        if (pathname.startsWith("/_next/") || pathname.startsWith("/favicon") || pathname.includes(".")) {
          return NextResponse.next()
        }

        // Determine required role
        let requiredRole: AlluraRole | null = null
        for (const gate of ROLE_GATES) {
          if (gate.matcher(req)) {
            requiredRole = gate.role
            break
          }
        }

        // Unprotected route — allow through
        if (!requiredRole) {
          return NextResponse.next()
        }

        // Require auth
        const { userId, sessionClaims } = await auth()

        if (!userId) {
          if (pathname.startsWith("/api/")) {
            return NextResponse.json({ error: "Authentication required", statusCode: 401 }, { status: 401 })
          }
          const loginUrl = new URL("/auth/v2/login", req.url)
          loginUrl.searchParams.set("redirect_url", pathname)
          return NextResponse.redirect(loginUrl)
        }

        // RBAC check
        const { role, groupId } = extractAlluraMetadata(
          sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined
        )

        if (!hasPermission(role, requiredRole)) {
          if (pathname.startsWith("/api/")) {
            return NextResponse.json(
              {
                error: "Insufficient permissions",
                statusCode: 403,
                required: requiredRole,
                actual: role,
              },
              { status: 403 }
            )
          }
          const url = new URL("/unauthorized", req.url)
          url.searchParams.set("required", requiredRole)
          url.searchParams.set("actual", role)
          return NextResponse.redirect(url)
        }

        // Authenticated and authorized — inject headers
        const response = NextResponse.next()
        response.headers.set("x-allura-user-id", userId)
        response.headers.set("x-allura-role", role)
        response.headers.set("x-allura-group-id", groupId)
        return response
      })

      // Wrap clerkInstance to match our handler signature.
      // clerkMiddleware returns a Next.js middleware function;
      // we call it with (request, evt) to get a Response.
      _clerkHandler = async (req: NextRequest) => {
        try {
          // clerkMiddleware returns a function that Next.js calls with (req, evt).
          // In dynamic context, we call it directly.
          const result = await (clerkInstance as any)(req, {} as any)
          // If result is a Response, wrap it; if it's already a NextResponse, return it
          if (result instanceof NextResponse) {
            return result
          }
          if (result instanceof Response) {
            return new NextResponse(result.body, {
              status: result.status,
              statusText: result.statusText,
              headers: result.headers,
            })
          }
          // Fallback — shouldn't normally happen
          return NextResponse.next()
        } catch (err) {
          console.error("[proxy] Clerk handler error, falling back to dev auth:", err)
          return handleDevAuth(req)
        }
      }
    } catch (err) {
      console.warn("[proxy] Clerk dynamic import failed, using DevAuthProvider:", err)
      // Wrap sync handleDevAuth in async signature to match handler type
      _clerkHandler = async (req: NextRequest) => handleDevAuth(req)
    }
  }
  return _clerkHandler!(request)
}

// ── Proxy Export ─────────────────────────────────────────────────────────────

/**
 * Next.js 16 Proxy — conditionally routes to Clerk or DevAuthProvider.
 *
 * Clerk is loaded dynamically to avoid import-time crashes when
 * NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not configured.
 */
export default async function proxy(request: NextRequest, _event?: unknown): Promise<NextResponse> {
  if (!isClerkEnabled()) {
    return handleDevAuth(request)
  }
  return handleClerkAuth(request)
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
