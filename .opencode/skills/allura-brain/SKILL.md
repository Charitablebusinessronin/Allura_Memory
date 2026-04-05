---
name: allura-brain
description: "The definitive guide to operating within the Allura Agent-OS ecosystem — architecture, tools, governance, and workflow for all agents"
---

# Allura Brain

> **Purpose:** The definitive guide to operating within the Allura Agent-OS ecosystem. Every agent reads this skill to understand the system architecture, tools, governance, and workflow.
> **When to use:** At session start, when onboarding new agents, when system behavior is unclear, or when MCP_DOCKER tools need to be used.
> **Applies to:** All projects under Allura governance (roninmemory, faith-meats, audits, creative, nonprofit, haccp).

---

## THE RULE

**NEVER** use `docker exec` for database operations.
**ALWAYS** use MCP_DOCKER tools.

**If you break this rule:** Delete the work, re-do with MCP_DOCKER, log the violation.

---

## System Architecture: 5-Layer Model

```
┌─────────────────────────────────────────────────────┐
│ Layer 5: Paperclip + OpenClaw                       │
│         (Human interfaces, external integrations)    │
├─────────────────────────────────────────────────────┤
│ Layer 4: Workflow / DAGs / A2A Bus                  │
│         (Orchestration, agent-to-agent protocol)     │
├─────────────────────────────────────────────────────┤
│ Layer 3: Agent Runtime (OpenCode)                   │
│         (Agent framework, skills, MCP tools)         │
├─────────────────────────────────────────────────────┤
│ Layer 2: PostgreSQL 16 + Neo4j 5.26                 │
│         (Data layer — the BRAIN)                     │
├─────────────────────────────────────────────────────┤
│ Layer 1: RuVix Kernel                               │
│         (Proof-gated mutation, system foundation)    │
└─────────────────────────────────────────────────────┘
```

**Governance Rule:** "Allura governs. Runtimes execute. Curators promote."

---

## The Brain: PostgreSQL + Neo4j + Notion

### PostgreSQL — The Chronicle (Raw Events)

**Purpose:** High-volume event logs. Append-only. Never mutate historical rows.

**Key Tables:**
| Table | Purpose |
|-------|---------|
| `events` | All agent execution traces (append-only) |
| `events_archive` | Archived events |
| `agents` | Agent registry |
| `agent_execution_records` | Detailed execution history |
| `agent_decision_records` | Decision audit trail |
| `budget_tracking` | Token/cost budget enforcement |
| `session_logs` | Session lifecycle events |
| `heartbeat_checkpoints` | Session state checkpoints |
| `promotion_requests` | HITL knowledge promotion queue |
| `curator_decisions` | Curator approval/rejection log |
| `notion_sync_log` | Notion sync status |
| `sync_drift_log` | Notion/Neo4j drift detection |

**Schema:** Every table has `group_id` (tenant isolation), `created_at`, `updated_at`.

### Neo4j — The Wisdom (Promoted Knowledge)

**Purpose:** Curated, versioned knowledge. Only promoted insights live here.

**Node Types:**
- `Agent` — Agent definitions with capabilities
- `Insight` — Promoted knowledge with versioning
- `Session` — Session summaries
- `Decision` — Architectural decisions (ADRs)
- `Pattern` — Reusable patterns

**Relationships:**
- `SUPERSEDES` — Insight versioning (v2 → v1)
- `CONTRIBUTED` — Agent → Insight (who created it)
- `LEARNED` — Agent → Session (what was learned)
- `DECIDED` — Agent → Decision (governance decisions)
- `INCLUDES` — AgentGroup → Agent (team membership)
- `KNOWS` — Agent → Agent (awareness for handoffs)

**Steel Frame Versioning:** Insights are immutable. Create new versions with `SUPERSEDES` relationships.

### Notion — The Human Workspace

**Purpose:** Human-readable knowledge hub. Synced from PostgreSQL, approved by humans, promoted to Neo4j.

**Flow:** PostgreSQL → Notion (draft) → Human approves → Neo4j (promoted)

---

## MCP_DOCKER Tools Available

### Database Tools (PostgreSQL)

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `MCP_DOCKER_connect_to_database` | Connect to database | Session start, switch databases |
| `MCP_DOCKER_list_tables` | List all tables | Explore database structure |
| `MCP_DOCKER_describe_table` | Get table schema | Understand column types |
| `MCP_DOCKER_query_database` | Natural language SQL | Quick queries, exploration |
| `MCP_DOCKER_execute_sql` | Raw SQL (SELECT only) | Precise read queries |
| `MCP_DOCKER_execute_unsafe_sql` | Raw SQL (any operation) | INSERT, UPDATE, DELETE (use with caution) |
| `MCP_DOCKER_insert_data` | Insert rows | Log events, create records |
| `MCP_DOCKER_update_data` | Update rows | Modify existing records |
| `MCP_DOCKER_delete_data` | Delete rows | Remove records (rare) |
| `MCP_DOCKER_get_current_database_info` | Connection status | Verify connection |

### Neo4j Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `MCP_DOCKER_read_neo4j_cypher` | Read from Neo4j | Query knowledge graph |
| `MCP_DOCKER_write_neo4j_cypher` | Write to Neo4j | Create/update nodes (HITL only) |

### MCP Server Management

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `MCP_DOCKER_mcp-find` | Find servers in catalog | Discover new capabilities |
| `MCP_DOCKER_mcp-add` | Add server to session | Enable new tools |
| `MCP_DOCKER_mcp-config-set` | Configure server | Set credentials, options |
| `MCP_DOCKER_mcp-exec` | Execute MCP tool | Call specific tool |
| `MCP_DOCKER_mcp-remove` | Remove server | Disable tools |

### Notion Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `MCP_DOCKER_notion-*` | Notion integration | Sync knowledge, create pages |

### Web Search Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `MCP_DOCKER_tavily_search` | Web search | Research, current info |
| `MCP_DOCKER_tavily_extract` | Extract webpage content | Read full articles |
| `MCP_DOCKER_tavily_research` | Comprehensive research | Deep dives |

---

## Universal Workflow

### 1. Session Start

```bash
# Check if memory containers are running
docker ps | grep knowledge-postgres
docker ps | grep knowledge-neo4j

# Connect to database
MCP_DOCKER_connect_to_database({ database_url: "postgresql+asyncpg://..." })

# Verify connection
MCP_DOCKER_get_current_database_info()
```

### 2. ALL Database Operations

```javascript
// ✅ CORRECT - Use MCP_DOCKER tools
MCP_DOCKER_query_database({ query: "Get recent events" })
MCP_DOCKER_execute_sql({ sql_query: "SELECT * FROM events" })
MCP_DOCKER_insert_data({ table_name: "events", columns: "...", values: "..." })

// ❌ WRONG - Never use docker exec
docker exec knowledge-postgres psql ...
```

### 3. Log Everything

```javascript
// Every significant action gets logged
MCP_DOCKER_insert_data({
  table_name: "events",
  columns: "event_type, group_id, agent_id, status, metadata",
  values: "'action_name', 'allura-project', 'agent-name', 'completed', '{\"key\": \"value\"}'"
})
```

### 4. Create Neo4j Insights (HITL Only)

```javascript
// Only after human approval
MCP_DOCKER_write_neo4j_cypher({
  query: "CREATE (i:Insight {name: 'Pattern Name', group_id: 'allura-project', ...})"
})
```

---

## Governance Model

### Tenant Isolation (group_id)

**Every record MUST have a `group_id`.** Format: `allura-{org}`

| Tenant | group_id |
|--------|----------|
| Faith Meats | `allura-faith-meats` |
| Creative Studio | `allura-creative` |
| Personal | `allura-personal` |
| Nonprofit | `allura-nonprofit` |
| Bank Audits | `allura-audits` |
| HACCP | `allura-haccp` |
| Roninmemory (this project) | `allura-roninmemory` |

**Legacy `roninclaw-*` is deprecated.**

### HITL Knowledge Promotion

Agents CANNOT autonomously promote to Neo4j/Notion. Human approval required.

```
PostgreSQL (traces) → Notion (draft) → Human approves → Neo4j (promoted)
```

### Steel Frame Versioning

Insights are immutable. Create new versions with `SUPERSEDES` relationships:

```
(v2-insight)-[:SUPERSEDES]->(v1-insight:deprecated)
```

### Budget Enforcement

Hard limits on tokens, tool calls, time, cost, steps. HALT on breach, NO auto-recovery.

---

## Agent Operating Model

### MemoryOrchestrator (Primary Agent)

- Loads memories FIRST before any action
- Presents menu, WAITs for user input
- Routes to subagents, coordinates workflows
- Logs every decision, handoff, outcome
- Never implements directly — architects design, builders build

### Subagents (The Surgical Team)

| Agent | Role | When to Use |
|-------|------|-------------|
| MemoryArchitect | System design | Architecture, technical design |
| MemoryBuilder | Implementation | Code construction |
| MemoryTester | QA | Test authoring, TDD |
| MemoryGuardian | Code review | Security audit, quality checks |
| MemoryScout | Context discovery | Find files, patterns, standards |
| MemoryChronicler | Documentation | Technical writing, ADRs |
| MemoryCurator | Task breakdown | Complex work decomposition |

### Party Mode

Multi-agent collaboration for complex decisions. Trigger with `[PM]` menu command.

---

## Error Handling Protocol

1. **STOP** — Do NOT attempt a fix yet
2. **Search Memories** — Check for known issues
3. **Evaluate Results** — If fix documented, apply it
4. **Context7 Lookup** — If no memory fix, check docs
5. **Attempt Fix** — Based on evidence only
6. **Log Result IMMEDIATELY** — Create event with fix source

**FORBIDDEN:** `See problem → Try fix → Fail → Try another → Eventually succeed → Maybe log`

**REQUIRED:** `See problem → STOP → Search memories → Read docs → Apply evidence-based fix → Log IMMEDIATELY`

---

## Verification Steps

### Before Any Database Operation

- [ ] Connected to correct database?
- [ ] Using MCP_DOCKER tools (not docker exec)?
- [ ] group_id included in all operations?
- [ ] Event logged after operation?

### Before Any Neo4j Write

- [ ] Human approval obtained?
- [ ] De-duplicated (search first)?
- [ ] SUPERSEDES relationship for versioning?
- [ ] Event logged to PostgreSQL?

### Before Session End

- [ ] All events logged to PostgreSQL?
- [ ] Neo4j insights created (if applicable)?
- [ ] Session summary written?
- [ ] Progress updated in memory-bank?

---

## Quick Reference

### Connection Strings

```
PostgreSQL: postgresql+asyncpg://ronin4life:<password>@host.docker.internal:5432/memory
Neo4j: bolt://host.docker.internal:7687
```

### Verification Commands

```bash
# PostgreSQL
docker exec knowledge-postgres pg_isready -U ronin4life -d memory

# Neo4j
curl -s http://localhost:7474 | jq .neo4j_version
```

### Common Queries

```sql
-- Recent events
SELECT * FROM events ORDER BY created_at DESC LIMIT 10;

-- Agent activity
SELECT agent_id, COUNT(*) FROM events GROUP BY agent_id;

-- Session logs
SELECT * FROM session_logs ORDER BY created_at DESC LIMIT 5;
```

---

**This is the OpenCode standard. Use it or delete your work.**