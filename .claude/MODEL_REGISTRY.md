# Agent Model Registry
# Allura Agent-OS — cross-runtime model mapping
# Update this file whenever a model is changed in either runtime.
# This is the authoritative contract between OpenCode and Claude Code agent equivalents.

version: "1.0.0"
last_updated: "2026-04-06"

## Mapping

| Agent Role         | OpenCode Agent       | OpenCode Model  | Claude Code Agent          | Claude Model        | Behavioral Notes                                              |
|--------------------|----------------------|-----------------|----------------------------|---------------------|---------------------------------------------------------------|
| Orchestrator       | MemoryOrchestrator   | glm-5-cloud     | memory-orchestrator        | claude-opus-4-6     | Brooks persona in Claude Code; loop enforcement in prompt     |
| Architect          | MemoryArchitect      | (runtime default)| brooks-architect           | claude-opus-4-6     | CA/VA commands; ADR discipline identical                      |
| Builder            | MemoryBuilder        | (runtime default)| memory-builder             | claude-sonnet-4-6   | Write templates identical; Postgres append-only enforced      |
| Guardian           | MemoryGuardian       | (runtime default)| memory-guardian            | claude-sonnet-4-6   | HITL gating identical; invariant checklist identical          |
| Scout              | MemoryScout          | (runtime default)| memory-scout               | claude-sonnet-4-6   | Memory-first search pattern identical; tools differ (see note)|
| Analyst            | MemoryAnalyst        | (runtime default)| memory-analyst             | claude-sonnet-4-6   | SQL/Cypher queries identical; report formats identical        |
| Chronicler         | MemoryChronicler     | (runtime default)| memory-chronicler          | claude-sonnet-4-6   | ADR format identical; Notion sync uses Smithery MCP           |
| Gap Auditor        | (no equivalent)      | —               | architecture-gap-auditor   | claude-sonnet-4-6   | Claude Code only — no OpenCode counterpart                    |

## Tool Differences (Claude Code vs OpenCode)

| Capability         | OpenCode Tool               | Claude Code Equivalent                        |
|--------------------|-----------------------------|-----------------------------------------------|
| Web search         | Exa                         | mcp__MCP_DOCKER__web_search_exa               |
| Deep research      | Hyperbrowser / Playwright   | mcp__MCP_DOCKER__tavily_research              |
| Neo4j reads        | memory() wrapper            | mcp__memory__* tools                          |
| Neo4j writes       | memory() wrapper            | mcp__memory__* tools (HITL via curator)       |
| Postgres reads     | MCP_DOCKER_execute_sql      | mcp__MCP_DOCKER__execute_sql                  |
| Postgres writes    | MCP_DOCKER_insert_data      | mcp__MCP_DOCKER__insert_data                  |
| Notion sync        | Notion MCP                  | mcp__claude_ai_Notion__* (Smithery)           |
| Agent dispatch     | A2A Bus (menu.yaml runtime) | Agent tool (prompt-enforced loop)             |

## Behavioral Parity Contract

The following behaviors MUST be identical across both runtimes:

- Terminal signals: `DONE:` / `BLOCKED:` / `ACTION:` — same semantics, same enforcement
- Write-back contract: every run with on_complete=write_back produces ≥1 Postgres event + ≥1 Neo4j node
- group_id: `allura-system` on all writes — no exceptions
- HITL gate: no Postgres → Neo4j promotion without human approval
- Append-only: no UPDATE/DELETE on Postgres event rows

## Known Divergences

1. **Loop enforcement location:** OpenCode enforces max_steps at runtime (menu.yaml). Claude Code enforces via prompt instructions. Prompt enforcement is advisory; runtime enforcement is hard. This is an accepted gap — the `memory() wrapper` implementation (Story 1.2) will close it.

2. **glm-5-cloud vs claude-opus-4-6:** The Orchestrator models differ. GLM-5 is a Chinese LLM optimized for instruction-following; Claude Opus 4.6 is larger and more reasoning-capable. The Brooks persona behavior in the Claude Code Orchestrator compensates with explicit loop discipline in the prompt.

3. **Context7 / YouTube Transcript:** Not available in Claude Code session. MemoryScout uses Tavily and Exa instead.
