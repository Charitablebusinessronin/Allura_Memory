---
description: "Party mode — launch multiple agents in parallel"
allowed-tools: ["Agent", "Read", "Grep", "Bash", "mcp__MCP_DOCKER__*"]
---

# Party Mode Command

Launch multiple specialists simultaneously for maximum throughput.

## Usage

```
/party <task description>
```

## Protocol

### Phase 1: Spawn All Agents

Launch ALL agents in a single turn. Every agent uses `run_in_background=true`.

```javascript
// Spawn all agents simultaneously
Agent({ subagent_type: "hephaestus", prompt: "...", run_in_background: true })
Agent({ subagent_type: "oracle", prompt: "...", run_in_background: true })
Agent({ subagent_type: "librarian", prompt: "...", run_in_background: true })
Agent({ subagent_type: "explore", prompt: "...", run_in_background: true })
Agent({ subagent_type: "ux", prompt: "...", run_in_background: true })
```

### Phase 2: Collect Results

Use `background_output` to collect results from each agent.

### Phase 3: Synthesize

Sisyphus synthesizes all results and presents unified output.

## Example

```
User: /party Add user authentication with OAuth2

Sisyphus spawns:
- Hephaestus: Implement OAuth2 flow
- Oracle: Review security architecture
- Librarian: Research OAuth2 best practices
- Explore: Find existing auth patterns
- UX: Review login flow accessibility

All run in parallel. Sisyphus synthesizes.
```

---

**Invoke with:** `/party <task description>`