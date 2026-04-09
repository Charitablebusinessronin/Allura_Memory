# OpenCode Plugin Architecture

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has been reviewed against Brooksian architectural principles and should be kept in sync with source-of-truth docs.
> When in doubt, defer to code, schemas, and team consensus.

## Overview

The OpenCode harness is a **plugin orchestrator** that enforces conceptual integrity:

- **Brooks decides** — No auto-discovery, no auto-routing
- **Harness executes** — Explicit approval, explicit delegation
- **Team knows what's happening** — All events logged

## Architecture

```
.opencode/
├── commands/           # Slash commands (user-facing)
│   ├── mcp-discover.md
│   ├── mcp-approve.md
│   ├── mcp-load.md
│   ├── skill-load.md
│   └── skill-propose.md
├── harness/           # Core orchestrator
│   ├── index.ts       # Main router
│   ├── mcp-plugin-loader.ts  # MCP discovery + loading
│   └── skill-loader.ts       # Skill discovery + execution
├── plugin/            # Registry (manually curated)
│   ├── mcp-registry.yaml     # MCP servers (approved + pending)
│   └── allura-memory.md      # Local plugin config
├── skills/            # Task templates
│   ├── allura-menu/
│   ├── code-review/
│   ├── task-creator/
│   └── ...
└── agent/             # Agent definitions
    ├── core/          # Primary agents (brooks, atlas, etc.)
    └── subagents/     # Specialists (hopper, cerf, etc.)
```

## Integration Points

### 1. Separate from OpenCode

The `.opencode/` directory is **self-contained**. It does not depend on external systems for core functionality.

- **Commands** are defined in `.opencode/commands/`
- **Agents** are defined in `.opencode/agent/`
- **Skills** are defined in `.opencode/skills/`
- **Registry** is defined in `.opencode/plugin/mcp-registry.yaml`

### 2. Wired to Postgres

All events are logged (append-only) to PostgreSQL:

```typescript
interface HarnessEvent {
  event_type: string;      // "MCP_LOADED", "SKILL_EXECUTED", etc.
  group_id: string;        // "allura-system"
  agent_id: string;        // "brooks", "atlas", etc.
  status: "pending" | "completed" | "failed";
  metadata: Record<string, unknown>;
  timestamp: string;      // ISO 8601
}
```

**Implementation**: Uncomment `logEvent()` in `harness/index.ts` and wire to `src/lib/postgres/client.ts`.

### 3. Ready for Neo4j Promotion

Decisions that affect the knowledge graph route through the Curator:

```
Brooks proposes insight
  ↓
Curator queue (Postgres)
  ↓
HITL approval (curator:approve)
  ↓
Promote to Neo4j (SUPERSEDES versioning)
```

**Implementation**: Use `mcp__MCP_DOCKER__write_neo4j_cypher` for promotion.

### 4. Uses MCP Docker Toolkit

MCP servers are loaded via the existing `mcp_add()` tool:

```typescript
// In harness/mcp-plugin-loader.ts
async loadServer(serverId: string): Promise<LoadResult> {
  const server = this.registry.find(s => s.id === serverId);
  
  if (!server || !server.approved) {
    return { success: false, message: "Server not approved" };
  }
  
  // Call actual MCP Docker tool
  // await mcp_add(server.id);
  
  return { success: true, tools: [] };
}
```

## Command Flow

### MCP Discovery

```
User: /mcp-discover database
  ↓
harness.discoverMCP("database")
  ↓
Returns: { approved: [...], unapproved: [...], prompt: "..." }
  ↓
User sees list + approval instructions
```

### MCP Approval

```
User: /mcp-approve postgresql-mcp
  ↓
harness.approveMCP("postgresql-mcp")
  ↓
Updates mcp-registry.yaml (approved: true)
  ↓
Logs event to Postgres
  ↓
Returns: "Ready to load with /mcp-load postgresql-mcp"
```

### Skill Loading

```
User: /skill-load code-review --executor oracle
  ↓
harness.loadSkill("code-review", "oracle")
  ↓
Loads from .opencode/skills/code-review/SKILL.md
  ↓
Logs event to Postgres
  ↓
Returns: instruction for @oracle to execute
```

## Governance

### Brooksian Principles

1. **Explicit Approval** — No auto-discovery. Brooks/user approves before loading.
2. **Explicit Delegation** — No auto-routing. Brooks decides which agent executes.
3. **Manual Curation** — Registry is hand-curated. No auto-fetch from external sources.
4. **Event Logging** — All actions logged to Postgres (append-only).
5. **HITL Promotion** — Knowledge graph changes require human approval.

### Constraints

```yaml
# In mcp-registry.yaml
constraints:
  max_mcp_servers: 20        # Bounded complexity
  require_approval: true      # No auto-load
  audit_writes: true         # Log all mutations
  hitl_promotion: true       # Curator gate for Neo4j
```

## Next Actions

1. **Test locally** — `bun run .opencode/harness/index.ts status`
2. **Wire Postgres logging** — Uncomment + implement `logEvent()` in `harness/index.ts`
3. **Integrate with .claude commands** — Route `/mcp-discover` from Claude Code to the harness
4. **Extend MCP registry** — Add verified servers as needed
5. **Refine skill frontmatter parsing** — Extract metadata from `SKILL.md` files

---

**Principle**: "Allura governs. Runtimes execute. Curators promote."

The harness is architecture-first, not feature-first. It enforces conceptual integrity: Brooks decides, the harness executes, the team knows what's happening.