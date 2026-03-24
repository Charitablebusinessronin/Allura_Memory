# Story 5.1: Audit and Document Notion Database Schemas

Status: done

## Story

As a system architect,
I want a complete audit of all Notion database schemas with property documentation,
So that we have clear visibility into current state and required fixes.

## Acceptance Criteria

1. Given the Notion workspace exists, when the schema audit runs, then it documents all databases: Master Knowledge Base, AI Agents Registry, Agent Learning Log, Insights Database
2. And it identifies missing properties in each database
3. And it flags overloaded properties (e.g., Tags containing project/domain/status)

## Tasks

- [x] Audit Master Knowledge Base schema
- [x] Audit AI Agents Registry schema
- [x] Audit Agent Learning Log schema
- [x] Audit Insights Database schema
- [x] Document property overload issues
- [x] Create recommended v2 schemas

## Dev Notes

### Audit Results

#### Master Knowledge Base ⚠️
| Property | Type | Purpose | Status |
|----------|------|---------|--------|
| Name | Title | Document title | ✅ |
| Category | Select | Document type | ✅ |
| Tags | Multi-select | OVERLOADED | ⚠️ |
| AI Accessible | Checkbox | Human approval | ✅ |
| Content Type | Select | Media type | ✅ |
| Assigned Agents | Relation | Agent assignment | ✅ |
| Source | Text | Origin | ✅ |
| Language | Select | Programming language | ✅ |

**Issue:** Tags contains:
- Project identity: Faith meats, Difference driven
- Technical: Python, Docker, Neo4j
- Workflow: Urgent, Completed
- Status: Operational, Strategic

#### AI Agents Registry ✅
Clean schema - no issues.

#### Agent Learning Log ✅
Clean schema - no issues.

#### Insights Database ❌ MISSING PROPERTIES
| Property | Type | Purpose | Status |
|----------|------|---------|--------|
| Name | Title | Insight title | ✅ |
| Confidence | Number | 0.0-1.0 | ✅ |
| Summary | Rich Text | What was learned | ❌ MISSING |
| Canonical Tag | Text | System slug | ❌ MISSING |
| Display Tags | Multi-select | Notion labels | ❌ MISSING |
| Status | Select | Proposed/Approved/etc | ❌ MISSING |
| AI Accessible | Checkbox | Human approval | ❌ MISSING |
| Source Insight ID | Text | Neo4j ID | ❌ MISSING |
| Source Project | Text | Project | ❌ MISSING |
| Promoted At | Date | When promoted | ❌ MISSING |
| Approved At | Date | When approved | ❌ MISSING |
| Approved By | Text | Who approved | ❌ MISSING |
| Rationale | Rich Text | Why valuable | ❌ MISSING |

### Recommended v2 Schemas

#### Master Knowledge Base v2
- Name (title)
- Category (select): Architecture, Governance, Insight, Policy, Tooling
- Project (multi_select): faith-meats, difference-driven, patriot-awning, global-coding-skills
- Domain (multi_select): AI, RAG, Coding, Infrastructure, Memory, Governance
- Status (select): Draft, Approved, Superseded, Archived
- AI Accessible (checkbox)
- Assigned Agents (relation)
- Source (text)
- Canonical ID (text): System slug for group_id

#### Insights Database v2
- Name (title)
- Summary (rich_text)
- Confidence (number): 0.0 - 1.0
- Canonical Tag (text): difference-driven, faith-meats, etc.
- Display Tags (multi_select): Difference driven, Faith meats, etc.
- Status (select): Proposed, Pending Review, Approved, Rejected, Superseded
- AI Accessible (checkbox)
- Source Insight ID (text): Neo4j node ID
- Source Project (text)
- Promoted At (date)
- Approved At (date)
- Approved By (text)
- Rationale (rich_text)

### Stability Rating
| Layer | Current | After Fix |
|-------|---------|-----------|
| Notion schema | 8/10 | 9/10 |
| Governance clarity | 6/10 | 9/10 |
| Long-term isolation | 5/10 | 10/10 |

## File List

- Schema audit documentation (this file)
- Recommended v2 schema definition

## Completion Notes

- Audit completed on 2026-03-17
- Identified critical Tags overload in Master Knowledge Base
- Identified 11 missing properties in Insights Database
- Created recommended v2 schemas for both databases