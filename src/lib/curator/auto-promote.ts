/**
 * auto-promote.ts — Deprecated Auto-Promotion Compatibility Shim
 *
 * Canonical memory promotion is HITL-only. This module remains only to keep
 * historical imports compiling while preventing autonomous semantic promotion.
 *
 * PROMOTION_MODE values:
 *   "soc2"  — all promotions require human approval (HITL)
 *   "auto"  — accepted for compatibility; still requires HITL approval
 *
 * Reference: docs/allura/BLUEPRINT.md (F10, F12, B18)
 */

if (typeof window !== "undefined") {
  throw new Error("auto-promote can only be used server-side")
}

import { validateGroupId } from "@/lib/validation/group-id"

// ── Types ──────────────────────────────────────────────────────────────────

export interface AutoPromoteOptions {
  group_id: string
  /** Historical threshold option; ignored because promotion is HITL-only. */
  threshold?: number
  /** Max proposals to process in one call (default: 50) */
  limit?: number
}

export interface AutoPromoteResult {
  promoted: string[]
  skipped: string[]
  errors: Array<{ proposal_id: string; reason: string }>
}

// ── Core service ───────────────────────────────────────────────────────────

/**
 * Check whether autonomous promotion is enabled.
 *
 * Always false: eligible proposals must wait for curator/HITL approval.
 */
export function isAutoPromoteEnabled(): boolean {
  return false
}

/**
 * Deprecated compatibility entry point.
 *
 * Does not approve, mutate, or promote proposals. Use the curator approval path
 * for semantic promotion.
 */
export async function autoPromoteProposal(
  proposal_id: string,
  group_id: string,
  curator_id = "auto-promote"
): Promise<{ memory_id: string; decided_at: string } | null> {
  validateGroupId(group_id)
  void proposal_id
  void curator_id
  return null
}

/**
 * Deprecated compatibility entry point. Returns an empty result because all
 * pending proposals require explicit curator/HITL review.
 */
export async function autoPromotePendingProposals(
  opts: AutoPromoteOptions
): Promise<AutoPromoteResult> {
  const result: AutoPromoteResult = { promoted: [], skipped: [], errors: [] }
  validateGroupId(opts.group_id)
  void opts.threshold
  void opts.limit
  return result
}
