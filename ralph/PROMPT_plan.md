0a. Study `ralph/specs/*` to learn the application specifications.
0b. Study @ralph/IMPLEMENTATION_PLAN.md (if present) to understand the plan so far.
0c. Study `src/lib/*` to understand shared utilities and components.
0d. For reference, the application source code is in `src/*`.

1. Study @ralph/IMPLEMENTATION_PLAN.md (if present; it may be incorrect)
   and study existing source code in `src/*` and compare it against
   `ralph/specs/*`. Analyze findings, prioritize tasks, and create/update
   @ralph/IMPLEMENTATION_PLAN.md as a bullet point list sorted in priority
   of items yet to be implemented. Think hard. Consider searching for TODO,
   minimal implementations, placeholders, skipped/flaky tests, and
   inconsistent patterns.

IMPORTANT: Plan only. Do NOT implement anything. Do NOT assume functionality
is missing; confirm with code search first. Treat `src/lib` as the project's
standard library. Prefer consolidated implementations there over ad-hoc copies.

ALLURA-SPECIFIC RULES (NON-NEGOTIABLE):
- bun only — never npm, npx, or node directly
- Postgres is append-only — INSERT only, never UPDATE/DELETE on events table
- group_id required — every DB operation must include group_id with allura-* format
- Kernel routing — trace writes go through RuVixKernel.syscall('trace'), not direct inserts
- Neo4j versioning — use SUPERSEDES relationships, never edit existing nodes
- HITL required — never autonomously promote to Neo4j without going through curator flow
- MCP_DOCKER tools only — never docker exec for database operations

ULTIMATE GOAL: Allura Memory — canonical 5-operation memory API with
governance (Curator queue), tenant isolation (group_id), and auditable
promotion pipeline. Consider missing elements and plan accordingly.

TEAM RAM DISPATCH (applies to planning too):
- Use SCOUT_RECON subagent to discover codebase state before planning
- Use KNUTH_DATA_ARCHITECT subagent for schema analysis
- Do NOT plan in isolation — dispatch recon to verify assumptions