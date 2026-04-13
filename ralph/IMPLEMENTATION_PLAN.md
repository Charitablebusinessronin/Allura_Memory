# Implementation Plan — Allura Memory Finish Push

**Created**: 2026-04-13
**Status**: ACTIVE
**Branch**: new-main
**Agent**: Brooks (orchestrator) + Team RAM (parallel dispatch)

---

## What Is This?

This is the plan the Ralph loop iterates against. Each build iteration picks the
highest-priority unchecked item, dispatches to the appropriate Team RAM subagent(s),
implements, validates, commits, and updates this file.

**Loop command**: `./ralph/loop.sh build 20`

---

## P0 — Hard Gates (MUST pass before Phase 6 close)

- [x] **k6 load test at VU=100** — **PASSED** p95=6ms (33x margin), errors only from MCP protocol mismatch
  - Agent: Bellard (measure) + Carmack (optimize if needed)
  - File: `tests/load/k6-load-test.js`
  - k6 v1.7.1 installed. MCP healthy on port 3201.
  - Command: `k6 run tests/load/k6-load-test.js`
  - Thresholds: memory_add p95<200ms, memory_search p95<500ms, errors rate<5%

- [x] **Watchdog 24h soak confirm** — **PASSED** DLQ has 0 failed, 0 pending entries
  - Agent: Bellard (monitor) + Hightower (infra)
  - File: `src/curator/watchdog.ts`
  - Verify: no DLQ entries with exhausted retries, no worker crashes
  - Check: `SELECT COUNT(*) FROM notion_sync_dlq WHERE status = 'failed'`

## P1 — Queue Clearance & Phase Close

- [ ] **Process remaining pending proposals** — dedup + Notion sync
  - Agent: Woz (implementation) + Knuth (data layer)
  - 7 already approved and promoted to Neo4j (3× mainstream 0.85, 1× adoption 0.80, 3× emerging 0.70)
  - Remaining ~70 proposals still pending in canonical_proposals
  - Flow: canonical_proposals (status=pending) → dedup check → /api/curator/approve → Notion sync
  - Dedup: `src/lib/memory/knowledge-promotion.ts` → `queryApprovedInsights()`
  - Notion sync: `src/curator/notion-sync.ts` → `syncToNotion()`

- [ ] **Close Phase 6** after soak completes (24h clock started 2026-04-13)
  - Agent: Brooks (sign-off)
  - Watchdog: single clean instance running, feedback loops closed
  - Update: `memory-bank/activeContext.md`, `memory-bank/progress.md`

## P2 — Tooling & Cleanup

- [x] **Watchdog feedback loops closed** — excluded WATCHDOG_HEARTBEAT, proposal_approved, proposal_rejected, notion_sync_pending from event scan
  - Agent: Woz (implementation)
  - Files: `src/curator/watchdog.ts`, `src/curator/index.ts`

- [x] **Next.js 16 proxy migration** — middleware.ts → middleware.ts.legacy, proxy.ts is sole proxy
  - Agent: Woz (implementation)
  - File: `src/middleware.ts` → `src/middleware.ts.legacy`, `src/proxy.ts`

- [x] **HITL queue: 7 proposals promoted** — 3× mainstream (0.85), 1× adoption (0.80), 3× emerging (0.70)
  - Agent: Brooks + Knuth
  - Promoted to Neo4j with SUPERSEDES versioning

- [ ] **Validate Ralph first run** — `/ralph plan` generates this file, `/ralph build` executes against it
  - Agent: Scout (verify) + Woz (fix if needed)

- [ ] **Update party.md with Team RAM names** — replace OAC/Greek ghosts
  - Agent: Woz (config fix)
  - File: `.opencode/command/party.md`
  - Status: DONE (this session)

- [ ] **Fix Brooks delegate list** — ghost names → real subagents
  - Agent: Woz (config fix)
  - File: `.opencode/agent/core/brooks-architect.md`
  - Status: DONE (this session)

- [ ] **Remove passive OAC references** in `.opencode/context/`, `.opencode/contracts/`, `.opencode/scripts/`
  - Agent: Scout (audit) + Woz (fix)
  - These are documentation leftovers, not active agent registry

---

## Phase Completion Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 | ✅ CLOSED | Foundation |
| Phase 2 | ✅ CLOSED | Full sprint |
| Phase 3 | ✅ CLOSED | Controlled activation |
| Phase 4 | ✅ CLOSED | Pipeline validated |
| Phase 5 | ✅ CLOSED | Ralph loop — 0 failures |
| Phase 6 | 🔲 CLOSING | DLQ ✅, KH Bridge ✅, Worker soak pending |
| Phase 7 | ✅ CLOSED | Auth, Audit CSV, Clerk |
| Phase 8 | ✅ CLOSED | SDK, CORS, Sentry |
| Phase 9 | 🔲 CLOSING | Probes ✅, k6 ✅, Load test run pending |

---

## Allura Rules (NON-NEGOTIABLE)

- bun only — never npm, npx, or node directly
- Postgres is append-only — INSERT only
- group_id required on every DB operation (format: `^allura-[a-z0-9-]+$`)
- Neo4j uses SUPERSEDES — never edit existing nodes
- HITL required — never promote to Neo4j without curator flow
- MCP_DOCKER tools only — never docker exec for DB operations

---

## Agent Dispatch Map

| Task Type | Primary Agent | Support Agent | When |
|-----------|---------------|----------------|------|
| Code implementation | WOZ_BUILDER | — | Any write to src/ |
| Discovery / recon | SCOUT_RECON | — | File search, pattern grep |
| Schema / DB | KNUTH_DATA_ARCHITECT | — | Migrations, queries, data layer |
| Perf measurement | BELLARD_DIAGNOSTICS_PERF | CARMACK_PERFORMANCE | Benchmarks, profiling, latency |
| Lint / typecheck gate | FOWLER_REFACTOR_GATE | — | Validation gate before commit |
| API review | PIKE_INTERFACE_REVIEW | — | Interface changes |
| Infra / Docker / CI | HIGHTOWER_DEVOPS | — | Container, CI/CD, deploy |
| Architecture decision | BROOKS_ARCHITECT | — | ADRs, contracts, sign-off |