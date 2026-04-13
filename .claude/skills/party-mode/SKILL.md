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
| **Brooks** | Rich Hickey | Orchestrator | Coordinates the party |
| **Woz** | Fabrice Bellard | Deep Worker | Implementation |
| **Pike** | Rob Pike | Consultant | Architecture review |
| **Scout** | Julia Evans | Docs Search | External research |
| **Scout** | Peter Bourgon | Codebase Grep | Pattern discovery |
| **UX** | Sara Soueidan | Designer | Accessibility review |

## Party Protocol

### Phase 1: Spawn All Agents

Launch ALL agents in a single turn. Every agent uses `run_in_background=true`. No sequential launches.

```javascript
// Spawn all agents simultaneously
Agent({ subagent_type: "WOZ_BUILDER", prompt: "...", run_in_background: true })
Agent({ subagent_type: "PIKE_INTERFACE_REVIEW", prompt: "...", run_in_background: true })
Agent({ subagent_type: "SCOUT_RECON", prompt: "...", run_in_background: true })
Agent({ subagent_type: "SCOUT_RECON", prompt: "...", run_in_background: true })
Agent({ subagent_type: "ux", prompt: "...", run_in_background: true })
```

### Phase 2: Collect Results

Use `background_output` to collect results:

```javascript
// Check each agent's output
background_output({ task_id: "woz-builder-task-id" })
background_output({ task_id: "pike-interface-review-task-id" })
background_output({ task_id: "scout-recon-task-id" })
background_output({ task_id: "scout-recon-task-id" })
background_output({ task_id: "ux-task-id" })
```

### Phase 3: Synthesize

Brooks synthesizes all results and presents unified output.

## Party Rules

1. **No sequential launches** — All agents spawn simultaneously
2. **No blocking** — Use `run_in_background=true` always
3. **No dependencies** — Each agent works independently
4. **Synthesis at the end** — Brooks combines results

## Example: Full Feature Party

```
User: "Add user authentication with OAuth2"

Brooks spawns:
- Woz: Implement OAuth2 flow
- Pike: Review security architecture
- Scout: Research OAuth2 best practices
- Scout: Find existing auth patterns in codebase
- UX: Review login flow accessibility

All run in parallel. Brooks synthesizes.
```

## Example: Code Review Party

```
User: "Review PR #123"

Brooks spawns:
- Pike: Architecture review
- Scout: Find related patterns
- UX: Accessibility review

All run in parallel. Brooks synthesizes.
```

## Communication Overhead

With 5 agents running in parallel, we reduce $\frac{5 \times 4}{2} = 10$ communication paths to **zero** during execution. Brooks handles all synthesis.

---

**Invoke with:** `party-mode <task description>`