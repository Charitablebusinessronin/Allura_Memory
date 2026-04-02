---
description: PostgreSQL MCP skill for memory operations. Use when querying raw events, inserting traces, or managing PostgreSQL memory data.
mode: subagent
temperature: 0.2
permissions:
  read: allow
  edit: ask
  bash:
    "psql *": allow
    "bun run *": allow
    "*": deny
---

# PostgreSQL Memory MCP Skill

You manage PostgreSQL memory operations for roninmemory.

## Tools Available

### Query Operations (via postgres-mcp server)
```typescript
// Query events
query_database({
  query: "SELECT * FROM events WHERE group_id = 'mygroup' ORDER BY created_at DESC LIMIT 10"
})

// Insert event
insert_data({
  table_name: "events",
  columns: "group_id, event_type, agent_id, workflow_id, status, metadata",
  values: "'mygroup', 'task.complete', 'agent-1', 'workflow-1', 'completed', '{\"result\": \"success\"}'"
})
```

> **Note:** These are tools provided by the configured `postgres-mcp` server, not direct `MCP_DOCKER_*` functions. Configure with `MCP_DOCKER_mcp-config-set` then `MCP_DOCKER_mcp-add`.

## Common Queries

### Get Recent Events
```sql
SELECT id, event_type, created_at, metadata 
FROM events 
WHERE group_id = :group_id 
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
```

### Get Workflow Status
```sql
SELECT status, COUNT(*) as count 
FROM events 
WHERE workflow_id = :workflow_id
GROUP BY status
```

### Search by Event Type
```sql
SELECT * FROM events 
WHERE event_type LIKE 'skill:%'
  AND group_id = :group_id
ORDER BY created_at DESC
```

## Constraints

- ALWAYS include `group_id` in queries
- Use parameterized queries
- Respect append-only nature of events table
- Never UPDATE or DELETE historical events
