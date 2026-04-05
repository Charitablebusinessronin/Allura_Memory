---
description: "Analyze code for performance issues, security vulnerabilities, and hidden edge cases"
allowed-tools: ["Read", "Bash", "Glob", "Grep"]
---

# Code Optimization Analysis

**Usage:** `/optimize [file or directory]`

Analyze `$ARGUMENTS` (file paths or directories) for performance, security, and hidden problems. If no arguments, analyze recently changed files via `git diff --name-only HEAD~5`.

## Analysis Process

### 1. Performance
- O(n²) or worse algorithmic complexity
- Unnecessary nested loops or redundant DB queries
- Memory leaks and excessive allocations
- Missing async where sync is blocking
- React: unnecessary re-renders, missing memoization
- DB: N+1 queries, missing indexes

### 2. Security
- Missing Zod validation at external boundaries
- SQL injection / XSS vectors
- Sensitive data in logs or error messages
- Missing rate limiting on API routes
- `group_id` not enforced on DB operations

### 3. Architecture Invariants (allura-memory-specific)
- PostgreSQL trace mutations (append-only rule violated)
- Neo4j node edits instead of `SUPERSEDES` versioning
- Missing `group_id` on any Neo4j or Postgres operation
- `roninclaw-*` group_id usage (deprecated namespace)
- Server-only DB modules imported in client components

### 4. Edge Cases
- Null/undefined not handled
- Empty array/object scenarios
- Network failure handling
- Race conditions

## Output Format

```
# Optimization Report: [scope]

## Critical (fix before merge)
- [file:line] [issue] → [fix]

## Important (fix soon)
- [file:line] [issue] → [fix]

## Informational
- [file:line] [observation]

## Summary
X critical, Y important, Z informational
```

Focus on real bottlenecks and actual vulnerabilities — not premature optimizations or hypothetical edge cases.
