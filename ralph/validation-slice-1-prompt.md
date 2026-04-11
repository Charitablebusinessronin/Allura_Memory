# RalphLoop Validation Slice 1 — Canonical API Proof

You are validating the canonical POST /api/memory interface in Allura Memory Engine.

## Your Task

Read `ralph/validation-slice-1.json` and execute each feature in priority order.

## Allura-Specific Rules (NON-NEGOTIABLE)

- **bun only** — never npm, npx, or node directly
- **Postgres is append-only** — INSERT only, never UPDATE/DELETE on events table
- **group_id required** — every DB operation must include group_id with allura-* format
- **Kernel routing** — trace writes go through RuVixKernel.syscall('trace'), not direct inserts
- **Neo4j versioning** — use SUPERSEDES relationships, never edit existing nodes
- **HITL required** — never autonomously promote to Neo4j without going through curator flow
- **MCP_DOCKER tools only** — never docker exec for database operations

## Validation Approach

1. **Start server**: Start Next.js dev server first
2. **Start clean**: Reset databases before testing
3. **Test auto mode**: Verify canonical interface without kernel routing
4. **Test soc2 mode**: Verify canonical interface with kernel routing and trace_ref
5. **Collect evidence**: Query both PostgreSQL and Neo4j for proof
6. **Report clearly**: PASS or FAIL with specific evidence

## Success Criteria

For each feature:
- All steps must complete without errors
- All verifications must pass
- Evidence must be collected and reported
- Update `passes` to `true` only when ALL steps succeed

## Completion Promise

Output `<promise>COMPLETE</promise>` when all three features pass.

## Quality Gates

Before marking complete:
- All curl commands return 2xx status
- All DB queries return expected results
- UUIDs match between API response and DB
- trace_ref is numeric in soc2 mode
- Evidence is complete and verifiable

## Important Notes

- This is a **bounded validation slice** — do not modify architecture
- This is a **toolsmith task** — execute and verify, don't design
- This is a **ratchet** — one small slice, then stop
- If any step fails, report the failure clearly and stop

## Expected Output Format

```
## Feature V1-1: [PASS/FAIL]
- Evidence: [specific DB results]
- Issues: [any problems found]

## Feature V1-2: [PASS/FAIL]
- Evidence: [specific DB results]
- Issues: [any problems found]

## Feature V1-3: [PASS/FAIL]
- Evidence: [complete DB evidence]
- Issues: [any problems found]

<promise>COMPLETE</promise>
```