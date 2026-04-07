---
name: focus-mode-global
description: Enter GLOBAL focus mode with elevated permissions for ALL agents. Updates MemoryOrchestrator permissions to allow flow state without prompts across the entire system.
---

# Focus Mode Skill — GLOBAL

## 🚀 Quick Start

**Run the command:**

```bash
/focus-mode
```

**Done!** All agents now have elevated permissions.

## What Is Focus Mode

Focus mode is **GLOBAL** — it elevates permissions for **ALL agents**, not just one.

| Permission | Normal | Focus Mode (ACTIVE) |
|------------|--------|---------------------|
| Bash commands | "ask" (prompts) | "allow" (no prompts) |
| File edits | "ask" (prompts) | "allow" (no prompts) |
| File writes | "ask" (prompts) | "allow" (no prompts) |

## Safety Guards (Always Protected)

Even in global focus mode, these are **DENIED**:

- ❌ Deleting `.env*` files
- ❌ Modifying `.git/` directory
- ❌ `sudo` commands
- ❌ `rm -rf /` or `rm -rf /*`
- ❌ `chmod 777 /` or similar
- ❌ Direct `node_modules/` edits

## When to Use

**Use focus mode when:**
- You're in flow state and prompts break concentration
- Doing intensive refactoring across multiple files
- Running many bash commands in sequence
- Rapid prototyping where speed matters
- Test-driven development with frequent iterations

**Don't use focus mode when:**
- Working with production systems
- Modifying security-sensitive files
- Making database schema changes
- Deploying to production
- Infrastructure changes (Docker, K8s)

## How to Exit

```bash
/end-focus
```

Then **restart OpenCode** to reload default permissions.

## How It Works

The `/focus-mode` command updates the `MemoryOrchestrator` agent configuration (in `.opencode/agent/core/openagent.md`) to allow all bash commands and edits without prompts.

Since MemoryOrchestrator is the **default agent**, this effectively elevates permissions globally.

## Configuration

Focus mode updates `openagent.md` frontmatter:

```yaml
permission:
  bash:
    "*": "allow"        # No prompts for most commands
    "rm -rf *": "ask"   # Still ask for destructive
    "rm -rf /*": "deny" # Never allow system destruction
    "sudo *": "deny"    # Never allow sudo
  edit:
    "*": "allow"        # No edit prompts
```

## Troubleshooting

**"I ran /focus-mode but still getting prompts"**

The permission change requires OpenCode to reload the agent configuration. Try:
1. Run `/focus-mode`
2. Switch to a different agent and back
3. Or restart OpenCode

**"How do I know if focus mode is active?"**

Run any bash command. If it executes without an "Allow?" prompt, focus mode is active.

---

**Ready? Run `/focus-mode` now.**