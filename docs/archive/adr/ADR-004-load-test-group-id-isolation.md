---
id: ADR-004
title: Load Test Group ID Isolation
status: Executed — closed 2026-04-13
author: brooks-architect
date: 2026-04-13
---

# ADR-004: Load Test Group ID Isolation

## Context

k6 load tests were writing `memory_add` calls using the production group_id `allura-roninmemory`. The scorer (`src/lib/curator/score.ts`) assigned these writes a confidence of 0.70 (base 0.5 + fresh +0.1 + length +0.1) — exactly at the promotion threshold. With `PROMOTION_MODE=hitl`, each VU write created a pending `canonical_proposals` row.

A single k6 run with 100 VUs generated 249 synthetic proposals, flooding the HITL queue and masking real knowledge waiting for promotion.

## Decision

**Isolate all load test writes to a dedicated group_id: `allura-roninmemory-loadtest`.**

Two changes:

1. `tests/load/k6-load-test.js`: `GROUP_ID = 'allura-roninmemory-loadtest'`
2. `src/mcp/canonical-tools.ts` (`memory_add`): Skip proposal creation if `groupId.endsWith('-loadtest')`

## Rationale

**Why a dedicated group_id over an agent_id filter:**
- Agent IDs (`k6-vu-*`) are implementation details of the test runner and could change. Group ID is the canonical tenant boundary — it is the right layer to enforce this.
- A `-loadtest` suffix convention is self-documenting and generalizes to other test tools (e.g., Playwright, Artillery) without new code.

**Why not a `test_mode` flag:**
- A flag on the request is opt-in by the caller. The group_id approach is enforced at the pipeline layer — the caller cannot accidentally opt back in.

**Why not filter in the scorer:**
- The scorer is a pure confidence function. Injecting environment concerns (is this a test?) into scoring logic violates separation of concerns.

## Consequences

- `allura-roninmemory-loadtest` events are written to Postgres (episodic trace preserved for debugging) but never enter the promotion pipeline.
- `allura-roninmemory-loadtest` satisfies the existing `^allura-[a-z0-9-]+$` constraint — no migration required.
- Any future load/perf test tool that uses the `-loadtest` suffix gets automatic exclusion.
- 249 existing synthetic proposals were purged from `canonical_proposals` on 2026-04-13.

## Alternatives Rejected

| Option | Reason Rejected |
|--------|----------------|
| Filter by `agent_id LIKE 'k6-%'` | Brittle — agent_id naming is caller-controlled |
| Dedicated `test_mode` flag on request | Opt-in — can be accidentally omitted |
| Raise proposal threshold | Would block legitimate emerging-tier writes |
| Delete proposals after each test run | Manual hygiene, not a systemic fix |
