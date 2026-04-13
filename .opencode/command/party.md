---
description: "Party mode — launch Team RAM agents in parallel for maximum throughput"
allowed-tools: ["Task", "Read", "Bash", "Grep", "Glob", "Edit", "Write", "mcp__MCP_DOCKER__*"]
---

# Party Mode — Team RAM Parallel Dispatch

Launch multiple specialists simultaneously. Brooks orchestrates; Team RAM executes.

## Usage

```
/party <task description>
```

## Team RAM Roster

| Agent | Subagent Type | Role | Writes Code? |
|-------|--------------|------|-------------|
| **Woz** | `WOZ_BUILDER` | Primary builder — implements, tests, commits | ✅ Yes |
| **Scout** | `SCOUT_RECON` | Recon — file discovery, pattern grep, risk scan | ❌ Read-only |
| **Knuth** | `KNUTH_DATA_ARCHITECT` | Data — schema, queries, migrations | ⚠️ Ask first |
| **Bellard** | `BELLARD_DIAGNOSTICS_PERF` | Diagnostics — perf measurement, profiling | ❌ Read-only |
| **Carmack** | `CARMACK_PERFORMANCE` | Perf — latency reduction, hot path optimization | ❌ Read-only |
| **Fowler** | `FOWLER_REFACTOR_GATE` | Refactor gate — maintainability, lint, typecheck | ✅ Yes (limited) |
| **Pike** | `PIKE_INTERFACE_REVIEW` | Interface gate — API ergonomics, surface area | ❌ Read-only |
| **Hightower** | `HIGHTOWER_DEVOPS` | DevOps — Docker, CI/CD, infrastructure | ⚠️ Ask first |

## Protocol

### Phase 1: Decompose (Brooks)

Brooks reads the task and decomposes it into **independent subtasks**.
Each subtask maps to one Team RAM agent. Identify dependencies:

```
Subtasks with NO dependencies → run in PARALLEL (same turn)
Subtasks that depend on others → run AFTER dependency completes
```

### Phase 2: Dispatch (Parallel Launch)

Launch ALL independent agents in a **single message** using the Task tool:

```
// Example: "Add user authentication with OAuth2"
// Independent subtasks — launch all at once:

Task(subagent_type: "SCOUT_RECON", prompt: "Find all existing auth patterns, middleware, and session handling in src/. Check .env for auth-related vars. Report file paths and current state.")
Task(subagent_type: "WOZ_BUILDER", prompt: "Implement OAuth2 flow per specs in ralph/specs/. Use bun only. Follow patterns in src/lib/auth/. Write tests alongside implementation.")
Task(subagent_type: "KNUTH_DATA_ARCHITECT", prompt: "Review schema for user tables and session storage. Check migrations in docker/postgres-init/. Propose any schema changes needed for OAuth2.")
Task(subagent_type: "HIGHTOWER_DEVOPS", prompt: "Check Docker and CI config for auth-related env vars and secrets. Ensure .env.example is updated. Verify container networking for OAuth callbacks.")
```

### Phase 3: Collect & Validate

After all parallel agents complete:

1. **Fowler gate**: Run `bun run typecheck && bun run lint`
2. **Pike gate**: Review any new API surface area
3. **Bellard gate**: Measure if performance-sensitive path changed

### Phase 4: Synthesize & Commit

Brooks synthesizes all results, resolves conflicts, and commits with a
descriptive message crediting the agents involved.

## Task Decomposition Examples

### "Run k6 load test and optimize if needed"
```
PARALLEL:
  - Bellard: Run k6 at VU=100, capture p95 metrics
  - Scout: Find hot paths in src/mcp/ and src/lib/memory/
AFTER Bellard reports:
  - Carmack: Optimize if p95 > 200ms
```

### "Process backlogged proposals through Notion sync"
```
PARALLEL:
  - Knuth: Query canonical_proposals for pending items, check dedup state
  - Scout: Find Notion sync config and env vars
AFTER both report:
  - Woz: Implement batch processing script using query results
```

### "Debug failing test suite"
```
PARALLEL:
  - Scout: Find all failing tests, categorize by error type
  - Bellard: Run benchmarks to check for perf regressions
AFTER both report:
  - Woz: Fix failures categorized by Scout
  - Fowler: Validate fixes don't add debt
```

## Rules

1. **At least 2 agents per party** — no solo work in party mode
2. **Woz is the only writer** — other agents read/analyze, Woz implements
3. **Fowler gates every commit** — no commits without typecheck passing
4. **Brooks never implements** — orchestrates, synthesizes, commits
5. **group_id on every DB operation** — no exceptions
6. **Append-only on events table** — INSERT only

---

**Invoke with:** `/party <task description>`