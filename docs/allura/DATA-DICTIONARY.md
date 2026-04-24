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
- [Neo4j: Agent](#neo4j-agent)
- [Neo4j: Team](#neo4j-team)
- [Neo4j: Project](#neo4j-project)
- [Neo4j: Relationships](#neo4j-relationships)
- [Metadata Payloads](#metadata-payloads)

---

## PostgreSQL: `events`

**JSON Schema:** [`json-schema/event.schema.json`](../../json-schema/event.schema.json)

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

**JSON Schema:** [`json-schema/memory.schema.json`](../../json-schema/memory.schema.json)

Curated, promoted knowledge. Created via `MERGE`. Never edited after creation. Versioned via `SUPERSEDES` relationships.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string (UUID) | Yes | Unique identifier. Generated at promotion time. |
| `name` | string | Yes | Short descriptive title for the memory |
| `group_id` | string | Yes | Tenant namespace. Must match `^allura-`. |
| `category` | string | Yes | Memory classification — see values below |
| `type` | string | Yes | Memory type — see values below |
| `confidence` | float | Yes | Confidence score (0.0–1.0) |
| `tags` | list\<string\> | No | Freeform tags for retrieval filtering |
| `content` | string | Yes | The memory text |
| `source` | string | Yes | Origin of the memory — see values below |
| `notion_id` | string | No | Notion page ID for bidirectional traceability |
| `status` | string | Yes | Node lifecycle status — see values below |
| `score` | float | Yes | Confidence/relevance score (0.0–1.0) |
| `deprecated` | boolean | Yes | `true` when a newer version supersedes this node. Default: `false` |
| `created_at` | datetime | Yes | UTC timestamp of node creation |
| `source_event_id` | string | No | ID of the originating `events` row in Postgres |
| `purpose` | string | No | Intended use of the memory |
| `core_structure` | string | No | Structural template or pattern the memory follows |
| `knowledge_rules` | string | No | Rules governing how this memory should be used |

**`category` values**

| Value | Description |
|-------|-------------|
| `decision` | Architectural or design decision |
| `pattern` | Recurring pattern or practice |
| `rule` | Constraint or rule to follow |
| `fact` | Verified fact about the system |
| `lesson` | Lesson learned from experience |
| `insight` | Curated insight from trace analysis |
| `preference` | User or team preference |
| `standard` | Standard or guideline |

**`type` values**

| Value | Description |
|-------|-------------|
| `procedural` | How-to or process knowledge |
| `declarative` | Factual knowledge |
| `strategic` | High-level strategy or direction |
| `operational` | Day-to-day operational knowledge |

**`source` values**

| Value | Description |
|-------|-------------|
| `notion` | Imported from Notion knowledge base |
| `curator` | Created by curator from trace analysis |
| `manual` | Manually added |
| `conversation` | Extracted from conversation context |

**`status` values**

| Value | Description |
|-------|-------------|
| `active` | Current and retrievable |
| `deprecated` | Superseded by a newer version |
| `pending` | Awaiting approval |

**`deprecated` values**

| Value | Description |
|-------|-------------|
| `false` | Active — this is the current version |
| `true` | Superseded — a newer `Memory` node exists with a `SUPERSEDES` edge pointing here |

---

## Neo4j: `Agent`

**JSON Schema:** [`json-schema/agent.schema.json`](../../json-schema/agent.schema.json)

Structural context node representing an AI agent in the team. Agents are members of Teams, contribute to Projects, and author Memory nodes. Seeded via `scripts/neo4j-seed-agents.cypher`.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique agent identifier (e.g. `brooks`, `pike`) |
| `name` | string | Yes | Human-readable agent name |
| `persona` | string | Yes | Agent persona description |
| `team` | string | Yes | Team name this agent belongs to |
| `category` | string | Yes | Agent classification — see values below |
| `type` | string | Yes | Agent type — see values below |
| `scope` | string | Yes | Operational scope — see values below |
| `platform` | string | Yes | Platform this agent runs on — see values below |
| `status` | string | Yes | Agent lifecycle status — see values below |
| `group_id` | string | Yes | Tenant namespace. Must match `^allura-`. |
| `description` | string | No | Extended description of the agent's role |

**`category` values**

| Value | Description |
|-------|-------------|
| `ram` | RAM team agent (engineering/execution) |
| `durham` | Durham team agent (creative/content) |
| `governance` | Governance/oversight agent |
| `ship` | Ship-level operational agent |

**`type` values**

| Value | Description |
|-------|-------------|
| `executor` | Task execution agent |
| `reviewer` | Review/audit agent |
| `curator` | Curation/approval agent |
| `orchestrator` | Orchestration/routing agent |
| `specialist` | Domain specialist agent |
| `creative` | Creative/content agent |

**`scope` values**

| Value | Description |
|-------|-------------|
| `project` | Scoped to a single project |
| `team` | Scoped to a team |
| `global` | Cross-team scope |

**`platform` values**

| Value | Description |
|-------|-------------|
| `openclaw` | Runs on OpenClaw |
| `claude` | Runs on Claude Code |
| `cursor` | Runs on Cursor |
| `opencode` | Runs on OpenCode |

**`status` values**

| Value | Description |
|-------|-------------|
| `active` | Currently operational |
| `inactive` | Temporarily disabled |
| `retired` | Permanently removed from rotation |

---

## Neo4j: `Team`

**JSON Schema:** [`json-schema/team.schema.json`](../../json-schema/team.schema.json)

Structural context node representing a team of agents. Seeded via `scripts/neo4j-seed-agents.cypher`.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique team identifier (e.g. `ram`, `durham`) |
| `name` | string | Yes | Human-readable team name |
| `group_id` | string | Yes | Tenant namespace. Must match `^allura-`. |
| `icon` | string | No | Emoji or icon identifier for the team |
| `description` | string | No | Team description and purpose |

---

## Neo4j: `Project`

**JSON Schema:** [`json-schema/project.schema.json`](../../json-schema/project.schema.json)

Structural context node representing a project that agents contribute to and memories relate to. Seeded via `scripts/neo4j-seed-agents.cypher`.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique project identifier (e.g. `allura-memory`) |
| `name` | string | Yes | Human-readable project name |
| `group_id` | string | Yes | Tenant namespace. Must match `^allura-`. |
| `status` | string | Yes | Project lifecycle status — see values below |
| `description` | string | No | Project description and scope |

**`status` values**

| Value | Description |
|-------|-------------|
| `active` | Currently in development |
| `planned` | Planned but not started |
| `complete` | Finished and delivered |
| `on-hold` | Temporarily paused |

---

## Neo4j: Relationships

| Relationship | Pattern | Cardinality | Description |
|---|---|---|---|
| `SUPERSEDES` | `(v2:Memory)-[:SUPERSEDES]->(v1:Memory)` | Many-to-one | v1 must be marked `deprecated: true`. v2 is the current version. Never edit v1. |
| `AUTHORED_BY` | `(m:Memory)-[:AUTHORED_BY]->(a:Agent)` | Many-to-one | Links a Memory to the Agent that authored it. |
| `RELATES_TO` | `(m:Memory)-[:RELATES_TO]->(p:Project)` | Many-to-many | Links a Memory to a Project it relates to. |
| `MEMBER_OF` | `(a:Agent)-[:MEMBER_OF]->(t:Team)` | Many-to-one | Agent is a member of a Team. |
| `CONTRIBUTES_TO` | `(a:Agent)-[:CONTRIBUTES_TO]->(p:Project)` | Many-to-many | Agent contributes to a Project. |
| `DELEGATES_TO` | `(a:Agent)-[:DELEGATES_TO]->(b:Agent)` | Many-to-many | Chain of command: Agent a delegates work to Agent b. |
| `ESCALATES_TO` | `(a:Agent)-[:ESCALATES_TO]->(b:Agent)` | Many-to-many | Escalation path: Agent a escalates to Agent b. |
| `HANDS_OFF_TO` | `(a:Agent)-[:HANDS_OFF_TO]->(b:Agent)` | Many-to-many | Creative flow handoff (Durham team pattern). |
| `PROPOSES_TO` | `(a:Agent)-[:PROPOSES_TO]->(b:Agent)` | One-to-one | Curator proposes to Auditor for approval. |
| `APPROVES_PROMOTION` | `(a:Agent)-[:APPROVES_PROMOTION]->(b:Agent)` | One-to-one | Auditor approves promotion back to Curator. |

**SUPERSEDES invariants:**
- A node with `deprecated: true` MUST have exactly one incoming `SUPERSEDES` edge
- A node with `deprecated: false` MUST have zero incoming `SUPERSEDES` edges (it is the head)
- The chain is traversable: `MATCH (head)-[:SUPERSEDES*]->(ancestor)` retrieves full lineage

**AUTHORED_BY invariants:**
- Every Memory node SHOULD have at least one `AUTHORED_BY` edge to an Agent
- An Agent may author many Memory nodes
- The Agent referenced MUST exist as an `Agent` node

**RELATES_TO invariants:**
- A Memory node may relate to zero or more Projects
- The Project referenced MUST exist as a `Project` node

**MEMBER_OF invariants:**
- Every Agent SHOULD belong to exactly one Team
- A Team contains one or more Agents

**DELEGATES_TO / ESCALATES_TO / HANDS_OFF_TO invariants:**
- These relationships form directed graphs between Agents
- No cycles: a delegation chain must not loop back to the originator
- `HANDS_OFF_TO` is specific to the Durham creative flow pattern

**PROPOSES_TO / APPROVES_PROMOTION invariants:**
- These form a bidirectional governance pair between Curator and Auditor roles
- `PROPOSES_TO`: Curator → Auditor (submission for review)
- `APPROVES_PROMOTION`: Auditor → Curator (approval granted)

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
