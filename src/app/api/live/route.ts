/**
 * Liveness Probe API Endpoint — GET /api/live
 *
 * Kubernetes liveness probe. Returns 200 if the Node.js process is alive.
 * No dependency checks — that's the readiness probe's job.
 *
 * No auth required — this is a health endpoint.
 */

import { NextResponse } from "next/server";
import { checkLiveness } from "@/lib/health/probes";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const result = checkLiveness();
  return NextResponse.json(result, { status: 200 });
}