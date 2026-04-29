/**
 * Workspace Isolation Middleware
 *
 * Express/Next.js middleware that enforces workspace boundaries on every request.
 *
 * Modes:
 * - strict (default): Reject violations with 403 + audit event
 * - permissive (WORKSPACE_ISOLATION_MODE=permissive): Log warning + continue
 *
 * FR-5: API layer enforcement
 * FR-6: Audit every violation
 * NFR-4: Path traversal must be impossible
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isValidWorkspaceGroupId,
  isAllowedGroupId,
  isWithinWorkspace,
  WORKSPACE_ROOT,
} from "@/lib/workspace/boundary";
import { WorkspaceViolationError } from "@/lib/workspace/errors";
import { logWorkspaceViolation } from "@/lib/workspace/audit";

// ── Configuration ─────────────────────────────────────────────────────────────

/**
 * Workspace isolation enforcement mode.
 * - strict: reject violations with 403
 * - permissive: log warning and continue
 */
export type IsolationMode = "strict" | "permissive";

/**
 * Get current isolation mode (reads env each time for testability).
 */
function getIsolationMode(): IsolationMode {
  return (process.env.WORKSPACE_ISOLATION_MODE as IsolationMode) || "strict";
}

/**
 * Check if strict mode is active.
 */
export function isStrictMode(): boolean {
  return getIsolationMode() === "strict";
}

/**
 * Check if permissive mode is active.
 */
export function isPermissiveMode(): boolean {
  return getIsolationMode() === "permissive";
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkspaceIsolationContext {
  groupId: string | null;
  mode: IsolationMode;
  violation: boolean;
  violationCode?: string;
}

// ── Helper: Extract group_id from request ───────────────────────────────────

/**
 * Extract group_id from a NextRequest.
 *
 * Searches (in order):
 * 1. x-allura-group-id header
 * 2. Query parameter: ?group_id=
 * 3. JSON body: { group_id }
 *
 * @param request - Incoming NextRequest
 * @returns Extracted group_id or null
 */
export async function extractGroupId(request: NextRequest): Promise<string | null> {
  // 1. Header
  const header = request.headers.get("x-allura-group-id");
  if (header) return header.trim();

  // 2. Query parameter
  const url = new URL(request.url);
  const query = url.searchParams.get("group_id");
  if (query) return query.trim();

  // 3. JSON body (only for POST/PUT/PATCH with JSON content)
  if (
    ["POST", "PUT", "PATCH"].includes(request.method) &&
    request.headers.get("content-type")?.includes("application/json")
  ) {
    try {
      // Clone to avoid consuming the original body
      const cloned = request.clone();
      const body = await cloned.json();
      if (body && typeof body.group_id === "string") {
        return body.group_id.trim();
      }
    } catch {
      // Not valid JSON or no group_id field
    }
  }

  return null;
}

// ── Helper: Build 403 response ────────────────────────────────────────────────

function forbiddenResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      error: "workspace_boundary_violation",
      code,
      message,
      details,
    },
    { status: 403 }
  );
}

// ── Main Middleware ───────────────────────────────────────────────────────────

/**
 * Workspace isolation middleware for Next.js App Router.
 *
 * Usage in route handlers:
 * ```ts
 * import { withWorkspaceIsolation } from "@/middleware/workspace-isolation";
 *
 * export const GET = withWorkspaceIsolation(async (request, context) => {
 *   // context.groupId is validated and available
 *   return NextResponse.json({ groupId: context.groupId });
 * });
 * ```
 *
 * @param handler - Next.js route handler
 * @returns Wrapped handler with workspace isolation
 */
export function withWorkspaceIsolation(
  handler: (
    request: NextRequest,
    context: WorkspaceIsolationContext
  ) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const groupId = await extractGroupId(request);
    const mode = getIsolationMode();

    // Missing group_id
    if (!groupId) {
      const event = {
        groupId: "unknown",
        code: "WS003",
        message: "Missing group_id: required header, query param, or body field not found",
        operation: `${request.method} ${request.nextUrl.pathname}`,
      };

      if (isStrictMode()) {
        await logWorkspaceViolation(event);
        return forbiddenResponse(
          "WS003",
          "Missing group_id: x-allura-group-id header, ?group_id= query param, or body.group_id required"
        );
      }

      // Permissive mode: log and continue with null groupId
      console.warn(`[WorkspaceIsolation] ${event.message}`);
      await logWorkspaceViolation(event);
      return handler(request, { groupId: null, mode, violation: true, violationCode: "WS003" });
    }

    // Invalid group_id format
    if (!isValidWorkspaceGroupId(groupId)) {
      const event = {
        groupId,
        code: "WS001",
        message: `Invalid group_id format: "${groupId}" does not match ^allura-[a-z0-9-]+$`,
        operation: `${request.method} ${request.nextUrl.pathname}`,
      };

      if (isStrictMode()) {
        await logWorkspaceViolation(event);
        return forbiddenResponse(
          "WS001",
          `Invalid group_id: "${groupId}". Must match pattern ^allura-[a-z0-9-]+$`,
          { groupId }
        );
      }

      console.warn(`[WorkspaceIsolation] ${event.message}`);
      await logWorkspaceViolation(event);
      return handler(request, { groupId, mode, violation: true, violationCode: "WS001" });
    }

    // group_id not in allowed list (if configured)
    if (!isAllowedGroupId(groupId)) {
      const event = {
        groupId,
        code: "WS001",
        message: `Group_id "${groupId}" is not in the allowed list`,
        operation: `${request.method} ${request.nextUrl.pathname}`,
      };

      if (isStrictMode()) {
        await logWorkspaceViolation(event);
        return forbiddenResponse(
          "WS001",
          `Group_id "${groupId}" is not authorized`,
          { groupId }
        );
      }

      console.warn(`[WorkspaceIsolation] ${event.message}`);
      await logWorkspaceViolation(event);
      return handler(request, { groupId, mode, violation: true, violationCode: "WS001" });
    }

    // Valid group_id — attach to context and continue
    return handler(request, { groupId, mode, violation: false });
  };
}

/**
 * Standalone workspace isolation check (for use outside of route handlers).
 *
 * @param groupId - The group_id to validate
 * @returns Validation result
 */
export function checkWorkspaceIsolation(groupId: string): {
  valid: boolean;
  code?: string;
  message?: string;
} {
  if (!groupId) {
    return { valid: false, code: "WS003", message: "Missing group_id" };
  }

  if (!isValidWorkspaceGroupId(groupId)) {
    return {
      valid: false,
      code: "WS001",
      message: `Invalid group_id: "${groupId}". Must match pattern ^allura-[a-z0-9-]+$`,
    };
  }

  if (!isAllowedGroupId(groupId)) {
    return {
      valid: false,
      code: "WS001",
      message: `Group_id "${groupId}" is not authorized`,
    };
  }

  return { valid: true };
}
