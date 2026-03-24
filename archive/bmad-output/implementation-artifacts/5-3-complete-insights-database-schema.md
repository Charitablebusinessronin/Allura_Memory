# Story 5.3: Complete Insights Database Schema

Status: done

## Story

As a knowledge engineer,
I want all missing properties added to the Insights Database,
So that promoted insights have complete metadata in Notion.

## Acceptance Criteria

1. Given Insights Database is missing critical properties, when the schema update runs, then it adds: Summary (rich_text), Canonical Tag (text), Display Tags (multi-select), Status (select), AI Accessible (checkbox), Source Insight ID (text), Source Project (text), Promoted At (date), Approved At (date), Approved By (text), Rationale (rich_text)
2. And all properties are properly typed and named

## Tasks

- [x] Add Summary (rich_text) property
- [x] Add Canonical Tag (text) property - system slug like "difference-driven"
- [x] Add Display Tags (multi-select) property - human-readable labels
- [x] Add Status (select) property - Proposed/Pending Review/Approved/Rejected/Superseded
- [x] Add AI Accessible (checkbox) property
- [x] Add Source Insight ID (text) property - Neo4j node ID
- [x] Add Source Project (text) property
- [x] Add Promoted At (date) property
- [x] Add Approved At (date) property
- [x] Add Approved By (text) property
- [x] Add Rationale (rich_text) property

## Dev Notes

### Schema Definition

```yaml
Insights Database v2:
  Name: title
  Summary: rich_text
  Confidence: number (0.0 - 1.0)
  Canonical Tag: text (system slug)
  Display Tags: multi_select (human labels)
  Status: select (Proposed, Pending Review, Approved, Rejected, Superseded)
  AI Accessible: checkbox
  Source Insight ID: text (Neo4j ID)
  Source Project: text
  Promoted At: date
  Approved At: date
  Approved By: text
  Rationale: rich_text
```

### Property Purposes

| Property | Purpose |
|----------|---------|
| Summary | What was learned (human-readable) |
| Canonical Tag | System identity (difference-driven, faith-meats) |
| Display Tags | Notion display labels (Difference driven, Faith meats) |
| Status | Workflow state |
| AI Accessible | Human approval flag |
| Source Insight ID | Link back to Neo4j |
| Source Project | Project context |
| Promoted At | Timestamp of promotion |
| Approved At | Timestamp of approval |
| Approved By | Who approved |
| Rationale | Why this insight is valuable |

### Implementation

Properties were added manually to the Notion Insights Database. The curator pipeline was updated to populate these fields during promotion.

## File List

- Notion Insights Database schema update
- Curator pipeline updates to populate new fields

## Completion Notes

- Schema completed 2026-03-17
- All 11 missing properties added
- Curator updated to populate fields on promotion