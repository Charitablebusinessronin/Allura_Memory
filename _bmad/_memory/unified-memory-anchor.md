# Unified Memory Anchor (memory project)

## Persona baseline
Custom persona override is limited to the **Brooks** BMad Master only:
- direct, pragmatic, precise
- story-first, evidence-driven
- focused on conceptual integrity and shipping

All other BMAD agents should use their base definitions unless explicitly customized later.

## Primary Skill
The `memory` skill is a **primary skill** — auto-loaded and always available. No explicit invocation needed.

## Mandatory memory retrieval order
1. **Memory Bank files** (`memory-bank/`) - Project context, patterns, progress
2. `memory search insights` for prior knowledge
3. `memory search events` for historical traces
4. `memory log decision` for decision history
5. Project artifacts under `_bmad-output/` (planning/implementation/test)
6. Sidecars under `_bmad/_memory/`

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

## Memory Skill (unified)

### Commands

| Command | Layer | Purpose |
|---------|-------|---------|
| `memory search events "query"` | 1 | Search PostgreSQL traces |
| `memory log event <type> <data>` | 1 | Log event to PostgreSQL |
| `memory search insights "query"` | 2 | Search Neo4j knowledge |
| `memory create insight <summary>` | 2 | Create Neo4j insight |
| `memory create entity <name> <type>` | 2 | Create knowledge graph entity |
| `memory create relation <from> <to> <type>` | 2 | Link entities |
| `memory log decision <title>` | 3 | Log ADR with counterfactuals |
| `memory health` | All | Check system connections |
| `memory graph` | 2 | Read full knowledge graph |

### Usage Patterns

**Search for prior knowledge:**
```
memory search insights "authentication"
memory search events "mistake"
```

**Store learned knowledge:**
```
memory create insight "Use group_id for all database operations"
memory create entity "Qwen3" "Model"
memory create relation "Qwen3" "Ollama" "RUNS_ON"
```

**Record decisions:**
```
memory log decision "Use Ollama for embeddings"
  --alternatives "OpenAI: cost, Custom: effort"
  --context "Reduce API costs"
```

## Memory Types

| Type | Use Case | Example |
|------|----------|---------|
| Insight | Learned knowledge, best practices | `ins_17540` |
| Decision | Architectural/process decisions | `adr_001` |
| Event | Raw execution traces | `evt_17530` |
| Entity | Knowledge graph nodes | `Qwen3` |

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
proposed → active → deprecated → archived
              ↓
         revision (creates new version via SUPERSEDES)
```

### Status Meanings
- `proposed`: Created but not validated
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

The memory system exposes MCP tools for direct invocation:

| Tool | Layer | Purpose |
|------|-------|---------|
| `MCP_DOCKER_create_entities` | 2 | Create entities in knowledge graph |
| `MCP_DOCKER_create_relations` | 2 | Link entities |
| `MCP_DOCKER_search_memories` | 2 | Search knowledge graph |
| `MCP_DOCKER_read_graph` | 2 | Read full graph |
| `unified-memory_log_event` | 1 | Log event to PostgreSQL |
| `unified-memory_search_events` | 1 | Search PostgreSQL traces |
| `unified-memory_create_insight` | 2 | Create Neo4j insight |
| `unified-memory_search_insights` | 2 | Search Neo4j insights |
| `unified-memory_log_decision` | 3 | Log ADR decision |
