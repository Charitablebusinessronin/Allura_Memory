# Data Dictionary — roninmemory

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

Promoted from archive `roninmemory/DATA-DICTIONARY.md`. Updated to Allura v2 naming (`allura-*` tenant namespace, single-tier `group_id`).

---

## Table of Contents

- [PostgreSQL Tables](#postgresql-tables)
- [Neo4j Graph Schema](#neo4j-graph-schema)
- [Views](#views)
- [Constraints Summary](#constraints-summary)
- [Naming Conventions](#naming-conventions)
- [JSON Schemas](#json-schemas)

---

## PostgreSQL Tables

### `tenants`

Multi-tenant namespace isolation. One row per Allura workspace.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | Yes | Primary key |
| `group_id` | TEXT NOT NULL | Yes | Tenant namespace — must match `allura-{org}` pattern |
| `display_name` | string | Yes | Human-readable workspace name |
| `is_global` | boolean | Yes | Whether this is the platform-wide fallback tenant |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Yes | When tenant was created |

**`group_id` values (current workspaces)**

| Value | Workspace | Priority |
|-------|-----------|----------|
| `allura-faith-meats` | 🥩 Faith Meats | P1 |
| `allura-creative` | 🎨 Creative Studio | P2 |
| `allura-personal` | 👤 Personal Assistant | P2 |
| `allura-nonprofit` | 🏛️ Nonprofit | P3 |
| `allura-audits` | 🏦 Bank Audits | P3 |
| `allura-haccp` | 🌡️ HACCP | P3 |
| `allura-platform` | 🌐 Platform (global knowledge) | — |

---

### `events`

Append-only raw execution traces. System of record for the present. Never mutated after insert.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | Yes | Primary key — `gen_random_uuid()` |
| `event_type` | TEXT NOT NULL | Yes | `task-start` \| `tool-call` \| `checkpoint` \| `heartbeat` \| `evaluation_failed` |
| `group_id` | TEXT NOT NULL | Yes | Tenant key — enforced, must match `allura-{org}` |
| `agent_id` | TEXT NOT NULL | Yes | Originating agent identifier |
| `workflow_id` | TEXT | No | Workflow execution context (nullable for manual ops) |
| `payload` | JSONB NOT NULL | Yes | Event-specific data |
| `metadata` | JSONB | No | Optional key/value context |
| `timestamp` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | Yes | Event timestamp (UTC) |

```sql
CREATE INDEX ON events (group_id, timestamp);
CREATE INDEX ON events (agent_id);
```

---

### `adas_runs`

Raw execution traces from ADAS evolutionary search. Immutable after insert except `status` and `promoted`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `run_id` | uuid | Yes | Unique run identifier |
| `group_id` | TEXT NOT NULL | Yes | Tenant FK → `tenants.group_id` |
| `agent_id` | TEXT NOT NULL | Yes | Agent that produced this run |
| `workflow_id` | TEXT | No | Workflow execution context |
| `agent_design_json` | JSONB NOT NULL | Yes | Full agent design snapshot |
| `fitness_score` | numeric | Yes | Composite score 0.0–1.0 |
| `status` | TEXT NOT NULL | Yes | `pending` \| `running` \| `succeeded` \| `failed` |
| `promoted` | boolean | Yes | Whether Curator promoted to Neo4j |
| `evidence_ref` | TEXT[] | No | Linked Neo4j node IDs |
| `rule_version` | TEXT | No | Governance rule version active at write time |
| `human_override` | BOOLEAN NOT NULL DEFAULT false | Yes | Whether a human overrode automated logic |
| `override_actor` | TEXT | No | User ID of override actor |
| `started_at` | TIMESTAMPTZ NOT NULL | Yes | Run start timestamp |
| `finished_at` | TIMESTAMPTZ | No | Run completion timestamp |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Yes | Row creation timestamp |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Yes | Last mutation timestamp |

**`status` values**

| Value | Description |
|-------|-------------|
| `pending` | Created, not yet started |
| `running` | Currently executing |
| `succeeded` | Completed successfully (terminal) |
| `failed` | Completed with error (terminal) |

---

### `adas_trace_events`

Every event during ADAS evaluation — full audit trail for debugging and compliance.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event_id` | uuid | Yes | Unique event identifier |
| `run_id` | uuid | Yes | FK → `adas_runs.run_id` |
| `group_id` | TEXT NOT NULL | Yes | Tenant key (denormalized for isolation) |
| `agent_id` | TEXT NOT NULL | Yes | Agent that generated this event |
| `event_type` | varchar(50) | Yes | See event type catalogue below |
| `payload` | JSONB NOT NULL | Yes | Event-specific data |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Yes | Event timestamp (UTC) |

**`event_type` catalogue**

| Value | Description |
|-------|-------------|
| `evaluation_started` | Candidate evaluation began |
| `evaluation_completed` | Candidate evaluation finished |
| `evaluation_failed` | Candidate evaluation errored |
| `fitness_scored` | Fitness score computed |
| `promotion_proposed` | Score threshold met, proposal generated |
| `sandbox_created` | DinD sandbox spun up |
| `sandbox_destroyed` | DinD sandbox torn down |

---

### `adas_promotion_proposals`

HITL governance proposals — human must approve before any design can go live.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `proposal_id` | uuid | Yes | Unique proposal identifier |
| `group_id` | TEXT NOT NULL | Yes | Tenant key |
| `agent_id` | TEXT NOT NULL | Yes | Agent that generated this proposal |
| `design_id` | uuid | Yes | Candidate design UUID |
| `design_snapshot` | JSONB NOT NULL | Yes | Full design at proposal time |
| `status` | varchar(20) | Yes | `pending` \| `approved` \| `rejected` \| `modified` |
| `human_decision` | varchar(20) | No | `approved` \| `rejected` |
| `rule_version` | TEXT | No | Governance rule version at write time |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Yes | |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Yes | |

---

### `curator_queue`

2-phase commit state tracking for Curator promotion pipeline.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `queue_id` | uuid | Yes | Primary key |
| `run_id` | uuid | Yes | FK → `adas_runs.run_id` |
| `group_id` | TEXT NOT NULL | Yes | Tenant key (denormalized) |
| `neo4j_written` | boolean | Yes | Phase 1 complete flag |
| `neo4j_node_id` | string | No | Neo4j node ID from Phase 1 |
| `attempt_count` | integer | Yes | Retry counter (max 4) |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Yes | |

---

### `agents`

Agent registry with heartbeat and cost tracking.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | Yes | Primary key |
| `name` | string | Yes | Agent identifier — `Memory{Role}` convention (e.g. `MemoryOrchestrator`) |
| `group_id` | TEXT NOT NULL | Yes | Tenant FK — `allura-{org}` |
| `status` | TEXT NOT NULL | Yes | `active` \| `idle` \| `error` |
| `last_heartbeat` | TIMESTAMPTZ NOT NULL | Yes | Updated by `after_tool_call` hook |
| `token_cost_usd` | numeric NOT NULL DEFAULT 0 | Yes | Cumulative spend |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Yes | |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Yes | |

---

### `notion_sync_log`

Audit trail for Notion mirror operations.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `log_id` | uuid | Yes | Primary key |
| `run_id` | uuid | Yes | FK → `adas_runs.run_id` |
| `group_id` | TEXT NOT NULL | Yes | Tenant key |
| `notion_page_id` | string | No | Notion page ID (null if sync not yet attempted) |
| `sync_status` | TEXT NOT NULL | Yes | `pending` \| `synced` \| `failed` |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Yes | |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Yes | |

---

### `decisions`

Governance decisions with full provenance for regulator-grade audit queries.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | Yes | Primary key |
| `group_id` | TEXT NOT NULL | Yes | Tenant key |
| `agent_id` | TEXT NOT NULL | Yes | Agent that made the decision |
| `workflow_id` | TEXT | No | Workflow context |
| `rule_version` | TEXT | No | Active governance rule at decision time |
| `status` | TEXT NOT NULL | Yes | `pending` \| `active` \| `promoted` \| `archived` \| `rejected` |
| `human_override` | BOOLEAN NOT NULL DEFAULT false | Yes | Whether a human overrode automated logic |
| `override_actor` | TEXT | No | User ID of override actor |
| `evidence_ref` | TEXT[] | No | Linked Neo4j evidence node IDs |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Yes | |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Yes | |

---

### `audit_history`

Immutable before/after state log for regulatory compliance (Query 3 in tenant spec).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | Yes | Primary key |
| `entity_id` | uuid | Yes | ID of the affected entity |
| `entity_type` | TEXT NOT NULL | Yes | `insight` \| `decision` \| `adas_run` \| `agent` |
| `group_id` | TEXT NOT NULL | Yes | Tenant key |
| `agent_id` | TEXT NOT NULL | Yes | Agent that made the change |
| `operation` | TEXT NOT NULL | Yes | `create` \| `update` \| `promote` \| `reject` \| `override` |
| `old_status` | TEXT | No | Status before the transition |
| `new_status` | TEXT | No | Status after the transition |
| `rule_version` | TEXT | No | Governance rule version at change time |
| `human_override` | BOOLEAN NOT NULL DEFAULT false | Yes | |
| `override_actor` | TEXT | No | |
| `changed_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Yes | |
| `change_payload` | JSONB | No | Full change context |

---

### `rule_versions`

Governance rule version registry — enables Query 4 (rule version validation) from tenant spec.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | Yes | Primary key |
| `version` | TEXT NOT NULL | Yes | Rule version identifier |
| `description` | TEXT | No | What changed in this version |
| `effective_from` | TIMESTAMPTZ NOT NULL | Yes | When this version became active |
| `effective_to` | TIMESTAMPTZ | No | When this version was superseded (null = currently active) |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Yes | |

---

## Neo4j Graph Schema

### Node Labels

| Label | Purpose |
|-------|---------|
| `Insight` | Versioned knowledge nodes — core semantic memory |
| `Insight:KnowledgeItem` | Tagged knowledge items |
| `InsightHead` | Version tracking heads (one per `insight_id` per tenant) |
| `AgentDesign` | Promoted agent configurations from ADAS |
| `ProposedKnowledge` | Cross-tenant promotion candidates (`group_id = allura-platform`) |
| `CodeFile` | Code with embedded vectors |
| `Entity` | Named entities extracted from content |

### Required Properties on Every Node

```javascript
group_id:      String    // Must match allura-{org} pattern
agent_id:      String    // Originating agent
workflow_id:   String?   // Optional workflow context
status:        String
created_at:    DateTime
updated_at:    DateTime
rule_version:  String
evidence_refs: [String]
```

Tenant label: Every node also receives `TenantScope_<group_id>` (e.g. `TenantScope_allura_faith_meats`) for defense-in-depth index-backed isolation.

### Relationship Types

| Type | Purpose |
|------|---------|
| `SUPERSEDES` | Knowledge lineage — old truth superseded, never deleted |
| `VERSION_OF` | Version chain links |
| `MENTIONS` | Entity references in content |
| `CONTRIBUTED` | Agent → Insight contribution trail |
| `LEARNED` | Agent session learning trace |
| `DECIDED` | Agent → Decision lineage |
| `COLLABORATED_WITH` | Agent → Agent collaboration |
| `INCLUDES` | AgentGroup membership |
| `KNOWS` | Agent knowledge relationships |
| `DERIVED_FROM` | ProposedKnowledge → source Insight (Overseer-visible only) |

### Required Properties on Every Relationship

```javascript
group_id:   String
created_at: DateTime
agent_id:   String
promoted:   Boolean
```

### `Insight` Node — Full Schema

```javascript
CREATE (i:Insight:TenantScope_allura_faith_meats {
  id:               randomUUID(),
  insight_id:       String,       // stable identifier across versions
  group_id:         "allura-faith-meats",
  title:            String,
  content:          String,
  status:           "Active",     // Active | Degraded | Expired | Superseded
  confidence:       0.92,         // 0.0–1.0
  version:          Integer,
  category:         String,
  source_type:      String,
  source_ref:       String,
  notion_page_id:   String?,
  promotion_status: String,
  promoted_at:      DateTime?,
  rule_version:     String,
  evidence_refs:    [String],
  StartDate:        datetime(),
  EndDate:          null          // set when SUPERSEDED
})
```

### State Machines

| Entity | States |
|--------|--------|
| **Insight** (knowledge validity) | `active` → `degraded` → `expired` \| `superseded` |
| **AgentDesign** (ADAS pipeline) | `draft` → `evaluating` → `ranked` → `proposed` → `approved` → `promoted` \| `rejected` |
| **ADAS Run** (execution) | `pending` → `running` → `succeeded` \| `failed` |
| **ProposedKnowledge** (cross-tenant) | `proposed` → `curator_review` → `approved` → `abstracted` → `published` \| `rejected` |

---

## Views

### `v_curator_pending`

Curator polling view — surfaces eligible runs for promotion.

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
| PostgreSQL | `trg_auto_enqueue_curator` | Auto-enqueues eligible runs to `curator_queue` |
| PostgreSQL | `chk_attempt_limit` | `attempt_count < 5` on `curator_queue` |
| PostgreSQL | `uniq_group_id` | `group_id` unique on `tenants` |
| PostgreSQL | NOT NULL `group_id` | Every table — tenant isolation enforced at schema level |
| PostgreSQL | NOT NULL `agent_id` | Every table — agent provenance required |
| Neo4j | `group_id` required | On all nodes |
| Neo4j | `TenantScope_*` label | Defense-in-depth on all nodes |
| Neo4j | `insight_id` + `group_id` unique | One InsightHead per insight per tenant |

---

## Naming Conventions

| System | Convention | Example |
|--------|------------|---------|
| PostgreSQL fields | `snake_case` | `group_id`, `run_id`, `agent_design_json` |
| Neo4j properties | `snake_case` | `group_id`, `insight_id`, `created_at` |
| Tenant keys | `allura-{org}` | `allura-faith-meats`, `allura-audits` |
| Agent identifiers | `Memory{Role}` | `MemoryOrchestrator`, `MemoryBuilder` |

**Critical:** Always `group_id` (snake_case). Never `groupId` (camelCase) in queries or code.

**Deprecated:** `organization_id` (old two-tier model). All tenant isolation is now single-tier via `group_id` with the `allura-*` namespace.

---

## JSON Schemas

Canonical schemas in `json-schema/`:

| Schema | Purpose |
|--------|---------|
| `insight.schema.json` | Insight node structure |
| `agent-design.schema.json` | ADAS candidate design |
| `tenant.schema.json` | Multi-tenant namespace |
| `audit-event.schema.json` | Compliance audit trail |
