---
name: memory-client
description: "Allura-specific skill. Connect to Allura Brain memory system for AI agent persistence. Use when storing memories, searching knowledge, logging events, or working with the 4-layer memory architecture. Requires MCP_DOCKER tools and Allura Brain infrastructure."
---

# Memory Client

> **This skill is Allura-specific.** It requires MCP_DOCKER tools and Allura Brain infrastructure (PostgreSQL + Neo4j). If you are not using Allura Brain, this skill does not apply.

## Connect

### MCP Server

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["tsx", "src/mcp/memory-server.ts"]
    }
  }
}
```

### Environment

```bash
POSTGRES_PASSWORD=your_password
NEO4J_PASSWORD=your_password
NEO4J_URI=bolt://localhost:7687
```

## MCP Tools

### Search

| Tool | Purpose | Required |
|------|---------|----------|
| search_insights | Query knowledge graph | query, group_id |
| search_events | Search raw traces | query, group_id |
| get_event | Get by ID | event_id |
| get_entity | Get by key | topic_key, group_id |
| search_knowledge_base | Search Notion | query |
| search_decisions | Search ADRs | query, group_id |

### Create

| Tool | Purpose | Required |
|------|---------|----------|
| create_insight | Store insight | topic_key, content, group_id |
| log_event | Log to PostgreSQL | group_id, event_type, agent_id |
| create_entity | Create graph node | type, topic_key, content, group_id |
| create_relation | Link nodes | from_topic_key, to_topic_key, relation_type, group_id |
| create_knowledge_item | HITL item | title, content, tags |

### Context

| Tool | Purpose | Required |
|------|---------|----------|
| get_agent_context | Session context | group_id, agent_id |

## Signatures

```javascript
// Search
search_insights({ query, group_id, limit?, min_confidence? })
search_events({ query, group_id, limit?, offset? })

// Store
create_insight({ topic_key, content, group_id, confidence?, tags?, source_event_id? })
log_event({ group_id, event_type, agent_id, metadata?, status?, workflow_id? })
create_relation({ from_topic_key, to_topic_key, relation_type, group_id, properties? })

// Context
get_agent_context({ group_id, agent_id, include_events?, include_insights? })
```

## Key Concepts

| Concept | Description |
|---------|-------------|
| group_id | Multi-tenant ID. Required for all ops. Ex: "faith-meats", "global" |
| topic_key | Hierarchical: "group.category.name". Ex: "project.auth.jwt" |
| confidence | Quality 0-1. Filter with min_confidence |
| versioning | Immutable insights. Use SUPERSEDES for updates |

## Examples

### Session

```javascript
// Start
log_event({ group_id: "session_001", event_type: "session_start", agent_id: "claude" })

// Store
create_insight({
  topic_key: "session.auth.jwt",
  content: "Use JWT for stateless auth",
  group_id: "session_001",
  confidence: 0.9
})

// End
log_event({ group_id: "session_001", event_type: "session_complete", status: "completed" })
```

### Search

```javascript
// Find pattern
results = search_insights({ query: "error handling", group_id: "project", min_confidence: 0.8 })

// Get context
context = get_agent_context({ group_id: "session_001", agent_id: "claude" })
```

### Link

```javascript
create_relation({
  from_topic_key: "project.patterns.auth",
  to_topic_key: "project.patterns.validation",
  relation_type: "DEPENDS_ON",
  group_id: "project"
})
```

## Architecture

```
Agent → ADR → Governance → Discovery → Control → Neo4j ← PostgreSQL
                          (HITL)      (ADAS)
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No PostgreSQL | Check POSTGRES_PASSWORD, container running |
| No Neo4j | Check NEO4J_PASSWORD, bolt://localhost:7687 |
| Empty results | Verify group_id, lower min_confidence |
| Insight hidden | Check Notion for HITL approval |
