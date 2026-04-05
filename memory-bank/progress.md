# Progress

> **Last Updated:** 2026-04-05
> **Epic:** Epic 1 — Persistent Knowledge Capture and Tenant-Aware Memory

---

## Sprint Status

**Epic 1: Persistent Knowledge Capture and Tenant-Aware Memory**

| Story | Status | Notes |
|-------|--------|-------|
| 1.1 Record Raw Execution Traces | `completed` | ✅ ARCH-001 integration + RK-01 enforcement |
| 1.2 Implement NOTION_SYNC Workflow | `completed` | ✅ Trace sync to Notion + HITL promotion |
| 1.3 Create Agent Knowledge Nodes | `completed` | ✅ |
| 1.4 Implement Relationship Schemas | `completed` | ✅ |
| 1.5 Implement CONTRIBUTED Relationship | `backlog` | Similar to Story 1.6 |
| 1.6 Implement LEARNED Relationship | `completed` | ✅ Agent session learning |
| 1.7 Create memory() TypeScript Wrapper | `backlog` | Simplifies MCP Docker calls |

---

## Milestones

### 2026-04-05 — Story 1.1: Record Raw Execution Traces (ARCH-001 Integration)

**Completed:**
- ✅ Updated `src/lib/postgres/trace-logger.ts` to import `validateTenantGroupId`
- ✅ Added RK-01 error code to `TraceValidationError` class
- ✅ Updated `logTrace()` to enforce `allura-{org}` naming convention
- ✅ Updated `getTracesByAgent()` with RK-01 tenant isolation
- ✅ Updated `getTracesByType()` with RK-01 tenant isolation
- ✅ Updated `getTraceById()` with RK-01 tenant isolation
- ✅ Updated `countTraces()` with RK-01 tenant isolation
- ✅ Created comprehensive test suite with RK-01 error code tests
- ✅ All functions enforce cross-tenant query protection (returns empty)
- ✅ All functions validate `group_id` before any database operation

**Key Changes:**
- Import: `validateTenantGroupId`, `TENANT_ERROR_CODE` from `../validation/tenant-group-id`
- Import: `GroupIdValidationError` from `../validation/group-id`
- Error class: `TraceValidationError` now has `code: string = TENANT_ERROR_CODE`
- All public functions validate `group_id` using `validateTenantGroupId()`
- All SQL queries use `WHERE group_id = $1` for tenant isolation

**Tests Added:**
- `RK-01: Tenant Isolation Validation` describe block
- Tests for rejecting invalid formats (roninmemory, roninclaw-*, uppercase)
- Tests for valid `allura-{org}` format acceptance
- Tests for cross-tenant query protection (returns empty)
- Tests for RK-01 error code presence in error messages

---

### 2026-04-05 — Story 1.2: Implement NOTION_SYNC Workflow

**Completed:**
- ✅ Created `src/lib/postgres/schema/notion_sync_log.sql` — PostgreSQL schema for sync tracking
- ✅ Implemented `src/lib/notion/sync-workflow.ts` — Complete sync workflow module
- ✅ Implemented `syncTraceToNotion()` — Sync trace to Notion Knowledge Hub
- ✅ Implemented `getSyncStatus()` — Query sync status with tenant isolation
- ✅ Implemented `markAsReviewed()` — Mark trace as reviewed for promotion
- ✅ Implemented `promoteFromNotion()` — HITL promotion to Neo4j
- ✅ Implemented `getSyncStatusCounts()` — Dashboard status counts
- ✅ Implemented `rejectSync()` — Reject unsuitable traces
- ✅ Created comprehensive test suite with RK-01 enforcement tests
- ✅ Updated `src/lib/notion/index.ts` with new exports
- ✅ All functions enforce `group_id` validation (RK-01)
- ✅ All functions use `validateTenantGroupId` from ARCH-001

**Key Features:**
- PostgreSQL `notion_sync_log` table with status tracking
- Status workflow: `draft` → `reviewed` → `promoted` (or `rejected`)
- Tenant isolation enforced via RK-01 error code
- Notion API integration using existing `NotionClient`
- Event logging for promotion and rejection actions

**Acceptance Criteria Met:**
- [x] Traces sync to Notion database
- [x] Human review queue in Notion
- [x] Approval workflow triggers promotion
- [x] Sync status tracked in PostgreSQL
- [x] Group ID enforcement (RK-01) in all functions
- [x] Comprehensive test coverage for validation scenarios

**Files Created:**
- `src/lib/postgres/schema/notion_sync_log.sql` — Database schema
- `src/lib/notion/sync-workflow.ts` — Workflow implementation
- `src/lib/notion/sync-workflow.test.ts` — Test suite

---

### 2026-04-05 — Epics Documentation and Bun Security

**Completed:**
- ✅ Created comprehensive `_bmad-output/planning-artifacts/epics.md` with all stories
- ✅ Documented ARCH-001 critical blocker
- ✅ Updated all MCP configs to use `bunx` instead of `npx`
- ✅ Updated all plugin specs for Bun-only strategy
- ✅ Added security notes to AGENTS.md, techContext.md, copilot-instructions.md
- ✅ Updated Notion with Bun security note

**Security Improvement:**
- Replaced `npx -y` with `bunx` for all MCP servers
- Added security warnings about npm supply chain risks
- Documented Bun-only package strategy

**Completed:**
- ✅ 7 Agent nodes created in Neo4j knowledge graph
- ✅ 7 Agent records synced to PostgreSQL `agents` table
- ✅ AgentGroup "Allura Agent Team" created with INCLUDES relationships
- ✅ KNOWS relationships established (MemoryOrchestrator knows all)
- ✅ Session logged to PostgreSQL (Event ID: 27146)
- ✅ Session insight created in Neo4j
- ✅ Relationship schemas documented in Notion (CONTRIBUTED, LEARNED, DECIDED, COLLABORATED_WITH, SUPERSEDES)
- ✅ Plugin Architecture comparison table added to Notion (Claude Code, OpenCode, OpenClaw)

**Knowledge Graph Entities:**
- MemoryOrchestrator, MemoryArchitect, MemoryBuilder, MemoryGuardian, MemoryScout, MemoryAnalyst, MemoryChronicler
- Allura Agent Team (AgentGroup)
- Session 2026-04-04 Memory System Wiring
- Agent Memory Architecture Complete (Insight)

**In Progress:**
- ⏳ memory() TypeScript wrapper for MCP Docker tools
- ⏳ CONTRIBUTED/LEARNED/DECIDED relationship creation in actual sessions
- ⏳ Complete Claude Code plugin (6 more agents)
- ⏳ Create OpenClaw plugin

---

### 2026-04-05 — Epics Documentation and Plugin Specs

**Completed:**
- ✅ Created `_bmad-output/planning-artifacts/epics.md` — Comprehensive epic and story definitions
- ✅ Documented all 6 epics with stories and acceptance criteria
- ✅ Updated `_bmad-output/planning-artifacts/source-of-truth.md` — Added epics.md to canon
- ✅ Updated all plugin specs for Bun-only strategy
- ✅ Replaced all `npx -y` with `bunx` in MCP configs
- ✅ Added security notes to AGENTS.md, techContext.md, copilot-instructions.md
- ✅ Updated Notion with Bun security note and plugin architecture

**Files Updated:**
- `_bmad-output/planning-artifacts/epics.md` — New comprehensive epics document
- `_bmad-output/planning-artifacts/opencode-plugin-spec.md` — Bun security note
- `_bmad-output/planning-artifacts/claude-code-plugin-spec.md` — Bun installation
- `_bmad-output/planning-artifacts/openclaw-plugin-spec.md` — Bun security note
- `_bmad-output/planning-artifacts/source-of-truth.md` — Added epics.md to canon
- `claude-plugin-allura/.mcp.json` — Bunx for all MCP servers
- `memory-bank/progress.md` — This update
- `memory-bank/techContext.md` — Bun security note
- `AGENTS.md` — Bun security note
- `.github/copilot-instructions.md` — Bun security rule
- Notion Allura Memory Control Center — Updated plugin architecture

---

### 2026-04-04 — OpenCode Configuration Fix

**Completed:**
- ✅ Created 4 missing agent prompt files: `coder.md`, `reviewer.md`, `contextscout.md`, `documentation.md`
- ✅ Fixed invalid color `muted` → `secondary` for `memory-scout` agent
- ✅ Created error pattern doc: `_bmad-output/planning-artifacts/error-patterns/opencode-config-errors.md`
- ✅ Logged to PostgreSQL (Event ID: 27144)
- ✅ Updated `activeContext.md`

**Valid OpenCode theme colors:** `primary`, `secondary`, `accent`, `success`, `warning`, `error`, `info`, or hex `#RRGGBB`

---

### 2026-04-04 — Documentation Canon Established

**Completed:**
- ✅ Created `_bmad-output/planning-artifacts/source-of-truth.md` — Document hierarchy
- ✅ Fixed tenant naming in `_bmad-output/planning-artifacts/tenant-memory-boundary-spec.md`
- ✅ Added supersession headers to `_bmad-output/planning-artifacts/*.md`
- ✅ Created `memory-bank/activeContext.md`
- ✅ Created `memory-bank/systemPatterns.md`
- ✅ Created `memory-bank/progress.md`
- ✅ Created `memory-bank/techContext.md`
- ✅ Created `memory-bank/productContext.md`
- ✅ Created `memory-bank/projectbrief.md`
- ✅ Deleted unused `bmad-output/` directory
- ✅ Reconciled BMad workflow architecture
- ✅ Verified `.opencode/agent/` and `_bmad/` clean (no naming drift)

**Documentation Architecture:**
- `_bmad-output/planning-artifacts/` → Human canon (you control)
- `_bmad-output/planning-artifacts/` → BMad generated (marked superseded)
- `_bmad-output/implementation-artifacts/` → Sprint stories
- `_bmad/` → Skill/workflow definitions
- `.opencode/context/` → Agent instructions

**Critical Blocker:** ARCH-001 `groupIdEnforcer.ts` fix required.

---

## Blockers

| ID | Description | Story | Status |
|----|-------------|-------|--------|
| ARCH-001 | `groupIdEnforcer.ts` broken | 1.1 | ✅ Fixed — Story 1.1 complete |
| RK-01 | Group ID enforcement not working | 1.1 | ✅ Fixed — Integrated with `validateTenantGroupId` |

---

## Next Actions

1. **Story 1.2** — Implement NOTION_SYNC workflow for human review queue
2. **Story 1.5** — Implement CONTRIBUTED relationship for agent knowledge tracking
3. **Story 1.7** — Create memory() TypeScript wrapper for MCP Docker tools

---

## Decisions Made

### 2026-04-04 — Tenant Naming Convention

**Decision:** Standardize on `allura-*` namespace for all tenant IDs.

**Rationale:**
- Notion uses `allura-*` naming
- Aligns with platform vision (Allura Agent-OS)
- Legacy `roninclaw-*` is deprecated

**Impact:**
- All new docs use `allura-*`
- All code must enforce `allura-*` pattern
- Legacy references are drift to be flagged

---

### 2026-04-04 — Documentation Canon Lock

**Decision:** `_bmad-output/planning-artifacts/` is the single source of truth for all human-curated documentation.

**Hierarchy:**
1. Notion Allura Memory Control Center — Product vision
2. `_bmad-output/planning-artifacts/*` — Implementation canon
3. `_bmad-output/planning-artifacts/*` — BMad outputs (superseded)
4. `_bmad-output/implementation-artifacts/*` — Sprint stories
5. `memory-bank/*` — Session context

**Impact:**
- BMad workflows read from `_bmad-output/planning-artifacts/*`
- When conflict, `_bmad-output/planning-artifacts/` wins
- Generated docs marked as superseded