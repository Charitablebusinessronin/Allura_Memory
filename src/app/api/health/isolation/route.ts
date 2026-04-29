/**
 * Workspace Isolation Health Check
 *
 * GET /api/health/isolation
 *
 * Returns workspace boundary status, enforcement mode, and recent violations.
 *
 * FR-6: Observable health checks
 * NFR-5: Health check endpoint for isolation status
 */

import { NextResponse } from "next/server";
import { isStrictMode, isPermissiveMode } from "@/middleware/workspace-isolation";
import { getViolationSummary } from "@/lib/workspace/audit";
import { isValidWorkspaceGroupId } from "@/lib/workspace/boundary";
import { WORKSPACE_ROOT } from "@/lib/workspace/boundary";

export const dynamic = "force-dynamic";

/**
 * Isolation health check response.
 */
export interface IsolationHealthResponse {
  status: "ok" | "degraded" | "critical";
  mode: "strict" | "permissive";
  workspaceRoot: string;
  boundaries: {
    fileSystem: boolean;
    database: boolean;
    api: boolean;
  };
  violations: {
    last24h: number;
    total: number;
    lastViolationAt: string | null;
    recent: Array<{
      groupId: string;
      code: string;
      message?: string;
      operation?: string;
    }>;
  };
  timestamp: string;
}

/**
 * GET handler for /api/health/isolation
 */
export async function GET(): Promise<NextResponse> {
  const summary = getViolationSummary();
  const mode = isStrictMode() ? "strict" : "permissive";

  // Determine status based on violations
  let status: IsolationHealthResponse["status"] = "ok";
  if (summary.last24h > 0) {
    status = "degraded";
  }
  if (summary.last24h >= 10) {
    status = "critical";
  }

  const response: IsolationHealthResponse = {
    status,
    mode,
    workspaceRoot: WORKSPACE_ROOT,
    boundaries: {
      fileSystem: true, // FS guard is always active
      database: true,   // DB guard is always active
      api: true,        // Middleware is always active
    },
    violations: {
      last24h: summary.last24h,
      total: summary.total,
      lastViolationAt: summary.lastViolationAt,
      recent: summary.recent.map((v) => ({
        groupId: v.groupId,
        code: v.code,
        message: v.message,
        operation: v.operation,
      })),
    },
    timestamp: new Date().toISOString(),
  };

  // HTTP status: 200 for ok/degraded, 503 for critical
  const httpStatus = status === "critical" ? 503 : 200;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
