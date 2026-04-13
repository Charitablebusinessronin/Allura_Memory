/**
 * Prometheus Metrics API Endpoint — GET /api/metrics
 *
 * Exposes application metrics in Prometheus exposition format.
 * Content-Type: text/plain; version=0.0.4; charset=utf-8
 *
 * Protected by Bearer token auth (same as MCP endpoint).
 * If ALLURA_MCP_AUTH_TOKEN is not set, auth is disabled (dev mode).
 */

import { NextRequest, NextResponse } from "next/server";
import { collectMetrics } from "@/lib/health/metrics";

export const dynamic = "force-dynamic";

const AUTH_TOKEN = process.env.ALLURA_MCP_AUTH_TOKEN || "";

/**
 * Validate Bearer token using timing-safe comparison.
 */
function validateBearerAuth(request: NextRequest): boolean {
  if (!AUTH_TOKEN) return true; // Dev mode — no auth

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;

  const token = authHeader.slice(7);
  const expected = Buffer.from(AUTH_TOKEN, "utf-8");
  const provided = Buffer.from(token, "utf-8");
  if (expected.length !== provided.length) return false;
  return expected.equals(provided);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Auth check — same pattern as MCP endpoint
  if (!validateBearerAuth(request)) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Bearer realm="Allura Memory Metrics"',
      },
    });
  }

  const metricsText = collectMetrics();

  return new NextResponse(metricsText, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}