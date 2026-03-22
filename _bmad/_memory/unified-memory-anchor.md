# Unified Memory Anchor (memory project)

## Persona baseline
Custom persona override is limited to the **Brooks** BMad Master only:
- direct, pragmatic, precise
- story-first, evidence-driven
- focused on conceptual integrity and shipping

All other BMAD agents should use their base definitions unless explicitly customized later.

## Mandatory memory retrieval order
1. **Memory Bank files** (`memory-bank/`) - Project context, patterns, progress
2. `memory_search` for prior work/decisions/dates/preferences/todos
3. `memory_get` for only the needed lines/snippets
4. Project artifacts under `_bmad-output/` (planning/implementation/test)
5. Sidecars under `_bmad/_memory/`

## Memory Bank Structure
The project uses a structured memory bank following the Tweag agentic coding handbook pattern:

| File | Purpose |
|------|---------|
| `projectbrief.md` | Overall scope and goals |
| `productContext.md` | UX, users, and problems being solved |
| `systemPatterns.md` | Architecture, design patterns, and decisions |
| `techContext.md` | Stack, dependencies, and constraints |
| `activeContext.md` | Current task, context, and working notes |
| `progress.md` | Status log of what's done and what's pending |

## Memory Skills (bmad-memory-*)

### bmad-memory-store
Store new memories (insights, decisions, research, patterns) into the knowledge graph.

**Usage:**
- "Save this insight..."
- "Store this decision..."
- "Remember this..."

**Key topic_key format:** `{group_id}.{type}.{identifier}`
- Example: `roninos.insight.deepseek-cost-efficiency`

### bmad-memory-search
Search for existing memories by content, type, or keywords.

**Usage:**
- "Search for anything about..."
- "Find previous decisions about..."
- "What do we know about..."

**Parameters:**
- `query` (required): Search terms
- `group_id` (required): Tenant identifier (e.g., `roninos`, `faith-meats`)
- `types` (optional): Filter by node type
- `confidence_min` (optional): Minimum confidence threshold

### bmad-memory-get
Retrieve a specific memory by topic_key with optional history and evidence.

**Usage:**
- "Get the DeepSeek insight"
- "Show memory roninos.insight.deepseek"
- "What's the current version of..."

**Parameters:**
- `topic_key` (required): Memory identifier
- `group_id` (required): Tenant identifier
- `include_history` (optional): Show all versions
- `include_evidence` (optional): Show supporting traces

## Memory Types

| Type | Use Case | Example topic_key |
|------|----------|-------------------|
| Insight | Learned knowledge, best practices | `roninos.insight.deepseek-cost` |
| Decision | Architectural/process decisions | `roninos.decision.neo4j-storage` |
| Research | Domain research findings | `roninos.research.agent-lifecycle` |
| ADR | Agent Decision Records | `roninos.adr.001-auth-pattern` |
| Pattern | Code/process patterns | `roninos.pattern.steel-frame` |
| Agent | Agent definitions | `roninos.agent.bmad-master` |

## Group IDs

### Reserved
- `global` - Shared knowledge across all projects
- `system` - System-level configurations
- `test` - Testing and fixtures

### Project-Specific
- `roninos` - Main Roninos agent framework
- `faith-meats` - Faith Meats e-commerce automation
- `memory` - Memory system itself

## Memory Lifecycle

```
draft → testing → active → deprecated → archived
           ↓
    promotion (requires approval)
```

### Status Meanings
- `draft`: Created but not validated
- `testing`: Under evaluation
- `active`: Approved for production use
- `deprecated`: No longer recommended
- `archived`: Historical reference only

## Write discipline
- Keep raw evidence/logs append-only.
- Promote only reviewed/approved insights into curated docs.
- Record significant outcomes so future runs can reuse them.
- Update `activeContext.md` when starting new work.
- Update `progress.md` when completing tasks.

## Path conventions
- Memory Bank: `{project-root}/memory-bank/`
- Output artifacts: `{project-root}/_bmad-output/`
- Memory sidecars: `{project-root}/_bmad/_memory/`
- Memory library: `{project-root}/src/lib/memory/`

## MCP Integration

The memory system exposes an MCP server for tool integration:

```json
{
  "mcpServers": {
    "memory": {
      "url": "http://127.0.0.1:3001/mcp",
      "description": "Neo4j + PostgreSQL memory"
    }
  }
}
```

### Available MCP Tools

1. **memory_search** - Search knowledge graph
2. **memory_get** - Retrieve specific memory
3. **memory_store** - Create new memory
4. **memory_promote** - Activate a draft memory
5. **memory_deprecate** - Mark memory as deprecated
6. **memory_archive** - Archive a memory
