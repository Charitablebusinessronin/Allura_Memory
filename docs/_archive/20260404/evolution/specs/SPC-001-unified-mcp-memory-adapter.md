# Unified MCP Memory Adapter — Update Specification

## Change Summary

Create thin runtime adapters for OpenCode and OpenClaw that both connect to the same governed roninmemory substrate through MCP. The adapters must inject `group_id`, standardize lifecycle hooks, and route all memory interactions through the shared contract without duplicating memory logic in either runtime.

**Note:** This is the target specification; current source files show partial implementation and should not be treated as fully complete.

## Before

- OpenCode and OpenClaw can diverge in how they hydrate context, log work, and persist outcomes.
- Memory behavior risks being implemented separately per runtime.
- Cross-runtime continuity depends on convention rather than a shared contract.

## After

- Both runtimes use the same MCP memory contract.
- Each adapter is a thin port: authenticate, inject `group_id`, normalize payloads, and expose tools.
- Lifecycle hooks are consistent: before work, during work, after work.
- Standard read/query operations use `mcp-neo4j`; graph edits use governed Cypher via authorized MCP tooling.
- Runtime alignment validation can block semantic drift before high-risk actions.

## Components

### 1) Shared Memory Contract

- `group_id` required on every read/write.
- Memory ingest and recall operations are standardized.
- Storage responsibilities remain separated:
  - PostgreSQL = append-only raw traces
  - Neo4j = curated knowledge and relationships

### 2) OpenCode Adapter

- Authenticates the session.
- Injects `group_id`.
- Exposes memory tools to the runtime.
- Enforces the authorized MCP-only rule for memory operations.

### 3) OpenClaw Adapter

- Authenticates the session.
- Injects `group_id`.
- Exposes the same memory tools and lifecycle hooks.
- Supports high-impact action interception via runtime alignment validation.

### 4) Lifecycle Hooks

- **Before work:** hydrate the minimum viable context.
- **During work:** record decisions, blockers, and events.
- **After work:** persist outcomes and next actions; promote only governed insights.

### 5) Runtime Alignment Validator

- Evaluates candidate actions against:
  - original user intent
  - execution trajectory
  - `group_id`
  - taint state of inputs
- Blocks or re-anchors misaligned actions.

## Responsive Behavior

| Runtime Condition | Expected Behavior |
|------------------|-------------------|
| OpenCode session start | Hydrate shared context automatically |
| OpenClaw task continuation | Recover the same context for the same `group_id` |
| High-risk action proposed | Require explicit justification or block |
| Tainted input detected | Prevent propagation into critical parameters |
| Graph read requested | Use `mcp-neo4j` tools |
| Graph structure edit requested | Use authorized Cypher through MCP |

## Acceptance Criteria

1. OpenCode and OpenClaw both read/write through the same MCP memory contract.
2. Every memory operation carries `group_id`.
3. The adapter layer stays thin; no runtime owns its own memory logic.
4. Standard context retrieval uses `mcp-neo4j`.
5. Graph edits use authorized Cypher through MCP tooling.
6. Runtime alignment validation blocks semantically drifting high-risk actions.
7. A context hydrated in OpenCode can be recovered in OpenClaw for the same `group_id`.

## Notes

- This spec intentionally avoids changing the storage model.
- It adds governance and consistency at the adapter and validation layers.
