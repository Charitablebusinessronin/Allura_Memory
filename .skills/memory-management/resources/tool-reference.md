# Memory Service Tool Reference

Complete reference for all MCP tools exposed by the memory service.

## Core Memory Operations

### memory.store
Create a new memory with versioning.

**Input:**
```json
{
  "type": "Insight",
  "topic_key": "project.insight.001",
  "content": "Memory content",
  "group_id": "project-slug",
  "confidence": 0.85
}
```

**Output:**
```json
{
  "id": "insight_uuid",
  "version": 1,
  "status": "draft",
  "created_at": "2026-03-24T..."
}
```

### memory.search
Search memories with semantic matching.

**Input:**
```json
{
  "query": "authentication best practices",
  "group_id": "project-slug",
  "limit": 10,
  "confidence_min": 0.5
}
```

**Output:**
```json
{
  "results": [
    {
      "id": "...",
      "summary": "...",
      "confidence": 0.92,
      "status": "active"
    }
  ]
}
```

## Governance Tools

| Tool | Purpose | HITL Required |
|------|---------|---------------|
| promote_insight | Draft → Active | Yes |
| reject_insight | Mark as rejected | Yes |
| supersede_insight | Replace with newer | Yes |
| revoke_insight | Remove from use | Yes |

## Health & Monitoring

### health.check
Returns system status.

**Output:**
```json
{
  "postgresql": "healthy",
  "neo4j": "healthy",
  "canonical_tags": ["project1", "project2"],
  "timestamp": "..."
}
```

## Full Tool List

See `src/mcp/memory-server.ts` for complete tool definitions (30+ tools).

For OpenClaw integration, see `src/integrations/openclaw/adapter.ts` (8 focused tools).
