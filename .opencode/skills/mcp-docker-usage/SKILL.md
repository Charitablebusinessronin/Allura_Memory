# Skill: mcp-docker-usage

## When to Use This Skill

Use this skill BEFORE attempting any MCP_DOCKER operation. This skill prevents the common failure pattern of:
- Trying to add MCP servers when direct tools already exist
- Following server lifecycle when a simple direct tool call would work
- Tool fallback chains that waste tokens and time

## Core Principle

**MCP_DOCKER provides TWO distinct tool sets:**

1. **Direct Tools** — Always available, no setup required
2. **Server Lifecycle Tools** — Only for external MCP servers from Docker Hub

---

## Tool Reference: Direct MCP_DOCKER Tools

These tools are **always available** in the current session. Use them directly.

### Database Tools
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `MCP_DOCKER_execute_sql` | PostgreSQL queries | Any SQL read/write |
| `MCP_DOCKER_query_database` | Natural language SQL | User asks in plain English |
| `MCP_DOCKER_list_tables` | Show all tables | Discovery phase |
| `MCP_DOCKER_describe_table` | Table schema | Understanding data model |
| `MCP_DOCKER_insert_data` | Insert rows | Event logging |
| `MCP_DOCKER_update_data` | Update rows | Corrections |
| `MCP_DOCKER_delete_data` | Delete rows | Cleanup (rare) |

### Neo4j Tools
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `MCP_DOCKER_read_neo4j_cypher` | Read from Neo4j | Queries, pattern matching |
| `MCP_DOCKER_write_neo4j_cypher` | Write to Neo4j | ADRs, promoted knowledge |

### Web & Research Tools
| Tool | Purpose | When to Use | Type |
|------|---------|-------------|------|
| `MCP_DOCKER_tavily_search` | Web search | Current information, news | Direct |
| `MCP_DOCKER_tavily_research` | Deep research | Comprehensive topic analysis | Direct |
| `MCP_DOCKER_web_search_exa` | **Exa** AI-optimized search | Technical queries | Direct |
| `MCP_DOCKER_tavily_extract` | Extract from URLs | Reading specific pages | Direct |
| `MCP_DOCKER_tavily_crawl` | Crawl websites | Site-wide extraction | Direct |

**Note:** `MCP_DOCKER_web_search_exa` is **Exa** search — high quality, AI-native search. Use this over `tavily_search` for technical queries.

### Documentation Tools (Require Server Lifecycle)
| Server | Purpose | When to Use | Type |
|--------|---------|-------------|------|
| `context7` | Library documentation | Up-to-date docs for any library | **MCP Server** |

**⚠️ Context7 requires full lifecycle:** `mcp-find` → `mcp-config-set` → `mcp-add` → `mcp-exec`

Context7 is NOT a direct tool. It must be configured with API key and added to session.

### YouTube Tools
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `MCP_DOCKER_get_transcript` | YouTube transcript | Video content analysis |
| `MCP_DOCKER_get_timed_transcript` | Transcript with timestamps | Referencing specific moments |
| `MCP_DOCKER_get_video_info` | Video metadata | Title, channel, duration |
| `MCP_DOCKER_get_available_languages` | Language options | Multi-language content |

### Utility Tools
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `MCP_DOCKER_get_connection_examples` | Database connection strings | Configuration help |
| `MCP_DOCKER_get_current_database_info` | Current DB info | Debugging connections |

---

## Tool Reference: Server Lifecycle (External MCP Servers)

**ONLY use these when you need a tool NOT in the direct list above.**

### The Lifecycle (Mandatory Sequence)

```
Step 1: Find
MCP_DOCKER_mcp-find --query "server-name"
  ↓ If found
Step 2: Configure
MCP_DOCKER_mcp-config-set --server NAME --config '{...}'
  ↓ If configured
Step 3: Add
MCP_DOCKER_mcp-add --name NAME --activate
  ↓ If added
Step 4: Execute
MCP_DOCKER_mcp-exec --name NAME --tool TOOL_NAME --arguments '{...}'
```

### Common External Servers

| Server | Use Case | Direct Tool Alternative |
|--------|----------|-------------------------|
| `notion` | Notion workspace access | None — requires lifecycle |
| `github` | GitHub API operations | Use `git` CLI or `gh` instead |
| `slack` | Slack messaging | None — requires lifecycle |
| `brave` | Web search | Use `MCP_DOCKER_tavily_search` or `exa` instead |
| `playwright` | Browser automation | None — requires lifecycle |
| `context7` | Library documentation | None — requires lifecycle with API key |

---

## Decision Tree

```
User needs functionality
    ↓
Check: Is there a direct MCP_DOCKER_* tool?
    ├─ YES → Use it immediately
    │        If fails: search memory → log → escalate
    │        NEVER try mcp-add/mcp-exec
    ↓
    └─ NO → Is this an external service integration?
              ├─ YES → Can we use alternative (REST API, CLI)?
              │        ├─ YES → Use alternative
              │        └─ NO → Proceed with full server lifecycle
              │                    find → config → add → exec
              │                    If ANY step fails: STOP
              │                    Don't try other servers
              └─ NO → Functionality unavailable
                       Report to user, suggest alternatives
```

---

## Anti-Patterns (STOP When You See These)

| Anti-Pattern | Why It Fails | Correct Approach |
|--------------|--------------|------------------|
| `mcp-add` then `mcp-exec` for YouTube | Direct tools exist | `MCP_DOCKER_get_transcript` |
| Try server A → fail → try server B | No diagnosis | If lifecycle fails, STOP |
| Tool fails → try different tool | No memory search | Search events table first |
| "Maybe this will work" guessing | Wastes tokens | Check this skill first |
| Configuring without finding | Validation error | Always `mcp-find` first |
| Executing without adding | "Server not found" | Must `mcp-add --activate` |

---

## Real Examples

### Example 1: YouTube Transcript (WRONG vs RIGHT)

**WRONG:**
```javascript
// Don't do this
MCP_DOCKER_mcp-find({ query: "youtube" })
MCP_DOCKER_mcp-add({ name: "youtube_transcript", activate: true })
MCP_DOCKER_mcp-exec({ name: "youtube_transcript", tool: "get_transcript" })
// Result: "Server not found in current session"
```

**RIGHT:**
```javascript
// Direct tool exists
MCP_DOCKER_get_transcript({ url: "https://youtube.com/watch?v=..." })
// Result: ✅ Transcript retrieved
```

### Example 2: Notion Access (Correct Lifecycle)

**Scenario:** User asks "Get Faith Meats info from Notion"

**Analysis:**
- No direct `MCP_DOCKER_notion_*` tool exists
- Requires external Notion MCP server

**Correct sequence:**
```javascript
// Step 1: Find
MCP_DOCKER_mcp-find({ query: "notion" })
// Returns: notion, notion-remote servers available

// Step 2: Configure (if not already configured)
MCP_DOCKER_mcp-config-set({
  server: "notion-remote",
  config: { integration_token: "..." }
})

// Step 3: Add
MCP_DOCKER_mcp-add({ name: "notion-remote", activate: true })

// Step 4: Execute
MCP_DOCKER_mcp-exec({
  name: "notion-remote",
  tool: "notion_search",
  arguments: { query: "Faith Meats" }
})
```

**If ANY step fails:** STOP. Report: "Notion MCP server unavailable. Using local files instead."

### Example 3: Web Search (Prefer Direct)

**Scenario:** User asks "Search for latest React patterns"

**WRONG:**
```javascript
// Don't configure external search
MCP_DOCKER_mcp-find({ query: "brave" })
MCP_DOCKER_mcp-config-set({ server: "brave", config: { api_key: "..." } })
// Unnecessary — direct tools exist
```

**RIGHT:**
```javascript
// Use direct tool
MCP_DOCKER_tavily_search({
  query: "latest React patterns 2026",
  max_results: 5
})
// Or
MCP_DOCKER_web_search_exa({
  query: "React Server Components best practices"
})
```

---

## Quick Reference Table

| Need | Direct Tool | Server Required? |
|------|-------------|------------------|
| PostgreSQL query | `MCP_DOCKER_execute_sql` | ❌ No |
| Neo4j Cypher | `MCP_DOCKER_read_neo4j_cypher` | ❌ No |
| YouTube transcript | `MCP_DOCKER_get_transcript` | ❌ No |
| Web search | `MCP_DOCKER_tavily_search` | ❌ No |
| **AI-optimized search** | `MCP_DOCKER_web_search_exa` (Exa) | ❌ No |
| Deep research | `MCP_DOCKER_tavily_research` | ❌ No |
| Library documentation | `context7` (query-docs) | ✅ Yes — full lifecycle + API key |
| Notion access | None | ✅ Yes — full lifecycle |
| Slack message | None | ✅ Yes — full lifecycle |
| Browser automation | None | ✅ Yes — full lifecycle |
| GitHub operations | None | ⚠️ Prefer `git` CLI |

---

## Error Handling

### When Direct Tool Fails

1. **STOP** — Do not try alternative tool
2. **Search memory** — Check events table for similar failures
3. **Evaluate** — Is this a known issue with documented fix?
4. **Log** — Record the failure with context
5. **Escalate** — Report to user: "Tool X failed. Attempted Y. Awaiting instruction."

### When Server Lifecycle Fails

1. **STOP** — Do not try different server
2. **Log** — Which step failed (find/config/add/exec)
3. **Fallback** — Use alternative approach or inform user
4. **No retry** — Server infrastructure issues require human intervention

---

## Skill Maintenance

**When to update this skill:**
- New MCP_DOCKER_* direct tools added to environment
- New common external servers identified
- Failure patterns observed in practice
- Additional anti-patterns discovered

**Version:** 1.1.0
**Last Updated:** 2026-04-06
**Changes:** Added Context7 documentation server and Exa search clarification
**Author:** MemoryOrchestrator (via MemoryOrchestrator)

---

*"The tar pit forms when we confuse 'having access to a tool' with 'knowing which tool to use.'"*