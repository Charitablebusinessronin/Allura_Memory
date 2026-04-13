# Curator Queue — Governance and Promotion Pipeline

**Source**: ADR-002 (Proposed), Requirements Matrix B4/B9/F6/F7

## What

A governance pipeline that controls promotion of high-confidence memories from Postgres (raw traces) to Neo4j (curated knowledge):

1. **Watchdog loop** (`src/curator/watchdog.ts`) — Polls `events` table for unpromoted high-confidence events within a 7-day window
2. **Scoring** — Each candidate scored via `curatorScore()`. Scores above threshold (default 0.7) create proposals
3. **Proposals table** (`canonical_proposals`) — Single approval queue for all promotions. Idempotent via `ON CONFLICT DO NOTHING`
4. **Human approval UI** — `/admin/approvals` page shows pending proposals with score, content, and provenance
5. **Approval route** — `POST /api/curator/approve` is the ONLY approval path. Never bypassed, even in auto mode
6. **Notion sync** — Pending proposals surfaced to Notion for human review (one-way sync)

## Acceptance Criteria

- `canonical_proposals` table exists with: id, event_id, group_id, score, content, status, created_at, reviewed_at, reviewed_by
- Watchdog polls every 60 seconds (configurable), max 50 events per cycle
- Scores above 0.7 threshold create proposals (configurable)
- `PROMOTION_MODE=soc2` mode: ALL proposals require human approval before Neo4j MERGE
- `PROMOTION_MODE=auto` mode: proposals above 0.9 threshold auto-promote; below requires approval
- `/admin/approvals` page shows pending proposals with approve/reject actions
- Idempotency: same event cannot create duplicate proposals
- `group_id` validated against `^allura-[a-z0-9-]+$` before any DB call
- `bun run typecheck && bun test` passes

## Key Files

- `docker/postgres-init/11-canonical-proposals.sql` — Schema migration
- `src/lib/curator/score.ts` — Scoring logic
- `src/curator/watchdog.ts` — Watchdog loop (NEW)
- `src/curator/index.ts` — Curator entry point
- `src/app/curator/page.tsx` — Governance dashboard
- `src/app/api/curator/proposals/route.ts` — Proposals API
- `src/app/api/curator/approve/route.ts` — Approve/reject API

## Constraints

- HITL gate: never autonomously promote to Neo4j without going through curator flow
- Single approval queue — preserves conceptual integrity
- Bounded scan per cycle — prevent runaway queries
- group_id enforcement on every operation