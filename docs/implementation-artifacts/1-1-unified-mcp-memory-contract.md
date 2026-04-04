# Story 1.1: Define Shared MCP Memory Contract

## Goal

Define the contract that OpenCode and OpenClaw will use to read and write memory through roninmemory.

## Scope

- `group_id` is required on every memory request.
- Memory ingest and recall use the same MCP-facing schema.
- Runtime lifecycle hooks are standardized:
  - before work
  - during work
  - after work
- The contract separates raw traces from curated knowledge.

## Acceptance Criteria

- The contract is documented and implemented in source.
- The contract is usable by both OpenCode and OpenClaw adapters.
- Missing `group_id` is rejected.
- Contract-level tests cover the required fields and lifecycle hooks.
