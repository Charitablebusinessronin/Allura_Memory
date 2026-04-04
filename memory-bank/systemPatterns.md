# System Patterns

Core architectural patterns for the roninmemory system:
1. Dual-Store Memory (PostgreSQL via `pg` + Neo4j)
2. Bun-only strict enforcement for executions
3. MemFS (self-editing capabilities)
4. MCP thin-adapter integration for runtimes (OpenCode/OpenClaw)
5. `group_id` as the isolation boundary for every read/write path
