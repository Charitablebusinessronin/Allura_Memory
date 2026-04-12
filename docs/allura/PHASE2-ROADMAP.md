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

**Status:** ✅ COMPLETE — `storeMemory()` now tries Neo4j first; on failure, routes to `ruvector_memory_fallback` (PostgreSQL) when `RUVECTOR_ENABLED=true`. Pending rows carry `replayed_to_neo4j=false` for replay once Neo4j recovers.

**Acceptance Criteria:**
- [x] Clear operator messaging about which stores are active (`/api/health` degraded mode)
- [x] Graceful degradation to ruvector when Neo4j unavailable (`src/lib/memory/store.ts`)
- [x] Automatic routing to available store based on query type (Neo4j → ruvector fallback path)

**Schema:** `docker/postgres-init/12-ruvector-fallback.sql` — apply to running DB once.

**Estimated:** 2 days ✅ Done

### P2-2: Additional Canonical-Memory Ops
**Description:** Extend canonical operations beyond the 5 current ones (add, search, get, list, delete).

**Status:** DEFERRED — `memory_update`, `memory_promote`, `memory_export` not implemented. Candidates documented; no immediate demand. Defer to Phase 4 unless curator pipeline surfaces a need.

**Candidates:**
- `memory_update` — Update existing memory metadata
- `memory_promote` — Explicit promotion request to Neo4j
- `memory_export` — Export memories in standard format

**Estimated:** 3 days (deferred)

### P2-3: Agent Hooks Integration
**Description:** Connect GitHub agent hooks to actual agent logic with DB persistence.

**Status:** DEFERRED — Still in mock mode. No `.github/scripts/` agent files found. Defer to Phase 4 alongside ChatGPT integration planning.

**Current:** Mock mode (no DB)
**Target:** Full DB logging with insight creation

**Acceptance Criteria:**
- [ ] Agent scripts log to PostgreSQL when DB available
- [ ] Create Neo4j insights from code analysis
- [ ] Route issues to appropriate team members

**Estimated:** 2 days (deferred)

### P2-4: Healthcheck Enhancement
**Description:** Add detailed component-level health with degraded capability mapping.

**Status:** ✅ COMPLETE — `/api/health/route.ts` (438 lines) ships:
- 5 component checks: PostgreSQL, Neo4j, session-bootstrap, encoding-validator, disk-space
- `?detailed=true`, `?include=`, `?exclude=` query params
- Degraded capability mapping: `neo4j_unavailable` → `capabilities_lost`
- POST `/api/health` for alert acknowledgement

**Estimated:** 1 day ✅ Done

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