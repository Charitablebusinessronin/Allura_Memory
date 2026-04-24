/**
 * Auto-Curator — Pattern detection and candidate insight proposal
 *
 * Reads recent raw_memory_event windows from PostgreSQL,
 * detects repeated patterns, and proposes candidate insights
 * WITHOUT writing truth directly to Neo4j or Notion.
 *
 * Law: Curator proposes. Paperclip approves. Neo4j remembers. Notion explains.
 *
 * Reference: Sprint 9 P4 — Auto-Curator
 */

if (typeof window !== "undefined") {
  throw new Error("Auto-curator can only be used server-side")
}

import { getPool } from "@/lib/postgres/connection"
import { validateGroupId } from "@/lib/validation/group-id"
import { curatorScore, type CuratorScore, type PromotionTier } from "@/lib/curator/score"

// ── Types ──────────────────────────────────────────────────────────────────

export type CandidateInsightType = "decision" | "pattern" | "failure" | "optimization"
export type ImpactLevel = "low" | "medium" | "high"

export interface CandidateInsight {
  /** Unique candidate ID */
  id: string
  /** The group_id this insight belongs to */
  group_id: string
  /** Type classification */
  type: CandidateInsightType
  /** What the insight is about */
  content: string
  /** Confidence score (0.0–1.0) from curator scoring */
  confidence: number
  /** Impact assessment */
  impact: ImpactLevel
  /** How many events contributed to this pattern */
  frequency: number
  /** Novelty score relative to existing Neo4j knowledge (0.0–1.0) */
  novelty_score: number
  /** Why this matters */
  reasoning: string
  /** Tier from scoring */
  tier: PromotionTier
  /** Source event IDs that contributed */
  source_event_ids: number[]
  /** Whether this requires HITL approval */
  requires_approval: boolean
  /** When this candidate was created */
  created_at: string
}

export interface PatternDetectionResult {
  candidates: CandidateInsight[]
  patterns_detected: number
  events_analyzed: number
  duplicates_suppressed: number
  analysis_window_hours: number
}

// ── Pattern Detectors ──────────────────────────────────────────────────────

interface RawEvent {
  id: number
  event_type: string
  agent_id: string
  group_id: string
  status: string
  metadata: Record<string, unknown>
  created_at: string
}

/**
 * Detect repeated failures (same error, same agent, same group)
 * Minimum 2 occurrences within the analysis window.
 */
export function detectFailurePatterns(events: RawEvent[]): CandidateInsight[] {
  const failureEvents = events.filter(
    (e) => e.event_type === "promotion_failed" || e.status === "failed"
  )

  // Group by agent + error type
  const failureGroups = new Map<string, { events: RawEvent[]; errorType: string }>()

  for (const event of failureEvents) {
    const metadata = event.metadata || {}
    const errorType = (metadata.error as string) || (metadata.error_message as string) || "unknown"
    const key = `${event.agent_id}|${errorType}|${event.group_id}`

    if (!failureGroups.has(key)) {
      failureGroups.set(key, { events: [], errorType })
    }
    failureGroups.get(key)!.events.push(event)
  }

  const candidates: CandidateInsight[] = []

  for (const [key, group] of failureGroups) {
    if (group.events.length < 2) continue // Minimum 2 occurrences

    const [agentId, errorType, groupId] = key.split("|")
    candidates.push({
      id: `candidate-failure-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      group_id: groupId,
      type: "failure",
      content: `Agent ${agentId} encountered repeated failures: ${errorType} (${group.events.length} occurrences)`,
      confidence: Math.min(0.5 + group.events.length * 0.1, 0.95),
      impact: group.events.length >= 5 ? "high" : group.events.length >= 3 ? "medium" : "low",
      frequency: group.events.length,
      novelty_score: 0.7, // Failures are usually novel (we don't want them repeating)
      reasoning: `Recurring failure detected: ${errorType} occurred ${group.events.length} times for agent ${agentId}. Root cause analysis recommended.`,
      tier: group.events.length >= 5 ? "mainstream" : group.events.length >= 3 ? "adoption" : "emerging",
      source_event_ids: group.events.map((e) => e.id),
      requires_approval: true, // Failures always require HITL
      created_at: new Date().toISOString(),
    })
  }

  return candidates
}

/**
 * Detect repeated wins (successful promotions, approvals)
 * Minimum 3 occurrences of same pattern type.
 */
export function detectWinPatterns(events: RawEvent[]): CandidateInsight[] {
  const winEvents = events.filter(
    (e) =>
      e.event_type === "proposal_approved" ||
      e.event_type === "memory_promoted" ||
      e.event_type === "tool_approved"
  )

  // Group by event type + group
  const winGroups = new Map<string, RawEvent[]>()

  for (const event of winEvents) {
    const key = `${event.event_type}|${event.group_id}`
    if (!winGroups.has(key)) {
      winGroups.set(key, [])
    }
    winGroups.get(key)!.push(event)
  }

  const candidates: CandidateInsight[] = []

  for (const [key, group] of winGroups) {
    if (group.length < 3) continue // Minimum 3 wins to form a pattern

    const [eventType, groupId] = key.split("|")
    const eventTypeLabel = eventType.replace(/_/g, " ")

    candidates.push({
      id: `candidate-win-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      group_id: groupId,
      type: "pattern",
      content: `Successful ${eventTypeLabel} pattern: ${group.length} occurrences in analysis window`,
      confidence: Math.min(0.6 + group.length * 0.05, 0.9),
      impact: group.length >= 10 ? "high" : group.length >= 5 ? "medium" : "low",
      frequency: group.length,
      novelty_score: 0.5, // Wins are less novel than failures
      reasoning: `Consistent success pattern: ${eventTypeLabel} occurred ${group.length} times. Consider documenting as institutional knowledge.`,
      tier: group.length >= 10 ? "mainstream" : group.length >= 5 ? "adoption" : "emerging",
      source_event_ids: group.map((e) => e.id),
      requires_approval: false, // Low-risk wins can be auto-approved
      created_at: new Date().toISOString(),
    })
  }

  return candidates
}

/**
 * Detect approval patterns (curator decisions)
 * Tracks approval rates and decision patterns.
 */
export function detectApprovalPatterns(events: RawEvent[]): CandidateInsight[] {
  const approvalEvents = events.filter(
    (e) => e.event_type === "proposal_approved" || e.event_type === "proposal_rejected"
  )

  if (approvalEvents.length < 2) return []

  const approved = approvalEvents.filter((e) => e.event_type === "proposal_approved").length
  const rejected = approvalEvents.filter((e) => e.event_type === "proposal_rejected").length
  const total = approved + rejected
  const approvalRate = total > 0 ? approved / total : 0

  // Only create a candidate if the pattern is meaningful
  if (total < 3) return []

  const candidates: CandidateInsight[] = []

  // High approval rate pattern
  if (approvalRate >= 0.9 && total >= 5) {
    candidates.push({
      id: `candidate-approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      group_id: approvalEvents[0].group_id,
      type: "optimization",
      content: `Curator approval rate is ${Math.round(approvalRate * 100)}% (${approved}/${total}). Consider increasing AUTO_APPROVAL_THRESHOLD.`,
      confidence: 0.85,
      impact: "medium",
      frequency: total,
      novelty_score: 0.6,
      reasoning: `High approval rate suggests proposals are consistently high quality. Auto-approval threshold could be adjusted to reduce HITL burden.`,
      tier: "adoption",
      source_event_ids: approvalEvents.map((e) => e.id),
      requires_approval: true, // Policy changes require HITL
      created_at: new Date().toISOString(),
    })
  }

  // High rejection rate pattern
  if (approvalRate <= 0.3 && total >= 5) {
    candidates.push({
      id: `candidate-rejection-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      group_id: approvalEvents[0].group_id,
      type: "decision",
      content: `Curator rejection rate is ${Math.round((1 - approvalRate) * 100)}% (${rejected}/${total}). Scoring threshold or content quality may need adjustment.`,
      confidence: 0.8,
      impact: "high",
      frequency: total,
      novelty_score: 0.75,
      reasoning: `High rejection rate suggests either the scoring threshold is too low or content quality needs review. Investigate rejected proposal patterns.`,
      tier: "adoption",
      source_event_ids: approvalEvents.map((e) => e.id),
      requires_approval: true,
      created_at: new Date().toISOString(),
    })
  }

  return candidates
}

/**
 * Detect tool-risk events (admin/destructive tool usage patterns)
 */
export function detectToolRiskPatterns(events: RawEvent[]): CandidateInsight[] {
  const toolEvents = events.filter(
    (e) => e.event_type === "tool_approved" || e.event_type === "tool_denied"
  )

  if (toolEvents.length === 0) return []

  const approved = toolEvents.filter((e) => e.event_type === "tool_approved").length
  const denied = toolEvents.filter((e) => e.event_type === "tool_denied").length

  // Only create a candidate if there are meaningful tool decisions
  if (approved + denied < 2) return []

  return [
    {
      id: `candidate-tool-risk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      group_id: toolEvents[0].group_id,
      type: "decision",
      content: `MCP catalog governance: ${approved} tools approved, ${denied} denied in analysis window. Tool adoption rate: ${approved > 0 ? Math.round((approved / (approved + denied)) * 100) : 0}%.`,
      confidence: 0.7,
      impact: "medium",
      frequency: approved + denied,
      novelty_score: 0.6,
      reasoning: `Tool governance patterns reveal adoption velocity and rejection patterns. High approval rate suggests good tool discovery; high rejection rate suggests quality gates are working.`,
      tier: "emerging",
      source_event_ids: toolEvents.map((e) => e.id),
      requires_approval: false, // Observational, not actionable
      created_at: new Date().toISOString(),
    },
  ]
}

// ── Dedup / Similarity ─────────────────────────────────────────────────────

/**
 * Check if a candidate is a duplicate of an existing canonical memory.
 * Uses simple lexical matching for now; embedding similarity is a future enhancement.
 *
 * Thresholds:
 *   >= 0.90  → duplicate (reject)
 *   0.80-0.89 → possible supersede (flag for review)
 *   0.65-0.79 → related context (include as reference)
 *   < 0.65    → new insight (proceed)
 */
export function classifySimilarity(
  candidateContent: string,
  existingContents: string[]
): { classification: "duplicate" | "supersede" | "related" | "new"; bestMatch: string; similarity: number } {
  const normalizedCandidate = candidateContent.toLowerCase().trim()

  let bestSimilarity = 0
  let bestMatch = ""

  for (const existing of existingContents) {
    const normalizedExisting = existing.toLowerCase().trim()

    // Jaccard similarity on word sets
    const candidateWords = new Set(normalizedCandidate.split(/\s+/))
    const existingWords = new Set(normalizedExisting.split(/\s+/))

    const intersection = new Set([...candidateWords].filter((w) => existingWords.has(w)))
    const union = new Set([...candidateWords, ...existingWords])

    const similarity = union.size > 0 ? intersection.size / union.size : 0

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity
      bestMatch = existing
    }
  }

  if (bestSimilarity >= 0.9) {
    return { classification: "duplicate", bestMatch, similarity: bestSimilarity }
  } else if (bestSimilarity >= 0.8) {
    return { classification: "supersede", bestMatch, similarity: bestSimilarity }
  } else if (bestSimilarity >= 0.65) {
    return { classification: "related", bestMatch, similarity: bestSimilarity }
  } else {
    return { classification: "new", bestMatch, similarity: bestSimilarity }
  }
}

// ── Main Auto-Curator ──────────────────────────────────────────────────────

/**
 * Run the auto-curator for a given group_id.
 * Analyzes recent events and proposes candidate insights.
 *
 * This function READS from Postgres and PROPOSES to canonical_proposals.
 * It does NOT write to Neo4j or Notion directly.
 */
export async function autoCurate(
  groupId: string,
  options?: {
    /** Analysis window in hours (default: 24) */
    windowHours?: number
    /** Maximum candidates to produce (default: 10) */
    maxCandidates?: number
  }
): Promise<PatternDetectionResult> {
  const validatedGroupId = validateGroupId(groupId)
  const windowHours = options?.windowHours ?? 24
  const maxCandidates = options?.maxCandidates ?? 10

  const pg = getPool()

  // Fetch recent events for analysis
  const result = await pg.query(
    `SELECT id, event_type, agent_id, group_id, status, metadata, created_at
     FROM events
     WHERE group_id = $1
       AND created_at >= NOW() - INTERVAL '${windowHours} hours'
     ORDER BY created_at DESC`,
    [validatedGroupId]
  )

  const events: RawEvent[] = result.rows.map((row) => ({
    id: row.id,
    event_type: row.event_type,
    agent_id: row.agent_id,
    group_id: row.group_id,
    status: row.status,
    metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata || {},
    created_at: row.created_at,
  }))

  // Run all pattern detectors
  const failureCandidates = detectFailurePatterns(events)
  const winCandidates = detectWinPatterns(events)
  const approvalCandidates = detectApprovalPatterns(events)
  const toolRiskCandidates = detectToolRiskPatterns(events)

  // Combine and deduplicate
  const allCandidates = [
    ...failureCandidates,
    ...winCandidates,
    ...approvalCandidates,
    ...toolRiskCandidates,
  ]

  // Fetch existing canonical memory contents for dedup
  const existingMemories = await pg.query(
    `SELECT content FROM allura_memories WHERE group_id = $1 LIMIT 100`,
    [validatedGroupId]
  )
  const existingContents = existingMemories.rows.map((r) => r.content as string)

  // Classify similarity and filter
  const filteredCandidates: CandidateInsight[] = []
  let duplicatesSuppressed = 0

  for (const candidate of allCandidates) {
    const similarity = classifySimilarity(candidate.content, existingContents)

    switch (similarity.classification) {
      case "duplicate":
        duplicatesSuppressed++
        continue // Skip duplicates entirely
      case "supersede":
        candidate.requires_approval = true // Flag for HITL review
        candidate.reasoning += ` (Similar to existing insight, similarity: ${Math.round(similarity.similarity * 100)}%)`
        break
      case "related":
        candidate.reasoning += ` (Related to existing content, similarity: ${Math.round(similarity.similarity * 100)}%)`
        break
      case "new":
        break // New insight, proceed as-is
    }

    // Apply curator scoring
    const score = await curatorScore({
      content: candidate.content,
      source: "conversation",
      usageCount: candidate.frequency,
    })

    candidate.confidence = score.confidence
    candidate.tier = score.tier
    candidate.reasoning = score.reasoning + ". " + candidate.reasoning

    // Determine impact from frequency and type
    if (candidate.type === "failure" && candidate.frequency >= 5) {
      candidate.impact = "high"
      candidate.requires_approval = true
    }

    filteredCandidates.push(candidate)
  }

  // Sort by confidence descending and take top N
  filteredCandidates.sort((a, b) => b.confidence - a.confidence)
  const topCandidates = filteredCandidates.slice(0, maxCandidates)

  return {
    candidates: topCandidates,
    patterns_detected: allCandidates.length,
    events_analyzed: events.length,
    duplicates_suppressed: duplicatesSuppressed,
    analysis_window_hours: windowHours,
  }
}

/**
 * Submit a candidate insight to the curator pipeline.
 * Creates a canonical_proposals row with status='pending'.
 * High-impact candidates ALWAYS require HITL.
 */
export async function submitCandidate(candidate: CandidateInsight): Promise<{ proposal_id: string; status: string; requires_approval: boolean }> {
  const pg = getPool()
  const validatedGroupId = validateGroupId(candidate.group_id)

  const result = await pg.query(
    `INSERT INTO canonical_proposals (group_id, content, score, tier, reasoning, status, trace_ref, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING id, status`,
    [
      validatedGroupId,
      candidate.content,
      candidate.confidence,
      candidate.tier,
      candidate.reasoning,
      candidate.requires_approval ? "pending" : "pending", // All go to pending — auto-promote handles the rest
      JSON.stringify(candidate.source_event_ids),
    ]
  )

  // Log the auto-curation event
  await pg.query(
    `INSERT INTO events (group_id, event_type, agent_id, status, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      validatedGroupId,
      "auto_curated",
      "auto-curator",
      "completed",
      JSON.stringify({
        candidate_id: candidate.id,
        proposal_id: result.rows[0].id,
        type: candidate.type,
        impact: candidate.impact,
        frequency: candidate.frequency,
        novelty_score: candidate.novelty_score,
        requires_approval: candidate.requires_approval,
        source_event_ids: candidate.source_event_ids,
      }),
    ]
  )

  return {
    proposal_id: result.rows[0].id,
    status: result.rows[0].status,
    requires_approval: candidate.requires_approval,
  }
}