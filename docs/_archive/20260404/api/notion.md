# notion

> API documentation for `notion` module.

## Functions

### `sleep`

Sleep utility for backoff

---

### `calculateBackoff`

Calculate exponential backoff delay

---

### `getNotionClient`

Get or create the singleton Notion client

---

### `closeNotionClient`

Close the client (reset singleton)

---

### `createNotionClient`

Create a Notion client with custom config

---

### `convertNumber`

Convert Neo4j node to AgentDesignNode

---

### `createDesignSyncManager`

Create a design sync manager

---

### `syncDesignToNotion`

Convenience function to sync a design

---

### `syncAllApprovedDesigns`

Convenience function to sync all approved designs

---

### `createSyncMonitor`

Create a sync monitor

---

### `checkDrift`

Convenience function to check drift

---

### `checkAllDrift`

Convenience function to check all drift

---

### `resolveDrift`

Convenience function to resolve drift

---

### `createRichText`

Create a rich text object

---

### `createHeading`

Create a heading block

---

### `createParagraph`

Create a paragraph block

---

### `createCodeBlock`

Create a code block

---

### `createCallout`

Create a callout block

---

### `createDivider`

Create a divider block

---

### `createBulletedListItem`

Create a bulleted list item

---

### `createNumberedListItem`

Create a numbered list item

---

### `createBookmark`

Create a bookmark block

---

### `generateDesignSummary`

Generate human-readable summary from design code AC1: Creates a summary from AgentDesign

---

### `generateHowToRunGuide`

Generate how-to-run guide from evaluation metadata AC1: Creates usage guide from design configuration

---

### `buildDesignPageBlocks`

Build Notion page blocks for a design Creates the full page structure with summary and guide

---

### `buildDesignPageProperties`

Build Notion page properties for a design Creates the database entry properties

---

### `buildDesignPageTemplate`

Build complete page template for Notion sync

---

### `buildMinimalPageTemplate`

Create minimal page template for database entry only

---

## Classes

### `NotionApiError`

Notion API error types

---

### `NotionRateLimitError`

Rate limit error

---

### `NotionAuthError`

Authentication error

---

### `NotionNotFoundError`

Not found error

---

### `NotionValidationError`

Validation error

---

### `NotionClient`

Notion API Client with backoff and retry

---

### `DesignSyncManager`

Design sync manager Handles mirroring AgentDesign nodes to Notion

---

### `SyncMonitor`

Sync Monitor Detects and handles drift between Neo4j and Notion

---

## Interfaces

### `NotionClientConfig`

Notion API configuration

---

### `CreatePageResult`

Page creation result

---

### `UpdatePageResult`

Page update result

---

### `GetPageResult`

Page retrieval result

---

### `QueryDatabaseResult`

Database query result

---

### `NotionBlockInput`

Notion page block

---

### `CreatePagePayload`

Create page payload

---

### `UpdatePagePayload`

Update page payload

---

### `AppendBlocksPayload`

Append blocks payload

---

### `SyncConfig`

Sync configuration

---

### `DesignSyncResult`

Sync result for a single design

---

### `BatchSyncResult`

Batch sync result

---

### `SyncStatusRecord`

Sync status record (stored in PostgreSQL)

---

### `AgentDesignNode`

Agent design node type (from promotion-proposal.ts)

---

### `DriftCheckResult`

Drift detection result for a single design

---

### `BatchDriftResult`

Batch drift check result

---

### `SyncStatusRecord`

Sync status from PostgreSQL

---

### `NotionPageInfo`

Notion page properties for comparison

---

### `DriftConfig`

Drift resolution config

---

### `NotionBlock`

Notion block types Simplified representation for creating Notion pages

---

### `NotionPageProperties`

Notion page properties

---

### `AgentDesignSummary`

AgentDesign summary for Notion page creation

---

### `HowToRunGuide`

How-to-run guide content

---

### `PageTemplateConfig`

Page template configuration

---

### `DesignPageTemplate`

Create full page template for syncing to Notion

---

## Type Definitions

### `ManagedTransaction`

Design Synchronization to Notion Story 2.5: Synchronize Best Designs to the Notion Registry  Mirrors AgentDesign nodes to Notion knowledge base. Implements AC1: Syncs designs with confidence >= 0.7 after approval. Implements AC2: Adds trace_ref link to PostgreSQL evidence.

---

### `PromotionStatus`

Promotion status type

---

### `NotionClientConfig`

Notion Integration Module Story 2.5: Synchronize Best Designs to the Notion Registry  Exports Notion API client, design sync, and drift monitoring.

---

### `ManagedTransaction`

Sync Drift Detection and Monitoring Story 2.5: Synchronize Best Designs to the Notion Registry  Detects and handles sync drift between Neo4j and Notion. Implements AC3: System detects and handles sync drift.

---

### `SyncDriftStatus`

Sync drift status

---

### `DriftAction`

Drift resolution action

---
