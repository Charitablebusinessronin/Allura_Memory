# Risks & Decisions Matrix: Adapt Curator to Master Knowledge Base Schema

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model (Claude).
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

This document captures key architectural and design decisions made in the curator-to-Notion schema adaptation, the rationale behind each, the alternatives considered, and the risks they introduce.

---

## Table of Contents

- [1. Architectural Decisions](#1-architectural-decisions)
- [2. Risks](#2-risks)

---

## 1. Architectural Decisions

### AD-01: Master Knowledge Base Database ID

| Field | Detail |
|-------|--------|
| **Status** | Decided |
| **Decision** | Update `NOTION_INSIGHTS_DB_ID` environment variable to point to Master Knowledge Base (`e5d3db1e-1290-4d33-bd1f-71f93cc36655`) instead of Ronin Agents database |
| **Rationale** | Curator was creating pages in the wrong database. The Master Knowledge Base is the canonical human workspace for curated insights, while Ronin Agents is a separate workspace. |
| **Alternatives considered** | Rename Master KB to match expected ID — rejected (would break existing integrations). Hardcode new ID in code — rejected (environment-specific). Use database name lookup — rejected (Notion API requires ID, not name). |
| **Consequences** | All environments must update `.env` files. Existing pages in Ronin Agents may need migration. CI/CD configs need audit. |
| **Owner** | Curator team |
| **References** | [BLUEPRINT.md](BLUEPRINT.md), [DATA-DICTIONARY.md](DATA-DICTIONARY.md) §Environment Variables |

---

### AD-02: Property Name Mapping via Centralized Mapper

| Field | Detail |
|-------|--------|
| **Status** | Decided |
| **Decision** | Create `notion-property-mapper.ts` as a centralized module that maps curator domain property names to Notion database property names, with explicit `exists` flags for properties that don't exist in Master KB |
| **Rationale** | Curator was using property names (Summary, Confidence, Canonical Tag) that don't exist in Master KB, causing Notion API "property does not exist" errors. A centralized mapper ensures single source of truth. |
| **Alternatives considered** | Inline mappings in each file — rejected (duplication, error-prone, hard to maintain). Rename Notion properties to match curator — rejected (Master KB has existing structure and human users). Skip Notion entirely — rejected (human workspace requirement). |
| **Consequences** | All curator-to-Notion interactions must route through mapper. New properties require mapping entry. Slightly more indirection in code. |
| **Owner** | Curator team |
| **References** | [BLUEPRINT.md](BLUEPRINT.md) §3, [SOLUTION-ARCHITECTURE.md](SOLUTION-ARCHITECTURE.md) §AD-02 |

---

### AD-03: Status to Content Type Transformation

| Field | Detail |
|-------|--------|
| **Status** | Decided |
| **Decision** | Map curator status values (Proposed, Pending Review, Approved, Rejected, Superseded) to Content Type select value "Insight" in Master KB |
| **Rationale** | Master KB uses Content Type to classify entries, but doesn't have a direct Status field. All curated insights are "Insight" type. This provides future flexibility if other content types (e.g., "Decision", "Pattern") are introduced. |
| **Alternatives considered** | Add Status field to Master KB — rejected (extra property for human users). Use Category for status — rejected (Category is for topic classification). Skip Content Type — rejected (required field). |
| **Consequences** | All promoted insights have Content Type = "Insight". Status is tracked elsewhere (Review Status field, if added). |
| **Owner** | Curator team |
| **References** | [BLUEPRINT.md](BLUEPRINT.md) §5 `STATUS_TO_CONTENT_TYPE`, [DATA-DICTIONARY.md](DATA-DICTIONARY.md) §STATUS_TO_CONTENT_TYPE |

---

## 2. Risks

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| [RK-01](#rk-01-schema-mismatch-property-errors) | Schema mismatch — property errors | High | 🔴 Open (mitigation in progress) |
| [RK-02](#rk-02-category-select-options) | Category select options mismatch | Medium | 🔴 Open |
| [RK-03](#rk-03-database-id-cache-staleness) | Database ID cache staleness | Low | 🔴 Open |
| [RK-04](#rk-04-missing-source-property) | Missing Source property | Low | ✅ Mitigated |

---

### RK-01: Schema Mismatch — Property Errors

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Likelihood** | High (in current state) |
| **Status** | 🔴 Open (mitigation in progress) |
| **Description** | Curator payloads include properties that don't exist in Master Knowledge Base: Summary, Confidence, Canonical Tag, Review Status, Source Insight ID, Promoted At, Approved At, Approved By. Notion API returns "property does not exist" errors and page creation fails. |
| **Mitigation** | Property mapper filters out properties where `exists: false`. All payload building routes through `buildMasterKBPayload()`. Review `PROPERTY_MAPPINGS` array for complete coverage. |
| **Owner** | Curator team |
| **Related decision** | [AD-02](#ad-02-property-name-mapping-via-centralized-mapper) |

---

### RK-02: Category Select Options

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Likelihood** | Medium |
| **Status** | 🔴 Open |
| **Description** | The `Category` select property in Master KB may not have options matching all canonical tags used by curator. Creating pages with unknown select values causes Notion API errors or inconsistent data. |
| **Mitigation** | Pre-populate Category select options in Notion to match display tags. Add validation in mapper to warn on unknown categories. Consider using multi_select instead of select if cardinality is high. |
| **Owner** | Curator team |
| **Related decision** | [AD-02](#ad-02-property-name-mapping-via-centralized-mapper) |

---

### RK-03: Database ID Cache Staleness

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Likelihood** | Low |
| **Status** | 🔴 Open |
| **Description** | Old database ID (`f1bb3b77...`) may be cached in environment variables, CI/CD configs, Docker images, or developer machines. Curator runs using old ID continue creating pages in wrong database (Ronin Agents). |
| **Mitigation** | Update `.env` files in all environments. Audit CI/CD pipeline configs. Document migration for existing pages in Ronin Agents database. Add startup validation that warns if using wrong database ID. |
| **Owner** | Curator team |
| **Related decision** | [AD-01](#ad-01-master-knowledge-base-database-id) |

---

### RK-04: Missing Source Property

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Likelihood** | Low |
| **Status** | ✅ Mitigated |
| **Description** | Curator expected "Source Project" but Master KB has "Source". Mapping handles this via `sourceProject` → `Source` in property mapper. |
| **Mitigation** | Property mapping includes `sourceProject` → `Source` with `exists: true`. Fallback handling in `mapInsightRow()` checks both property names. |
| **Owner** | Curator team |
| **Related decision** | [AD-02](#ad-02-property-name-mapping-via-centralized-mapper) |

---

**See also:**
- [BLUEPRINT.md](BLUEPRINT.md) — System design
- [SOLUTION-ARCHITECTURE.md](SOLUTION-ARCHITECTURE.md) — System topology
- [DATA-DICTIONARY.md](DATA-DICTIONARY.md) — Field definitions
- [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md) — Requirement traceability
- [TASKS.md](TASKS.md) — Implementation tasks
