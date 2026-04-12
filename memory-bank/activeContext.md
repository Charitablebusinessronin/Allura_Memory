# Active Context — Brooks Architect Persona

**Session**: 2026-04-12d (Phase 3 Controlled Activation)
**Status**: ✅ PHASE 3 CONTROLLED ACTIVATION COMPLETE | Typecheck clean | 5 tasks committed

## Current Focus

**Phase 3 controlled activation complete. All 5 tasks committed. Milestone: "Phase 3 controlled activation"**

### What Changed This Session

1. **Watchdog refactored for testability**: `scanAndPropose()` exported with `WatchdogConfig` interface, CLI guarded by `isMainModule`
2. **3-cycle sustained validation**: Watchdog ran 3 cycles against live PostgreSQL, created pending proposals, confirmed idempotency
3. **Notion-sync refactored**: `getPendingProposals(groupId)`, `syncToNotion(config)`, `markSynced()` all exported; CLI guarded
4. **Tier constraint fixed on running DB**: `ALTER TABLE` migrated `established` → `mainstream` (72 rows)
5. **approvePromotions() hard-blocked**: Throws `DeprecatedApprovalPathError` unless `MIGRATION_MODE=true` or `DEBUG_LEGACY=true`
6. **Browser/runtime test separation**: 264 tests correctly skipped via `describe.skipIf` guards
7. **INV-001 updated**: From "must emit warning" → "must throw DeprecatedApprovalPathError"

## Issues on the Board

| Issue | Severity | Description | Status |
|-------|----------|-------------|--------|
| #7 | MEDIUM | Legacy tools missing `^allura-` validation | **FIXED** (commit 863ac5b9) |
| #12 | HIGH | Kernel proof gate returns errors as data | **FIXED** |
| #13 | HIGH | Neo4j I/O modules lack try/catch | **FIXED** |
| #14 | HIGH | `memory_list` swallows PostgreSQL errors | **FIXED** |
| #15 | HIGH | E2E test fixtures violate `^allura-` group_id | **FIXED** |
| #16 | HIGH | SQL tier CHECK uses 'established' instead of 'mainstream' | **FIXED** |
| #17 | MEDIUM | approvePromotions() dual-path risk | **HARD-BLOCKED** (this session) |

## Pipeline Status

| Step | Task | Status |
|------|------|--------|
| 1 | Sustained watchdog validation (3-cycle pass) | ✅ DONE (commit c8df8be4) |
| 2 | Wire Notion review surface | ✅ DONE (commit a5f2dfb5) |
| 3 | E2E approve/reject validation | ✅ DONE (commit 78b2f6a0) |
| 4 | Hard-block approvePromotions() | ✅ DONE (commit 16bcc046) |
| 5 | Browser/runtime test separation | ✅ DONE (commit 71a83338) |

## Commits This Session

1. `c8df8be4` — test(curator): sustained watchdog validation — 3-cycle pass
2. `a5f2dfb5` — feat(curator): wire notion-sync to pending proposals queue
3. `78b2f6a0` — test(curator): e2e approve/reject validation through /api/curator/approve
4. `16bcc046` — fix(curator): hard-block approvePromotions() — throw in operational context
5. `71a83338` — test(config): verify browser/runtime test separation

## Key Invariants Verified

- ✅ `canonical_proposals` is the ONLY proposals queue (no `proposals` or `proposal_queue` tables)
- ✅ `/api/curator/approve` is the sole operational approval door
- ✅ `approvePromotions()` throws (not warns) in operational context
- ✅ `^allura-` prefix enforced on all group_ids
- ✅ Sustained watchdog creates pending proposals (3+ cycles)
- ✅ notion-sync queries canonical_proposals correctly
- ✅ Typecheck clean across all 5 commits
- ✅ Test separation: 922 pass, 36 fail (pre-existing), 264 skip (gated)

## System Health

| Component | Status | Notes |
|-----------|--------|-------|
| Postgres | ✅ READY | 78 proposals pending, tier constraint fixed |
| Neo4j | ✅ READY | SUPERSEDES versioning |
| Typecheck | ✅ CLEAN | All 5 commits verified |
| Watchdog | ✅ VALIDATED | 3-cycle sustained pass |
| Notion Sync | ✅ WIRED | Queries canonical_proposals, graceful degradation |
| Approval Gate | ✅ HARD-BLOCKED | approvePromotions() throws DeprecatedApprovalPathError |
| Test Separation | ✅ VERIFIED | 264 tests correctly gated |

---

**Phase 2: CLOSED ✅**

**Next Session (Phase 4)**:
1. **Restart Claude Code** — picks up `allura-memory` MCP from settings.json (verified boots clean, 5 tools surface)
2. **Wire Notion end-to-end** — Create Notion database via MCP, surface pending proposals
3. **Run full E2E** — `RUN_E2E_TESTS=true bun vitest run`
4. **Fix remaining pre-existing test failures** (mutate-events, embeddings)
5. **Phase 4 planning** — ChatGPT integration (untracked plan: docs/allura/chatgpt-integration-plan.md), P2-3 agent hooks, autonomous curator production