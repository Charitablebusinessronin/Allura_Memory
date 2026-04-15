import { NextRequest, NextResponse } from "next/server"

// Paths that never require auth (public)
const PUBLIC_PATHS = [
  "/auth",
  "/api/health",
  "/api/live",
  "/api/stream",
  "/_next",
  "/favicon",
]

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  // Always allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // In dev mode: bypass auth entirely
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next()
  }

  // In production: check for auth session cookie
  // Clerk sets __session; DevAuth sets allura-dev-session
  const hasSession =
    request.cookies.has("__session") ||
    request.cookies.has("allura-dev-session")

  if (!hasSession) {
    const loginUrl = new URL("/auth/v2/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
