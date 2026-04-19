# Agent Model Registry
# Allura Agent-OS — cross-runtime model mapping
# Update this file whenever a model is changed in either runtime.
# This is the authoritative contract between OpenCode and Claude Code agent equivalents.

version: "3.0.0"
last_updated: "2026-04-18"

## Primary Assignments

| Agent        | Role           | Primary Model                      | Specialist Override                    | Fallback Model          |
|--------------|----------------|------------------------------------|---------------------------------------|-------------------------|
| brooks       | Orchestrator   | openai/gpt-5.4                    | —                                     | ollama-cloud/glm-5.1    |
| hightower    | Infra          | openai/gpt-5.4                    | —                                     | ollama-cloud/glm-5.1    |
| jobs         | Strategy       | ollama-cloud/kimi-k2.5            | —                                     | ollama-cloud/glm-5.1    |
| scout        | Search/Triage  | ollama-cloud/nemotron-3-super      | —                                     | ollama-cloud/glm-5.1    |
| woz          | Code           | ollama-cloud/qwen3-coder-next     | —                                     | ollama-cloud/glm-5.1    |
| bellard      | Code/Diag      | ollama-cloud/glm-5.1              | —                                     | ollama-cloud/glm-5.1    |
| carmack      | Code/Perf      | ollama-cloud/qwen3-coder-next     | —                                     | ollama-cloud/glm-5.1    |
| knuth        | Code/Data      | ollama-cloud/glm-5.1              | —                                     | ollama-cloud/glm-5.1    |
| fowler       | Code/Refactor  | ollama-cloud/glm-5.1              | —                                     | ollama-cloud/glm-5.1    |
| pike         | Code/Interface | openai/gpt-5.4-mini               | —                                     | ollama-cloud/glm-5.1    |

## Specialist Override Tasks

Specialist overrides activate when the task type matches. The agent stays on its primary model for all other work.

| Agent    | Specialist Model                    | Override Tasks                                        |
|----------|-------------------------------------|-------------------------------------------------------|
| (none)   | —                                   | No specialist overrides defined in current frontmatter |

## Global Default (opencode.json)

```json
{
  "model": "ollama-cloud/glm-5.1"
}
```

> All agents without an explicit `model:` field inherit this. Fallback activates on credit exhaustion or API error.

## Agent Frontmatter (per .md file)

```yaml
# brooks.md / hightower.md
model: openai/gpt-5.4

# jobs.md
model: ollama-cloud/kimi-k2.5

# scout.md
model: ollama-cloud/nemotron-3-super

# woz.md / carmack.md
model: ollama-cloud/qwen3-coder-next

# bellard.md / fowler.md / knuth.md
model: ollama-cloud/glm-5.1

# pike.md
model: openai/gpt-5.4-mini
```

## Cross-Runtime Mapping

| Agent Role         | OpenCode Agent       | OpenCode Model              | Claude Code Agent          | Claude Model        | Behavioral Notes                                              |
|--------------------|----------------------|-----------------------------|----------------------------|---------------------|---------------------------------------------------------------|
| Orchestrator       | MemoryOrchestrator   | ollama-cloud/glm-5.1        | memory-orchestrator        | claude-opus-4-6     | Brooks persona in Claude Code; loop enforcement in prompt     |
| Architect          | MemoryArchitect      | ollama-cloud/gpt-5.4        | brooks-architect           | claude-opus-4-6     | CA/VA commands; ADR discipline identical                      |
| Builder            | MemoryBuilder        | ollama-cloud/gpt-5.4-mini   | memory-builder             | claude-sonnet-4-6   | Write templates identical; Postgres append-only enforced      |
| Guardian           | MemoryGuardian       | ollama-cloud/glm-5.1        | memory-guardian            | claude-sonnet-4-6   | HITL gating identical; invariant checklist identical          |
| Scout              | MemoryScout          | ollama-cloud/gpt-5.4-nano   | memory-scout               | claude-sonnet-4-6   | Memory-first search pattern identical; tools differ (see note)|
| Analyst            | MemoryAnalyst        | ollama-cloud/gpt-5.4-mini   | memory-analyst             | claude-sonnet-4-6   | SQL/Cypher queries identical; report formats identical        |
| Chronicler         | MemoryChronicler     | ollama-cloud/gpt-5.4-mini   | memory-chronicler          | claude-sonnet-4-6   | ADR format identical; Notion sync uses Smithery MCP           |
| Gap Auditor        | (no equivalent)      | —                           | architecture-gap-auditor   | claude-sonnet-4-6   | Claude Code only — no OpenCode counterpart                    |

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

## Model Rationale

| Model                              | Why                                                                        |
|------------------------------------|----------------------------------------------------------------------------|
| ollama-cloud/gpt-5.4               | Best intelligence for orchestration, strategy, and infra reasoning         |
| ollama-cloud/gpt-5.4-mini          | Strongest mini model for coding subagents (review, refactor, data)        |
| ollama-cloud/nemotron-3-super:cloud | Fast wide-context scanning for recon; internal benchmark: 1.63s avg latency |
| ollama-cloud/qwen3-coder-next:cloud | Coding specialist — 262K context, optimized for codegen and repo surgery  |
| ollama-cloud/gpt-5.4-nano          | Cheapest for tiny lookups, path checks, and prefiltering                   |
| ollama-cloud/kimi-k2.5             | Jobs primary — fast intent gating and scope control                      |
| ollama-cloud/glm-5.1               | Universal fallback — instruction-following, always-on                      |

> **Note:** The 1.63s latency claim for Nemotron is internal benchmark data, not a generally established property. Validate with per-agent harness evals before locking.

## Known Divergences

1. **Loop enforcement location:** OpenCode enforces max_steps at runtime (menu.yaml). Claude Code enforces via prompt instructions. Prompt enforcement is advisory; runtime enforcement is hard. This is an accepted gap — the `memory() wrapper` implementation (Story 1.2) will close it.

2. **ollama-cloud/glm-5.1 vs claude-opus-4-6:** The Orchestrator models differ. GLM-5.1 is a Chinese LLM optimized for instruction-following; Claude Opus 4.6 is larger and more reasoning-capable. The Brooks persona behavior in the Claude Code Orchestrator compensates with explicit loop discipline in the prompt.

3. **Context7 / YouTube Transcript:** Not available in Claude Code session. MemoryScout uses Tavily and Exa instead.

## Excluded Models

| Model                      | Reason                                                     |
|----------------------------|------------------------------------------------------------|
| qwen3-coder-next           | Removed per owner decision                                 |
| gpt-oss:120b-cloud         | Removed per owner decision                                 |
| gemma3:27b-cloud           | Removed per owner decision                                 |
| deepseek-v3.1:671b-cloud   | Removed per owner decision                                 |
