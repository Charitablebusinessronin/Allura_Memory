# sync

> API documentation for `sync` module.

## Functions

### `createDriftAnalyzer`

Create a drift analyzer

---

### `createInsightMirror`

Create an insight mirror

---

### `createMockInsightMirror`

Create a mock insight mirror for testing

---

### `createNeo4jExtractor`

Create a Neo4j extractor

---

### `createMockNeo4jExtractor`

Create a mock Neo4j extractor for testing

---

### `createNotionExtractor`

Create a Notion extractor

---

### `createMockNotionExtractor`

Create a mock Notion extractor for testing

---

### `createSyncStateManager`

Create a sync state manager

---

### `createMockSyncStateManager`

Create a mock sync state manager for testing

---

## Classes

### `DriftAnalyzer`

Drift Analyzer  Analyzes drift between Notion and Neo4j data. Identifies missing entities, stale entities, and conflicts. Generates actionable reconciliation recommendations.

---

### `MockNotionMirrorClient`

Mock Notion client for testing

---

### `MockNeo4jInsightClient`

Mock Neo4j client for testing

---

### `InsightMirror`

Insight Mirror  Mirrors high-confidence approved insights from Neo4j to Notion. Creates structured pages with trace_ref linking to source evidence.

---

### `MockNeo4jClient`

Mock Neo4j client for testing Generates realistic test data without actual database connection

---

### `Neo4jExtractor`

Neo4j Extractor  Extracts entity data from Neo4j for drift detection. Supports filtering by type, timestamp, and sync key presence.

---

### `NotionRateLimiter`

Token bucket rate limiter for Notion API Enforces 3 requests per second limit with exponential backoff

---

### `MockNotionClient`

Mock Notion client for testing Generates realistic test data without actual API calls

---

### `NotionExtractor`

Notion Extractor  Extracts entity data from Notion for drift detection. Handles rate limiting, pagination, and incremental extraction.

---

### `MockNeo4jStateClient`

Mock Neo4j client for testing

---

### `SyncStateManager`

Sync State Manager  Manages sync state tracking for mirrored insights. Stores Notion page URLs in Neo4j for drift detection.

---

## Interfaces

### `InsightNode`

Insight data from Neo4j

---

### `InsightClaim`

Claim associated with an insight

---

### `InsightEvidence`

Evidence associated with an insight

---

### `NotionPageContent`

Notion page content structure

---

### `NotionBlock`

Notion block structure

---

### `MirrorConfig`

Mirror configuration

---

### `MirrorResult`

Mirror result for a single insight

---

### `BatchMirrorResult`

Batch mirror result

---

### `NotionMirrorClient`

Notion API client interface for creating pages

---

### `Neo4jInsightClient`

Neo4j client interface for querying insights

---

### `Neo4jClient`

Neo4j driver interface Abstracts the actual Neo4j driver for testing/mocking

---

### `Neo4jSession`

Neo4j session interface

---

### `NotionClient`

Notion API client interface This abstracts the actual Notion SDK for testing/mocking

---

### `SyncState`

Sync state for a single entity

---

### `SyncStateQuery`

Sync state query options

---

### `SyncStateResult`

Sync state result

---

### `SyncStatistics`

Sync statistics

---

### `SyncDriftResult`

Sync drift detection result

---

### `SyncStateConfig`

Sync state configuration

---

### `Neo4jStateClient`

Neo4j client interface for sync state

---

### `SyncKey`

Sync key - unique identifier linking Notion and Neo4j entities  Uses stable identifiers that exist in both systems: - For AgentDesign pages: Notion page ID - For Task nodes: Notion page ID or custom UUID - For Knowledge entries: Neo4j node UUID stored in Notion

---

### `NotionEntity`

Notion entity snapshot for comparison

---

### `Neo4jEntity`

Neo4j entity snapshot for comparison

---

### `DriftResult`

Drift detection result for a single entity

---

### `DriftReport`

Drift detection report

---

### `DriftSummary`

Drift summary statistics

---

### `ReconciliationRecommendation`

Reconciliation recommendation for a drift

---

### `NotionExtractionOptions`

Notion extraction options

---

### `NotionExtractionResult`

Notion extraction result

---

### `Neo4jExtractionOptions`

Neo4j extraction options

---

### `Neo4jExtractionResult`

Neo4j extraction result

---

### `ExtractionError`

Extraction error

---

### `DriftAnalyzerConfig`

Drift analyzer configuration

---

### `RateLimiterConfig`

Rate limiter configuration Notion API has 3 requests per second limit

---

## Type Definitions

### `and`

Execute mock query

---

### `from`

Convert Neo4j record to entity

---

### `if`

Query mock database

---

### `if`

Extract entities from Notion database

---

### `SyncStatus`

Sync status

---

### `EntityType`

Entity types that can be synced

---

### `DriftStatus`

Drift status for an entity

---

### `DriftType`

Drift types classification

---

### `ReconciliationPriority`

Reconciliation priority levels

---

### `ReconciliationDirection`

Reconciliation direction

---
