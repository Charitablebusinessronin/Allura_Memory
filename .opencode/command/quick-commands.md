---
description: "Quick slash commands for Allura Memory surgical team"
allowed-tools: ["Read", "Grep", "Bash", "mcp__MCP_DOCKER__*"]
---

# Quick Slash Commands

Type these directly in your IDE for fast access to Allura Memory workflows.

## Session Commands

| Command | Action | Equivalent |
|---------|--------|------------|
| `/start` | Start session | `start-session` |
| `/end <summary>` | End session | `end-session` |
| `/dash` | Dashboard | `dashboard` |

## Task Commands

| Command | Action | Equivalent |
|---------|--------|------------|
| `/task <desc>` | Create task | `task-creator` |
| `/promote` | HITL promotion | `curator-team-promote` |
| `/review` | Code review | `code-review` |

## Memory Commands

| Command | Action | Equivalent |
|---------|--------|------------|
| `/query <term>` | Memory query | `mcp__MCP_DOCKER__search_memories` |
| `/update <target>` | Quick update | `quick-update` |
| `/party <task>` | Party mode | `party-mode` |

## Agent Shortcuts

| Shortcut | Agent | Persona |
|----------|-------|---------|
| `@sisyphus` | Sisyphus | Rich Hickey |
| `@atlas` | Atlas | Gergely Orosz |
| `@hephaestus` | Hephaestus | Fabrice Bellard |
| `@oracle` | Oracle | Rob Pike |
| `@librarian` | Librarian | Julia Evans |
| `@explore` | Explore | Peter Bourgon |
| `@prometheus` | Prometheus | Martin Fowler |
| `@ux` | UX | Sara Soueidan |

## Usage Examples

### Start a Session
```
/start
```
Loads memory, verifies infrastructure, prepares tools.

### Create a Task
```
/task Add OAuth2 authentication with Google provider
```
Generates structured task file with memory links.

### Launch Party Mode
```
/party Implement user dashboard with charts
```
Spawns all agents in parallel for maximum throughput.

### Quick Update
```
/update progress Added OAuth2 authentication
```
Updates memory-bank/progress.md and logs to Allura Brain.

### Query Memory
```
/query authentication patterns
```
Searches Allura Brain for relevant insights.

### Code Review
```
/review
```
Launches Oracle, Explore, and UX in parallel for review.

---

**All commands work with Allura Brain integration.**