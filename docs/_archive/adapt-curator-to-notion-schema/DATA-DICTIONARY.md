# Data Dictionary: Adapt Curator to Master Knowledge Base Schema

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model (Claude).
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

This document describes all data structures used in the curator-to-Notion schema adaptation, including property mappings, configuration constants, and Notion API payload formats.

---

## Table of Contents

- [PROPERTY_MAPPING](#property_mapping)
- [MASTER_KB_PROPERTIES](#master_kb_properties)
- [STATUS_TO_CONTENT_TYPE](#status_to_content_type)
- [INSIGHT_PAYLOAD](#insight_payload)
- [Environment Variables](#environment-variables)

---

## PROPERTY_MAPPING

Configuration entry defining a single curator-to-Notion property mapping. Part of the `PROPERTY_MAPPINGS` array in `notion-property-mapper.ts`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domain` | string | Yes | Curator internal property name (e.g., "title", "sourceProject") |
| `notion` | string | Yes | Notion database property name (e.g., "Name", "Source") |
| `exists` | boolean | Yes | Whether the Notion property exists in Master KB |
| `transform` | enum | No | Transformation to apply when building payload |

**`transform` values**

| Value | Description |
|-------|-------------|
| `canonicalToDisplay` | Convert canonical tag to display tag via DISPLAY_TAG_MAP |
| `statusToContentType` | Map status value to Content Type select option |

---

## MASTER_KB_PROPERTIES

Constant object containing all property names in the Notion Master Knowledge Base database. Used as the single source of truth for Notion property names.

| Field | Type | Description |
|-------|------|-------------|
| `NAME` | string | Title property — "Name" |
| `SOURCE` | string | Rich text property — "Source" |
| `CATEGORY` | string | Select property — "Category" |
| `TAGS` | string | Multi-select property — "Tags" |
| `AI_ACCESSIBLE` | string | Checkbox property — "AI Accessible" |
| `CONTENT_TYPE` | string | Select property — "Content Type" |

---

## STATUS_TO_CONTENT_TYPE

Mapping of curator status values to Master Knowledge Base Content Type select values.

| Source Status | Content Type |
|---------------|--------------|
| `Proposed` | `Insight` |
| `Pending Review` | `Insight` |
| `Approved` | `Insight` |
| `Rejected` | `Insight` |
| `Superseded` | `Insight` |

All status values map to "Insight" in Content Type. This provides future flexibility if different content types are introduced.

---

## INSIGHT_PAYLOAD

The Notion API property payload built by `buildMasterKBPayload()`. Each property is formatted according to Notion's rich property type requirements.

| Field | Notion Type | Format | Example |
|-------|-------------|--------|---------|
| `Name` | title | `{ title: [{ text: { content: "..." } }] }` | Page title |
| `Source` | rich_text | `{ rich_text: [{ text: { content: "..." } }] }` | "memory-project" |
| `Category` | select | `{ select: { name: "..." } }` | Display tag value |
| `Tags` | multi_select | `{ multi_select: [{ name: "..." }, ...] }` | Array of tags |
| `AI Accessible` | checkbox | `{ checkbox: true/false }` | Always false on create |
| `Content Type` | select | `{ select: { name: "Insight" } }` | Always "Insight" |

---

## Expected Schema vs Master KB Schema

### Expected Schema (Curator Assumption)

| Property | Type | Status in Master KB |
|----------|------|---------------------|
| Title | title | ✅ (as "Name") |
| Summary | rich_text | ❌ Missing |
| Confidence | number | ❌ Missing |
| Canonical Tag | rich_text | ❌ Missing (use "Category") |
| Display Tags | multi_select | ✅ (as "Tags") |
| Status | select | ❌ Missing (use "Content Type") |
| Review Status | select | ❌ Missing |
| AI Accessible | checkbox | ✅ Present |
| Source Insight ID | rich_text | ❌ Missing |
| Source Project | rich_text | ❌ Missing (use "Source") |
| Promoted At | date | ❌ Missing |
| Approved At | date | ❌ Missing |
| Approved By | rich_text | ❌ Missing |

### Master Knowledge Base Actual Schema

| Property | Type | Maps From |
|----------|------|-----------|
| **Name** | title | Title |
| **Source** | rich_text | Source Project |
| **Category** | select | Canonical Tag (transformed) |
| **Tags** | multi_select | Display Tags |
| **AI Accessible** | checkbox | AI Accessible |
| **Content Type** | select | Status (transformed) |
| **Assigned Agents** | multi_select | Skip — Not used |
| **Language** | select | Skip — Not used |
| **Created Date** | date | System — Not set |
| **Last Updated** | date | System — Not set |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NOTION_INSIGHTS_DB_ID` | Yes | Notion database ID for Master Knowledge Base |
| `NOTION_API_KEY` | Yes | Notion API integration token |

### Environment Values

| Environment | NOTION_INSIGHTS_DB_ID |
|-------------|----------------------|
| **Old (Wrong)** | `f1bb3b77-0658-4545-8acf-b2081fbe8690` (Ronin Agents) |
| **New (Correct)** | `e5d3db1e-1290-4d33-bd1f-71f93cc36655` (Master Knowledge Base) |

---

**See also:**
- [BLUEPRINT.md](BLUEPRINT.md) — System design and requirements
- [SOLUTION-ARCHITECTURE.md](SOLUTION-ARCHITECTURE.md) — System topology
- [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md) — Requirement traceability
- [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) — Risks and decisions
- [TASKS.md](TASKS.md) — Implementation tasks
