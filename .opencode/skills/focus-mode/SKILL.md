---
name: focus-mode
description: Enter focus mode with elevated permissions for intensive development. Switch to memory-builder-focus agent to enable flow state without permission prompts.
---

# Focus Mode Skill

## Quick Start

**To enter focus mode, switch your agent to `memory-builder-focus`:**

1. **Click agent selector** (top-left of OpenCode)
2. **Select "memory-builder-focus"**
3. **Done** - elevated permissions active

## What Is Focus Mode

Focus mode is an **agent switch**, not a command. The `memory-builder-focus` agent has elevated permissions compared to normal `memory-builder`:

| Permission | Normal Mode | Focus Mode |
|------------|-------------|------------|
| Bash commands | "ask" (prompts) | "allow" (no prompts) |
| File edits | "ask" (prompts) | "allow" (no prompts) |
| File writes | "ask" (prompts) | "allow" (no prompts) |

## Safety Guards (Always Protected)

Even in focus mode, these operations are **DENIED**:

- ❌ Deleting `.env`, `.env.local`, `*.key`, `*.secret`
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

Switch back to any other agent:
- `memory-builder` - normal development
- `memory-orchestrator` - planning & architecture
- `memory-guardian` - code review

## Troubleshooting

**"I ran /focus-mode but still getting prompts"**

The `/focus-mode` command only shows instructions. You must **switch the agent** to get elevated permissions.

**"How do I switch agents?"**

1. Look at top-left of OpenCode window
2. Click current agent name
3. Select "memory-builder-focus"

**"Can I use a keyboard shortcut?"**

Yes: `Ctrl+Shift+P` → type "Switch Agent" → select "memory-builder-focus"

## Configuration

The `memory-builder-focus` agent is configured in `opencode.json` with:

```json
"memory-builder-focus": {
  "permission": {
    "edit": "allow",
    "bash": {
      "*": "allow",
      "rm -rf *": "ask",
      "rm -rf /*": "deny",
      "sudo *": "deny"
    }
  }
}
```

This gives elevated permissions while maintaining critical safety guards.

---

**Ready? Switch to `memory-builder-focus` agent now.**
- 30 minutes for standard sessions
- 60 minutes for deep work

### 2. Know Your Safety Guards
Even in focus mode, you cannot:
- Delete environment files
- Modify git internals
- Run sudo commands
- Delete system files

### 3. Exit When Done
Don't stay in focus mode longer than necessary. Exit when:
- The intensive work is complete
- You're switching to a different task
- You're about to make security-sensitive changes
- You're done for the day

### 4. Use for the Right Work

**Good for focus mode:**
- Refactoring TypeScript/React code
- Writing tests
- Bulk file operations
- Rapid prototyping
- Documentation updates

**Bad for focus mode:**
- Production deployments
- Security reviews
- Database migrations
- Infrastructure changes
- Secret rotation

## Example Workflows

### Refactoring Session
```bash
/focus-mode 45
# Refactor components
# Update imports
# Run tests
/end-focus
```

### Test-Driven Development
```bash
/focus-mode 30
# Write test
# Implement feature
# Run test
# Refactor
# Repeat
/end-focus
```

### Bulk Operations
```bash
/focus-mode 20
# Rename files
# Update references
# Run linter
# Run tests
/end-focus
```

## Troubleshooting

### "Permission denied" in focus mode
You're trying to do something that's always protected (like editing `.env`). This is expected behavior.

### Focus mode not activating
Check that the agent is properly configured:
```bash
opencode --agent memory-builder-focus
```

### Can't exit focus mode
Type `/end-focus` or wait for auto-timeout. If stuck, restart OpenCode.

## Related Commands

| Command | Purpose |
|---------|---------|
| `/focus-mode` | Enter focus mode |
| `/end-focus` | Exit focus mode |
| `/validate-repo` | Run validation (works in any mode) |
| `/start-session` | Initialize session |

## Remember

> "Focus mode is for flow, not for recklessness."
>
> The safety guards protect you from catastrophic mistakes.
> Everything else is allowed so you can move fast.

## See Also

- Agent: `.opencode/agent/memory-builder-focus.md`
- Command: `.opencode/command/focus-mode.md`
- Command: `.opencode/command/end-focus.md`