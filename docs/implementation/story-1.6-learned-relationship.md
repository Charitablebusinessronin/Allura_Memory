# Story 1.6: LEARNED Relationship Implementation

> **Implementation Date:** 2026-04-05
> **Status:** ✅ Completed
> **Story:** 1.6 Implement LEARNED Relationship

---

## Overview

Implemented the LEARNED relationship to track agent session learning in the Allura Agent-OS memory system.

**Relationship Type:** `(Agent)-[:LEARNED {timestamp, relevance_score}]->(Session)`

---

## Files Created

### 1. Implementation File

**File:** `src/lib/memory/relationships/learned.ts`

**Functions:**
- `createLearnedRelationship()` - Create LEARNED relationship with properties
- `getAgentLearnings()` - Query learnings by agent
- `getSessionLearners()` - Get all agents that learned from a session
- `deleteLearnedRelationship()` - Remove relationship
- `countAgentLearnings()` - Count learning relationships

**Key Features:**
- ✅ Creates LEARNED relationship with timestamp and relevance_score
- ✅ Creates Session node automatically if it doesn't exist
- ✅ Increments learning_count on Agent node
- ✅ Enforces group_id on all operations (tenant isolation)
- ✅ Logs to PostgreSQL events table for audit trail
- ✅ Supports filtering by min_relevance, workflow_id
- ✅ Returns results ordered by relevance_score DESC
- ✅ Uses MERGE for idempotency (no duplicate relationships)

### 2. Test File

**File:** `src/lib/memory/relationships/learned.test.ts`

**Test Coverage:**
- ✅ Creation of LEARNED relationship
- ✅ Querying learnings by agent
- ✅ Limiting results with session_limit
- ✅ Filtering by min_relevance
- ✅ group_id enforcement
- ✅ Tenant isolation (cross-tenant queries return empty)
- ✅ Validation of required fields
- ✅ Validation of relevance_score range (0.0 to 1.0)
- ✅ Idempotency (MERGE prevents duplicates)
- ✅ Edge cases (Unicode, large metadata, boundary values)
- ✅ Error handling for non-existent agents

---

## Neo4j Queries Used

### Create LEARNED Relationship

```cypher
MATCH (a:Agent {agent_id: $agent_id, group_id: $group_id})
MATCH (s:Session {session_id: $session_id, group_id: $group_id})
MERGE (a)-[r:LEARNED {group_id: $group_id}]->(s)
SET r.timestamp = datetime(),
    r.relevance_score = $relevance_score,
    r.learning_summary = $learning_summary,
    r.metadata = $metadata
RETURN r
```

### Get Agent Learnings

```cypher
MATCH (a:Agent)-[r:LEARNED]->(s:Session)
WHERE a.agent_id = $agent_id
  AND a.group_id = $group_id
  [AND r.relevance_score >= $min_relevance]
  [AND s.workflow_id = $workflow_id]
RETURN s, r.relevance_score AS relevance_score, r.timestamp AS learned_at
ORDER BY r.relevance_score DESC, r.timestamp DESC
LIMIT $limit
```

### Count Agent Learnings

```cypher
MATCH (a:Agent {agent_id: $agent_id, group_id: $group_id})-[r:LEARNED]->(s:Session)
RETURN count(r) AS learning_count
```

### Delete Relationship

```cypher
MATCH (a:Agent {agent_id: $agent_id, group_id: $group_id})-[r:LEARNED]->(s:Session {session_id: $session_id, group_id: $group_id})
DELETE r
RETURN count(r) AS deleted_count
```

---

## Integration Points

### 1. Agent Nodes (Story 1.3)

The LEARNED relationship requires:
- Agent node must exist in Neo4j (validated)
- Automatically increments `learning_count` on Agent node
- Updates `last_active` timestamp on Agent

### 2. PostgreSQL Events (Story 1.1)

Every operation logs to PostgreSQL:
- `relationship.learned.created` - On creation
- `relationship.learned.deleted` - On deletion

### 3. Session Nodes

Session nodes are auto-created if they don't exist:
- `id: randomUUID()`
- `session_id: string`
- `agent_id: string`
- `group_id: string`
- `started_at: datetime()`
- `status: 'active'`

---

## TypeScript Types

```typescript
// Relationship
interface LearnedRelationship {
  agent_id: string;
  session_id: string;
  group_id: string;
  timestamp: Date;
  relevance_score: number;
  learning_summary?: string;
  metadata?: Record<string, unknown>;
}

// Session Node
interface SessionNode {
  id: string;
  session_id: string;
  agent_id: string;
  group_id: string;
  workflow_id?: string;
  started_at: Date;
  ended_at?: Date;
  status: "active" | "completed" | "failed" | "cancelled";
  summary?: string;
  metadata: Record<string, unknown>;
}

// Create Parameters
interface CreateLearnedParams {
  agent_id: string;
  session_id: string;
  group_id: string;
  relevance_score: number;
  learning_summary?: string;
  metadata?: Record<string, unknown>;
}

// Query Parameters
interface GetAgentLearningsParams {
  agent_id: string;
  group_id: string;
  session_limit?: number;
  min_relevance?: number;
  workflow_id?: string;
}
```

---

## Validation Rules

### group_id (Tenant Isolation)
- ✅ Required (cannot be empty)
- ✅ Must follow `allura-*` naming convention
- ✅ Enforced on all queries (WHERE clause)
- ✅ Prevents cross-tenant data access

### relevance_score
- ✅ Required (must be a number)
- ✅ Must be between 0.0 and 1.0 (inclusive)
- ✅ Used for ordering results
- ✅ Can filter with `min_relevance`

### agent_id
- ✅ Required
- ✅ Agent must exist (throws `LearnedValidationError`)
- ✅ Learning count incremented on Agent node

### session_id
- ✅ Required
- ✅ Session created automatically if doesn't exist

---

## Error Handling

### LearnedValidationError
- Missing required fields
- Invalid relevance_score range
- Invalid group_id format
- Non-existent agent

### LearnedQueryError
- Invalid query parameters
- Missing group_id on queries

### PostgreSQL Logging
- Logs operations asynchronously
- Does NOT fail operation if logging fails
- Console error logged for debugging

---

## Usage Examples

### Create Learning Relationship

```typescript
import { createLearnedRelationship } from "@/lib/memory/relationships/learned";

const relationship = await createLearnedRelationship({
  agent_id: "memory-builder",
  session_id: "session-2026-04-05-001",
  group_id: "allura-default",
  relevance_score: 0.85,
  learning_summary: "Implemented LEARNED relationship tracking",
  metadata: {
    workflow_id: "memory-relationship",
    components: ["neo4j", "postgresql"],
  },
});

console.log(relationship.timestamp); // 2026-04-05T...
console.log(relationship.relevance_score); // 0.85
```

### Get Agent Learnings

```typescript
import { getAgentLearnings } from "@/lib/memory/relationships/learned";

const sessions = await getAgentLearnings({
  agent_id: "memory-builder",
  group_id: "allura-default",
  session_limit: 10,
  min_relevance: 0.7,
});

console.log(sessions.length); // Number of sessions
console.log(sessions[0].session_id); // First session ID
```

### Get Session Learners (Collaboration)

```typescript
import { getSessionLearners } from "@/lib/memory/relationships/learned";

const learners = await getSessionLearners(
  "session-2026-04-05-001",
  "allura-default"
);

console.log(learners[0].agent_id); // "memory-builder"
console.log(learners[0].relevance_score); // 0.85
```

### Count Agent Learnings

```typescript
import { countAgentLearnings } from "@/lib/memory/relationships/learned";

const count = await countAgentLearnings(
  "memory-builder",
  "allura-default"
);

console.log(count); // 42
```

---

## Testing Instructions

### Run Tests

```bash
bun test src/lib/memory/relationships/learned.test.ts
```

### Run Type Check

```bash
npm run typecheck
```

### Run Lint

```bash
npm run lint
```

---

## Story Acceptance Criteria

| Criteria | Status |
|----------|--------|
| `LEARNED` relationship creates on agent session completion | ✅ |
| Properties: `timestamp`, `relevance_score` | ✅ |
| Queryable by session and agent | ✅ |
| Enables context recall | ✅ |
| Enforces group_id on all operations | ✅ |
| Logs to PostgreSQL events table | ✅ |
| Test suite created | ✅ |

---

## Next Steps

1. **Story 1.5**: Implement CONTRIBUTED relationship (similar pattern)
2. **Story 1.7**: Create memory() TypeScript wrapper (simplifies MCP Docker calls)
3. **Integration**: Use in MemoryBuilder agent to track learning during sessions

---

## Related Files

- `src/lib/neo4j/agent-nodes.ts` - Agent node management
- `src/lib/neo4j/connection.ts` - Neo4j connection utility
- `src/lib/postgres/queries/insert-trace.ts` - PostgreSQL event logging
- `src/lib/postgres/trace-logger.ts` - Trace logging utilities

---

## References

- **Architecture Pattern:** 5-Layer Allura Agent-OS (L2: PostgreSQL + Neo4j)
- **Memory Pattern:** Steel Frame Versioning (SUPERSEDES relationships)
- **Isolation Pattern:** Tenant-aware with `group_id` enforcement
- **Audit Pattern:** PostgreSQL append-only traces