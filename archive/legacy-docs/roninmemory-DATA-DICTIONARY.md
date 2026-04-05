# roninmemory Data Dictionary

Complete field definitions for all PostgreSQL tables and Neo4j node types.

***

## 1. PostgreSQL Tables

### `tenants`

Multi-tenant namespace isolation. Every row in Postgres carries a `group_id` FK to this table.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | Yes | Primary key |
| `group_id` | string | Yes | Tenant namespace (e.g. `faith-meats`, `global-coding-skills`) |
| `display_name` | string | Yes | Human-readable tenant name |
| `is_global` | boolean | Yes | Whether this is the global fallback tenant |
| `created_at` | datetime | Yes | When tenant was created |

**Constraints:**
- `group_id` must be unique
- Exactly one row with `is_global = true`

---

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
| `finished_at` | datetime | No | Run completion timestamp |
| `source` | string | No | Source tag (e.g. `smoke-test`) |

**Triggers:**
- `trg_auto_enqueue_curator` — fires when `fitness_score >= 0.7` AND `status = succeeded`

---

### `curator_queue`

Curator promotion queue. Tracks 2-phase commit state.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `queue_id` | uuid | Yes | Primary key |
| `run_id` | uuid | Yes | FK → `adas_runs.run_id` |
| `fitness_score` | numeric | Yes | Cached score at enqueue time |
| `neo4j_written` | boolean | Yes | Phase 1 complete flag |
| `neo4j_node_id` | string | No | Neo4j node ID from Phase 1 |
| `attempt_count` | integer | Yes | Retry counter (max 4) |
| `enqueued_at` | datetime | Yes | When entry was created |
| `resolved_at` | datetime | No | When Phase 2 committed |

**Constraints:**
- `trg_promotion_guard` — enforces `neo4j_written = true` before `adas_runs.promoted = true`

---

### `agents`

Agent registry with heartbeat and cost tracking.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | Yes | Primary key |
| `name` | string | Yes | Agent identifier |
| `group_id` | string | Yes | Tenant FK |
| `status` | string | Yes | `active` \| `idle` \| `error` |
| `last_heartbeat` | datetime | Yes | Updated by `after_tool_call` hook |
| `token_cost_usd` | numeric | Yes | Cumulative cost across all sessions |
| `tasks_completed` | integer | Yes | Count of successful task completions |
| `tasks_failed` | integer | Yes | Count of failed tasks |

**Updated by:** `after_tool_call` hook after every tool execution

---

### `notion_sync_log`

Audit trail for Notion mirror operations.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `log_id` | uuid | Yes | Primary key |
| `run_id` | uuid | Yes | FK → `adas_runs.run_id` |
| `notion_page_id` | string | No | Notion page ID after successful sync |
| `sync_status` | string | Yes | `pending` \| `synced` \| `failed` |
| `synced_at` | datetime | No | When sync completed |
| `error_message` | text | No | Error details if failed |

---

## 2. Neo4j Graph Schema

Based on live graph inspection (Phase 0):

### Node Labels

| Label | Purpose | Count (approx) |
|-------|---------|----------------|
| `Insight` | Versioned knowledge insights | 5+ |
| `Insight:KnowledgeItem` | Tagged knowledge items | 5+ |
| `InsightHead` | Version tracking heads | 5+ |
| `CodeFile` | Embedded code with vectors | — |
| `Entity` | Named entities | — |
| `Module` | Software modules | — |
| `Platform` | Technology platforms | — |
| `Test` | Test entities | 1 |

### Relationship Types

| Type | Purpose | Count |
|------|---------|-------|
| `MENTIONS` | Entity mentions in content | — |
| `VERSION_OF` | Version chain links | 6 |

### Node Properties by Label

#### `Insight`

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | UUID (may be NULL for older nodes) |
| `insight_id` | string | Unique insight identifier |
| `group_id` | string | Tenant namespace |
| `status` | string | `active` \| `promoted` |
| `confidence` | float | 0.0–1.0 confidence score |
| `version` | integer | Version number (1, 2, 3...) |
| `content` | string | Full insight content |
| `summary` | string | Brief description |
| `source_type` | string | Origin (e.g., `adas`, `manual`) |
| `source_ref` | string | Reference to source data |
| `notion_page_id` | string | Linked Notion page |
| `promotion_status` | string | Promotion state |
| `promoted_at` | datetime | When promoted |
| `created_at` | datetime | When created |
| `updated_at` | datetime | Last update |

#### `Insight:KnowledgeItem`

Extends `Insight` with additional properties:

| Property | Type | Description |
|----------|------|-------------|
| `tags` | string[] | Array of category tags |
| `notion_url` | string | Direct Notion URL |
| `promoted_at` | datetime | Promotion timestamp |

#### `InsightHead`

| Property | Type | Description |
|----------|------|-------------|
| `insight_id` | string | Unique insight identifier |
| `group_id` | string | Tenant namespace |
| `current_version` | integer | Latest version number |
| `current_id` | string | UUID of current version node |
| `created_at` | datetime | When head was created |
| `updated_at` | datetime | When current version changed |

#### `CodeFile`

| Property | Type | Description |
|----------|------|-------------|
| `path` | string | File system path |
| `content` | string | File contents |
| `embedding` | float[] | Vector embedding |
| `model` | string | Embedding model used |
| `embedded_at` | datetime | When embedded |

#### `Test`

| Property | Type | Description |
|----------|------|-------------|
| `entity_id` | string | Test identifier |
| `name` | string | Test name |
| `properties` | map | Additional test properties |
| `created_at` | datetime | When created |

### Relationship Properties

#### `VERSION_OF`

| Property | Type | Description |
|----------|------|-------------|
| `version` | integer | Version number of target |
| `created_at` | datetime | When relationship created |

---

## 3. Views

### `v_curator_pending`

Curator polling view — shows eligible runs not yet promoted.

```sql
SELECT *
FROM adas_runs r
WHERE r.fitness_score >= 0.7
  AND r.status = 'succeeded'
  AND r.promoted = false
  AND NOT EXISTS (
    SELECT 1 FROM curator_queue q
    WHERE q.run_id = r.run_id
      AND q.neo4j_written = true
  );
```

### `v_sync_drift`

Shows insights promoted in Neo4j but not yet synced to Notion.

```cypher
MATCH (i:Insight)
WHERE i.promoted_to_notion = false
  OR i.promoted_to_notion IS NULL
  AND i.status = 'promoted'
RETURN i.insight_id, i.group_id, i.promoted_at
```

---

## 4. Constraints

### PostgreSQL

| Table | Constraint | Description |
|-------|------------|-------------|
| `adas_runs` | `trg_promotion_guard` | Prevents `promoted = true` without `neo4j_written = true` |
| `curator_queue` | `chk_attempt_limit` | `attempt_count < 5` |
| `tenants` | `uniq_group_id` | `group_id` must be unique |
| `tenants` | `chk_one_global` | Exactly one `is_global = true` |

### Neo4j

| Label | Constraint | Description |
|-------|------------|-------------|
| `Insight` | `insight_id` must exist | All insights need identifier |
| `Insight` | `group_id` must exist | Tenant isolation enforced |
| `InsightHead` | `insight_id` + `group_id` unique | One head per insight per tenant |

---

## 5. Migration Notes

### Adding new node labels

1. Run Phase 0 inspect to see current state
2. Add label to this dictionary
3. Update `inspect-graph.cypher` to query new label
4. Create migration script in `postgres-init/`
5. Test with Phase 2 smoke test

### Schema Changes

- **PostgreSQL:** Use `postgres-init/` migration files
- **Neo4j:** Additive only — never remove properties
- **Both:** Update this dictionary before applying changes

---

*Last updated: March 2026 from Phase 0 inspect-graph results*
