# curation

> API documentation for `curation` module.

## Functions

### `runCurator`

Run the Curator agent for a group Scans traces, detects patterns, and creates draft insights

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `options` | `unknown` | - Curator options |

**Returns:**

`void` - Curator result

---

### `runCuratorBatch`

Run Curator for multiple groups Useful for batch processing

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `groupIds` | `unknown` | - Array of group IDs |
| `options` | `unknown` | - Common curator options (group_id will be overridden) |

**Returns:**

`void` - Array of curator results

---

### `getCuratorStatistics`

Get curator statistics for a group

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `groupId` | `unknown` | - Group ID |

**Returns:**

`void` - Curator statistics

---

### `previewDrafts`

Preview what drafts would be created without actually creating them Useful for testing and review

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `options` | `unknown` | - Curator options (dry_run is always true) |

**Returns:**

`void` - Curator result with drafts but no created insights

---

### `validateCuratorOptions`

Validate curator options

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `options` | `unknown` | - Options to validate |

**Throws:**

- `Error` - CuratorError if options are invalid

---

### `formatCuratorResult`

Format curator result for logging

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `result` | `unknown` | - Curator result |

**Returns:**

`void` - Formatted string

---

### `defaultContentTemplate`

Default content template Generates human-readable insight content from pattern

---

### `generateDraftInsights`

Generate draft insights from detected patterns

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `patterns` | `unknown` | - Detected patterns |
| `options` | `unknown` | - Generation options |

**Returns:**

`void` - Array of draft insights (not yet stored)

---

### `createDraftInsights`

Create draft insights in Neo4j Stores draft insights with status='pending_approval'

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `drafts` | `unknown` | - Draft insights to create |

**Returns:**

`void` - Array of created insight records

---

### `summarizeDraft`

Generate insight summary for approval UI Creates a concise summary of the draft insight

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `draft` | `unknown` | - Draft insight |

**Returns:**

`void` - Summary string

---

### `generateAndCreateDrafts`

Generate batch of draft insights from patterns Convenience function that combines generation and creation

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `patterns` | `unknown` | - Detected patterns |
| `options` | `unknown` | - Generation options |

**Returns:**

`void` - Array of created draft insights

---

### `calculateDraftQuality`

Calculate estimated quality of draft insights Useful for prioritizing human review

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `draft` | `unknown` | - Draft insight |

**Returns:**

`void` - Quality score (0.0 - 1.0)

---

### `getCuratorStats`

Get curator statistics Useful for monitoring curator performance

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `groupId` | `unknown` | - Group ID |

**Returns:**

`void` - Statistics about curator activity

---

### `detectPatterns`

Detect successful patterns from PostgreSQL traces

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `options` | `unknown` | - Detection options |

**Returns:**

`void` - Array of detected patterns

---

### `extractCommonPatterns`

Extract common patterns from an array of objects Returns key-value pairs that appear frequently

---

### `calculateConfidence`

Calculate confidence score for a pattern Based on frequency and success rate

---

### `getPatternByEventType`

Get pattern details by event type

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `groupId` | `unknown` | - Group ID |
| `eventType` | `unknown` | - Event type to analyze |

**Returns:**

`void` - Pattern details or null

---

### `getEventTypes`

Get all unique event types for a group Useful for determining what patterns to look for

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `groupId` | `unknown` | - Group ID |
| `limit` | `unknown` | - Maximum number of event types to return |

**Returns:**

`void` - Array of event types with counts

---

### `getPatternStats`

Get pattern statistics for a group Useful for monitoring curator performance

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `groupId` | `unknown` | - Group ID |

**Returns:**

`void` - Statistics about patterns detected

---

## Classes

### `CuratorError`

Curator error

---

### `InsightGenerationError`

Generation error

---

### `PatternDetectionError`

Pattern detection error

---

## Interfaces

### `CuratorOptions`

Curator run options

---

### `CuratorResult`

Curator run result

---

### `CuratorStats`

Curator statistics

---

### `DraftInsight`

Draft insight generated from a pattern

---

### `InsightGenerationOptions`

Insight generation options

---

### `DetectedPattern`

Pattern detected from traces

---

### `PatternDetectionOptions`

Pattern detection options

---

### `EventPattern`

Event pattern from database

---

## Type Definitions

### `DetectedPattern`

Curator Agent Orchestration Story 1.7: Automated Knowledge Curation  Main orchestrator for the Curator agent that: 1. Scans PostgreSQL traces for patterns 2. Generates draft insights 3. Flags for human approval

---

### `InsightRecord`

Draft Insight Generation from Patterns Story 1.7: Automated Knowledge Curation  Generates draft insights from detected patterns.

---
