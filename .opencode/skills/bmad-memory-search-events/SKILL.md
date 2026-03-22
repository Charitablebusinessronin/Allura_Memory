---
name: bmad-memory-search-events
description: Search PostgreSQL events (Layer 1 - Raw Memory). Use when user wants to find historical events, traces, or logs.
---

# Memory Search Events Skill

Search raw execution traces from PostgreSQL. This is Layer 1 of the 4-Layer Memory System.

## When to Use

- User asks to "find", "search", "look for" events or traces
- Agent needs historical context before acting
- Debugging: "What happened before this error?"
- Audit: "Show all actions for feature X"
- Understanding workflow progression

## Usage

```
User: "Search for events about authentication"
User: "Find all mistakes logged in the past week"
User: "What did the dev agent do yesterday?"
User: "Show me events for epic-1"
```

## MCP Tool

**Tool:** `search_events`
**Layer:** 1 - PostgreSQL (Raw Memory)
**Purpose:** Query historical execution traces

## Input Parameters

| Parameter | Required | Type | Description | Example |
|-----------|----------|------|-------------|---------|
| query | yes | string | Search query | `authentication`, `mistake` |
| group_id | yes | string | Tenant/project identifier | `memory`, `roninos` |
| event_type | no | string | Filter by event type | `agent_action`, `mistake` |
| agent_id | no | string | Filter by agent | `dev-agent`, `architect-agent` |
| workflow_id | no | string | Filter by workflow | `epic-1`, `feature-auth` |
| status | no | string | Filter by status | `completed`, `failed` |
| limit | no | number | Max results | `20` (default: 10) |
| offset | no | number | Pagination offset | `10` |
| date_from | no | string | Start date filter | `2024-01-01T00:00:00Z` |
| date_to | no | string | End date filter | `2024-12-31T23:59:59Z` |

## Process

### Step 1: Construct Search Query

Gather search parameters:
- **query**: Search terms
- **group_id**: Required tenant ID
- **filters**: Optional type, agent, workflow filters

### Step 2: Call MCP Tool

Use the `search_events` MCP tool:

```json
{
  "query": "authentication",
  "group_id": "roninos",
  "event_type": "agent_action",
  "limit": 20,
  "date_from": "2024-03-01T00:00:00Z"
}
```

### Step 3: Process Results

Results include:
- `event_id`: Unique identifier
- `event_type`: Type classification
- `timestamp`: When it happened
- `metadata`: Event details
- `status`: Completion status

### Step 4: Present Results

```markdown
## Search Results: "authentication" (15 found, 45ms)

### 1. evt_17530 [agent_action] ✅ completed
**Agent:** dev-agent
**Workflow:** feature-auth
**Time:** 2024-03-15T14:20:00Z

**Metadata:**
- action: implemented_login
- files: ["src/auth/login.ts"]
- tests: 3

---

### 2. evt_17450 [mistake] ⚠️ resolved
**Agent:** dev-agent
**Workflow:** feature-auth
**Time:** 2024-03-14T10:30:00Z

**Metadata:**
- mistake_type: missing_validation
- description: Forgot input validation
- fix_applied: true

---
```

## Search Tips

### By Event Type

```json
{
  "query": "",
  "group_id": "roninos",
  "event_type": "mistake",
  "limit": 50
}
```

### By Time Range

```json
{
  "query": "deployment",
  "group_id": "roninos",
  "date_from": "2024-03-01T00:00:00Z",
  "date_to": "2024-03-31T23:59:59Z"
}
```

### By Agent

```json
{
  "query": "",
  "group_id": "roninos",
  "agent_id": "architect-agent",
  "event_type": "decision_context"
}
```

### Full-Text Search

```json
{
  "query": "authentication OR login",
  "group_id": "roninos",
  "limit": 20
}
```

## Response Format

The `search_events` tool returns:

```json
{
  "results": [
    {
      "event_id": "evt_17530",
      "event_type": "agent_action",
      "agent_id": "dev-agent",
      "group_id": "roninos",
      "workflow_id": "feature-auth",
      "timestamp": "2024-03-15T14:20:00Z",
      "status": "completed",
      "metadata": {
        "action": "implemented_login",
        "files": ["src/auth/login.ts"]
      }
    }
  ],
  "total": 15,
  "query_time_ms": 45
}
```

## Common Searches

| Goal | Parameters |
|------|------------|
| Find mistakes | `event_type: "mistake"` |
| Find failed actions | `status: "failed"` |
| Find recent work | `date_from: <recent date>` |
| Find by feature | `workflow_id: <feature-id>` |
| Find by agent | `agent_id: <agent-id>` |

## Output Format

```
🔍 Search: "authentication"
   Group: roninos
   Found: 15 results (45ms)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 [agent_action] evt_17530
   Agent: dev-agent
   Workflow: feature-auth
   Status: ✅ completed
   Time: 2024-03-15 14:20 UTC

   Metadata:
   • action: implemented_login
   • files: ["src/auth/login.ts"]
   • tests: 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 [mistake] evt_17450
   Agent: dev-agent
   Workflow: feature-auth
   Status: ⚠️ resolved
   Time: 2024-03-14 10:30 UTC

   Metadata:
   • mistake_type: missing_validation
   • fix_applied: true

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Error Handling

| Error | Solution |
|-------|----------|
| `group_id required` | Always provide tenant identifier |
| `No results found` | Broaden query, remove filters |
| `PostgreSQL connection failed` | Check database: `docker ps` |
| `Invalid date format` | Use ISO 8601 format |

## Layer Relationship

Events found here can be:
1. Linked to insights (Layer 2) via `trace_ref`
2. Used as decision context (Layer 3)
3. Traced to understand workflow progression

## Best Practices

1. **Always filter by group_id** - Required for multitenancy
2. **Use event_type for focus** - Narrows results effectively
3. **Set reasonable limits** - Default 10 is good for display
4. **Use date filters** - Prevents old result noise
5. **Check workflow_id** - Understand feature progression

## See Also

- `bmad-memory-log-event` - Log new events
- `bmad-memory-create-insight` - Create insights from events
- `bmad-memory-log-decision` - Reference events in decisions