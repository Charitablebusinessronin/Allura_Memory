# Allura Architecture

This document describes Allura's system architecture, components, data flow, and design decisions.

---

## Table of Contents

- [System Overview](#system-overview)
- [Core Concepts](#core-concepts)
- [Component Architecture](#component-architecture)
- [Data Flow](#data-flow)
- [Storage Layer](#storage-layer)
- [Governance & Promotion](#governance--promotion)
- [Multi-Tenancy](#multi-tenancy)
- [Key Invariants](#key-invariants)

---

## System Overview

Allura is built on a **dual-database architecture** that separates raw execution traces (PostgreSQL) from curated knowledge (Neo4j).

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Agent                                │
│         (Claude, Cursor, OpenCode, etc.)                   │
└────────────────────────┬────────────────────────────────────┘
                         │ (MCP Protocol)
                         ↓
            ┌────────────────────────────┐
            │    Memory Engine           │
            │  1. Validate group_id      │
            │  2. Score content (0-1)    │
            │  3. Route to storage       │
            │  4. Dedup prevention       │
            │  5. Circuit breaker        │
            └────────┬───────────────────┘
                     │
        ┌────────────┼────────────────┐
        ↓            ↓                ↓
  ┌──────────┐ ┌──────────┐  ┌─────────────┐
  │PostgreSQL│ │  Neo4j   │  │   Curator   │
  │Episodic  │ │ Semantic │  │ (HITL Gate) │
  └──────────┘ └──────────┘  └─────────────┘
```

---

## Core Concepts

### Memory

A **memory** is a unit of information that an AI agent stores about a user or context. Every memory goes through a state machine:

```
1. Episodic Only      (score < 0.85)
   ↓
2. Pending Review     (score ≥ 0.85, SOC2 mode)
   ↓ [curator approval]
3. Both Stores        (PostgreSQL + Neo4j)
```

**Confidence Score (0.0–1.0):**
- 0.0–0.49: Low confidence → episodic only (no promotion candidate)
- 0.50–0.84: Medium confidence → episodic + eligible for manual promotion
- 0.85–1.0: High confidence → auto-queue for promotion (SOC2) or immediate promotion (auto mode)

### Episodic Memory (PostgreSQL)

Raw execution traces. **Append-only. Immutable. Never deleted.**

```sql
events (
  id:        bigserial (auto-increment)
  group_id:  varchar (e.g., "allura-myproject")
  event_type: varchar (e.g., "memory_add", "memory_promoted")
  agent_id:  varchar (source agent)
  metadata:  jsonb (payload)
  created_at: timestamptz (immutable)
)
```

Every memory write creates one `memory_add` event. If it gets promoted, a separate `memory_promoted` event is appended. Soft-deletes create a `memory_delete` event.

### Semantic Memory (Neo4j)

Curated, versioned knowledge. **All updates create new nodes.**

```cypher
(m:Memory {
  id:         "mem_...",
  group_id:   "allura-myproject",
  content:    "...",
  score:      0.92,
  deprecated: false,
  created_at: "2026-04-07T06:30:00Z"
})

(v2:Memory)-[:SUPERSEDES]->(v1:Memory)
```

When a memory needs updating:
1. Create a new `Memory` node
2. Link `(v2)-[:SUPERSEDES]->(v1)`
3. Mark v1 as `deprecated: true`
4. Never edit v1

This provides full versioning history and prevents accidental data loss.

---

## Component Architecture

### MCP Server (`src/mcp/memory-server.ts`)

Exposes 5 memory tools over the Model Context Protocol (stdio transport).

**Tools:**
- `memory_add(content, userId, metadata?)`
- `memory_search(query, userId, limit?)`
- `memory_get(memoryId)`
- `memory_list(userId, limit?, offset?)`
- `memory_delete(memoryId)`

**Validation:**
- Every request must include `group_id` (derived from environment or passed explicitly)
- Missing/invalid `group_id` → 400 error
- Content validation via Zod schemas

### Memory Engine (`src/lib/memory/`)

Core business logic:

1. **Scorer**: Computes confidence (0–1) via semantic similarity + agent metadata
2. **Router**: Determines: episodic-only vs. pending-review vs. both-stores
3. **Deduplicator**: Prevents duplicate Neo4j nodes (same content, same user, same group)
4. **Promoter**: Moves high-confidence traces from PostgreSQL to Neo4j (curator-gated)
5. **Searcher**: Federated search (PostgreSQL full-text + Neo4j semantic), merged by relevance

### Curator (`src/curator/`)

HITL approval workflow for promotion:

1. High-confidence traces (score ≥ 0.85) enter `proposals` queue
2. Curator reviews via dashboard: `/admin/pending`
3. Curator approves → Memory Engine writes to Neo4j + logs `memory_promoted` event
4. Curator rejects → Event logged, trace stays episodic-only

### PostgreSQL Client (`src/integrations/postgres.client.ts`)

- Connection pooling + retry logic
- Append-only write guardrails (no UPDATE/DELETE on events table)
- `group_id` validation at every query boundary

### Neo4j Client (`src/integrations/neo4j.client.ts`)

- Connection pooling + query parameterization
- `SUPERSEDES` relationship management
- Deprecation flag handling

---

## Data Flow

### Write Path (memory_add)

```
Agent calls memory_add("content", userId, metadata)
  ↓
MCP Server validates request
  - Validate group_id (CHECK constraint)
  - Validate content (not null, < 10KB)
  - Validate metadata (JSON schema)
  ↓
Memory Engine scores content
  - Semantic similarity to existing memories
  - Token overlap analysis
  - Agent confidence metadata
  - Result: confidence score (0–1)
  ↓
Router decision
  - score < 0.85? → Episodic only, return
  - score ≥ 0.85 + SOC2 mode? → Insert into proposals, return pending_review
  - score ≥ 0.85 + auto mode? → Promote immediately
  ↓
INSERT event into PostgreSQL
  - event_type: "memory_add"
  - metadata contains content, score, reasoning
  - created_at: NOW() (immutable)
  ↓
[If promotion eligible]
  Deduplicator checks Neo4j
    - Query: (m:Memory {group_id, user_id, content})
    - If found + score within threshold → return existing ID, stop
    - Else → proceed to promotion
  ↓
[If SOC2 mode]
  INSERT proposal
    - curator_id: NULL
    - approved_at: NULL
    - status: PENDING
  ↓
[If auto mode]
  MERGE Memory node into Neo4j
    - INSERT (m:Memory) with all properties
    - INSERT event: "memory_promoted"
  ↓
Return to agent
  - { id, status, stored }
```

### Search Path (memory_search)

```
Agent calls memory_search("query", userId, limit)
  ↓
Parallel: PostgreSQL search + Neo4j search
  ↓
PostgreSQL:
  - Full-text search on events.metadata->>'content'
  - WHERE group_id = ? AND deleted = false
  - LIMIT + OFFSET for pagination
  ↓
Neo4j:
  - Semantic embedding query
  - WHERE m.group_id = ? AND m.deprecated = false
  - MATCH (m)-[:FOR_USER]->(u {id: userId})
  - Relevance ranking
  ↓
Merge results
  - De-duplicate (same content, different sources)
  - Semantic results win on conflict
  - Sort by relevance + recency
  ↓
Return to agent
  - [{ id, content, source, score, created, used_count }]
```

---

## Storage Layer

### PostgreSQL (Episodic)

**Primary Table: `events`**

```sql
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  group_id VARCHAR(255) NOT NULL CHECK (group_id ~ '^allura-'),
  event_type VARCHAR(100) NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  workflow_id VARCHAR(255) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'completed',
  metadata JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_events_group_id_created ON events(group_id, created_at DESC);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_metadata_gin ON events USING GIN(metadata);
```

**Secondary Table: `proposals` (curator queue)**

```sql
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id VARCHAR(255) NOT NULL CHECK (group_id ~ '^allura-'),
  event_id BIGINT NOT NULL REFERENCES events(id),
  memory_id UUID NULL,  -- populated after curator approval
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  curator_id VARCHAR(255) NULL,
  notes TEXT NULL,
  approved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Invariants:**
- No row ever updated or deleted
- Every row has immutable `created_at`
- `group_id` enforced by CHECK constraint
- Full audit trail is implicit (just read `events`)

### Neo4j (Semantic)

**Node: `Memory`**

```cypher
MERGE (m:Memory {
  id: apoc.create.uuid(),
  group_id: "allura-myproject",
  user_id: "sabir",
  content: "...",
  score: 0.92,
  deprecated: false,
  created_at: datetime(),
  promoted_at: datetime()
})

// Relationships
(m)-[:FOR_USER]->(u:User {id: user_id})
(m2)-[:SUPERSEDES]->(m1)  -- versioning
```

**Invariants:**
- `deprecated` flag prevents stale node usage
- `SUPERSEDES` chain provides version history
- Nodes are never edited; updates create new nodes
- Queries filter out `deprecated: true` nodes

---

## Governance & Promotion

### Promotion Mode: SOC2 (Default)

**High Compliance. Human approval required.**

```
Memory created (score 0.92)
  ↓
Router: score ≥ 0.85? YES
Router: PROMOTION_MODE? SOC2
  ↓
INSERT into proposals (status: PENDING)
  ↓
Curator dashboard: /admin/pending
  ↓
Curator clicks APPROVE
  ↓
MERGE into Neo4j
INSERT event: memory_promoted
  ↓
Response to agent: { status: "promoted", stored: "both" }
```

### Promotion Mode: Auto

**Low Friction. For consumer use cases only.**

```
Memory created (score 0.92)
  ↓
Router: score ≥ 0.85? YES
Router: PROMOTION_MODE? auto
  ↓
MERGE into Neo4j immediately
INSERT event: memory_promoted
  ↓
Response to agent: { status: "promoted", stored: "both" }
```

### Deduplication

Before any Neo4j write, query for duplicates:

```cypher
MATCH (existing:Memory)
WHERE existing.group_id = $group_id
  AND existing.user_id = $user_id
  AND existing.content = $content
  AND existing.deprecated = false
RETURN existing.id
```

If found + score within `DUPLICATE_THRESHOLD`: return existing ID, skip write.

---

## Multi-Tenancy

### Tenant Isolation

**Hard boundary via schema-level CHECK constraint:**

```sql
ALTER TABLE events
ADD CONSTRAINT group_id_format
CHECK (group_id ~ '^allura-');
```

**Rules:**
- Every read/write **must** include valid `group_id`
- Invalid `group_id` → database constraint error (not application error)
- No application-layer bypass possible
- Soft-tenancy (row-level security) not used; schema enforcement is stronger

### Example: Tenant "allura-bank-lending"

```
Agent A (group_id: allura-bank-lending)
  ↓ memory_add("Borrower has 5-year credit history")
  ↓
PostgreSQL: INSERT into events (group_id = "allura-bank-lending", ...)

Agent B (group_id: allura-haccp-food)
  ↓ memory_search("borrower", userId)
  ↓
PostgreSQL: SELECT * FROM events WHERE group_id = "allura-haccp-food" ...
  [Agent B sees nothing from Agent A's tenant]
```

---

## Key Invariants

### 1. PostgreSQL is Append-Only

```sql
-- NEVER ALLOW
UPDATE events SET content = '...' WHERE id = ...;
DELETE FROM events WHERE id = ...;

-- ONLY ALLOW
INSERT INTO events (...) VALUES (...);
SELECT * FROM events WHERE ...;
```

### 2. Neo4j Uses SUPERSEDES, Never Edit

```cypher
-- NEVER ALLOW
MATCH (m:Memory) SET m.content = "..."

-- ONLY ALLOW
CREATE (m2:Memory { ... })
CREATE (m2)-[:SUPERSEDES]->(m1)
SET m1.deprecated = true
```

### 3. group_id is Mandatory

```sql
-- Schema enforcement
CREATE TABLE events (
  ...
  group_id VARCHAR(255) NOT NULL CHECK (group_id ~ '^allura-'),
  ...
);

-- Missing group_id → database error
INSERT INTO events (group_id, ...) VALUES (NULL, ...);
-- Error: new row for relation "events" violates check constraint "group_id_format"
```

### 4. Soft-Deletes Only

```sql
-- Soft-delete: append an event
INSERT INTO events (event_type, metadata, ...)
VALUES ('memory_delete', '{"memory_id": "..."}', ...);

-- In Neo4j: mark deprecated
MATCH (m:Memory {id: ...}) SET m.deprecated = true
```

Deleted memories stay in PostgreSQL for audit. Query filters exclude them:

```sql
SELECT * FROM events
WHERE event_type = 'memory_add'
  AND metadata->>'memory_id' NOT IN (
    SELECT metadata->>'memory_id'
    FROM events
    WHERE event_type = 'memory_delete'
  )
```

---

## Request-Response Examples

### Example 1: Write + Auto-Promote

```
Agent: memory_add("Sabir prefers dark mode", "sabir", {"confidence": 0.92})

Memory Engine:
  1. Scores content → 0.92 (high confidence)
  2. PROMOTION_MODE = "auto" → eligible for immediate promotion
  3. Dedup check → no duplicate found
  4. INSERT into PostgreSQL (event_type: memory_add)
  5. MERGE into Neo4j (Memory node)
  6. INSERT into PostgreSQL (event_type: memory_promoted)

Response:
{
  "id": "mem_7f9e2c3a1b5d",
  "status": "promoted",
  "stored": "both",
  "score": 0.92
}
```

### Example 2: Write + Pending Review (SOC2)

```
Agent: memory_add("Borrower flagged for suspicious income", "officer-1", {"confidence": 0.88})

Memory Engine:
  1. Scores content → 0.88 (high confidence)
  2. PROMOTION_MODE = "soc2" → requires curator approval
  3. INSERT into PostgreSQL (event_type: memory_add)
  4. INSERT into proposals (status: pending, curator_id: NULL)

Response:
{
  "id": "mem_a1b2c3d4e5f6",
  "status": "pending_review",
  "stored": "episodic",
  "message": "Queued for curator review"
}

[Curator Dashboard]
Curator clicks APPROVE
  ↓
System:
  1. MERGE into Neo4j (Memory node)
  2. INSERT into PostgreSQL (event_type: memory_promoted)
  3. UPDATE proposals (status: approved, curator_id: "curator-1", approved_at: NOW())
```

### Example 3: Search (Federated)

```
Agent: memory_search("dark mode preferences", "sabir", limit=10)

Parallel queries:

PostgreSQL:
  SELECT metadata->>'content', (...) FROM events
  WHERE group_id = "allura-myproject"
    AND metadata->>'user_id' = "sabir"
    AND event_type = 'memory_add'
    AND deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 10

Neo4j:
  MATCH (m:Memory)
  WHERE m.group_id = "allura-myproject"
    AND m.deprecated = false
  WITH m, apoc.text.distance("dark mode preferences", m.content) as similarity
  WHERE similarity > 0.7
  RETURN m.id, m.content, m.score, similarity
  ORDER BY similarity DESC
  LIMIT 10

Merge results:
  [
    {"source": "semantic", "score": 0.96, "content": "Sabir prefers dark mode"},
    {"source": "episodic", "score": 0.87, "content": "IDE theme set to dark"}
  ]
```

---

## References

- [BLUEPRINT.md](../docs/allura/BLUEPRINT.md) — Core requirements & execution rules
- [DATA-DICTIONARY.md](../docs/allura/DATA-DICTIONARY.md) — Field-level reference
- [RISKS-AND-DECISIONS.md](../docs/allura/RISKS-AND-DECISIONS.md) — Architectural decisions
