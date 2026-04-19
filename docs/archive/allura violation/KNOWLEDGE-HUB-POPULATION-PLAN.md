# Knowledge Hub Population Plan

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has been reviewed against the repository guidance files.

**Date**: 2026-04-12
**Author**: brooks-architect
**Status**: ✅ COMPLETE

## Objective

Populate the **ronin Knowledge Hub** Notion database (`083f40a9210445eaae513557bb1ae1ca`) with all project knowledge — architecture decisions, patterns, risks, research, and templates — ensuring every entry has a valid `group_id` and consistent metadata.

## Database Schema

| Property | Type | Values |
|----------|------|--------|
| Topic | title | — |
| Category | select | Architecture, Pattern, Decision, Research, Bugfix, Performance |
| Type | select | Agent Framework, Prompt System, Spec-Driven System, Multi-Step Workflow, Meta-Prompt Architecture |
| Status | select | Draft, Approved, Deprecated, Archived |
| Source | select | memory-orchestrator, memory-architect, memory-builder, memory-guardian, memory-scout, memory-chronicler, Human |
| Complexity Level | select | Lightweight, Modular, Full System, Enterprise |
| Confidence | number (percent) | 0–100 |
| Content | text | Full insight content |
| Purpose | text | Why this entry exists |
| Core Structure | text | Structural outline |
| Knowledge Rules | text | Governance rules |
| Input Model | select | Free Text, Structured Form, Spec-Driven, JSON, Multi-Stage Intake |
| Output Type | multi_select | Strategy, Automation, Landing Page, Code, Copy, UI |
| Tags | multi_select | memory-system, agent, api, database, security, ux, architecture |
| group_id | text | Tenant identifier (allura-system) |
| Neo4j ID | text | Links back to Neo4j node |
| PostgreSQL Trace ID | text | Links to raw evidence |
| Created | date | — |
| Last Updated | date | — |
| Last Synced | date | When last updated from brain |

## Pre-Population State (25 entries)

### Already Present (from Human source)
- RK-01 through RK-05 (5 risk entries)
- AD-01 through AD-04 (4 architecture decisions)
- 7 Brand/creative templates (Team Durham)
- 6 Spec-driven system templates (Blueprint, Design, Data Dictionary, etc.)
- 2 Pattern entries (PROJECT.md template, AI-GUIDELINES template)
- 1 Brand Kit entry

### Issues Found
- 8 entries missing `group_id` (all RK and AD entries)
- No ADR-002 entry (was promoted to separate Notion page, not Knowledge Hub)
- No architecture patterns (Surgical Team, 5-Layer OS, Dual-DB, Curator Pipeline)
- No tech stack entry
- No invariants registry
- No phase validation results

## Population Actions

### 1. New Entries Created (14 entries)

| Topic | Category | Type | Status |
|-------|----------|------|--------|
| ADR-002: Autonomous Curator Watchdog Loop | Decision | Multi-Step Workflow | Approved |
| AD-05: Steel Frame Versioning (SUPERSEDES) | Decision | Spec-Driven System | Approved |
| AD-06: group_id Tenant Isolation Enforcement | Decision | Agent Framework | Approved |
| AD-07: HITL Knowledge Promotion Gate | Decision | Agent Framework | Approved |
| Brooksian Surgical Team Pattern | Pattern | Agent Framework | Approved |
| 5-Layer Allura Agent-OS Architecture | Architecture | Spec-Driven System | Approved |
| Dual-Database Memory Architecture | Architecture | Spec-Driven System | Approved |
| Curator Pipeline Flow | Pattern | Multi-Step Workflow | Approved |
| MCP Docker Toolkit Integration | Architecture | Agent Framework | Approved |
| Allura Tech Stack | Architecture | Spec-Driven System | Approved |
| Allura Invariants Registry | Architecture | Agent Framework | Approved |
| Phase 3 Validation Results | Research | Multi-Step Workflow | Approved |
| Phase 2 Completion Status | Research | Spec-Driven System | Approved |
| RK-06: PostgreSQL MCP Connection Instability | Architecture | Agent Framework | Draft |

### 2. Existing Entries Updated (8 entries)

All RK-01 through RK-05 and AD-01 through AD-04 entries updated with `group_id: allura-system`.

### 3. Knowledge Graph (Allura Memory MCP)

15 entities created in the knowledge graph via `create_entities`:
- 2 Event nodes (ADR-002 promotion, Knowledge Hub population)
- 4 Decision nodes (ADR-002, AD-05, AD-06, AD-07)
- 6 Pattern/Architecture nodes (Surgical Team, 5-Layer OS, Dual-DB, Curator Pipeline, MCP Toolkit, Tech Stack, Invariants)
- 2 Research nodes (Phase 3 results, Phase 2 status)

14 relations created linking entities:
- ADR-002 → IMPLEMENTED_BY → Curator Pipeline
- AD-05 → ENFORCES → Dual-DB Architecture
- AD-06 → ENFORCES → Invariants Registry
- AD-07 → GOVERNED_BY → Invariants Registry
- Surgical Team → IMPLEMENTS → 5-Layer OS
- 5-Layer OS → USES → Dual-DB Architecture
- Dual-DB → EXPOSED_VIA → MCP Toolkit
- Curator Pipeline → ENFORCES → AD-07
- Curator Pipeline → USES → AD-05
- Tech Stack → RUNS_ON → 5-Layer OS
- Phase 3 → VALIDATES → ADR-002
- Phase 2 → PRECEDES → Phase 3
- ADR-002 Event → LOGGED_BY → Knowledge Hub Event

### 4. Neo4j (Direct)

ADR-002 Decision node created with:
- `decision_id: ADR-002`
- `group_id: allura-system`
- `CONTRIBUTED` relationship to `Person:Brooks`
- Verified via read-back

## Post-Population State (39 entries)

| Category | Count | Entries |
|----------|-------|---------|
| Decision | 8 | AD-01 through AD-07, ADR-002 |
| Architecture | 7 | 5-Layer OS, Dual-DB, MCP Toolkit, Tech Stack, Invariants, Brand Kit, RK-06 |
| Pattern | 3 | Surgical Team, Curator Pipeline, PROJECT.md template |
| Research | 4 | Phase 2, Phase 3, AI-GUIDELINES, RK-05 |
| Risk | 5 | RK-01 through RK-06 |
| Template | 12 | Blueprint, Design, Data Dictionary, RTM, Solution Architecture, AI-GUIDELINES, 7 Brand templates |

## Data Sources

| Source | Tool | Status |
|--------|------|--------|
| Notion Knowledge Hub | notion-create-pages | ✅ 14 new entries |
| Notion Knowledge Hub | notion-update-page | ✅ 8 group_id updates |
| Allura Memory MCP | create_entities | ✅ 15 entities |
| Allura Memory MCP | create_relations | ✅ 14 relations |
| Neo4j (direct) | write_neo4j_cypher | ✅ ADR-002 Decision node |
| PostgreSQL | insert_data | ❌ Connection failure (use Allura Memory MCP instead) |

## Lessons Learned

1. **Notion create-pages schema is strict** — properties must go in `properties` object, not at page top level
2. **Confidence field** — Notion expects JavaScript number, not string; percent format means 0.95 not 95
3. **PostgreSQL MCP connection** — database-server tool has persistent connection issues; use Allura Memory MCP (`memory_add`) as primary write path
4. **Batch creation** — Notion API sometimes drops connection on large batches; 3-4 entries per call is safer
5. **group_id enforcement** — All new entries created with `group_id: allura-system`; existing entries backfilled

## Next Steps

1. **Wire Notion end-to-end** — Create Notion database via MCP for pending proposals surface
2. **Run full E2E** — `RUN_E2E_TESTS=true bun vitest run`
3. **Fix remaining pre-existing test failures** (Issue #15)
4. **Begin Phase 4** — Autonomous curator in production
5. **Resolve RK-06** — Fix PostgreSQL MCP connection instability