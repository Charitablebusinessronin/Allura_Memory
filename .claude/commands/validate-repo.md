---
description: "Comprehensive repo validation - typecheck, lint, tests, and file integrity check"
allowed-tools: ["Bash", "Glob", "Grep", "Read"]
---

# Validate Repository

Run a full integrity check across the allura-memory codebase.

## Step 1: Type Check

```bash
bun run typecheck
```

Report any type errors with file and line references.

## Step 2: Lint

```bash
bun run lint
```

Report linting issues.

## Step 3: Tests

```bash
bun test
```

Report pass/fail counts. Flag any regressions.

## Step 4: Infrastructure Health

Use MCP tools only — never `docker exec`:

```javascript
mcp__MCP_DOCKER__mcp-exec({ name: "read_graph", arguments: {} })        // Neo4j
mcp__MCP_DOCKER__mcp-exec({ name: "query_database", arguments: { query: "SELECT 1" } })  // Postgres
```

## Step 5: Agent Registry Integrity

Check that all agents defined in `.opencode/agent/` exist as files, and all commands in `.opencode/command/` and `.claude/commands/` are valid markdown with a `description` field.

For each file referenced: verify it exists on disk. Report any broken references.

## Step 6: Architecture Invariants

Grep for common violations:
- Any DB operation missing `group_id`:
  ```bash
  # look for postgres/neo4j queries without group_id
  ```
- Any `npm run` or `npx` usage (banned — use `bun`):
  ```bash
  grep -r "npx\|npm run" src/ --include="*.ts" -l
  ```
- Any `roninclaw-*` group_id references (deprecated):
  ```bash
  grep -r "roninclaw-" . --include="*.ts" --include="*.md" -l
  ```

## Output Format

```
# Validation Report

## ✅ Passed
- TypeScript: no errors
- Lint: clean
- Tests: 1854 passing
- Postgres: healthy
- Neo4j: healthy

## ⚠️ Warnings
- [file]: [issue]

## ❌ Errors
- [file]: [issue]

## Summary
X checks passed, Y warnings, Z errors
```

Fix all ❌ errors before considering the repo stable.
