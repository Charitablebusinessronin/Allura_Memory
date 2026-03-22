---
name: bmad-memory-log-event
description: Log events to PostgreSQL (Layer 1 - Raw Memory). Use when user wants to record an event, action, mistake, or execution trace.
---

# Memory Log Event Skill

Log raw events to PostgreSQL for append-only execution traces. This is Layer 1 of the 4-Layer Memory System.

## When to Use

- User asks to "log", "record", "save" an event or action
- Agent completes a task and needs to record it for traceability
- Something goes wrong and you need to log a mistake or error
- User wants to trace workflow execution
- Before making a decision (log context)

## Usage

```
User: "Log that I completed the authentication feature"
User: "Record a mistake: forgot to validate email format"
User: "Save this event: deployed to production at 3pm"
```

## MCP Tool

**Tool:** `log_event`
**Layer:** 1 - PostgreSQL (Raw Memory)
**Purpose:** Append-only event storage

## Input Parameters

| Parameter | Required | Type | Description | Example |
|-----------|----------|------|-------------|---------|
| event_type | yes | string | Type of event | `agent_action`, `mistake`, `decision_context` |
| agent_id | no | string | Agent identifier | `bmad-master`, `dev-agent` |
| group_id | yes | string | Tenant/project identifier | `memory`, `roninos`, `faith-meats` |
| workflow_id | no | string | Workflow identifier | `sprint-1`, `feature-auth` |
| metadata | no | object | Additional event data | `{ "feature": "auth", "status": "completed" }` |
| status | no | string | Event status | `completed`, `failed`, `pending` |
| parent_event_id | no | string | Link to parent event | `evt_12345` |
| trace_ref | no | string | Reference to evidence | `insight:ins_456` |

## Process

### Step 1: Gather Event Information

Collect required information:
- **event_type**: What kind of event?
- **group_id**: Which project/tenant?
- **metadata**: What details to store?

### Step 2: Call MCP Tool

Use the `log_event` MCP tool:

```json
{
  "event_type": "agent_action",
  "agent_id": "bmad-master",
  "group_id": "memory",
  "workflow_id": "skill-refactor",
  "metadata": {
    "action": "created_skill",
    "skill_name": "bmad-memory-log-event",
    "layer": "postgreSQL"
  },
  "status": "completed"
}
```

### Step 3: Store Returned Event ID

The tool returns an `event_id`. Store this for:
- Linking to insights (Layer 2)
- Creating ADR references (Layer 3)
- Building trace chains

### Step 4: Report Result

```
✅ Event Logged Successfully

📌 Event ID: evt_12345
📝 Type: agent_action
🏷️ Group: memory
⏰ Timestamp: 2024-03-15T14:30:00Z

📋 Metadata:
   - action: created_skill
   - skill_name: bmad-memory-log-event
```

## Event Types

| Type | Use Case |
|------|----------|
| `agent_action` | Agent completed an action |
| `mistake` | Something went wrong |
| `decision_context` | Context before a decision |
| `workflow_start` | Started a workflow |
| `workflow_end` | Completed a workflow |
| `task_start` | Started a task |
| `task_end` | Completed a task |
| `error` | Error occurred |
| `warning` | Warning condition |
| `info` | Informational event |

## Examples

### Log Agent Action

```json
{
  "event_type": "agent_action",
  "agent_id": "dev-agent",
  "group_id": "roninos",
  "workflow_id": "epic-1-story-3",
  "metadata": {
    "action": "implemented_feature",
    "feature": "user-authentication",
    "files_modified": ["src/auth/login.ts", "src/auth/middleware.ts"],
    "tests_added": 5
  },
  "status": "completed"
}
```

### Log Mistake

```json
{
  "event_type": "mistake",
  "agent_id": "dev-agent",
  "group_id": "roninos",
  "metadata": {
    "mistake_type": "missing_validation",
    "description": "Forgot to validate email format before saving",
    "fix_applied": true,
    "lessons_learned": "Always validate input at model boundary"
  },
  "status": "resolved"
}
```

### Log Decision Context

```json
{
  "event_type": "decision_context",
  "agent_id": "architect-agent",
  "group_id": "memory",
  "metadata": {
    "decision_pending": "which_embedding_model",
    "options": ["openai", "ollama", "local"],
    "criteria": ["cost", "latency", "quality"],
    "current_favorite": "ollama"
  }
}
```

## Response Format

The `log_event` tool returns:

```json
{
  "event_id": "evt_17532",
  "event_type": "agent_action",
  "group_id": "memory",
  "timestamp": "2024-03-15T14:30:00Z",
  "status": "completed"
}
```

## Error Handling

| Error | Solution |
|-------|----------|
| `group_id required` | Always provide project/tenant identifier |
| `event_type required` | Specify event type from allowed list |
| `PostgreSQL connection failed` | Check database status: `docker ps` |
| `Invalid metadata format` | Ensure metadata is valid JSON object |

## Layer Relationship

```
Layer 1: log_event (PostgreSQL)
    │
    └─ Stores raw events with trace_ref
         │
         └─ Layer 2: create_insight (Neo4j)
              │
              └─ Links to event via trace_ref
                   │
                   └─ Layer 3: log_decision (ADR)
                        │
                        └─ References insight for context
```

## Best Practices

1. **Always include group_id** - Required for tenant isolation
2. **Use descriptive event_type** - Enables better search
3. **Include relevant metadata** - Context is crucial for debugging
4. **Store event_id returned** - Use for trace chains
5. **Link to insights** - Use `trace_ref` when creating insights

## See Also

- `bmad-memory-search-events` - Search logged events
- `bmad-memory-create-insight` - Create insights (Layer 2)
- `bmad-memory-log-decision` - Log decisions (Layer 3)