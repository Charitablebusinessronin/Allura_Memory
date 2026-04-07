# Focus Mode - Quick Reference

## 🚀 Activate

**Switch agent to `memory-builder-focus`:**

1. Click agent selector (top-left)
2. Select "memory-builder-focus"
3. Done!

Or use command palette: `Ctrl+Shift+P` → "Switch Agent"

## 🛑 Deactivate

Switch back to any other agent:
- `memory-builder` (normal)
- `memory-orchestrator` (planning)
- `memory-guardian` (review)

## ⚡ What's Different

| Action | Normal (memory-builder) | Focus Mode (memory-builder-focus) |
|--------|------------------------|-----------------------------------|
| Bash commands | Ask | Allow |
| File edits | Ask | Allow |
| File writes | Ask | Allow |

## 🛡️ Still Protected

- `.env*` files
- `.git/` directory
- `*.key`, `*.secret`
- `node_modules/`
- `sudo` commands
- `rm -rf /`

## 💡 Best For

- Refactoring
- Rapid prototyping
- Test-driven development
- Bulk operations

## ⚠️ Not For

- Production deployments
- Security changes
- Database migrations
- Infrastructure

## 📝 Example

```
1. Switch to memory-builder-focus agent
2. Do intensive work without prompts
3. Switch back when done
```

## ⚠️ Important

The `/focus-mode` command only shows instructions. You must **switch the agent** to get elevated permissions.
/end-focus
```

---

**Full docs:** `.opencode/skills/focus-mode/SKILL.md`