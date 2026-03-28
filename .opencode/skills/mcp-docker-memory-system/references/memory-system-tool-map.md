# Memory System Tool Map

Use this reference to map memory objectives to MCP_DOCKER actions.

## Objective -> Server -> Typical Tool

| Objective | Server Search Terms | Typical Tool |
|---|---|---|
| Query insight graph | `neo4j`, `cypher`, `graph` | read Cypher tool (server-specific name) |
| Update graph lineage | `neo4j`, `cypher` | write Cypher tool (server-specific name) |
| Query raw traces | `postgres`, `sql`, `database` | SQL query tool |
| Validate DB shape | `postgres`, `sql` | list tables / describe table |
| Search workspace docs | `notion` | notion search/fetch tools |
| Add external search context | `tavily`, `brave` | web search tools |

## Minimal Verification Pattern

For each newly added server:

1. Run one read-only command.
2. Confirm expected response shape.
3. Confirm tenant scoping (`group_id`) in query.
4. Proceed to mutation only if checks pass.

## Tenant-Safe Query Hints

- Neo4j: include `WHERE n.group_id = $group_id` or equivalent in every tenant-scoped query.
- PostgreSQL: include `WHERE group_id = $1` (or parameterized equivalent).
- Notion/knowledge sources: include project identifier or equivalent scope filter where available.

## Suggested Operational Log Fields

When recording what was executed, capture:

- `group_id`
- `server_name`
- `tool_name`
- `query_purpose`
- `result_count`
- `write_operation` (boolean)
