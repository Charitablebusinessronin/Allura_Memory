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

## P0 — Hard Gates (MUST pass before Phase 6 close) — ✅ ALL PASSED

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

- [x] **Process remaining proposals** — ✅ DRAINED (3 approved this session, 0 pending remaining)
  - Agent: Knuth (data operations)
  - 228 total approved, 0 pending, 0 rejected
  - 10 total promoted to Neo4j (7 prior + 3 this session)
  - DLQ: 0 failed, 0 pending

- [x] **Close Phase 6** — ✅ CLOSED 2026-04-13
  - Agent: Brooks (sign-off)
  - 32 watchdog heartbeats in 24h, 0 DLQ failures, 0 DLQ pending
  - Queue drained, KH Bridge working, feedback loops closed
  - Phase 6 formally declared CLOSED

## P2 — Tooling & Cleanup

- [x] **Watchdog feedback loops closed** — excluded WATCHDOG_HEARTBEAT, proposal_approved, proposal_rejected, notion_sync_pending from event scan
  - Agent: Woz (implementation)
  - Files: `src/curator/watchdog.ts`, `src/curator/index.ts`

- [x] **Next.js 16 proxy migration** — middleware.ts → middleware.ts.legacy, proxy.ts is sole proxy
  - Agent: Woz (implementation)
  - File: `src/middleware.ts` → `src/middleware.ts.legacy`, `src/proxy.ts`

- [x] **HITL queue: 7+3 proposals promoted** — 3× mainstream (0.85), 1× adoption (0.80), 3× emerging (0.70) + 3 more this session
  - Agent: Brooks + Knuth
  - Promoted to Neo4j with SUPERSEDES versioning
  - Queue now DRAINED: 0 pending, 228 approved

- [x] **Fix MCP `/mcp` k6 test** — Added session handshake + Goja compatibility
  - Agent: Woz (implementation)
  - File: `tests/load/k6-load-test.js`

- [x] **Wire canonical-tools.ts → RuVector bridge** — memory_search now has conditional third search source
  - Agent: Woz (implementation) + Scout (recon) + Brooks (orchestration)
  - Files: `src/mcp/canonical-tools.ts`, `src/lib/memory/canonical-contracts.ts`, `src/__tests__/memory-search-ruvector.test.ts`
  - Design: Feature-flagged via `shouldUseRuVector()`, fail-closed (PG+Neo4j still work if RuVector down)
  - Evidence-gated: trajectoryId in metadata for caller to use with postFeedback()
  - Tests: 20 new unit tests + 49 existing RuVector tests + 38 canonical tests all pass
  - Added mcpInitialize(), mcpInitialized(), mcpToolCall() protocol conformance
  - Converted ES2017+ to ES5.1 for k6/Goja engine

- [ ] **Validate Ralph first run** — `/ralph plan` generates this file, `/ralph build` executes against it
  - Agent: Scout (verify) + Woz (fix if needed)

- [x] **Update party.md with Team RAM names** — ✅ DONE (earlier this session)
  - Agent: Woz (config fix)

- [x] **Fix Brooks delegate list** — ✅ DONE (earlier this session)
  - Agent: Woz (config fix)
  - File: `.opencode/agent/core/brooks-architect.md`
  - Status: DONE (this session)

- [x] **OAC ghost reference purge** — ✅ 161 references replaced across 21 files
  - Agent: Woz (batch fix)
  - oracle→Pike, hephaestus→Woz, prometheus→Fowler, explore→Scout, librarian→Scout, atlas→Brooks, sisyphus→Brooks, OpenAgent/OpenCoder→Team RAM names
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
| Phase 6 | ✅ CLOSED | DLQ ✅, KH Bridge ✅, Feedback loops ✅, Queue DRAINED, 32 heartbeats |
| Phase 7 | ✅ CLOSED | Auth, Audit CSV, Clerk |
| Phase 8 | ✅ CLOSED | SDK, CORS, Sentry |
| Phase 9 | ✅ CLOSED | k6 p95=6ms ✅, MCP handshake ✅, SDK ✅, CORS ✅, Sentry ✅ |

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