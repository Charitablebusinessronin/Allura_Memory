# roninmemory Epics

## Epic 1: Unified MCP Memory Adapter

Build a shared memory contract and thin runtime adapters so OpenCode and OpenClaw both read/write through the same governed substrate.

### Story 1.1: Define Shared MCP Memory Contract

Specify the contract for memory ingest, recall, `group_id` injection, and runtime lifecycle hooks.

### Story 1.2: Implement OpenCode Thin Adapter

Replace any runtime-specific memory behavior with a thin MCP client adapter for OpenCode.

### Story 1.3: Implement OpenClaw Thin Adapter

Replace any runtime-specific memory behavior with a thin MCP client adapter for OpenClaw.

### Story 1.4: Add Runtime Alignment Validation

Block semantic drift by checking candidate actions against user intent, execution trajectory, and taint state.

## Epic 2: Stabilize Existing Runtime and Test Gaps

Fix the current typecheck and runtime issues so the initialization baseline is healthy.

### Story 2.1: Replace Broken Group ID Middleware

Remove placeholder middleware code and implement a real `group_id` enforcement layer.

### Story 2.2: Repair Typecheck and Test Mismatches

Update stale mocks and typing issues in existing tests and ADAS CLI code.

### Story 2.3: Document Current System State

Keep the project overview, active context, and progress docs aligned with the actual codebase.
