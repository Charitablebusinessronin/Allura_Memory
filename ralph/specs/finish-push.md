# Finish Push — Phase 6-9 Close

**Source**: memory-bank/activeContext.md, IMPLEMENTATION_PLAN.md

## What

Close out Phases 6 and 9 by completing the remaining verification gates:

1. **k6 load test at VU=100** — Validate p95 < 200ms for memory_add (Phase 9)
2. **Watchdog 24h soak confirm** — Zero unhandled rejections in DLQ
3. **Process 116 backlogged proposals** — Dedup + Notion sync via curator pipeline
4. **Phase 6 close** — Update memory-bank/ after watchdog confirmed

## Acceptance Criteria

- k6 reports memory_add p95 < 200ms, error rate < 5%
- `SELECT COUNT(*) FROM notion_sync_dlq WHERE status = 'failed'` returns 0
- All pending proposals in canonical_proposals have status != 'pending' (or count is 0 after processing)
- memory-bank/activeContext.md and memory-bank/progress.md updated to show Phase 6 CLOSED
- `bun run typecheck` passes
- `bun test` passes

## Agent Dispatch

- k6 test: Bellard (measure) + Carmack (optimize if needed)
- Watchdog: Bellard (monitor) + Hightower (infra)
- Proposals: Woz (implementation) + Knuth (data layer)
- Phase close: Brooks (sign-off)

## Constraints

- HITL gate on any Neo4j promotion
- group_id enforced on all operations
- Append-only on events table