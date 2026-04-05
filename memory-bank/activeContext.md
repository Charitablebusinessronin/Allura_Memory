# Active Context

> **Last Updated:** 2026-04-06
> **Current Sprint:** Epic 1 — Persistent Knowledge Capture
> **Course Correction:** Session Stability Infrastructure COMPLETE — 6-month operational stability

---

## Session Stability Infrastructure (2026-04-06)

**Status:** ✅ COMPLETE

**Implementation:**
13 files, 4711 lines committed (`4a85f2b`)

**Components Delivered:**
1. **Encoding Validator** — UTF-8 validation with null byte, BOM, control char detection
2. **State Hydrator** — 4-layer encoding priority (Database → Neo4j → Files → Memory Bank)
3. **Checkpoint Manager** — 5-minute automatic checkpoints with SHA-256 integrity
4. **Session Bootstrap** — Entry point combining all layers (Encoding → Hydration → Checkpoint → Budget → Drift)
5. **Planning Drift Analyzer** — Story vs AC, Story vs Epic, Subagent vs Plan drift detection
6. **Alert Manager** — FATAL/WARNING/INFO operational alerts
7. **Health API** — GET/POST endpoints for health monitoring
8. **Daily Audit Script** — Encoding, DB, State, Budget, Health, TypeScript, Git checks
9. **Weekly Audit Script** — Dependencies, Security, DB maintenance, Log rotation, Drift analysis

**Key Decisions:**
- FATAL errors halt execution (HITL governance — wait for human diagnosis)
- Checkpoints every 5 minutes with SHA-256 integrity checksums
- State recovery order: Database → Neo4j → Files → Memory Bank
- Budget enforcement before every state transition
- Three-dimensional drift detection

**Documentation:**
- `.opencode/skills/session-stability/SKILL.md` — Complete usage guide

---

## Course Correction (2026-04-05)

**Trigger:** Video analysis — "I Broke Down Anthropic's $2.5 Billion Leak. Your Agent Is Missing 12 Critical Pieces"

**Finding:** Production agents are 80% plumbing, 20% model. We're strong on foundational primitives (registry, permissions, agent types, event logging) but missing 3 critical pieces:

1. **Session Persistence** — Crash recovery via `.opencode/state/session-{id}.json`
2. **Workflow State Machine** — Explicit state transitions in PostgreSQL `workflow_states` table
3. **Token Budget Pre-Turn Checks** — Hard stops before API calls if budget exceeded

**Audit:** [agent-primitives-audit.md](../_bmad-output/planning-artifacts/agent-primitives-audit.md) — Full scorecard vs. Claude Code

**Scorecard:**
- 4/12 fully implemented (Agent Types, System Event Logging, Memory Contract, Two-Level Verification partial)
- 5/12 partial (Tool Registry, Permission Tiers, Structured Streaming, Dynamic Tool Pool, Permission Audit Trail)
- 3/12 missing (Session Persistence, Workflow State, Token Budget)

**Document Updated:** `_bmad-output/planning-artifacts/course-correction-agent-primitives.md`
**Primitives Updated:** `_bmad-output/planning-artifacts/agent-primitives.md` (7 strengthened, 3 new)

**Implementation Phases:**
- Phase 1: Session Persistence + Workflow State (Week 1)
- Phase 2: Token Budget + Streaming Events (Week 2)
- Phase 3: Two-Level Verification + Tool Pool (Week 3)
- Phase 4: Transcript Compaction (Week 4)

---

---

## Current Focus

**✅ RESOLVED (2026-04-05): ARCH-001 — groupId Enforcement**

**Solution:** Created `EnforcedMcpClient` wrapper class that validates `group_id` at construction and auto-injects it into all MCP operations.

**Implementation:**
- `src/lib/mcp/enforced-client.ts` — 250 lines, production implementation
- `src/lib/mcp/enforced-client.test.ts` — 490 lines, 32 passing tests
- `src/app/api/memory/traces/route.ts` — Added validation, removed fallback
- `src/app/api/memory/insights/route.ts` — Added validation

**Key Features:**
- Validates `group_id` using existing `validateGroupId()`
- Auto-injects validated `group_id` into all MCP calls
- Enforces `allura-*` naming convention
- NFR11 compliant (lowercase-only)
- Type-safe interfaces for common operations

**Next Steps (Ordered):**
1. **Resume Story 1.1** — Record Raw Execution Traces (NOW UNBLOCKED)
2. **Complete Phase 4** — Sync new specs to Notion
3. **Create epic-build-loop skill** — `.opencode/skills/epic-build-loop/SKILL.md`
4. **Fix BehaviorSpec files** — Remove markdown from YAML (DONE for faith-meats)

**Blocker RESOLVED:** ARCH-001 ✅

---

## Recent Accomplishments (2026-04-05 Session 2)

**Phase 0: Architecture Confidence Review** — ✅ COMPLETE
- ✅ Searched codebase for WorkflowState, BehaviorSpec, Agent Primitives, Paperclip, OpenClaw
- ✅ Identified groupIdEnforcer exists and appears correct
- ✅ Found WorkflowState NOT IMPLEMENTED (spec created)
- ✅ Found BehaviorSpec PARTIAL (1/6, created 5 more)
- ✅ Found 12 Agent Primitives NOT IMPLEMENTED (spec created)
- ✅ Found OpenClaw Gateway is STUB (exists, needs wiring)

**Phase 1: Sync Notion ↔ Local** — ✅ COMPLETE
- ✅ Created Notion page for Solution Architecture

**Phase 2: Fix sprint-status.yaml** — ✅ COMPLETE
- ✅ Epic 2: `in-progress` → `done`
- ✅ Story 1.1: `backlog` → `ready-for-dev`

**Phase 3: Create Missing Specs** — ✅ COMPLETE
- ✅ WorkflowState spec created
- ✅ 5 BehaviorSpec workspaces created
- ✅ Agent Primitives spec created
- ✅ Fixed faith-meats.yaml (pure YAML now)

**Recent Accomplishments (2026-04-05 Session 1):**
- ✅ Created 7 Agent nodes in Neo4j knowledge graph
- ✅ Synced 7 Agent records to PostgreSQL `agents` table
- ✅ Established AgentGroup with INCLUDES relationships
- ✅ Documented relationship schemas (CONTRIBUTED, LEARNED, DECIDED, COLLABORATED_WITH, SUPERSEDES)
- ✅ Added plugin architecture comparison to Notion

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

1. **Implement Session Persistence** — `.opencode/state/session-{id}.json` (P1 — course correction)
2. **Implement Workflow State Machine** — PostgreSQL `workflow_states` table (P1 — course correction)
3. **Implement Token Budget Pre-Turn Checks** — Hard stops before API calls (P1 — course correction)
4. **Create memory() TypeScript wrapper** — Simplified interface for MCP Docker tools
5. **Implement CONTRIBUTED relationship** — Track agent knowledge contributions
6. **Implement LEARNED relationship** — Track agent session learning
7. **Resume Epic 1** — Persistent knowledge capture

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

| ID | Description | Status | Notes |
|----|-------------|--------|-------|
| ~~ARCH-001~~ | `groupIdEnforcer.ts` integration | ✅ RESOLVED | Created EnforcedMcpClient wrapper |

**ARCH-001 Resolution:**
- ✅ `src/lib/mcp/enforced-client.ts` — Created wrapper class
- ✅ `src/lib/mcp/enforced-client.test.ts` — 32 passing tests
- ✅ `src/integrations/mcp.client.ts` — Added documentation
- ✅ API routes — Added group_id validation, removed fallbacks

---

## Architecture Status

| Component | Status | Notes |
|-----------|--------|-------|
| EnforcedMcpClient | ✅ COMPLETE | Wrapper for MCP operations with groupId enforcement |
| groupIdEnforcer.ts | EXISTS | Original implementation (middleware pattern) |
| WorkflowState | ❌ MISSING | Spec created, P1 priority — course correction |
| BehaviorSpec (6 workspaces) | PARTIAL | 6/6 specs created, need implementation |
| Agent Primitives (12) | UPDATED | Course correction applied — 3 new, 7 strengthened |
| OpenClaw Gateway | STUB | Exists at 362 lines, needs permissions, persistence, streaming |
| ADAS System | COMPLETE | 25 files, comprehensive coverage |
| Epic 2 Plugins | COMPLETE | All 4 stories done |
| Session Persistence | ❌ MISSING | Course correction — P1 priority |
| Token Budget Enforcement | ❌ MISSING | Course correction — pre-turn checks needed |

---

## Epic Build Loop Status

| Phase | Status |
|-------|--------|
| Phase 0: Architecture Review | ✅ COMPLETE |
| Phase 1: Sync Notion ↔ Local | ✅ COMPLETE |
| Phase 2: Fix sprint-status.yaml | ✅ COMPLETE |
| Phase 3: Create Missing Specs | ✅ COMPLETE |
| Phase 4: Sync to Notion (final) | ⏳ IN PROGRESS |
| Phase 5: Create epic-build-loop skill | ❌ NOT STARTED |