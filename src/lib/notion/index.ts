/**
 * Notion Integration Module
 * Story 2.5: Synchronize Best Designs to the Notion Registry
 *
 * Exports Notion API client, design sync, and drift monitoring.
 */

export {
  NotionClient,
  NotionApiError,
  NotionRateLimitError,
  NotionAuthError,
  NotionNotFoundError,
  NotionValidationError,
  getNotionClient,
  closeNotionClient,
  createNotionClient,
  type NotionClientConfig,
  type CreatePageResult,
  type UpdatePageResult,
  type GetPageResult,
  type QueryDatabaseResult,
  type CreatePagePayload,
  type UpdatePagePayload,
  type AppendBlocksPayload,
} from "./client";

export {
  DesignSyncManager,
  createDesignSyncManager,
  syncDesignToNotion,
  syncAllApprovedDesigns,
  type SyncConfig,
  type DesignSyncResult,
  type BatchSyncResult,
  type SyncStatusRecord,
} from "./design-sync";

export {
  SyncMonitor,
  createSyncMonitor,
  checkDrift,
  checkAllDrift,
  resolveDrift,
  type SyncDriftStatus,
  type DriftCheckResult,
  type BatchDriftResult,
  type DriftAction,
  type DriftConfig,
} from "./sync-monitor";

export {
  buildDesignPageTemplate,
  buildMinimalPageTemplate,
  buildDesignPageBlocks,
  buildDesignPageProperties,
  generateDesignSummary,
  generateHowToRunGuide,
  type NotionBlock,
  type RichText,
  type NotionPageProperties,
  type AgentDesignSummary,
  type HowToRunGuide,
  type DesignPageTemplate,
  type PageTemplateConfig,
} from "./templates";

export {
  syncTraceToNotion,
  getSyncStatus,
  markAsReviewed,
  promoteFromNotion,
  getSyncStatusCounts,
  rejectSync,
  NotionSyncValidationError,
  DEFAULT_NOTION_DATABASE_ID,
  type SyncStatus,
  type SyncStatusRecord,
  type SyncToNotionParams,
  type SyncToNotionResult,
  type GetSyncStatusParams,
  type MarkAsReviewedParams,
  type PromoteFromNotionParams,
  type PromoteFromNotionResult,
} from "./sync-workflow";