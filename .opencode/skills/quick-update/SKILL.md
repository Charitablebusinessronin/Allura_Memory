---
name: quick-update
description: "Quick updates using Allura Brain via MCP tools. Writes insights to Brain, syncs canonical docs."
allowed-tools: ["Write", "Read", "Grep", "mcp__MCP_DOCKER__*"]
---

# Quick Update — Brain-First Sync

Quickly update Allura Brain and canonical docs with insights from the current session.

## When to Use

- Logging a session decision or architecture insight
- Updating canonical docs after code changes
- Recording a blocker or status change
- Refreshing architecture docs with new decisions

## Update Protocol

### Phase 1: Identify Target

```javascript
// What needs updating?
const target = args[0] // e.g., "decision", "blocker", "insight", "blueprint", "design"
```

### Phase 2: Write to Brain

```javascript
// Store the update as a memory in the Brain
mcp__MCP_DOCKER__memory_add({
  group_id: "allura-roninmemory",
  user_id: agent_id,
  content: "<the update content>",
  metadata: {
    source: "manual",
    agent_id: "brooks",
    update_type: target,
  },
})
```

### Phase 3: Sync Canonical Docs (if applicable)

For canonical doc targets, also update the file:

| Target          | File                                   | Purpose          |
| --------------- | -------------------------------------- | ---------------- |
| `blueprint`     | `docs/allura/BLUEPRINT.md`             | System blueprint |
| `solution-arch` | `docs/allura/SOLUTION-ARCHITECTURE.md` | Architecture     |
| `design`        | `docs/allura/DESIGN-ALLURA.md`         | Design contracts |
| `requirements`  | `docs/allura/REQUIREMENTS-MATRIX.md`   | Requirements     |
| `risks`         | `docs/allura/RISKS-AND-DECISIONS.md`   | ADRs and risks   |
| `data-dict`     | `docs/allura/DATA-DICTIONARY.md`       | Schema reference |

```javascript
// Read current doc
Read({ path: `docs/allura/${target}.md` })
// Write updated content
Write({ path: `docs/allura/${target}.md`, content: updatedContent })
```

### Phase 4: Log to Events

```javascript
// Log the update event
mcp__MCP_DOCKER__execute_sql({
  sql_query: `INSERT INTO events (event_type, agent_id, group_id, status, metadata, created_at)
    VALUES ('DOC_UPDATE', 'brooks', 'allura-roninmemory', 'completed', $1, NOW())`,
  params: [{ target, changeSummary }],
})
```

## Quick Update Patterns

### Pattern 1: After Architecture Decision

```
User: "quick-update decision Decided to use RRF fusion for hybrid search"

Updates:
- memory_add → Brain stores the decision
- RISKS-AND-DECISIONS.md gets the ADR entry
- Events logged for audit trail
```

### Pattern 2: After Blocker

```
User: "quick-update blocker Neo4j driver timeout on large queries"

Updates:
- memory_add → Brain stores the blocker
- Events logged with BLOCKER type
```

### Pattern 3: After Code Change

```
User: "quick-update insight Fixed Neo4j DateTime serialization"

Updates:
- memory_add → Brain stores the insight
- Events logged for audit
```

## Memory Integration

Every quick-update:

1. **Writes** to Allura Brain via memory_add (Brain is source of truth)
2. **Syncs** canonical docs if target is a docs/allura/ file
3. **Logs** the change to PostgreSQL events
4. **Never** writes to memory-bank/ (deleted — Brain is the source)

---

**Invoke with:** `quick-update <target> <change description>`
