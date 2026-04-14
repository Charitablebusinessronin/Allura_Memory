/**
 * RuVector Retrieval Adapter
 *
 * Thin integration layer between canonical MCP retrieval and RuVector.
 * Wraps retrieveMemories() with trajectory tracking and a feature flag
 * so callers can opt into RuVector search and later submit feedback
 * using the returned trajectoryId.
 *
 * Key constraints:
 * - Server-only: throws if imported in browser
 * - Uses import type for type-only imports
 * - group_id validated via validateGroupId() (ARCH-001)
 * - No string interpolation in SQL (delegated to bridge.ts)
 * - Uses existing getRuVectorPool() from connection.ts
 */

// Server-only guard
if (typeof window !== "undefined") {
  throw new Error("RuVector retrieval adapter can only be used server-side");
}

import type { RetrieveMemoriesResult } from "./types";
import { retrieveMemories, isRuVectorReady } from "./bridge";
import { isRuVectorEnabled } from "./connection";
import { validateGroupId } from "../validation/group-id";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Result from retrieval with feedback metadata.
 * Extends the base RetrieveMemoriesResult with:
 * - bridgeSource: which backend produced these memories
 * - shouldLogFeedback: true only when memories were actually returned,
 *   so callers know whether postFeedback() is meaningful
 */
export interface RetrievalWithFeedbackResult extends RetrieveMemoriesResult {
  /** Which backend produced these memories */
  bridgeSource?: "ruvector" | "postgres";
  /** Whether postFeedback() should be called (true only if memories.length > 0) */
  shouldLogFeedback: boolean;
}

// ── shouldUseRuVector ─────────────────────────────────────────────────────────

/**
 * Feature flag check: should RuVector be used for retrieval?
 *
 * Checks both the RUVECTOR_ENABLED env var and the health endpoint.
 * Returns false immediately if the env var is off, otherwise
 * performs an async health check.
 *
 * @returns Whether RuVector should handle the current request
 */
export async function shouldUseRuVector(): Promise<boolean> {
  if (!isRuVectorEnabled()) {
    return false;
  }

  try {
    const readiness = await isRuVectorReady();
    return readiness.ready;
  } catch {
    return false;
  }
}

// ── searchWithFeedback ─────────────────────────────────────────────────────────

/**
 * Retrieve memories via RuVector with trajectory tracking.
 *
 * Wraps the bridge's retrieveMemories() and enriches the result with:
 * - bridgeSource: 'ruvector' (since this path always uses RuVector)
 * - shouldLogFeedback: true only when memories were actually returned
 *
 * The caller can use the trajectoryId from the result to later call
 * postFeedback() if they actually incorporate any memories into
 * their response (evidence-gated feedback).
 *
 * @param userId - Tenant isolation key (validated as group_id per ARCH-001)
 * @param query - Search query text
 * @param options - Optional limit and threshold overrides
 * @returns Enriched retrieval result with feedback metadata
 * @throws GroupIdValidationError if userId doesn't match ^allura-[a-z0-9-]+$
 */
export async function searchWithFeedback(
  userId: string,
  query: string,
  options?: { limit?: number; threshold?: number }
): Promise<RetrievalWithFeedbackResult> {
  // Validate group_id per ARCH-001 tenant isolation
  validateGroupId(userId);

  const base = await retrieveMemories({
    userId,
    query,
    limit: options?.limit,
    threshold: options?.threshold,
  });

  return {
    ...base,
    bridgeSource: "ruvector",
    shouldLogFeedback: base.memories.length > 0,
  };
}