---
description: "[DEPRECATED] Use mcp-docker, mcp-docker, and research policy directly"
argument-hint: ""
allowed-tools: []
---

# MCP Server & Skill Decision Guide [DEPRECATED]

> ⚠️ **This skill is deprecated.** Do not use for new work.

## Migration Guide

| Need | Use Instead |
|------|-------------|
| MCP orchestration (find/configure/add) | [`mcp-docker`](https://opencode.ai/skills/mcp-docker) |
| Memory operations | [`mcp-docker`](https://opencode.ai/skills/mcp-docker) |
| Research queries | **Exa-first**, Tavily-fallback policy |

## Research Policy

```
Research Priority:
1. Exa (primary — neural/semantic search)
2. Tavily (fallback — broad web search)
3. Context7 (docs/technical references)
```

## Quick Reference

```typescript
// MCP Orchestration (mcp-docker skill)
MCP_DOCKER_mcp-find({ query: "database" })
MCP_DOCKER_mcp-config-set({ server: "...", config: {...} })
MCP_DOCKER_mcp-add({ name: "...", activate: true })
MCP_DOCKER_mcp-exec({ name: "...", tool: "..." })

// Memory Operations (mcp-docker skill)
memory_create_entities({ entities: [...] })
memory_search_knowledge({ query: "..." })
```

---
*This file is a minimal deprecation wrapper. Migrate to canonical skills.*
