# Progress

> **Last Updated:** 2026-04-06
> **Epic:** Epic 1 — Persistent Knowledge Capture and Tenant-Aware Memory

---

## Sprint Status

**Epic 1: Persistent Knowledge Capture and Tenant-Aware Memory**

| Story | Status | Notes |
| |-------|--------|
| 1.1 Record Raw Execution Traces | `done` | ✅ TraceMiddleware implemented - 42 tests pass |
| 1.2 TraceMiddleware Integration | `in-progress` | ✅ Architecture design complete, implementation pending |
| 1.3-1.7 | `backlog` | Ready to start after 1.2 |

**Epic 2: Plugin Foundation** — ✅ **COMPLETE**

| Story | Status |
|-------|--------|
| 2.1 OpenCode Plugin | `done` |
| 2.2 Claude Code Plugin | `done` |
| 2.3 OpenClaw Plugin | `done` |
| 2.4 Bun-Only Strategy | `done` |

---

## Milestones

### 2026-04-06 — Session Persistence Infrastructure Complete (Course Correction P1)

**Deliverables:**
- ✅ `src/lib/session/persistence.ts` — Core persistence logic (716 lines)
- ✅ `src/lib/session/persistence.test.ts` — 48 tests (minimum 15 required)
- ✅ `src/lib/session/checkpoint.ts` — Checkpoint management (574 lines)
- ✅ `.opencode/state/.gitkeep` — Directory structure ensured

**Features Implemented:**
- **Session ID Generation**: UUID-based with crypto.randomUUID()
- **State Persistence**: Async, non-blocking saves with queue management
- **State Loading**: File-based with schema validation (Zod)
- **Crash Recovery**: Recover from last checkpoint for agent/group
- **Token Usage Tracking**: Accumulates input/output/turns across updates
- **Permission Management**: Grant/revoke/check with persistence
- **Concurrent Isolation**: Separate sessions don't interfere
- **Integrity Verification**: SHA-256 checksums on state files

**Test Coverage:**
- ✅ Session creation with validation
- ✅ State loading from file
- ✅ Crash recovery (simulated)
- ✅ Token usage accumulation
- ✅ Permission persistence
- ✅ Concurrent session isolation
- ✅ State validation (Zod schema)

**Commit:** Session persistence infrastructure (Course Correction P1)

---

### 2026-04-05 — TraceMiddleware Implementation Complete

**Story 1.1 Complete: Record Raw Execution Traces**

**Completed:**
- ✅ Implemented `TraceMiddleware` class in `src/lib/mcp/trace-middleware.ts`
- ✅ All 42 tests passing
- ✅ Dual-mode logging: immediate (default) or buffered with timer (when `flushIntervalMs` specified)
- ✅ Payload truncation at 10KB with `input_truncated`/`output_truncated` flags
- ✅ Error handling: logs error trace then re-throws original error
- ✅ Group ID validation via `validateGroupId()`
- ✅ Circular reference graceful handling
- ✅ Session lifecycle: `startSession()`/`endSession()`
- ✅ Decision and learning logging: `logDecision()`/`logLearning()`

**Key Components:**
- **TraceMiddleware** (`src/lib/mcp/trace-middleware.ts`) — MCP tool call wrapper with buffering
- **TraceMiddlewareConfig** — Configuration interface
- **Dual-mode**: immediate logging (default) vs buffered timer-based flushing

**Files Created:**
- `src/lib/mcp/trace-middleware.ts` — Trace middleware implementation (450+ lines)
- `src/lib/mcp/trace-middleware.test.ts` — 42 tests (all passing)

**Knowledge Graph:**
- Neo4j Insight: "TraceMiddleware Implementation Complete" created
- Session node created in Neo4j

**PostgreSQL Logging Note:**
- MCP Docker `execute_unsafe_sql` has sqlite fallback issue
- Event logging to be done via app's `logTrace()` function
- Event ID pending manual log

---

### 2026-04-06 — Session Stability Infrastructure

**Completed:**
- ✅ Implemented Encoding Validator with UTF-8, null byte, BOM, control char detection
- ✅ Implemented State Hydrator with 4-layer encoding priority (Database → Neo4j → Files → Memory Bank)
- ✅ Implemented Checkpoint Manager with 5-minute automatic checkpoints and SHA-256 integrity
- ✅ Implemented Session Bootstrap combining all layers (Encoding → Hydration → Checkpoint → Budget → Drift)
- ✅ Implemented Planning Drift Analyzer (Story vs AC, Story vs Epic, Subagent vs Plan)
- ✅ Implemented Alert Manager with FATAL/WARNING/INFO severity handling
- ✅ Implemented Health API endpoints for monitoring
- ✅ Created Daily Audit Script (encoding, DB, state, budget, health checks)
- ✅ Created Weekly Audit Script (dependencies, security, DB maintenance, log rotation, drift)
- ✅ Created Session Stability Skill documentation

**Key Components:**
- **Encoding Validator** (`encoding-validator.ts`) — UTF-8 validation with corruption detection
- **State Hydrator** (`state-hydrator.ts`) — 4-layer recovery with fallback chain
- **Checkpoint Manager** (`checkpoint-manager.ts`) — Auto checkpoints with integrity checksums
- **Session Bootstrap** (`session-bootstrap.ts`) — Entry point combining all layers
- **Drift Analyzer** (`planning-drift-analyzer.ts`) — Story/AC, Epic, Subagent drift detection
- **Alert Manager** (`alert-manager.ts`) — FATAL/WARNING/INFO operational alerts
- **Health API** (`route.ts`) — GET/POST endpoints for health monitoring

**Key Decisions:**
- FATAL errors halt execution and wait for human diagnosis (HITL governance)
- Automatic checkpoints every 5 minutes with SHA-256 integrity
- State hydrates from Database → Neo4j → Files → Memory Bank (priority order)
- Budget enforced before every state transition
- Drift detection across 3 dimensions (Story vs AC, Story vs Epic, Subagent vs Plan)

**Files Created:**
- `src/lib/validation/encoding-validator.ts` — UTF-8 validation with corruption detection
- `src/lib/validation/encoding-validator.test.ts` — Tests for encoding validator
- `src/lib/validation/planning-drift-analyzer.ts` — Drift detection across planning artifacts
- `src/lib/session/checkpoint-manager.ts` — Checkpoint management with integrity
- `src/lib/session/checkpoint-manager.test.ts` — Tests for checkpoint manager
- `src/lib/session/state-hydrator.ts` — 4-layer state hydration
- `src/lib/session/state-hydrator.test.ts` — Tests for state hydrator
- `src/lib/session/session-bootstrap.ts` — Entry point combining all layers
- `src/lib/monitoring/alert-manager.ts` — FATAL/WARNING/INFO alert handling
- `src/app/api/health/route.ts` — Health check API endpoints
- `scripts/audit/daily-audit.sh` — Daily health checks script
- `scripts/audit/weekly-audit.sh` — Weekly maintenance script
- `.opencode/skills/session-stability/SKILL.md` — Session stability skill documentation

**Commit:** `4a85f2b` — feat(session-stability): implement 6-month operational stability infrastructure

---

### 2026-04-06 — RuVix Kernel Initiative (Party Mode Session)

**Status:** 🚀 IN PROGRESS — Phase 1A: Kernel Core

**Completed:**
- ✅ Party mode team discussion convened (MemoryOrchestrator, MemoryArchitect, MemoryBuilder, MemoryGuardian, MemoryInfrastructure)
- ✅ 4-phase implementation plan approved
- ✅ Sprint status updated (arch-002-build-ruvix-kernel: in-progress)
- ✅ Key design decisions documented:
  - `mutate` primitive identified as linchpin
  - Microkernel pattern: trusted core separate from orchestration
  - SDK wrapper for backward compatibility
  - HMAC + claims for proof structure

**Architecture Decision:**
- **Problem:** RuVix Kernel is documented but NOT implemented. Enforcement scattered across L2/L3.
- **Solution:** 4-phase kernel build consolidating all policy enforcement into L1
- **Phases:**
  - Phase 1A: Kernel Core (primitives + proof engine) — STARTING
  - Phase 1B: Enforcement Gate (SDK wrapper + block direct access)
  - Phase 2: Migration (move existing enforcers INTO kernel)
  - Phase 3: Validation (prove nothing bypasses kernel)

**Completed (Phase 1A - Kernel Core):**
- ✅ Created `src/kernel/proof.ts` — Proof-of-intent engine (HMAC-SHA256, 280 lines)
- ✅ Created `src/kernel/policy.ts` — Policy validation engine (5 policies, 280 lines)
- ✅ Created `src/kernel/syscalls.ts` — 12 syscalls with `mutate` as linchpin (450 lines)
- ✅ Created `src/kernel/ruvix.ts` — Kernel orchestrator exporting 6 primitives (300 lines)
- ✅ Created `src/kernel/proof.test.ts` — 25 tests for proof engine (ALL PASSING)
- ✅ Kernel version: 1.0.0-alpha (ruvix-l1-core)

**Key Features Implemented:**
- Proof-of-intent with HMAC-SHA256 signatures
- 5-minute proof validity window with 30-second clock skew tolerance
- group_id validation (allura-* convention enforced)
- 5 builtin policies: tenant isolation, budget, permission tier, actor validation, audit trail
- 12 syscalls: mutate, query, spawn, kill, trace, budget, policy, attest, verify, isolate, sandbox, audit
- 6 primitives exported: mutate, attest, verify, isolate, sandbox, audit

**Files Created:**
- `src/kernel/proof.ts` — 280 lines, trusted core
- `src/kernel/policy.ts` — 280 lines, trusted core
- `src/kernel/syscalls.ts` — 450 lines, syscall implementations
- `src/kernel/ruvix.ts` — 300 lines, kernel orchestrator
- `src/kernel/proof.test.ts` — 350 lines, 25 passing tests

**Test Results:**
```
✓ src/kernel/proof.test.ts (25 tests) 11ms
Test Files  1 passed (1)
     Tests  25 passed (25)
```

**Phase 1B: Enforcement Gate** — ✅ **COMPLETE**

**Files Created:**
- `src/kernel/sdk.ts` — Backward-compatible SDK wrapper (430 lines)
- `src/kernel/gate.ts` — Enforcement gate with MCP interception (385 lines)

**Key Features:**
- SDK exports same interface as old EnforcedMcpClient
- Enables gradual migration (old imports → new kernel-backed imports)
- Enforcement gate blocks direct database access
- Monkey-patches MCP_DOCKER tools to validate kernel proof
- Violation tracking and logging

**Migration Path:**
```typescript
// Old code:
import { executeQuery } from '@/lib/mcp/enforced-client';

// New code (kernel-backed):
import { executeQuery } from '@/kernel/sdk';
// OR direct kernel access:
import { syscall } from '@/kernel/ruvix';
```

**Commit:** `25a411d` — feat(ruvix-kernel): implement L1 kernel with proof-gated mutation (Phase 1A + 1B)

**Total Deliverable:** 2,125 lines (1,660 production + 465 tests) across 7 kernel files

---

**Phase 2: Migration** — ✅ **COMPLETE**

**Files Migrated:**
- `src/kernel/policy/tenant.ts` — Tenant isolation (migrated from enforced-client.ts, 260 lines)
- `src/kernel/policy/budget.ts` — Budget enforcement (migrated from enforcer.ts, 280 lines)
- `src/kernel/audit/trace.ts` — Audit tracing (migrated from trace-middleware.ts, 390 lines)

**Migration Summary:**
| Old Location | New Location | Status |
|--------------|--------------|--------|
| `src/lib/mcp/enforced-client.ts` | `src/kernel/policy/tenant.ts` | ✅ Migrated |
| `src/lib/budget/enforcer.ts` | `src/kernel/policy/budget.ts` | ✅ Migrated |
| `src/lib/mcp/trace-middleware.ts` | `src/kernel/audit/trace.ts` | ✅ Migrated |

**Key Features:**
- Kernel-native tenant isolation with `allura-*` enforcement
- Budget policy engine with warning/breach thresholds
- Audit trace logger with buffering support
- Backward compatibility wrappers for gradual migration

**Deprecated (but still functional):**
- `src/lib/mcp/enforced-client.ts` — Use `KernelTenantEnforcer` instead
- `src/lib/budget/enforcer.ts` — Use `BudgetPolicyEngine` instead
- `src/lib/mcp/trace-middleware.ts` — Use `KernelTraceLogger` instead

**Total Kernel Lines:** 3,055 lines (2,125 Phase 1 + 930 Phase 2)

---

**Next:** Phase 3 — Validation (prove nothing bypasses kernel)

---

### 2026-04-06 — Trace Middleware (Party Mode Session)

**Completed:**
- ✅ Designed trace middleware wiring contract (MemoryArchitect)
- ✅ Wrote 42 TDD tests covering all categories (MemoryTester)
- ✅ Implemented TraceMiddleware class (MemoryBuilder)
- ✅ Code review with 4 high, 4 medium, 4 low findings (MemoryGuardian)
- ✅ All 4 high-priority issues fixed, 42/42 tests passing

**Key Components:**
- **TraceMiddleware** — Wraps MCP tool calls, logs to PostgreSQL
- **Buffered mode** — Configurable flush interval (5s default when specified)
- **Immediate mode** — Default (no flushIntervalMs = log immediately)
- **Error traces** — Always logged immediately, never buffered
- **Truncation** — 10KB max payload, 5K per-string limit
- **Group ID enforcement** — Validated before every trace

**Files Created:**
- `src/lib/mcp/trace-middleware.ts` — 348 lines, production implementation
- `src/lib/mcp/trace-middleware.test.ts` — 994 lines, 42 passing tests

**Code Review Fixes:**
- H1: Partial flush no longer double-logs (tracks failed index)
- H2: Error path no longer swallows original exception
- H3: 0ms timer busy loop prevented (guard on flushIntervalMs > 0)
- H4: logLearning confidence clamped to 0.0-1.0
- M3: Server-side guard added

**Commit:** `7ae2ff7` — feat(trace-middleware): add MCP tool call tracing with buffering

**Next Session:** Wire middleware into agent execution paths

---

### 2026-04-05 — Agent Primitives Audit

**Completed:**
- ✅ Created comprehensive audit comparing Allura vs. Claude Code's 12 primitives
- ✅ Identified 4 fully implemented, 5 partial, 3 missing
- ✅ Mapped priority order: P1 (Session Persistence, Workflow State, Token Budget)
- ✅ Created implementation plan with Brooksian approach (boring plumbing first)
- ✅ Updated course correction document with audit link
- ✅ Updated agent primitives spec with audit link

**Key Findings:**
- 🔍 **4/12 fully implemented:** Agent Types, System Event Logging, Memory Contract, Two-Level Verification (partial)
- 🔍 **5/12 partial:** Tool Registry, Permission Tiers, Structured Streaming, Dynamic Tool Pool, Permission Audit Trail
- 🔍 **3/12 missing:** Session Persistence, Workflow State, Token Budget (all P1)

**Files Created:**
- `_bmad-output/planning-artifacts/agent-primitives-audit.md` — Full scorecard vs. Claude Code

**Files Updated:**
- `_bmad-output/planning-artifacts/course-correction-agent-primitives.md` — Added audit link
- `_bmad-output/planning-artifacts/agent-primitives.md` — Added audit link
- `memory-bank/activeContext.md` — Updated course correction section

---

### 2026-04-05 — Brooks Persona Enhancement & Agent Primitives Audit

**Completed:**
- ✅ Created 4 Brooks persona memory files (quotes, anecdotes, modern opinions, usage guide)
- ✅ Completed comprehensive agent primitives audit (4/12 complete, 5/12 partial, 3/12 missing)
- ✅ Fixed 3 OpenCode configuration bugs (JSON syntax, file paths, memory_bootstrap)
- ✅ Synchronized all planning documents with current status
- ✅ Created Notion session summary
- ✅ Created memory session file

**Key Findings:**
- 🔍 **Token Budget is not missing — it's unwired.** `BudgetEnforcer` exists in `src/lib/budget/`, just needs MCP middleware wiring (~50 lines)
- 🔍 **Workflow State spec uses UPDATE semantics** — violates append-only invariant. Need append-only transition events instead.
- 🔍 **Session Persistence is the keystone** — nearly everything else depends on it

**Brooksian Remediation Plan:**
- P0: Session Persistence (keystone)
- P0: Token Budget — WIRE ONLY (not missing)
- P1: Workflow State Machine (append-only events)
- P1: Streaming Events (9-type discriminated union)
- P2: Tool Registry, Permission Tiers, Permission Audit Trail
- P3: Transcript Compaction (defer)

**Files Created:**
- `memory-bank/brooks-quotes.md` — His actual quotes with context
- `memory-bank/brooks-anecdotes.md` — Stories from IBM days
- `memory-bank/brooks-modern-opinions.md` — Modern practice opinions
- `memory-bank/brooks-persona.md` — Usage guide
- `/memories/session/2026-04-05-brooks-persona-enhancement.md` — Session summary
- Notion: Session 2026-04-05 — Brooks Persona Enhancement & Agent Primitives Audit

**Files Modified:**
- `.opencode/config/agent-metadata.json` — Fixed JSON syntax error
- `.opencode/agent/menu.yaml` — Fixed primary agent paths
- `.opencode/agent/subagents/core/contextscout.md` — Added memory_bootstrap, group_id
- `.opencode/agent/subagents/code/reviewer.md` — Added memory_bootstrap, group_id
- `.opencode/agent/subagents/code/test-engineer.md` — Added memory_bootstrap, group_id
- `_bmad-output/planning-artifacts/requirements-matrix.md` — Added Section 4
- `docs/project-planning/PRD-BRIEF.md` — Updated status, risks, metrics
- `_bmad-output/planning-artifacts/agent-primitives-audit.md` — Created
- `_bmad-output/planning-artifacts/course-correction-agent-primitives.md` — Added audit link
- `_bmad-output/planning-artifacts/agent-primitives.md` — Added audit link
- `memory-bank/activeContext.md` — Updated course correction section
- `memory-bank/progress.md` — Added this milestone

---

### 2026-04-05 — ARCH-001 Complete: Multi-Layer groupId Enforcement

**Problem Identified:**
- `groupIdEnforcer.ts` existed (131 lines) but was **NOT WIRED** into the system
- MCP_DOCKER tools are external - cannot wrap them directly
- Solution: Multi-layer enforcement approach

**Implementation:**
- ✅ Created `EnforcedMcpClient` wrapper (`src/lib/mcp/enforced-client.ts`)
  - Validates `group_id` at construction time
  - Enforces `allura-*` naming convention
  - Injects validated `group_id` into all MCP tool calls
- ✅ Added API route validation (`src/app/api/memory/*/route.ts`)
  - Validates `group_id` in GET/POST handlers
  - Returns 400 for missing/invalid `group_id`
- ✅ Created OpenCode plugin (`.opencode/plugin/group-id-enforcer.ts`)
  - Intercepts `tool.execute.before` for MCP_DOCKER tools
  - Validates and injects `group_id` automatically
  - Registered in `opencode.json`
- ✅ Created verification script (`scripts/verify-group-id-enforcement.ts`)
  - 20 tests, all passing
  - Validates format, prefix, injection behavior

**Architecture Layers:**
1. **EnforcedMcpClient** — Call-site validation for TypeScript code
2. **API Routes** — Request validation for external traffic
3. **OpenCode Plugin** — Tool interception for agent operations

**Files Created:**
- `src/lib/mcp/enforced-client.ts` — Enforced MCP client wrapper
- `src/lib/mcp/enforced-client.test.ts` — Test suite (63 tests)
- `.opencode/plugin/group-id-enforcer.ts` — OpenCode plugin
- `scripts/verify-group-id-enforcement.ts` — Verification script

**Files Modified:**
- `src/app/api/memory/traces/route.ts` — Added group_id validation
- `src/app/api/memory/insights/route.ts` — Added group_id validation
- `opencode.json` — Registered group-id-enforcer plugin

**Test Results:**
```
Total: 20 tests
Passed: 20
Failed: 0
✅ All enforcement layers verified successfully!
```

---

### 2026-04-05 — Architecture Review and Spec Creation

**Completed:**
- ✅ Phase 0: Architecture Confidence Review — Identified what's implemented vs not
- ✅ Phase 1: Sync Notion ↔ Local — Created Solution Architecture Notion page
- ✅ Phase 2: Fix sprint-status.yaml — Epic 2 marked complete, Story 1.1 ready-for-dev
- ✅ Phase 3: Create Missing Specs — WorkflowState, BehaviorSpecs, Agent Primitives
- ✅ Fixed `faith-meats.yaml` — Converted from markdown+YAML to pure YAML

**Key Discoveries:**
- 🔍 `groupIdEnforcer.ts` EXISTS and appears correct (131 lines of complete code)
- 🔍 **ARCH-001 may be wiring issue, not code issue** — Need to verify integration
- 🔍 WorkflowState NOT IMPLEMENTED — Spec created, awaiting implementation
- 🔍 BehaviorSpec PARTIAL — Only 1/6 existed, created 5 more workspace specs
- 🔍 12 Agent Primitives NOT IMPLEMENTED — Spec created, awaiting implementation
- 🔍 OpenClaw Gateway is STUB — 362 lines exist, missing groupId integration, permissions, persistence

**Files Created:**
- `_bmad-output/implementation-artifacts/workflow-state-spec.md` — Crash-safe state machine
- `_bmad-output/implementation-artifacts/behavior-specs/creative-studio.yaml`
- `_bmad-output/implementation-artifacts/behavior-specs/personal-assistant.yaml`
- `_bmad-output/implementation-artifacts/behavior-specs/nonprofit.yaml`
- `_bmad-output/implementation-artifacts/behavior-specs/bank-audits.yaml`
- `_bmad-output/implementation-artifacts/behavior-specs/haccp.yaml`
- `_bmad-output/implementation-artifacts/behavior-specs/faith-meats.yaml` (fixed)
- `_bmad-output/planning-artifacts/agent-primitives.md` — 12 primitives spec

**Files Updated:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Epic 2 complete, Story 1.1 ready
- `_bmad-output/planning-artifacts/epics.md` — Epic 2 status → completed

**In Progress:**
- ⏳ Phase 4: Sync to Notion (final)
- ⏳ Phase 5: Create epic-build-loop skill
- ⏳ Investigate ARCH-001 — Determine if groupIdEnforcer needs wiring

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
| ARCH-001 | `groupIdEnforcer.ts` broken | 1.1 | Ready for dev |
| RK-01 | Group ID enforcement not working | 1.1 | Critical |

---

## Next Actions

1. **Fix ARCH-001** — `groupIdEnforcer.ts` must enforce `group_id` on all DB operations
2. **Resume Story 1.1** — Record Raw Execution Traces
3. **Validate canon** — Ensure all generated docs use `allura-*` naming

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