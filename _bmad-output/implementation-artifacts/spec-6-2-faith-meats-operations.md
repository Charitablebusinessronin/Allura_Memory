---
title: 'Faith Meats Operations Workflow'
type: 'feature'
created: '2026-04-06'
status: 'in-progress'
baseline_commit: '692fb42d'
context:
  - '_bmad-output/implementation-artifacts/behavior-specs/faith-meats.yaml'
  - '_bmad-output/planning-artifacts/tenant-memory-boundary-spec.md'
  - 'src/workflows/notion-sync.ts'
---

## Intent

**Problem:** Faith Meats (P1 production workspace) lacks automated operations for inventory management, HACCP compliance, order processing, business intelligence, and operational alerts. Manual processes create risk of compliance violations, stock discrepancies, and missed customer communications.

**Approach:** Build integrated `FaithMeatsOperations` workflow module using wrapped MCP client with auto group_id enforcement. Follow existing pattern from `notion-sync.ts` — config interfaces, workflow orchestration, PostgreSQL logging, Neo4j knowledge graph. Enforce `allura-faith-meats` tenant isolation via RuVix kernel primitives.

## Boundaries & Constraints

**Always:**
- Enforce `group_id: allura-faith-meats` on all database operations (PostgreSQL + Neo4j)
- Log all state transitions to PostgreSQL `events` table (append-only, immutable)
- Track Neo4j knowledge relationships: Customer → Order → Product, CCP → Logged → Verified
- Use `WrappedMcpClient` with auto-tracing and budget enforcement
- Follow HACCP 7-year retention policy per BehaviorSpec CCP definitions
- Maintain 90-day inventory snapshot cycle per BehaviorSpec

**Ask First:**
- Payload CMS integration requires workspace owner approval (out of scope for v1)
- Cross-tenant BI dashboards require security review (scope to single-tenant first)

**Never:**
- Never access data from other tenants (`allura-audits`, `allura-creative`, etc.)
- Never modify PostgreSQL traces (append-only, immutable)
- Never skip HACCP compliance checks on critical control points
- Never store financial transaction data (out of scope per BehaviorSpec)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Order created | New order with valid products, sufficient inventory | Order logged to PostgreSQL, inventory decremented, status: created | Insufficient inventory → reject with error code, log to events |
| Order cancelled | Existing order in created/processing status | Inventory restored, status: cancelled, log restoration event | Order already shipped → reject, escalate to human |
| HACCP CCP logged | Temperature reading outside threshold | Log violation, flag for quality manager review, escalate | Continuous monitoring, auto-alert on deviation |
| Inventory snapshot | Daily scheduled run | Snapshot persisted to PostgreSQL, compared to previous day | Discrepancy > 5% → alert to operations team |
| BI query | Aggregation request for monthly order volume | Sum of orders by status, grouped by product | Empty result set → return zeros, not error |

## Code Map

- `src/workflows/notion-sync.ts` -- Reference pattern: workflow orchestration with group_id enforcement
- `src/lib/mcp/wrapped-client.ts` -- MCP client with auto-tracing, budget enforcement, group_id injection
- `src/kernel/ruvix.ts` -- Kernel primitives for write operations (mutate)
- `src/lib/memory/writer.ts` -- Neo4j knowledge graph writes using SUPERSEDES pattern
- `_bmad-output/implementation-artifacts/behavior-specs/faith-meats.yaml` -- HACCP CCP definitions, retention policies

## Tasks & Acceptance

**Execution:**
- [ ] `src/workflows/faith-meats.ts` -- Create FaithMeatsOperations class with order lifecycle, inventory management, HACCP tracking, BI queries, alert system
- [ ] `src/lib/haccp/compliance.ts` -- Create HACCP module with CCP validation, deviation logging, audit trail for 5 critical control points
- [ ] `src/lib/inventory/manager.ts` -- Create inventory module with stock updates, threshold alerts, discrepancy detection
- [ ] `docs/workflows/faith-meats-operations.md` -- Document workflow architecture, state machines, integration points
- [ ] `src/workflows/faith-meats.test.ts` -- Write tests covering order lifecycle, HACCP violations, inventory operations, BI queries

**Acceptance Criteria:**
- Given new order request, when products are in stock and group_id is valid, then order is created in PostgreSQL, inventory decremented, and Customer → Order → Product relationship created in Neo4j
- Given HACCP temperature recording, when reading exceeds CCP threshold, then violation is logged to PostgreSQL with escalation flag, and quality manager notified via Paperclip dashboard
- Given inventory snapshot request, when stock is queried, then current levels are persisted with timestamp and compared to previous snapshot for discrepancies
- Given BI dashboard query, when monthly order volume is requested, then aggregated results are returned grouped by status and product
- Given operational alert condition, when threshold breach occurs, then alert is logged and queued for Paperclip notification

## Spec Change Log

## Design Notes

**Order State Machine:**
```
created → processing → shipped → delivered
              ↓
           cancelled (restores inventory)
```

**HACCP CCP Flow:**
Each Critical Control Point follows: Record → Validate → Flag (if deviation) → Escalate (if critical) | Log to PostgreSQL with 7-year retention policy

**Inventory Snapshot Pattern:**
```
Daily snapshot → Compare to previous → Flag discrepancy > 5% → Alert operations team
```

**Group ID Enforcement:**
All operations use `WrappedMcpClient` with `groupId: 'allura-faith-meats'`. The RuVix kernel's `mutate` primitive enforces write permissions via tenant isolation policy.

## Verification

**Commands:**
- `npm run typecheck` -- expected: 0 errors
- `npm run lint` -- expected: 0 errors
- `npm test -- --grep "FaithMeatsOperations"` -- expected: all tests pass

**Manual checks (if no CLI):**
- Inspect `src/workflows/faith-meats.ts` for validateGroupId calls on all entry points
- Verify Neo4j relationship schema follows SUPERSEDES pattern
- Confirm PostgreSQL event types follow `faith-meats.{entity}.{action}` naming
- Check BehaviorSpec lifecycle hooks are implemented (before_work, during_work, after_work)