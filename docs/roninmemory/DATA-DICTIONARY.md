# roninmemory Data Dictionary

> [!NOTE]
> **AI-Assisted Documentation**
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.

This document describes every table and event in the roninmemory data model.

---

## Table of Contents

- [PostgreSQL Tables](#postgresql-tables)
- [Neo4j Graph Schema](#neo4j-graph-schema)
- [Views](#views)
- [Constraints Summary](#constraints-summary)

---

## PostgreSQL Tables

### `tenants`
Multi-tenant namespace isolation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | Yes | Primary key |
| `group_id` | string | Yes | Tenant namespace (e.g. `faith-meats`) |
| `display_name` | string | Yes | Human-readable name |
| `is_global` | boolean | Yes | Whether this is the global fallback tenant |
| `created_at` | datetime | Yes | When tenant was created |

### `adas_runs`
Raw execution traces from ADAS discovery. Immutable after insert except `status` and `promoted`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `run_id` | uuid | Yes | Unique run identifier |
| `group_id` | string | Yes | Tenant FK → `tenants.group_id` |
| `agent_design_json` | jsonb | Yes | Full agent design snapshot |
| `fitness_score` | numeric | Yes | Composite score 0.0–1.0 |
| `status` | string | Yes | `pending` \| `running` \| `succeeded` \| `failed` |
| `promoted` | boolean | Yes | Whether Curator promoted to Neo4j |
| `started_at` | datetime | Yes | Run start timestamp |
| `finished_at`| datetime | No | Run completion timestamp |

### `adas_trace_events`
Every event during ADAS evaluation for audit/debugging.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event_id` | uuid | Yes | Unique event identifier |
| `run_id` | uuid | Yes | FK → `adas_runs.run_id` |
| `event_type` | varchar(50) | Yes | See event type catalogue below |
| `payload` | jsonb | Yes | Event-specific data |
| `created_at` | timestamp | Yes | Event timestamp (UTC) |

### `adas_promotion_proposals`
HITL governance proposals.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `proposal_id` | uuid | Yes | Unique proposal identifier |
| `design_id` | uuid | Yes | Candidate design UUID |
| `design_snapshot` | jsonb | Yes | Full design at proposal time |
| `status` | varchar(20) | Yes | `pending` \| `approved` \| `rejected` \| `modified` |
| `human_decision`| varchar(20) | No | `approved` \| `rejected` |

### `curator_queue`
Curator promotion queue — tracks 2-phase commit state.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `queue_id` | uuid | Yes | Primary key |
| `run_id` | uuid | Yes | FK → `adas_runs.run_id` |
| `neo4j_written` | boolean | Yes | Phase 1 complete flag |
| `neo4j_node_id` | string | No | Neo4j node ID from Phase 1 |
| `attempt_count` | integer | Yes | Retry counter (max 4) |

### `agents`
Agent registry with heartbeat and cost tracking.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | Yes | Primary key |
| `name` | string | Yes | Agent identifier |
| `group_id` | string | Yes | Tenant FK |
| `status` | string | Yes | `active` \| `idle` \| `error` |
| `last_heartbeat`| datetime | Yes | Updated by `after_tool_call` hook |
| `token_cost_usd`| numeric | Yes | Cumulative cost |

### `notion_sync_log`
Audit trail for Notion mirror operations.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `log_id` | uuid | Yes | Primary key |
| `run_id` | uuid | Yes | FK → `adas_runs.run_id` |
| `notion_page_id`| string | No | Notion page ID |
| `sync_status` | string | Yes | `pending` \| `synced` \| `failed` |

---

## Neo4j Graph Schema

### Node Labels
| Label | Purpose |
|-------|---------|
| `Insight` | Versioned knowledge insights |
| `Insight:KnowledgeItem` | Tagged knowledge items |
| `InsightHead` | Version tracking heads |
| `CodeFile` | Embedded code with vectors |
| `Entity` | Named entities |

### Relationship Types
| Type | Purpose |
|------|---------|
| `MENTIONS` | Entity mentions in content |
| `VERSION_OF` | Version chain links |
| `SUPERSEDES` | Knowledge lineage |

### Key Node Properties
**`Insight`:** `id`, `insight_id`, `group_id`, `status`, `confidence`, `version`, `content`, `summary`, `notion_page_id`, `promotion_status`

---

## Views

**`v_curator_pending`** — Curator polling view:
```sql
SELECT * FROM adas_runs r
WHERE r.fitness_score >= 0.7
  AND r.status = 'succeeded'
  AND r.promoted = false
  AND NOT EXISTS (
    SELECT 1 FROM curator_queue q
    WHERE q.run_id = r.run_id AND q.neo4j_written = true
  );
```

---

## Constraints Summary

| Store | Constraint | Description |
|-------|------------|-------------|
| PostgreSQL | `trg_promotion_guard` | Prevents `promoted = true` without `neo4j_written = true` |
| PostgreSQL | `chk_attempt_limit` | `attempt_count < 5` on `curator_queue` |
| PostgreSQL | `uniq_group_id` | `group_id` must be unique on `tenants` |
| PostgreSQL | Unique `run_id` | Each EvaluationHarness gets unique runId |
| Neo4j | `insight_id` required | All insights need identifier |
| Neo4j | `group_id` required | Tenant isolation enforced |
| Neo4j | `insight_id` + `group_id` unique | One head per insight per tenant |
