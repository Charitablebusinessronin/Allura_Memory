---
description: "Enter focus mode with elevated permissions for ALL agents"
argument-hint: "[duration-minutes]"
---

# 🔓 GLOBAL Focus Mode Activated

**All agents now have elevated permissions.**

## What Changed

The MemoryOrchestrator (and all other agents) now have:

| Permission | Normal | Focus Mode (NOW ACTIVE) |
|------------|--------|-------------------------|
| Bash commands | "ask" (prompts) | "allow" (no prompts) |
| File edits | "ask" (prompts) | "allow" (no prompts) |
| File writes | "ask" (prompts) | "allow" (no prompts) |

## Safety Guards (Always Active)

Even in focus mode, these are **STILL PROTECTED**:
- ❌ Deleting `.env*` files
- ❌ Modifying `.git/` directory  
- ❌ `sudo` commands
- ❌ `rm -rf /` or similar
- ❌ Direct `node_modules/` edits
- ❌ Editing `*.key`, `*.secret`

## How to Exit

Run `/end-focus` to return to normal permission levels.

Or restart OpenCode to reload default permissions.

## Current Status

!`echo "Global focus mode activated at $(date)"`

---

**🔓 All agents now have elevated permissions. What are we building?**