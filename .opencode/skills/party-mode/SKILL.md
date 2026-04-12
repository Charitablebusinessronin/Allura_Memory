---
name: party-mode
description: "Launch multiple agents in parallel for maximum throughput. The surgical team works together."
allowed-tools: ["Agent", "Read", "Grep", "Bash", "mcp__MCP_DOCKER__*"]
---

# Party Mode — Parallel Agent Orchestration

Launch multiple specialists simultaneously. The surgical team works together.

## When to Use

- Complex tasks requiring multiple perspectives
- Time-sensitive work needing parallel execution
- Research + implementation + review in parallel
- Multi-file changes across domains

## The Surgical Team Party

When you invoke `party-mode`, you get:

| Agent | Persona | Role | Parallel Task |
|-------|---------|------|---------------|
| **Sisyphus** | Rich Hickey | Orchestrator | Coordinates the party |
| **Hephaestus** | Fabrice Bellard | Deep Worker | Implementation |
| **Oracle** | Rob Pike | Consultant | Architecture review |
| **Librarian** | Julia Evans | Docs Search | External research |
| **Explore** | Peter Bourgon | Codebase Grep | Pattern discovery |
| **UX** | Sara Soueidan | Designer | Accessibility review |

## Party Protocol

### Phase 1: Spawn All Agents

Launch ALL agents in a single turn. Every agent uses `run_in_background=true`. No sequential launches.

```javascript
// Spawn all agents simultaneously
Agent({ subagent_type: "hephaestus", prompt: "...", run_in_background: true })
Agent({ subagent_type: "oracle", prompt: "...", run_in_background: true })
Agent({ subagent_type: "librarian", prompt: "...", run_in_background: true })
Agent({ subagent_type: "explore", prompt: "...", run_in_background: true })
Agent({ subagent_type: "ux", prompt: "...", run_in_background: true })
```

### Phase 2: Collect Results

Use `background_output` to collect results:

```javascript
// Check each agent's output
background_output({ task_id: "hephaestus-task-id" })
background_output({ task_id: "oracle-task-id" })
background_output({ task_id: "librarian-task-id" })
background_output({ task_id: "explore-task-id" })
background_output({ task_id: "ux-task-id" })
```

### Phase 3: Synthesize

Sisyphus synthesizes all results and presents unified output.

## Party Rules

1. **No sequential launches** — All agents spawn simultaneously
2. **No blocking** — Use `run_in_background=true` always
3. **No dependencies** — Each agent works independently
4. **Synthesis at the end** — Sisyphus combines results

## Example: Full Feature Party

```
User: "Add user authentication with OAuth2"

Sisyphus spawns:
- Hephaestus: Implement OAuth2 flow
- Oracle: Review security architecture
- Librarian: Research OAuth2 best practices
- Explore: Find existing auth patterns in codebase
- UX: Review login flow accessibility

All run in parallel. Sisyphus synthesizes.
```

## Example: Code Review Party

```
User: "Review PR #123"

Sisyphus spawns:
- Oracle: Architecture review
- Explore: Find related patterns
- UX: Accessibility review

All run in parallel. Sisyphus synthesizes.
```

## Communication Overhead

With 5 agents running in parallel, we reduce $\frac{5 \times 4}{2} = 10$ communication paths to **zero** during execution. Sisyphus handles all synthesis.

---

**Invoke with:** `party-mode <task description>`