/**
 * Liveness Probe — GET /api/health/live
 *
 * Kubernetes liveness check. Returns 200 as long as the process is alive.
 * No dependency checks — if this fails, Kubernetes restarts the pod.
 *
 * Includes uptime in seconds for observability.
 */

import { NextResponse } from "next/server";
import { checkLiveness } from "@/lib/health/probes";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const result = checkLiveness();

  return NextResponse.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}