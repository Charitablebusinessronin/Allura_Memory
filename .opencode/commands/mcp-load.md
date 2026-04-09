# /mcp-load

**Load an approved MCP server and activate its tools.**

Once a server is approved, load it to make its tools available to the harness.

## Usage

```bash
/mcp-load <server-id>
```

## Examples

```bash
/mcp-load postgresql-mcp
/mcp-load tavily-search
/mcp-load allura-memory
```

## Workflow

```
Server must be approved first
  ↓
mcp-load postgresql-mcp
  ↓
Calls: mcp_add("postgresql-mcp")
  ↓
Tools available: mcp__MCP_DOCKER__*
  ↓
Event logged: MCP_LOADED
```

## Requirements

- Server must be `approved: true` in registry
- Environment variables (if any) must be set

## Example Success

```
Ready to load: PostgreSQL MCP

Tools now available:
  • mcp__MCP_DOCKER__query_database
  • mcp__MCP_DOCKER__execute_sql
  • mcp__MCP_DOCKER__insert_data
  • mcp__MCP_DOCKER__update_data
  • mcp__MCP_DOCKER__delete_data
  • mcp__MCP_DOCKER__describe_table
  • mcp__MCP_DOCKER__list_tables

Event logged: MCP_LOADED
```

## Error Cases

### Server not approved

```
Error: Server postgresql-mcp is not approved.
Request approval first with: /mcp-approve postgresql-mcp
```

### Server not found

```
Error: Server not found: unknown-mcp
Available servers: [allura-memory, postgresql-mcp, tavily-search, ...]
```

### Env var missing

```
Warning: postgresql-mcp requires DATABASE_URL env var.
Set it and try again: export DATABASE_URL="postgres://..."
```

## Implementation

Handler: `.opencode/harness/mcp-plugin-loader.ts::loadServer()`

Calls: `mcp_add()` (via MCP Docker Toolkit)

Logs: Postgres event table
