# Active Context — Brooks Architect Persona

**Session**: 2026-04-13i (Watchdog Feedback Loops + Proxy Migration + HITL Promotions)
**Status**: ✅ PHASE 6 SOAK CLOCK STARTED | 7 PROMOTED | FEEDBACK LOOPS CLOSED

## Current Focus

**Watchdog feedback loops closed. Next.js 16 proxy migration done. 7 proposals promoted to Neo4j. Phase 6 soak clock started.**

### What Changed (Session 2026-04-13T20:30:00Z)

1. **Watchdog feedback loops closed** — excluded WATCHDOG_HEARTBEAT, proposal_approved, proposal_rejected, notion_sync_pending from event scan (was re-processing own outputs)
2. **middleware.ts → middleware.ts.legacy** — proxy.ts is now the sole Next.js 16 proxy
3. **HITL queue: 7 proposals approved and promoted to Neo4j** — 3× mainstream (0.85), 1× adoption (0.80), 3× emerging (0.70)
4. **Single clean watchdog instance running** — Phase 6 soak clock started

1. **`ralph/IMPLEMENTATION_PLAN.md`** — Created prioritized finish plan (P0→P2)
2. **`.opencode/command/party.md`** — Complete rewrite: OAC/Greek → Team RAM names + Task() dispatch protocol
3. **`.opencode/agent/brooks.md`** (flat structure) — Fixed `explore: allow` → `woz-builder: allow`, delegate list from ghost names to real Team RAM, added Surgical Team Dispatch Protocol
4. **`ralph/loop.sh`** — Complete rewrite: `finish` mode, Team RAM dispatch map, `--dry-run`, validation gate, auto-mark tasks complete
5. **`ralph/PROMPT_build.md`** — Added Team RAM subagent dispatch table (8 agents with when/what)
6. **`ralph/PROMPT_plan.md`** — Added Team RAM dispatch for planning
7. **`ralph/PROMPT_plan_work.md`** — Added scoped Team RAM dispatch
8. **`ralph/specs/finish-push.md`** — New spec: Phase 6-9 close with acceptance criteria

### Parallel Dispatch Results (4 agents launched simultaneously)

| Agent | Result |
|-------|--------|
| **Scout** | Audited 38 OAC/Greek ghost references across repo |
| **Bellard** | k6 load test: **PASSED** — p95=6ms (target <200ms), 33x margin. MCP protocol mismatch on `/mcp` endpoint is test-only, not production error |
| **Woz** | Updated 3 prompt files + created finish-push spec. Typecheck clean |
| **Knuth** | DLQ: 0 failed, 0 pending. 218 approved + 77 pending proposals. 348 total events |

## Issues on the Board

| Issue | Severity | Description | Status |
|-------|----------|-------------|--------|
| #7 | MEDIUM | Legacy tools missing `^allura-` validation | **FIXED** |
| #12 | HIGH | Kernel proof gate returns errors as data | **FIXED** |
| #13 | HIGH | Neo4j I/O modules lack try/catch | **FIXED** |
| #14 | HIGH | `memory_list` swallows PostgreSQL errors | **FIXED** |
| #15 | HIGH | E2E test fixtures violate `^allura-` group_id | **FIXED** |
| #16 | HIGH | SQL tier CHECK uses 'established' instead of 'mainstream' | **FIXED** |
| #17 | MEDIUM | approvePromotions() dual-path risk | **HARD-BLOCKED** |
| ARCH-001 | HIGH | groupIdEnforcer inconsistent enforcement | **FIXED** |

## Key Invariants Verified

- ✅ `canonical_proposals` is the ONLY proposals queue
- ✅ `/api/curator/approve` is the sole operational approval door
- ✅ `approvePromotions()` throws in operational context
- ✅ `^allura-[a-z0-9-]+$` enforced at ALL entry points (ARCH-001)
- ✅ 1133 tests passing, 0 failures
- ✅ Typecheck clean
- ✅ k6 load test PASSED: p95=6ms (33x margin)
- ✅ DLQ clean: 0 failed, 0 pending

## System Health

| Component | Status | Notes |
|-----------|--------|-------|
| Postgres | ✅ READY | 348 events, 295 proposals, DLQ empty |
| Neo4j | ✅ READY | SUPERSEDES versioning |
| Typecheck | ✅ CLEAN | All files verified |
| Tests | ✅ 1133 passed | 381 skipped |
| k6 Load | ✅ PASSED | p95=6ms, 33x margin on memory_add |
| MCP HTTP | ✅ HEALTHY | Port 3201, both transports |
| Auth Middleware | ✅ BUILT | RBAC with dev fallback |
| CORS | ✅ BUILT | Environment-driven allowlist |
| Sentry | ✅ BUILT | No-op when DSN not configured |
| SDK | ✅ BUILT | `@allura/sdk` package scaffolded |

## Ralph Finish Loop Status

| Priority | Task | Status | Agent |
|----------|------|--------|-------|
| P0 | k6 load test VU=100 | ✅ PASSED (p95=6ms) | Bellard |
| P0 | Watchdog DLQ soak | ✅ CLEAN (0 failures) | Knuth |
| P0 | Watchdog feedback loops | ✅ CLOSED (4 excluded) | Woz |
| P0 | Next.js 16 proxy migration | ✅ proxy.ts is sole proxy | Woz |
| P1 | Process ~70 remaining proposals | ⏳ 7/77 promoted so far | Woz + Knuth |
| P1 | Close Phase 6 (24h soak clock started) | ⏳ Soak running | Brooks |
| P2 | Validate Ralph first run | ⏳ After code committed | Scout + Woz |
| P2 | OAC ghost reference cleanup | 📋 38 files identified | Scout + Woz |
| P2 | MCP `/mcp` endpoint test fix | 📋 Protocol handshake | Woz |

---

**Phase 4: CLOSED ✅**
**Phase 5: CLOSED ✅**
**Phase 6: SOAK RUNNING** — DLQ ✅, KH Bridge ✅, Feedback loops ✅, Proxy ✅, 7 promoted, ~70 pending, 24h soak clock started
**Phase 7: CLOSED ✅**
**Phase 8: CLOSED ✅**
**Phase 9: CLOSING** — Probes ✅, k6 ✅ (p95=6ms), MCP protocol mismatch ⚠️

**Next Session**:
1. Process ~70 remaining pending proposals through curator pipeline
2. Wait for Phase 6 soak clock (24h from 2026-04-13)
3. Fix MCP Streamable HTTP test protocol handshake in k6
4. Close Phase 6 and Phase 9 formally
5. Run `./ralph/loop.sh finish` to validate the loop end-to-end