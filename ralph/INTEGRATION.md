# Ralph Integration Summary

**Date**: 2026-04-11
**Status**: Ready for installation and testing

---

## What Was Created

### 1. RalphLoop Subagent Definition
**File**: `.opencode/agent/subagents/core/ralph-loop.md`

Defines RalphLoop as a toolsmith subagent in the Brooksian surgical team. Role: autonomous iteration runner for tasks with clear completion criteria.

### 2. Ralph Integration Contract
**File**: `.opencode/contracts/ralph-integration.md`

Defines:
- When to use Ralph (NIGHT_BUILD, clear criteria)
- When NOT to use Ralph (DAY_BUILD, architecture decisions)
- Routing policy updates
- PRD format recommendations
- Allura-specific rules

### 3. Agent Metadata Update
**File**: `.opencode/config/agent-metadata.json`

Added `ralph-loop` subagent entry with dependencies on task-delegation-basics and ralph-integration contract.

### 4. Features JSON (Ralph Format)
**File**: `ralph/features.json`

Converted `ralph/prd.json` to the recommended JSON feature list format based on Anthropic's research. This format reduces the chance of agents modifying test definitions.

### 5. Allura-Ralph Wrapper Script
**File**: `ralph/allura-ralph.sh`

Executable script that:
- Checks for ralph CLI installation
- Validates features.json exists
- Displays Allura-specific rules
- Runs Ralph with proper configuration
- Supports custom iterations and agent selection

---

## Installation Steps

### Step 1: Install Ralph CLI

```bash
npm install -g @th0rgal/ralph-wiggum
```

Or via Bun:

```bash
bun add -g @th0rgal/ralph-wiggum
```

### Step 2: Verify Installation

```bash
ralph --version
ralph --help
```

### Step 3: Test Integration

```bash
cd /home/ronin704/Projects/allura\ memory
./ralph/allura-ralph.sh 5 claude-code
```

This runs a 5-iteration test loop.

---

## Usage Examples

### Basic Epic Completion

```bash
# Run with defaults (50 iterations, claude-code)
./ralph/allura-ralph.sh

# Custom iterations
./ralph/allura-ralph.sh 30

# Custom agent
./ralph/allura-ralph.sh 50 opencode

# Custom agent and model
./ralph/allura-ralph.sh 50 claude-code claude-opus-4
```

### Monitor from Another Terminal

```bash
# Show status
ralph --status

# Show status with tasks
ralph --status --tasks

# Inject hint if struggling
ralph --add-context "Check trace-logger.ts for syscall routing"

# Clear pending context
ralph --clear-context
```

### Direct Ralph Usage

```bash
# Run Ralph directly (without wrapper)
ralph "Read ralph/features.json. Work through each feature. Update passes to true when verified. Output <promise>COMPLETE</promise> when all pass." \
  --tasks \
  --max-iterations 50 \
  --agent claude-code \
  --model claude-sonnet-4

# With agent rotation
ralph "..." \
  --rotation "claude-code:claude-sonnet-4,opencode:claude-sonnet-4" \
  --max-iterations 50
```

---

## Integration with Harness

### DAY_BUILD Mode

**Do NOT use Ralph.** DAY_BUILD requires approval gates for every decision.

Use standard workflow:
```
ContextScout → OpenAgent → Approval → Implementation
```

### NIGHT_BUILD Mode

**Ralph is preferred.** NIGHT_BUILD is designed for autonomous execution.

Workflow:
```
1. Brooks reviews architecture (ADR created)
2. TaskManager breaks down epic into stories
3. RalphLoop executes each story autonomously
4. Brooks reviews results, logs completion
```

---

## Allura-Specific Rules

When using Ralph with Allura, these rules are NON-NEGOTIABLE:

1. **bun only** — never npm, npx, or node directly
2. **Postgres is append-only** — INSERT only, never UPDATE/DELETE on events table
3. **group_id required** — every DB operation must include group_id with allura-* format
4. **Kernel routing** — trace writes go through RuVixKernel.syscall('trace'), not direct inserts
5. **Neo4j versioning** — use SUPERSEDES relationships, never edit existing nodes
6. **HITL required** — never autonomously promote to Neo4j without going through curator flow
7. **MCP_DOCKER tools only** — never docker exec for database operations

These rules are enforced via:
- `ralph/CLAUDE.md` (prompt file)
- `ralph/allura-ralph.sh` (wrapper script)
- `.opencode/contracts/ralph-integration.md` (contract)

---

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `.opencode/agent/subagents/core/ralph-loop.md` | Created | Subagent definition |
| `.opencode/contracts/ralph-integration.md` | Created | Integration contract |
| `.opencode/config/agent-metadata.json` | Modified | Added ralph-loop entry |
| `ralph/features.json` | Created | Ralph-format feature list |
| `ralph/allura-ralph.sh` | Created | Wrapper script |
| `ralph/INTEGRATION.md` | Created | This file |

---

## Next Steps

1. **Install Ralph CLI**: `npm install -g @th0rgal/ralph-wiggum`
2. **Test integration**: `./ralph/allura-ralph.sh 5`
3. **Run Epic 1**: `./ralph/allura-ralph.sh 50`
4. **Monitor progress**: `ralph --status` (from another terminal)
5. **Inject hints if needed**: `ralph --add-context "your hint"`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ralph: command not found` | Install: `npm install -g @th0rgal/ralph-wiggum` |
| Loop never terminates | Check prompt includes `<promise>COMPLETE</promise>` |
| Agent modifies test definitions | Use JSON feature list format (already done) |
| Agent loops on question | Use `--no-questions` or answer interactively |
| Plugin conflicts (OpenCode) | Use `--no-plugins` |
| Model not found | Set model in opencode.json or use `--model` |
| Struggle detected | Use `--add-context` to inject hints |

---

## See Also

- [Open Ralph Wiggum GitHub](https://github.com/Th0rgal/open-ralph-wiggum)
- [Harness Contract v1](../.opencode/contracts/harness-v1.md)
- [Ralph Integration Contract](../.opencode/contracts/ralph-integration.md)
- [Brooksian Surgical Team](../.claude/rules/agent-routing.md)