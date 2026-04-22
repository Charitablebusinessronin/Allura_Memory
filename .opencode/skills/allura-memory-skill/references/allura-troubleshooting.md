# Allura Memory Troubleshooting

## MCP Layer

Check:

- are `allura-brain_*` tools available?
- if not, is the MCP/gateway layer healthy?
- is transport mode correct?
- is the client pointed to the right server/tool surface?

## Neo4j Layer

Check:

- `NEO4J_URI` / `NEO4J_URL`
- username and password
- target database name
- container or network reachability
- expected schema/index assumptions

## PostgreSQL Layer

Check:

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- username and password
- connectivity from the runtime that is executing the memory workflow

## Memory Logic Layer

Check:

- duplicate detection is not too weak or too aggressive
- promotion does not write directly to canonical truth without governance
- timestamps exist and are trustworthy
- status and lineage fields are present
- `group_id` is explicit and valid

## Repo-Specific Guardrails

- Allura Brain is canonical memory authority
- `group_id` must match `^allura-[a-z0-9-]+$`
- default tenant is `allura-roninmemory`
- PostgreSQL traces are append-only
- Neo4j knowledge is versioned, not overwritten

## Recovery Questions

Ask:

- is this a tool availability problem, a storage problem, or a policy problem?
- is the failure local to one tenant or global?
- is the returned memory stale, deprecated, or superseded?
- did the workflow search before writing?
