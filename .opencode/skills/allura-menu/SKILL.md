---
name: allura-menu
description: "Interactive menu for Allura Memory surgical team. Quick prompts for common workflows."
allowed-tools: ["Read", "Grep", "Bash", "mcp__MCP_DOCKER__*"]
---

# Allura Menu — Quick Prompts

Interactive menu for common Allura Memory workflows.

## Menu Structure

```
╔═══════════════════════════════════════════════════════════════╗
║                    ALLURA MEMORY MENU                        ║
╠═══════════════════════════════════════════════════════════════╣
║  [1] 🚀 Start Session      — Load memory, verify infra       ║
║  [2] 📋 Create Task        — Generate structured task         ║
║  [3] 🎉 Party Mode         — Launch parallel agents           ║
║  [4] 📝 Quick Update        — Sync docs with memory            ║
║  [5] 🔍 Code Review        — Surgical team review             ║
║  [6] 📊 Dashboard           — View system status               ║
║  [7] 🧠 Memory Query       — Search Allura Brain              ║
║  [8] 📤 Promote            — HITL promotion workflow           ║
║  [9] 🏁 End Session        — Persist and archive              ║
║  [0] ❓ Help               — Show this menu                    ║
╚═══════════════════════════════════════════════════════════════╝
```

## Menu Options

### [1] 🚀 Start Session

**Trigger:** `start-session`

**What it does:**
- Verifies Neo4j and PostgreSQL connectivity
- Hydrates context from Allura Brain
- Reads memory-bank files in order
- Logs session start

**Equivalent command:** `/start-session`

---

### [2] 📋 Create Task

**Trigger:** `task-creator`

**What it does:**
- Gathers context from Allura Brain
- Generates structured task file
- Links to memory insights
- Assigns to appropriate agent

**Equivalent skill:** `task-creator <description>`

---

### [3] 🎉 Party Mode

**Trigger:** `party-mode`

**What it does:**
- Launches all agents in parallel
- Each agent works independently
- Sisyphus synthesizes results
- Maximum throughput

**Equivalent skill:** `party-mode <task>`

---

### [4] 📝 Quick Update

**Trigger:** `quick-update`

**What it does:**
- Updates memory-bank files
- Syncs with Allura Brain
- Logs changes
- Maintains consistency

**Equivalent skill:** `quick-update <target> <changes>`

---

### [5] 🔍 Code Review

**Trigger:** `code-review`

**What it does:**
- Oracle reviews architecture
- Explore finds patterns
- UX reviews accessibility
- Sisyphus synthesizes

**Equivalent skill:** `code-review`

---

### [6] 📊 Dashboard

**Trigger:** `dashboard`

**What it does:**
- Shows system status
- Displays active tasks
- Lists recent insights
- Shows blockers

**Equivalent command:** `/dashboard`

---

### [7] 🧠 Memory Query

**Trigger:** `memory-query`

**What it does:**
- Searches Allura Brain
- Returns relevant insights
- Links to related entities
- Shows confidence scores

**Usage:** `memory-query <search term>`

---

### [8] 📤 Promote

**Trigger:** `curator-team-promote`

**What it does:**
- Proposes promotion from PostgreSQL to Neo4j
- Runs curator team workflow
- Requires HITL approval
- Logs to audit trail

**Equivalent command:** `/curator-team-promote`

---

## Menu Options

### [9] 🏁 End Session

**Trigger:** `end-session`

**What it does:**
- Persists session reflection to Neo4j
- Logs completion to PostgreSQL
- Archives temporary files
- Updates progress

**Equivalent command:** `/end-session <summary>`

---

### [0] ❓ Help

**Trigger:** `help`

**What it does:**
- Shows this menu
- Lists available skills
- Shows current context
- Displays agent status

---

## Quick Prompts

Type these directly in your IDE:

| Prompt | Action |
|--------|--------|
| `start` | Start session |
| `task <desc>` | Create task |
| `party <task>` | Launch party mode |
| `update <target>` | Quick update |
| `review` | Code review |
| `dash` | Dashboard |
| `query <term>` | Memory query |
| `promote` | HITL promotion |
| `end <summary>` | End session |

---

## Agent Shortcuts

| Agent | Shortcut | Persona |
|-------|----------|---------|
| Sisyphus | `@sisyphus` | Rich Hickey |
| Atlas | `@atlas` | Gergely Orosz |
| Hephaestus | `@hephaestus` | Fabrice Bellard |
| Oracle | `@oracle` | Rob Pike |
| Librarian | `@librarian` | Julia Evans |
| Explore | `@explore` | Peter Bourgon |
| Prometheus | `@prometheus` | Martin Fowler |
| UX | `@ux` | Sara Soueidan |

---

**Invoke with:** `allura-menu` or type any quick prompt directly.