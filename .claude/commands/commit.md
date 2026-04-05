---
description: "Create well-formatted conventional commits with emoji — runs typecheck before committing"
allowed-tools: ["Bash"]
---

# Commit Command

**Usage:** `/commit` or `/commit <message>`

Create a well-formatted git commit with conventional commit messages and emoji.

## Steps

### Step 1: Pre-commit Validation

```bash
bun run typecheck
bun run lint
```

If either fails, report the errors and ask the user whether to fix first or proceed anyway.

### Step 2: Analyze Staged Changes

```bash
git status --porcelain
git diff --cached
```

If nothing is staged, run `git add .` to stage all modified files.

### Step 3: Generate Commit Message

If `$ARGUMENTS` provided, use it as the message. Otherwise analyze the diff and choose:

**Format:** `<emoji> <type>: <description>`

| Emoji | Type | Use |
|-------|------|-----|
| ✨ | feat | New feature |
| 🐛 | fix | Bug fix |
| 📝 | docs | Documentation |
| ♻️ | refactor | Refactor (no new feature/fix) |
| ✅ | test | Tests |
| 🔧 | chore | Tooling, config, deps |
| 🏗️ | refactor | Architectural changes |
| 🗃️ | db | Database changes |
| 🔒️ | fix | Security fix |
| 🚑️ | fix | Critical hotfix |
| 💥 | feat | Breaking change |
| ⚡️ | perf | Performance improvement |
| 🚧 | wip | Work in progress |

Show the proposed message and get confirmation before committing.

### Step 4: Commit and Push

```bash
git commit -m "<message>"
git push
```

Show the commit hash and a brief summary on success.

## Rules

- Keep message under 72 characters
- Imperative mood ("add feature" not "added feature")
- Auto-stage if nothing staged
- Always push after a successful commit
