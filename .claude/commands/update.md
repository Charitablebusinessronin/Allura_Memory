---
description: "Quick update — sync documentation with Allura Brain"
allowed-tools: ["Write", "Read", "Grep", "mcp__MCP_DOCKER__*"]
---

# Quick Update Command

Quickly update documentation with insights from Allura Brain.

## Usage

```
/update <target> <change description>
```

## Targets

| Target | File | Purpose |
|--------|------|---------|
| `activeContext` | `memory-bank/activeContext.md` | Current focus and blockers |
| `progress` | `memory-bank/progress.md` | What has been done |
| `systemPatterns` | `memory-bank/systemPatterns.md` | Architecture decisions |
| `techContext` | `memory-bank/techContext.md` | Tech stack details |

## Protocol

### Phase 1: Gather Context

```javascript
// Search Allura Brain
mcp__MCP_DOCKER__search_memories({ query: "<topic>" })

// Read current doc
Read({ path: `memory-bank/${target}.md` })
```

### Phase 2: Update Document

```javascript
// Write updated content
Write({
  path: `memory-bank/${target}.md`,
  content: updatedContent
})
```

### Phase 3: Log to Memory

```javascript
// Log the update
mcp__MCP_DOCKER__create_entities({
  entities: [{
    name: `Doc Update ${target}`,
    entity_type: "doc_update",
    observations: [...]
  }]
})
```

## Example

```
User: /update progress Added OAuth2 authentication

Updates:
- memory-bank/progress.md
- Logs to Allura Brain
- Updates activeContext if needed
```

---

**Invoke with:** `/update <target> <change description>`