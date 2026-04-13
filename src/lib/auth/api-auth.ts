/**
 * API Route Auth Helpers
 *
 * Server-side utilities for checking authentication and authorization
 * in Next.js API route handlers.
 *
 * Usage in route handlers:
 *   import { requireAuth, requireRole } from "@/lib/auth/api-auth";
 *
 *   export async function GET(request: NextRequest) {
 *     const user = requireAuth(request);
 *     if (!user) return unauthorizedResponse();
 *
 *     const roleCheck = requireRole(request, "curator");
 *     if (!roleCheck.allowed) return forbiddenResponse(roleCheck);
 *
 *     // ... proceed with authenticated request
 *   }
 *
 * Reference: Phase 7 benchmark — RBAC with curator/admin/viewer roles
 */

import { NextRequest, NextResponse } from "next/server";
import type { AuthUser, AlluraRole, PermissionCheckResult } from "./types";
import { hasPermission, checkPermission, parseRole } from "./roles";
import { isClerkEnabled } from "./config";
import { getDevUserSync } from "./dev-auth";

// ── Auth Resolution ─────────────────────────────────────────────────────────

/**
 * Get the authenticated user from the request.
 *
 * In production with Clerk: reads from middleware-injected headers.
 * In development without Clerk: returns the dev user.
 *
 * Returns null if no authenticated user is found.
 */
export function getAuthUser(request: NextRequest): AuthUser | null {
  // Development mode: use DevAuthProvider
  if (!isClerkEnabled()) {
    return getDevUserSync();
  }

  // Production mode: read from middleware headers
  const userId = request.headers.get("x-allura-user-id");
  const role = request.headers.get("x-allura-role");
  const groupId = request.headers.get("x-allura-group-id");
  const email = request.headers.get("x-allura-email");
  const name = request.headers.get("x-allura-name");
  const imageUrl = request.headers.get("x-allura-image-url");

  if (!userId) {
    return null;
  }

  return {
    id: userId,
    email: email ?? "",
    name: name ?? undefined,
    role: parseRole(role, "viewer"),
    groupId: groupId ?? "allura-default",
    imageUrl: imageUrl ?? undefined,
  };
}

/**
 * Require authentication — returns the user or null.
 *
 * Use this when the route requires authentication but not a specific role.
 * If null is returned, respond with `unauthorizedResponse()`.
 */
export function requireAuth(request: NextRequest): AuthUser | null {
  return getAuthUser(request);
}

/**
 * Require a minimum role — returns a permission check result.
 *
 * Use this when the route requires a specific role level.
 * If `allowed` is false, respond with `forbiddenResponse(result)`.
 */
export function requireRole(
  request: NextRequest,
  requiredRole: AlluraRole,
): PermissionCheckResult & { user: AuthUser | null } {
  const user = getAuthUser(request);

  if (!user) {
    return {
      allowed: false,
      reason: "Authentication required",
      requiredRole,
      actualRole: "viewer" as AlluraRole,
      user: null,
    };
  }

  const result = checkPermission(user.role, requiredRole);
  return { ...result, user };
}

// ── Response Helpers ─────────────────────────────────────────────────────────

/**
 * Standard 401 Unauthorized response.
 */
export function unauthorizedResponse(message: string = "Authentication required"): NextResponse {
  return NextResponse.json(
    {
      error: message,
      statusCode: 401,
    },
    { status: 401 }
  );
}

/**
 * Standard 403 Forbidden response with role details.
 */
export function forbiddenResponse(
  result: PermissionCheckResult,
): NextResponse {
  return NextResponse.json(
    {
      error: "Insufficient permissions",
      statusCode: 403,
      required: result.requiredRole,
      actual: result.actualRole,
      message: result.reason,
    },
    { status: 403 }
  );
}

/**
 * Extract group_id from auth context.
 *
 * If the request has an authenticated user, uses their group_id.
 * Falls back to the query parameter or body parameter.
 * Falls back to "allura-default" if nothing is available.
 *
 * This replaces the hardcoded `allura-default` pattern in UI components.
 */
export function getGroupIdFromAuth(
  request: NextRequest,
  fallbackGroupId?: string,
): string {
  const user = getAuthUser(request);
  if (user?.groupId) {
    return user.groupId;
  }

  // Try query parameter for GET requests
  const urlGroupId = new URL(request.url).searchParams.get("group_id");
  if (urlGroupId) {
    return urlGroupId;
  }

  // Use provided fallback or default
  return fallbackGroupId ?? "allura-default";
}