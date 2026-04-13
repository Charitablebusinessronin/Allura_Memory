/**
 * Curator Watchdog API
 *
 * POST /api/curator/watchdog — Run one scan cycle for a group
 * GET  /api/curator/watchdog — Return watchdog status + pending count
 *
 * Designed for cron-style invocation (e.g. Vercel Cron, systemd timer).
 * Does NOT auto-approve — proposals go to canonical_proposals for HITL review.
 */

if (typeof window !== "undefined") {
  throw new Error("This module can only be used server-side");
}

import { NextRequest, NextResponse } from "next/server";
import { scanAndPropose } from "@/curator/watchdog";
import { getPool } from "@/lib/postgres/connection";
import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id";
import { requireRole, forbiddenResponse, unauthorizedResponse } from "@/lib/auth/api-auth";

const DEFAULT_GROUP_ID = process.env.ALLURA_GROUP_ID ?? "allura-roninmemory";
const DEFAULT_THRESHOLD = parseFloat(process.env.CURATOR_SCORE_THRESHOLD ?? "0.7");

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth: require curator or admin role
  const roleCheck = requireRole(req, "curator");
  if (!roleCheck.user) {
    return unauthorizedResponse();
  }
  if (!roleCheck.allowed) {
    return forbiddenResponse(roleCheck);
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[watchdog:POST] start requestId=${requestId}`);

  let groupId = DEFAULT_GROUP_ID;
  let scoreThreshold = DEFAULT_THRESHOLD;

  try {
    const body = await req.json().catch(() => ({}));
    if (body.group_id) {
      try {
        groupId = validateGroupId(body.group_id);
      } catch (error) {
        if (error instanceof GroupIdValidationError) {
          console.warn(`[watchdog:POST] invalid group_id="${body.group_id}" requestId=${requestId}`);
          return NextResponse.json(
            { error: `Invalid group_id: ${error.message}` },
            { status: 400 }
          );
        }
        throw error;
      }
    }
    if (typeof body.score_threshold === "number") {
      scoreThreshold = body.score_threshold;
    }
  } catch {
    // malformed body — use defaults
  }

  const start = Date.now();
  const proposed = await scanAndPropose({ groupId, scoreThreshold });
  const duration_ms = Date.now() - start;

  console.log(`[watchdog:POST] done requestId=${requestId} group=${groupId} proposed=${proposed} duration=${duration_ms}ms`);

  return NextResponse.json({
    ok: true,
    group_id: groupId,
    score_threshold: scoreThreshold,
    proposals_created: proposed,
    duration_ms,
    scanned_at: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Auth: require curator or admin role
  const roleCheck = requireRole(req, "curator");
  if (!roleCheck.user) {
    return unauthorizedResponse();
  }
  if (!roleCheck.allowed) {
    return forbiddenResponse(roleCheck);
  }

  console.log(`[watchdog:GET] status check group=${DEFAULT_GROUP_ID}`);
  const pool = getPool();

  const [pending, total] = await Promise.all([
    pool.query(
      "SELECT COUNT(*) AS cnt FROM canonical_proposals WHERE status = 'pending'"
    ),
    pool.query("SELECT COUNT(*) AS cnt FROM canonical_proposals"),
  ]);

  const pendingCount = Number(pending.rows[0].cnt);
  const totalCount = Number(total.rows[0].cnt);

  console.log(`[watchdog:GET] group=${DEFAULT_GROUP_ID} pending=${pendingCount} total=${totalCount}`);

  return NextResponse.json({
    ok: true,
    pending: pendingCount,
    total: totalCount,
    group_id: DEFAULT_GROUP_ID,
    score_threshold: DEFAULT_THRESHOLD,
    checked_at: new Date().toISOString(),
  });
}
