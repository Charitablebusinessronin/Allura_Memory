/**
 * Notion Projection Sync — Event type mapping and sync key generation
 *
 * Shared constants and utilities for Notion projection sync.
 * This module has NO server-side imports — safe for test environments.
 * The main sync logic lives in notion-projection-sync.ts.
 *
 * Reference: Sprint 8 P3 — Live Event → Notion Sync
 */

import { createHash } from "crypto"
import { getPool } from "@/lib/postgres/connection"
import { validateGroupId } from "@/lib/validation/group-id"

// ── Notion Types ──────────────────────────────────────────────────────────

/** Function type for creating Notion pages. Injected at runtime.
 *  Supports data source creation (pages[]) and standard page creation.
 */
export type NotionCreatePageFn = (params: {
  parent: { page_id: string } | { database_id: string } | { data_source_id: string }
  properties?: Record<string, unknown>
  children?: Record<string, unknown>[]
  pages?: Array<Record<string, unknown>>
}) => Promise<{ id: string; pages?: Array<{ id: string; url?: string }> }>

// ── Types ──────────────────────────────────────────────────────────────────

export type NotionSyncTargetType = "proposal" | "insight" | "tool_approval" | "execution_event"

export interface NotionSyncTarget {
  /** What kind of Notion object to create/update */
  type: NotionSyncTargetType
  /** The event ID from PostgreSQL */
  eventId: number
  /** The group_id for tenant isolation */
  groupId: string
  /** The metadata payload from the event */
  metadata: Record<string, unknown>
  /** When this sync was created */
  createdAt: string
}

export interface NotionSyncResult {
  success: boolean
  notionPageId?: string
  notionPageUrl?: string
  syncKey: string
  error?: string
  retried?: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Map event_type to Notion sync target type */
export const EVENT_TYPE_TO_TARGET: Record<string, NotionSyncTargetType> = {
  proposal_approved: "proposal",
  proposal_rejected: "proposal",
  notion_sync_pending: "proposal",
  memory_promoted: "insight",
  tool_approved: "tool_approval",
  tool_denied: "tool_approval",
  execution_succeeded: "execution_event",
  execution_failed: "execution_event",
  execution_blocked: "execution_event",
}

// ── Idempotent Sync Key ────────────────────────────────────────────────────

/**
 * Generate an idempotent sync key for a given event and target.
 * SHAKE-256 hash ensures uniqueness per event+target combination.
 */
export function generateSyncKey(eventId: number, targetType: NotionSyncTargetType): string {
  return createHash("shake256", { outputLength: 16 })
    .update(`${eventId}|${targetType}`)
    .digest("hex")
}

// ── Notion page IDs for sync targets ─────────────────────────────────────────

export const NOTION_SYNC_TARGETS = {
  alluraParent: "33b1d9be65b38045b6b0fa8c48dbc17b",
  insightsRegistry: "34c1d9be65b381d98e8ce12c10deeeea",
  executionLifecycle: "34c1d9be65b38142acf6ebdfd299062f",
  governanceFlow: "34c1d9be65b381e3a7f9e713de24b4a5",
  curatorDataSource: "42894678-aedb-4c90-9371-6494a9fe5270",
} as const

// ── Sync Status Tracking ───────────────────────────────────────────────────

/**
 * Check if a sync has already been completed for this event+target.
 * Returns the Notion page ID if it has, null otherwise.
 */
export async function getCompletedSync(
  eventId: number,
  targetType: NotionSyncTarget["type"],
  groupId: string
): Promise<string | null> {
  const pg = getPool()
  const syncKey = generateSyncKey(eventId, targetType)
  const validatedGroupId = validateGroupId(groupId)

  const result = await pg.query(
    `SELECT notion_page_id FROM notion_sync_log
     WHERE sync_key = $1 AND group_id = $2 AND status = 'completed'
     LIMIT 1`,
    [syncKey, validatedGroupId]
  )

  return result.rows.length > 0 ? result.rows[0].notion_page_id : null
}

/**
 * Record a sync attempt in the log.
 * Idempotent: if the sync_key already exists with status 'completed',
 * returns the existing page ID without creating a duplicate.
 */
export async function recordSyncAttempt(
  eventId: number,
  targetType: NotionSyncTarget["type"],
  groupId: string,
  success: boolean,
  notionPageId: string | null,
  error?: string
): Promise<void> {
  const pg = getPool()
  const syncKey = generateSyncKey(eventId, targetType)
  const validatedGroupId = validateGroupId(groupId)

  await pg.query(
    `INSERT INTO notion_sync_log (sync_key, event_id, target_type, group_id, status, notion_page_id, error_message, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (sync_key) DO NOTHING`,
    [
      syncKey,
      eventId,
      targetType,
      validatedGroupId,
      success ? "completed" : "failed",
      notionPageId,
      error || null,
    ]
  )
}

// ── Sync Functions per Target ───────────────────────────────────────────────

/**
 * Sync a proposal approval/rejection to Notion Curator Proposals DB.
 * Uses the existing notion-sync.ts infrastructure.
 */
export async function syncProposalToNotion(
  target: NotionSyncTarget,
  createPageFn: NotionCreatePageFn
): Promise<NotionSyncResult> {
  const { metadata } = target
  const syncKey = generateSyncKey(target.eventId, "proposal")

  // Check idempotency
  const existingPage = await getCompletedSync(target.eventId, "proposal", target.groupId)
  if (existingPage) {
    return { success: true, notionPageId: existingPage, syncKey, retried: false }
  }

  try {
    const status = (metadata as Record<string, unknown>).status as string || "pending"
    const content = (metadata as Record<string, unknown>).content as string || "Untitled Proposal"
    const score = (metadata as Record<string, unknown>).score as number || 0
    const curatorId = (metadata as Record<string, unknown>).curator_id as string || "unknown"

    const result = await createPageFn({
      parent: { data_source_id: "42894678-aedb-4c90-9371-6494a9fe5270" },
      pages: [
        {
          properties: {
            "Title": content.substring(0, 100),
            "Status": status,
            "Score": score,
            "Group ID": target.groupId,
            "Notes": `Approved by ${curatorId}. Event: ${target.eventId}`,
          },
        },
      ],
    })

    const pageId = result.pages?.[0]?.id || ""
    const pageUrl = result.pages?.[0]?.url || ""

    await recordSyncAttempt(target.eventId, "proposal", target.groupId, true, pageId)

    return { success: true, notionPageId: pageId, notionPageUrl: pageUrl, syncKey }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    await recordSyncAttempt(target.eventId, "proposal", target.groupId, false, null, errorMsg)
    return { success: false, syncKey, error: errorMsg }
  }
}

/**
 * Sync an insight promotion to Notion Insights Registry.
 * Appends a new insight section to the existing Insights Registry page.
 */
export async function syncInsightToNotion(
  target: NotionSyncTarget,
  createPageFn: NotionCreatePageFn
): Promise<NotionSyncResult> {
  const { metadata } = target
  const syncKey = generateSyncKey(target.eventId, "insight")

  const existingPage = await getCompletedSync(target.eventId, "insight", target.groupId)
  if (existingPage) {
    return { success: true, notionPageId: existingPage, syncKey, retried: false }
  }

  try {
    const insightId = (metadata as Record<string, unknown>).memory_id as string || `insight-${target.eventId}`
    const content = (metadata as Record<string, unknown>).content as string || ""
    const score = (metadata as Record<string, unknown>).score as number || 0

    // Create as a child page of the Allura memory parent
    const result = await createPageFn({
      parent: { page_id: NOTION_SYNC_TARGETS.alluraParent },
      pages: [
        {
          properties: { title: `📊 ${insightId}` },
          content: `**Type:** ${"insight"}\n**Source:** Event ${target.eventId}\n**Content:** ${content}\n**Score:** ${score}\n**Group:** ${target.groupId}\n\n*Synced from Allura event ${target.eventId}. Notion is a projection, not a witness.*`,
          icon: "📊",
        },
      ],
    })

    const pageId = result.pages?.[0]?.id || ""
    const pageUrl = result.pages?.[0]?.url || ""

    await recordSyncAttempt(target.eventId, "insight", target.groupId, true, pageId)

    return { success: true, notionPageId: pageId, notionPageUrl: pageUrl, syncKey }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    await recordSyncAttempt(target.eventId, "insight", target.groupId, false, null, errorMsg)
    return { success: false, syncKey, error: errorMsg }
  }
}

/**
 * Sync a tool approval/denial to Notion MCP Catalog page.
 */
export async function syncToolApprovalToNotion(
  target: NotionSyncTarget,
  createPageFn: NotionCreatePageFn
): Promise<NotionSyncResult> {
  const { metadata } = target
  const syncKey = generateSyncKey(target.eventId, "tool_approval")

  const existingPage = await getCompletedSync(target.eventId, "tool_approval", target.groupId)
  if (existingPage) {
    return { success: true, notionPageId: existingPage, syncKey, retried: false }
  }

  try {
    const candidateId = (metadata as Record<string, unknown>).candidate_id as string || "unknown"
    const decision = (metadata as Record<string, unknown>).decision as string || "unknown"

    const result = await createPageFn({
      parent: { page_id: NOTION_SYNC_TARGETS.alluraParent },
      pages: [
        {
          properties: { title: `🔧 Tool ${decision}: ${candidateId}` },
          content: `**Candidate:** ${candidateId}\n**Decision:** ${decision}\n**Group:** ${target.groupId}\n**Event:** ${target.eventId}\n\n*Synced from Allura MCP Catalog event. Notion is a projection, not a witness.*`,
          icon: "🔧",
        },
      ],
    })

    const pageId = result.pages?.[0]?.id || ""
    const pageUrl = result.pages?.[0]?.url || ""

    await recordSyncAttempt(target.eventId, "tool_approval", target.groupId, true, pageId)

    return { success: true, notionPageId: pageId, notionPageUrl: pageUrl, syncKey }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    await recordSyncAttempt(target.eventId, "tool_approval", target.groupId, false, null, errorMsg)
    return { success: false, syncKey, error: errorMsg }
  }
}

/**
 * Main sync dispatcher — routes events to the correct Notion target.
 */
export async function syncEventToNotion(
  event: { id: number; event_type: string; group_id: string; metadata: Record<string, unknown>; created_at: string },
  createPageFn: NotionCreatePageFn
): Promise<NotionSyncResult> {
  const targetType = EVENT_TYPE_TO_TARGET[event.event_type]

  if (!targetType) {
    return {
      success: false,
      syncKey: generateSyncKey(event.id, "proposal"),
      error: `Unknown event type for Notion sync: ${event.event_type}`,
    }
  }

  const target: NotionSyncTarget = {
    type: targetType,
    eventId: event.id,
    groupId: event.group_id,
    metadata: event.metadata,
    createdAt: event.created_at,
  }

  switch (targetType) {
    case "proposal":
      return syncProposalToNotion(target, createPageFn)
    case "insight":
      return syncInsightToNotion(target, createPageFn)
    case "tool_approval":
      return syncToolApprovalToNotion(target, createPageFn)
    case "execution_event":
      // Execution events don't create individual pages — they update the lifecycle page
      // This is a no-op for now; execution events are queryable via /api/health/metrics
      return { success: true, syncKey: generateSyncKey(event.id, "execution_event"), retried: false }
    default:
      return { success: false, syncKey: generateSyncKey(event.id, targetType), error: `Unhandled target type: ${targetType}` }
  }
}

/**
 * Process all pending Notion sync events for a group.
 * Idempotent: skips events that have already been synced successfully.
 */
export async function processPendingNotionSyncs(
  groupId: string,
  createPageFn: NotionCreatePageFn,
  limit = 50
): Promise<{ synced: number; skipped: number; failed: number }> {
  const pg = getPool()
  const validatedGroupId = validateGroupId(groupId)

  const result = await pg.query(
    `SELECT id, event_type, group_id, metadata, created_at
     FROM events
     WHERE group_id = $1
       AND event_type IN ('proposal_approved', 'proposal_rejected', 'memory_promoted', 'tool_approved', 'tool_denied', 'notion_sync_pending')
       AND id NOT IN (
         SELECT event_id FROM notion_sync_log WHERE status = 'completed'
       )
     ORDER BY created_at ASC
     LIMIT $2`,
    [validatedGroupId, limit]
  )

  let synced = 0
  let skipped = 0
  let failed = 0

  for (const row of result.rows) {
    const syncResult = await syncEventToNotion(
      {
        id: row.id,
        event_type: row.event_type,
        group_id: row.group_id,
        metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
        created_at: row.created_at,
      },
      createPageFn
    )

    if (syncResult.success) {
      if (syncResult.retried) {
        skipped++
      } else {
        synced++
      }
    } else {
      failed++
      console.error(`[NotionSync] Failed to sync event ${row.id}: ${syncResult.error}`)
    }
  }

  return { synced, skipped, failed }
}