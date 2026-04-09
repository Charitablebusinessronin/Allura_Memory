---
description: Surface current sprint, blockers, ownership map, and architecture health (OAC style)
---
# /oac:status

1. Invoke `MCP_DOCKER_query_database` to fetch latest events for the current `group_id`.
2. Inspect `memory-bank/activeContext.md` and `memory-bank/progress.md`.
3. Check for any failing tests via `npm test` (if safe).
4. Render a summary:
   - **Current Orbit**: What are we working on?
   - **Blockers**: What is stopping us?
   - **System Health**: Types, Tests, Lint status.
   - **Active Agents**: Who is doing what.
