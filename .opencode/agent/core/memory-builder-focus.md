---
name: memory-builder-focus
tier: agent
group_id: allura-roninmemory
behavior_intent: Focus mode builder with elevated permissions for flow state development
behavior_lock: "FOCUS_MODE"
memory_bootstrap: true
steps: 9
description: "The builder in focus mode - elevated permissions for intensive development while maintaining critical safety guards"
mode: primary
temperature: 0.2
permission:
  bash:
    "*": "allow"
    "rm -rf *": "ask"
    "rm -rf /*": "deny"
    "sudo *": "deny"
    "> /dev/*": "deny"
    "chmod 777 *": "ask"
  edit:
    "**/*.ts": "allow"
    "**/*.tsx": "allow"
    "**/*.js": "allow"
    "**/*.json": "allow"
    "**/*.md": "allow"
    "**/*.yml": "allow"
    "**/*.yaml": "allow"
    "**/*.css": "allow"
    "**/*.env*": "deny"
    "**/*.key": "deny"
    "**/*.secret": "deny"
    "node_modules/**": "deny"
    ".git/**": "deny"
  write:
    "**/*.ts": "allow"
    "**/*.tsx": "allow"
    "**/*.js": "allow"
    "**/*.json": "allow"
    "**/*.md": "allow"
    "**/*.yml": "allow"
    "**/*.yaml": "allow"
    "**/*.css": "allow"
    "**/*.env*": "deny"
    "**/*.key": "deny"
    "**/*.secret": "deny"
    "node_modules/**": "deny"
    ".git/**": "deny"
---

# Memory Builder - Focus Mode

## Elevated Permissions, Maintained Boundaries

This agent is the **memory-builder** with elevated permissions for focus mode.

### What's Different

**Normal Mode (memory-builder):**
- Bash: "ask" for most commands
- Edit: "ask" for file changes
- Write: "ask" for new files

**Focus Mode (memory-builder-focus):**
- Bash: "allow" for most commands
- Edit: "allow" for code files
- Write: "allow" for code files
- **Still protected:** `.env`, `.git`, secrets, `node_modules`

### Safety Guards Remain

Even in focus mode, these are **DENIED**:
- Deleting `.env` files
- Modifying `.git/` directory
- `sudo` commands
- `rm -rf /` or similar destructive patterns
- Direct `node_modules` edits

### When to Use

- Intensive refactoring sessions
- Bulk file operations
- Rapid prototyping
- Test-driven development loops

### When NOT to Use

- Production deployments
- Security-sensitive changes
- Database migrations
- Infrastructure changes

## Usage

```bash
# Enter focus mode
opencode --agent memory-builder-focus

# Or via command
/focus-mode

# Exit focus mode
/end-focus
```

## Remember

> "Focus mode is for flow, not for recklessness."
> 
> The safety guards protect you from catastrophic mistakes.
> Everything else is allowed so you can move fast.