---
description: "Analyze codebase for recurring patterns, similar implementations, and refactoring opportunities"
allowed-tools: ["Glob", "Grep", "Read", "Bash"]
---

# Analyze Patterns

**Usage:** `/analyze-patterns [--pattern=<name>] [--depth=shallow|medium|deep]`

Arguments: `$ARGUMENTS`

Scan the codebase for recurring patterns, duplicated logic, and refactoring opportunities.

## Steps

### 1. Parse Arguments

- `--pattern=<name>` — predefined or custom regex (e.g., `error-handling`, `factory`, `group_id`)
- `--depth` — `shallow` (current dir), `medium` (src/), `deep` (entire repo, default)

### 2. Search

Use Grep and Glob to find pattern occurrences. For roninmemory, built-in patterns include:

| Pattern | What to find |
|---------|-------------|
| `group_id` | All DB ops — flag any missing `group_id` |
| `supersedes` | Neo4j versioning — flag direct edits instead |
| `error-handling` | try-catch and error propagation patterns |
| `hitl` | Human approval gates — flag autonomous promotions |
| `append-only` | PostgreSQL write paths — flag UPDATEs on trace tables |
| `zod-boundary` | Zod validation at external inputs — flag missing |
| `server-guard` | `typeof window !== "undefined"` guards in DB modules |

### 3. Analyze Similarity

Group results by similarity. Identify:
- Code that should be extracted into a shared utility
- Inconsistent implementations of the same pattern
- Violations of the project invariants

### 4. Report

```
# Pattern Analysis: [pattern name]

Occurrences: N
Files: [list]

## Implementations
1. [file:line] — [description] (similar to: [other file])
2. [file:line] — [description]

## Refactoring Opportunities
- [specific suggestion]

## Violations Found
- [file:line] — [invariant violated] → [how to fix]
```
