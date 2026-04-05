# Active Context

> **Last Updated:** 2026-04-05
> **Current Sprint:** Epic 1 — Persistent Knowledge Capture

---

## Current Focus

**Story 1.1 Completed:** ARCH-001 integration complete — `trace-logger.ts` now enforces tenant isolation.

**Recent Accomplishments (2026-04-05):**
- ✅ Story 1.1: Record Raw Execution Traces — ARCH-001 integration complete
- ✅ Updated `src/lib/postgres/trace-logger.ts` with `validateTenantGroupId` from ARCH-001
- ✅ Added RK-01 error code to all validation errors
- ✅ All public functions enforce `allura-{org}` naming convention
- ✅ Cross-tenant queries return empty results (tenant isolation)
- ✅ Comprehensive test suite with RK-01 enforcement tests
- ✅ Story 1.6: Implement LEARNED relationship for agent session learning
- ✅ Created 7 Agent nodes in Neo4j knowledge graph
- ✅ Synced 7 Agent records to PostgreSQL `agents` table
- ✅ Established AgentGroup with INCLUDES relationships
- ✅ Documented relationship schemas (CONTRIBUTED, LEARNED, DECIDED, COLLABORATED_WITH, SUPERSEDES)

**Recent Accomplishments (2026-04-04):**
- ✅ Established documentation canon (`_bmad-output/planning-artifacts/source-of-truth.md`)
- ✅ Fixed tenant naming (`roninclaw-*` → `allura-*`)
- ✅ Marked superseded docs in `_bmad-output/planning-artifacts/`
- ✅ Deleted unused `bmad-output/` directory
- ✅ Reconciled BMad workflow architecture
- ✅ Created `memory-bank/` with 6 context files
- ✅ Created `roninmemory-context` skill for session initialization
- ✅ Fixed OpenCode boot errors (missing prompt files + invalid color)
- ✅ Logged to memory and Notion

---

## Session Context

### What We're Building

**Allura Agent-OS** — A unified multi-agent enterprise platform that:
1. Separates noise from signal (PostgreSQL + Neo4j)
2. Enables audit reconstruction (6-12 month decision trails)
3. Implements HITL governance (human approval for promotions)
4. Provides dual-context queries (project + global)

### Governance Rule

> **Allura governs. Runtimes execute. Curators promote.**

---

## First Production Workflow

**Bank-auditor (`allura-audits`)** — Mortgage audit automation

**Workspaces (Prio Order):**
1. 🥩 `allura-faith-meats` — Payload CMS + Next.js + HACCP
2. 🎨 `allura-creative` — Content + branding agents
3. 👤 `allura-personal` — Daily ops, scheduling
4. 🏛️ `allura-nonprofit` — 501(c)(3) grants
5. 🏦 `allura-audits` — GLBA data, most restricted
6. 🌡️ `allura-haccp` — Food safety monitoring

---

## Documentation Architecture

| Location | Purpose | Control |
|----------|---------|---------|
| `_bmad-output/planning-artifacts/` | Human canon | You |
| `_bmad-output/planning-artifacts/` | BMad outputs | BMad |
| `_bmad-output/implementation-artifacts/` | Sprint stories | BMad |
| `_bmad/` | Workflow definitions | BMad framework |
| `.opencode/context/` | Agent instructions | You |

**Source of Truth:** `_bmad-output/planning-artifacts/source-of-truth.md`

---

## Architecture: 5-Layer Model

| Layer | Component | Runs On |
|-------|-----------|---------|
| L1 | RuVix Kernel | Docker |
| L2 | PostgreSQL 16 + Neo4j 5.26 | Docker |
| L3 | Agent Runtime (OpenCode) | Docker |
| L4 | Workflow / DAGs / A2A Bus | Docker |
| L5 | Paperclip + OpenClaw | Docker/Ubuntu |

---

## Agent Taxonomy

### OpenCode CLI Agents (Winston's Hands)

| Agent | Role |
|-------|------|
| `MemoryOrchestrator` | BMad workflow coordination |
| `MemoryArchitect` | System design lead |
| `MemoryBuilder` | Infrastructure implementation |
| `MemoryAnalyst` | Memory system metrics |
| `MemoryCopywriter` | Agent prompt writing |
| `MemoryRepoManager` | Git operations |
| `MemoryScribe` | Documentation/specs |

### BMad Personas

- Winston (Architect) → `MemoryArchitect`
- Amelia (Builder) → `MemoryBuilder`
- Quinn (QA) → `MemoryTester`
- Paige (Writer) → `MemoryScribe`

---

## Next Steps

1. **Fix ARCH-001** — `groupIdEnforcer.ts` critical blocker
2. **Create memory() TypeScript wrapper** — Simplified interface for MCP Docker tools (Story 1.7)
3. **Implement CONTRIBUTED relationship** — Track agent knowledge contributions (Story 1.5)
4. **Resume Epic 1** — Persistent knowledge capture

---

## Recent Implementation (2026-04-04)

### PostgreSQL → Notion Trace Infrastructure

**Files Created:**
- `src/lib/postgres/trace-logger.ts` — Structured trace logging with agent attribution
- `src/lib/notion/trace-sync.ts` — Notion Knowledge Hub sync infrastructure
- `src/lib/postgres/trace-logger.test.ts` — Test suite for trace logger

**Key Functions:**
- `logTrace()` — Log append-only traces with confidence scoring
- `getTracesByAgent()` — Query traces by agent (with group_id enforcement)
- `getTracesByType()` — Filter traces by type (contribution, decision, learning, error)
- `syncTraceToNotion()` — Sync traces to Knowledge Hub (Source mapping, confidence display)
- `buildNotionTraceProperties()` — Build Notion page properties from trace data

**Architecture:**
- Uses existing `insertEvent()` from `queries/insert-trace.ts`
- Enforces `group_id` (allura-* naming convention)
- Maps agent_id to Notion "Source" field
- Stores PostgreSQL Trace ID for audit linking
- All synced traces start as "Draft" (requires human review)

---

## Blockers

| ID | Description | Status |
|----|-------------|--------|
| ARCH-001 | `groupIdEnforcer.ts` broken | Ready for dev |