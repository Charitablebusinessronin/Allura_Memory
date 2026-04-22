# Allura Memory Troubleshooting (Native MCP_DOCKER)

Read this when:
- MCP memory tools are not available after activation
- Memory search returns no results
- Connection to Neo4j or PostgreSQL hangs or times out
- `group_id` errors occur
- MCP servers fail to start after `mcp-add`

## Environment Variable Mapping

The MCP_DOCKER memory servers expect configuration via environment variables:

| MCP Config | Environment Variable | Description |
|------------|---------------------|-------------|
| `url` | `NEO4J_URL` | Neo4j connection URL (e.g., `neo4j://host:7687`) |
| `username` | `NEO4J_USERNAME` or `NEO4J_USER` | Neo4j username |
| `password` | `NEO4J_PASSWORD` | Neo4j password (secret) |
| `database` | `NEO4J_DATABASE` | Neo4j database name (`neo4j` or custom) |
| `host` | `POSTGRES_HOST` | PostgreSQL host |
| `port` | `POSTGRES_PORT` | PostgreSQL port (default `5432`) |
| `database` | `POSTGRES_DB` | PostgreSQL database name |
| `username` | `POSTGRES_USER` | PostgreSQL username |
| `password` | `POSTGRES_PASSWORD` | PostgreSQL password (secret) |

## Diagnostic Steps

### 1. Verify Environment Variables

All environment variables **must** be set:
- Neo4j: `NEO4J_URL`, `NEO4J_USERNAME` or `NEO4J_USER`, `NEO4J_PASSWORD`, `NEO4J_DATABASE`
- PostgreSQL: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

Use `validate-env.sh` script or manual `echo $VAR` checks.

### 2. MCP Server Discovery

Run `MCP_DOCKER_mcp_find` to verify servers exist in catalog:
```bash
MCP_DOCKER_mcp_find("neo4j-memory")
MCP_DOCKER_mcp_find("database-server")
MCP_DOCKER_mcp_find("neo4j-cypher")
```

### 3. Configuration

Run `MCP_DOCKER_mcp_config_set` with env-based values:
```bash
MCP_DOCKER_mcp_config_set("neo4j-memory", {
  url: $NEO4J_URL,
  username: $NEO4J_USERNAME or $NEO4J_USER,
  password: $NEO4J_PASSWORD,
  database: $NEO4J_DATABASE
})
MCP_DOCKER_mcp_config_set("database-server", {
  host: $POSTGRES_HOST,
  port: $POSTGRES_PORT,
  database: $POSTGRES_DB,
  username: $POSTGRES_USER,
  password: $POSTGRES_PASSWORD
})
```

### 4. Activation

Run `MCP_DOCKER_mcp_add` for each server:
```bash
MCP_DOCKER_mcp_add("neo4j-memory")
MCP_DOCKER_mcp_add("database-server")
MCP_DOCKER_mcp_add("neo4j-cypher")  # only if graph-specific work needed
```

### 5. Tool Availability

Run `mcp__MCP_DOCKER__listTools` to verify memory-related tools appear in the session.

## Common Failures

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| No tools after `mcp-add` | Config validation failure | Check env vars against config schema |
| Connection timeout | Wrong host/port or network isolation | Validate `NEO4J_URL`, `POSTGRES_HOST`, `POSTGRES_PORT` |
| Auth error | Wrong password or missing `NEO4J_USERNAME`/`NEO4J_USER` | Confirm `NEO4J_PASSWORD` and one username var |
| `group_id` CHECK constraint failure | Missing or invalid `group_id` | Use `allura-*` namespace, default `allura-roninmemory` |
| `graph schema` error | Wrong database name | Set `NEO4J_DATABASE` to correct database |

## Recovery Questions

Ask:

- Is this a tool availability problem, a storage problem, or a policy problem?
- Is the failure local to one tenant or global?
- Is the returned memory stale, deprecated, or superseded?
- Did the workflow search before writing?

## Repo-Specific Guardrails

- Native MCP_DOCKER servers are canonical memory surface
- `group_id` must match `^allura-[a-z0-9-]+$`
- Default tenant is `allura-roninmemory`
- PostgreSQL traces are append-only
- Neo4j knowledge is versioned via `SUPERSEDES`
- Custom `allura-brain_memory_*` MCP surface is deprecated
