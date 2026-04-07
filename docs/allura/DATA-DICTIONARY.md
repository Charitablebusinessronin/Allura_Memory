# Data Dictionary: Allura Data Models

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> When in doubt, defer to the source code, schemas, and team consensus.

This document describes every table and node type in Allura's dual-database data model. PostgreSQL holds episodic memory (append-only event log). Neo4j holds semantic memory (versioned knowledge graph).

---

## Table of Contents

- [PostgreSQL: events](#postgresql-events)
- [Neo4j: Memory](#neo4j-memory)
- [Neo4j: Relationships](#neo4j-relationships)
- [Metadata Payloads](#metadata-payloads)

---

## PostgreSQL: `events`

The primary and only append-only log. Every memory operation — add, search, get, list, delete, promotion — produces one row. Rows are permanent. No UPDATE or DELETE, ever.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | bigserial | Yes | Auto-increment primary key |
| `group_id` | varchar(255) | Yes | Tenant namespace. CHECK constraint: must match `^allura-` |
| `event_type` | varchar(100) | Yes | Operation type — see values below |
| `agent_id` | varchar(255) | Yes | Identifier of the agent or user who triggered the event |
| `workflow_id` | varchar(255) | No | Optional grouping for multi-step workflows |
| `status` | varchar(50) | Yes | Default: `completed`. See values below |
| `metadata` | jsonb | No | Event-specific payload — see Metadata Payloads section |
| `created_at` | timestamptz | Yes | Write timestamp. DEFAULT NOW(). Immutable. |

**`event_type` values**

| Value | Description |
|-------|-------------|
| `memory_add` | A memory was written by an agent |
| `memory_search` | A search query was executed |
| `memory_get` | A single memory was fetched by ID |
| `memory_list` | All memories for a user were listed |
| `memory_delete` | A memory was soft-deleted |
| `memory_promoted` | A memory was successfully promoted to Neo4j |
| `promotion_failed` | Neo4j write failed — episodic record retained |
| `promotion_queued` | SOC2 mode — memory queued for human approval |
| `session_start` | Agent session began |
| `health_check` | System health check performed |

**`status` values**

| Value | Description |
|-------|-------------|
| `completed` | Operation succeeded |
| `failed` | Operation failed — see metadata.error |
| `pending` | Operation in progress or awaiting human action |

---

## Neo4j: `Memory`

Curated, promoted knowledge. Created via `MERGE`. Never edited after creation. Versioned via `SUPERSEDES` relationships.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string (UUID) | Yes | Unique identifier. Generated at promotion time. |
| `group_id` | string | Yes | Tenant namespace. Must match `^allura-`. |
| `user_id` | string | Yes | Memory owner — scoped within the tenant |
| `content` | string | Yes | The memory text |
| `score` | float | Yes | Confidence/relevance score (0.0–1.0) |
| `deprecated` | boolean | Yes | `true` when a newer version supersedes this node. Default: `false` |
| `created_at` | datetime | Yes | UTC timestamp of node creation |
| `source_event_id` | string | No | ID of the originating `events` row in Postgres |

**`deprecated` values**

| Value | Description |
|-------|-------------|
| `false` | Active — this is the current version |
| `true` | Superseded — a newer `Memory` node exists with a `SUPERSEDES` edge pointing here |

---

## Neo4j: Relationships

| Relationship | Pattern | Description |
|---|---|---|
| `SUPERSEDES` | `(v2:Memory)-[:SUPERSEDES]->(v1:Memory)` | v1 must be marked `deprecated: true`. v2 is the current version. Never edit v1. |

**SUPERSEDES invariants:**
- A node with `deprecated: true` MUST have exactly one incoming `SUPERSEDES` edge
- A node with `deprecated: false` MUST have zero incoming `SUPERSEDES` edges (it is the head)
- The chain is traversable: `MATCH (head)-[:SUPERSEDES*]->(ancestor)` retrieves full lineage

---

## Metadata Payloads

The `metadata` JSONB column in `events` carries event-specific data. Shapes by `event_type`:

### `memory_add`

```jsonc
{
  "content": "User prefers dark mode",
  "user_id": "user-123",
  "score": 0.91,
  "stored": "both",           // "episodic" | "both" | "episodic+pending"
  "neo4j_id": "uuid",         // present if promoted
  "pending_review": false     // true if SOC2 mode queued
}
```

### `memory_search`

```jsonc
{
  "query": "user preferences",
  "user_id": "user-123",
  "result_count": 5,
  "sources": ["postgres", "neo4j"]
}
```

### `memory_delete`

```jsonc
{
  "memory_id": "uuid",
  "user_id": "user-123",
  "neo4j_deprecated": true    // false if memory was episodic-only
}
```

### `memory_promoted`

```jsonc
{
  "source_event_id": "12345",
  "neo4j_id": "uuid",
  "score": 0.91,
  "user_id": "user-123",
  "mode": "auto"              // "auto" | "manual"
}
```

### `promotion_failed`

```jsonc
{
  "source_event_id": "12345",
  "score": 0.91,
  "error": "Neo4j connection timeout",
  "fallback": "episodic_only"
}
```

**Redacted fields:** passwords, API keys, tokens, and any PII beyond `user_id` MUST NOT appear in `metadata`.
