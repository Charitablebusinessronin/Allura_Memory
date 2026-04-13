0a. Study `ralph/specs/*` to learn the application specifications.
0b. Study @ralph/IMPLEMENTATION_PLAN.md.
0c. For reference, the application source code is in `src/*`.

1. Your task is to implement functionality per the specifications. Follow
   @ralph/IMPLEMENTATION_PLAN.md and choose the most important unchecked item
   to address. Before making changes, search the codebase (don't assume not
   implemented).

2. **TEAM RAM PARALLEL DISPATCH (MANDATORY)** — Do NOT implement everything
   yourself. Use the Task tool to dispatch to Team RAM subagents in parallel:

   | Subagent Type | When to Dispatch | What It Does |
   |---------------|-----------------|--------------|
   | `WOZ_BUILDER` | Code implementation, feature building | Writes code, tests, commits |
   | `SCOUT_RECON` | Before implementation | Finds files, patterns, risks |
   | `KNUTH_DATA_ARCHITECT` | Schema, migration, query changes | Data layer work |
   | `BELLARD_DIAGNOSTICS_PERF` | Performance measurement, k6, benchmarks | Measures and diagnoses |
   | `CARMACK_PERFORMANCE` | Latency optimization, hot path tuning | Optimizes based on Bellard data |
   | `HIGHTOWER_DEVOPS` | Docker, CI/CD, infrastructure | Container and deploy changes |
   | `FOWLER_REFACTOR_GATE` | Before commit (validation gate) | Lint, typecheck, refactor |
   | `PIKE_INTERFACE_REVIEW` | New API surface, interface changes | Reviews ergonomics |

   **Pattern:**
   ```
   Task(subagent_type: "SCOUT_RECON", prompt: "Find all files related to X...")
   Task(subagent_type: "WOZ_BUILDER", prompt: "Implement X per spec in ralph/specs/...")
   // Wait for results, then gate:
   Task(subagent_type: "FOWLER_REFACTOR_GATE", prompt: "Validate changes: bun run typecheck && bun run lint")
   ```

3. After implementing functionality or resolving problems, run the tests
   for that unit of code. If functionality is missing then it's your job to
   add it per the specifications. Think hard.

4. When you discover issues, immediately update @ralph/IMPLEMENTATION_PLAN.md
   with your findings. When resolved, update and remove the item.

5. When the tests pass, update @ralph/IMPLEMENTATION_PLAN.md, then
   `git add -A` then `git commit` with a message describing the changes.

6. **Finish Mode**: If RALPH_MODE=finish, the next task is in RALPH_NEXT_TASK
   env var. The primary agent is RALPH_PRIMARY_AGENT and support is
   RALPH_SUPPORT_AGENT. Dispatch to those agents specifically.

99999. Important: When authoring documentation, capture the why — tests
   and implementation importance.
999999. Single sources of truth, no migrations/adapters. If tests unrelated
   to your work fail, resolve them as part of the increment.
9999999. Keep @ralph/IMPLEMENTATION_PLAN.md current with learnings — future
   work depends on this to avoid duplicating efforts. Update especially
   after finishing your turn.
99999999. When you learn something new about how to run the application,
   update @AGENTS.md but keep it brief. For example if you run commands
   multiple times before learning the correct command then that file
   should be updated.
999999999. For any bugs you notice, resolve them or document them in
   @ralph/IMPLEMENTATION_PLAN.md even if unrelated to the current work.
9999999999. Implement functionality completely. Placeholders and stubs
   waste efforts and time redoing the same work.
99999999999. When @ralph/IMPLEMENTATION_PLAN.md becomes large, periodically
   clean out the items that are completed from the file.
999999999999. IMPORTANT: Keep @AGENTS.md operational only — status updates
   and progress notes belong in `ralph/IMPLEMENTATION_PLAN.md`. A bloated
   AGENTS.md pollutes every future loop's context.

ALLURA-SPECIFIC RULES (NON-NEGOTIABLE):
- bun only — never npm, npx, or node directly
- Postgres is append-only — INSERT only, never UPDATE/DELETE on events table
- group_id required — every DB operation must include group_id with allura-* format
- Kernel routing — trace writes go through RuVixKernel.syscall('trace'), not direct inserts
- Neo4j versioning — use SUPERSEDES relationships, never edit existing nodes
- HITL required — never autonomously promote to Neo4j without going through curator flow
- MCP_DOCKER tools only — never docker exec for database operations

TEAM RAM SOURCE OF TRUTH (authoritative):
- Notion: https://www.notion.so/555af02240844238adddb721389ec27c
- Local: .opencode/agent/ directory
- When in doubt, defer to Notion