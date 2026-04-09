---
name: quick-update
description: "Quick documentation updates using Allura Brain. Updates docs with memory insights and current context."
allowed-tools: ["Write", "Read", "Grep", "mcp__MCP_DOCKER__*"]
---

# Quick Update — Documentation Sync

Quickly update documentation with insights from Allura Brain.

## When to Use

- Updating docs after code changes
- Syncing memory-bank files
- Updating PROJECT.md with new decisions
- Refreshing architecture docs

## Update Protocol

### Phase 1: Identify Target

```javascript
// What needs updating?
const target = args[0] // e.g., "activeContext", "progress", "systemPatterns"
```

### Phase 2: Gather Context

```javascript
// Search Allura Brain for relevant insights
mcp__MCP_DOCKER__search_memories({ query: "<topic>" })

// Read current doc
Read({ path: `memory-bank/${target}.md` })
```

### Phase 3: Update Document

```javascript
// Write updated content
Write({
  path: `memory-bank/${target}.md`,
  content: updatedContent
})
```

### Phase 4: Log to Memory

```javascript
// Log the update
mcp__MCP_DOCKER__create_entities({
  entities: [{
    name: `Doc Update ${target}`,
    entity_type: "doc_update",
    observations: [
      `Updated: ${new Date().toISOString()}`,
      `File: memory-bank/${target}.md`,
      `Changes: ${changeSummary}`
    ]
  }]
})
```

## Update Targets

| Target | File | Purpose |
|--------|------|---------|
| `activeContext` | `memory-bank/activeContext.md` | Current focus and blockers |
| `progress` | `memory-bank/progress.md` | What has been done |
| `systemPatterns` | `memory-bank/systemPatterns.md` | Architecture decisions |
| `techContext` | `memory-bank/techContext.md` | Tech stack details |
| `projectbrief` | `memory-bank/projectbrief.md` | Project overview |
| `productContext` | `memory-bank/productContext.md` | Product context |

## Quick Update Patterns

### Pattern 1: After Code Change

```
User: "quick-update progress Added OAuth2 authentication"

Updates:
- memory-bank/progress.md with new completion
- Logs to Allura Brain
- Updates activeContext if needed
```

### Pattern 2: After Architecture Decision

```
User: "quick-update systemPatterns Decided to use JWT for auth"

Updates:
- memory-bank/systemPatterns.md with new pattern
- Creates ADR in _bmad-output/planning-artifacts/
- Logs to Allura Brain
```

### Pattern 3: After Blocker

```
User: "quick-update activeContext Blocked on API key from vendor"

Updates:
- memory-bank/activeContext.md with blocker
- Logs to Allura Brain
- Notifies if critical
```

## Memory Integration

Every quick-update:

1. **Searches** Allura Brain for related insights
2. **Updates** the target document
3. **Logs** the change to memory
4. **Links** to relevant entities

---

**Invoke with:** `quick-update <target> <change description>`