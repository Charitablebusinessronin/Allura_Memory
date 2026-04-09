# /mcp-approve

**Request approval to load an MCP server.**

Brooks reviews and approves loading a specific MCP server.

## Usage

```bash
/mcp-approve <server-id>
```

## Examples

```bash
/mcp-approve postgresql-mcp
/mcp-approve notion-mcp
/mcp-approve neo4j-cypher
```

## What Happens

1. Display server details (name, description, env vars, notes)
2. Prompt Brooks: "Approve?"
3. If approved:
   - Mark server as `approved: true` in registry
   - Record approver + timestamp
   - Next step: `/mcp-load <server-id>`
4. If denied:
   - Server remains pending
   - Can be requested again later

## Example Approval Prompt

```
📋 MCP Server Approval Request

Server: PostgreSQL MCP
ID: postgresql-mcp
Description: Direct PostgreSQL client — execute_sql, insert_data, etc.

Source: docker://mcp/postgresql
Required Environment Variables: DATABASE_URL

⚠️  Notes: Requires DATABASE_URL env var. Approve before adding.

Brooks, approve this server? (yes/no)
→ mcp-approve postgresql-mcp --yes
```

## Safeguards

- **HITL gates** — Sensitive servers (neo4j-cypher, notion-mcp, github-mcp) require explicit HITL approval
- **Audit trail** — All approvals recorded (approved_by, approved_date)
- **Approver identity** — Only specified roles (Brooks) can approve

## Registry Update

After approval, `.opencode/plugin/mcp-registry.yaml` is updated:

```yaml
- id: postgresql-mcp
  name: PostgreSQL MCP
  approved: true              # ✅ Changed from false
  approved_by: "brooks"       # Who approved
  approved_date: "2026-04-09" # When
```

## Next Step

After approval, load the server:

```bash
/mcp-load postgresql-mcp
```

## Implementation

Handler: `.opencode/harness/mcp-plugin-loader.ts::approveServer()`

Registry: `.opencode/plugin/mcp-registry.yaml`
