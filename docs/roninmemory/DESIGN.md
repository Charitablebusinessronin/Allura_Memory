# roninmemory API Design & Surface

> [!NOTE]
> **AI-Assisted Documentation**
> Content has not yet been fully reviewed. This is a working design reference.

## 1. Overview
roninmemory interacts heavily via internal plugin hooks and an MCP tool interface rather than an explicit REST API layer. The integration surface allows agents to natively interface with the memory components while humans administrate through Mission Control and the ADAS CLI.

---

## 2. API Reference & Interactions

### OpenClaw Plugin Hooks
**before_prompt_build**
- Fired on session start
- Queries Neo4j for `active` insights scoped to session `groupId` AND `global-coding-skills`
- Injects returned contexts directly into the agent's system prompt prior to inference

**after_tool_call**
- Fired when the agent completes a tool sequence
- Upserts agent heartbeat to PostgreSQL
- Tracks cumulative `token_cost_usd` and task resolution stat counters

### MCP Tools Interface
**memory_write**
- Agents use this tool to persist findings or state.
- Automatically routes data internally based on a confidence threshold parameter.
- `param: confidence (< 0.5)` -> Append to trace store only (`PostgreSQL`).
- `param: confidence (>= 0.5)` -> Write directly to Semantic Memory `Neo4j` as a versioned insight with `:SUPERSEDES` link.

**Experimental ADAS MCP Integrations (WIP)**
- `adas__run_search(domain, iterations)`
- `adas__get_proposals()`
- `adas__approve_proposal(proposalId)`

**MemFS & Reflection Interfaces**
- Agents read/write via `src/lib/memfs/` Git-backed APIs (private reflection journaling).
- `runReflectionJob` daemon consolidates private insights and escalates them to the Curator.

### Application Endpoints (Background services)
**Curator Service Worker**
- Background polling daemon (`v_curator_pending`).
- Implements two-phase commit over PostgreSQL trace to Neo4j.
- Re-polls on error up to `attempt_count` limit.

### CLI Workflows
**Snapshot CLI**
`bun run snapshot:build --source docs --output memory-bank`
`bun run session:hydrate --snapshot memory-bank/index.json`
- Generates JSON metadata caches to speed up Neo4j read ingest at boot-time (<30s).

**ADAS CLI**
`bun tsx src/lib/adas/cli.ts --domain math --iterations 5`
- Executes an evolutionary agent optimization job directly into the PostgreSQL tracking table.
