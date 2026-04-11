# Phase 2: MCP-Tooling Expansion

## Goal
Advance Allura's agent memory capabilities beyond the hardened v1.0 baseline.

## Green Baseline Check (2026-04-11)

| Check | Status | Run ID |
|-------|--------|--------|
| Allura Agent Hooks runs | ✅ | 24289774255 |
| CodeQL completes | ✅ | 24289774106 |
| No Node.js 20 warnings | ✅ | Opt-in set |
| MCP degraded mode works | ✅ | Manual test |
| Tests pass | ✅ | canonical-memory.test.ts |

## Stories

### P2-1: Richer Neo4j Fallbacks
**Description:** Add intelligent fallback behavior when Neo4j is degraded beyond episodic-only mode.

**Acceptance Criteria:**
- [ ] Graceful degradation to ruvector (PostgreSQL with vector extensions) when Neo4j unavailable
- [ ] Automatic routing to available store based on query type
- [ ] Clear operator messaging about which stores are active

**Estimated:** 2 days

### P2-2: Additional Canonical-Memory Ops
**Description:** Extend canonical operations beyond the 5 current ones (add, search, get, list, delete).

**Candidates:**
- `memory_update` — Update existing memory metadata
- `memory_promote` — Explicit promotion request to Neo4j
- `memory_export` — Export memories in standard format

**Estimated:** 3 days

### P2-3: Agent Hooks Integration
**Description:** Connect GitHub agent hooks to actual agent logic with DB persistence.

**Current:** Mock mode (no DB)
**Target:** Full DB logging with insight creation

**Acceptance Criteria:**
- [ ] Agent scripts log to PostgreSQL when DB available
- [ ] Create Neo4j insights from code analysis
- [ ] Route issues to appropriate team members

**Estimated:** 2 days

### P2-4: Healthcheck Enhancement
**Description:** Add detailed component-level health with degraded capability mapping.

**Estimated:** 1 day

---

## Gate Check

Before starting Phase 2, verify green baseline:

| Check | Status | Notes |
|-------|--------|-------|
| Allura Agent Hooks runs | ✅ | Run ID 24289774255 passed |
| CodeQL completes | ✅ | No failures |
| No Node.js 20 warnings | ✅ | FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 set |
| MCP degraded mode works | ✅ | Tested manually, PR #1 evidence |
| Tests pass | ✅ | canonical-memory.test.ts rerun-safe |

**Green baseline confirmed:** 2026-04-11