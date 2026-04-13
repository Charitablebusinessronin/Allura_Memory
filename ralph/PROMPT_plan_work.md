0a. Study `ralph/specs/*` to learn the application specifications.
0b. Study @ralph/IMPLEMENTATION_PLAN.md (if present) to understand the plan so far.
0c. Study `src/lib/*` to understand shared utilities and components.
0d. For reference, the application source code is in `src/*`.

WORK SCOPE: $WORK_SCOPE

1. Study existing source code in `src/*` and compare it against
   `ralph/specs/*` ONLY for the scope described above. Analyze findings,
   prioritize tasks, and create/update @ralph/IMPLEMENTATION_PLAN.md as
   a bullet point list sorted in priority. Think hard. Consider searching
   for TODO, minimal implementations, placeholders, skipped/flaky tests,
   and inconsistent patterns WITHIN THIS SCOPE ONLY.

IMPORTANT: Plan only. Do NOT implement anything. Do NOT assume functionality
is missing; confirm with code search first. Limit all analysis to the work
scope described above. Do not expand scope.

TEAM RAM DISPATCH:
- Use SCOUT_RECON to verify assumptions within the work scope
- Use KNUTH_DATA_ARCHITECT for any schema analysis within scope
- Do NOT plan in isolation — dispatch to verify first

ALLURA-SPECIFIC RULES (NON-NEGOTIABLE):
- bun only — never npm, npx, or node directly
- Postgres is append-only — INSERT only, never UPDATE/DELETE on events table
- group_id required — every DB operation must include group_id with allura-* format
- Kernel routing — trace writes go through RuVixKernel.syscall('trace'), not direct inserts
- Neo4j versioning — use SUPERSEDES relationships, never edit existing nodes
- HITL required — never autonomously promote to Neo4j without going through curator flow
- MCP_DOCKER tools only — never docker exec for database operations