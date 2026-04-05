# Tech Spec: Story 1.1 - Record Raw Execution Traces

**Story ID:** 1.1  
**Epic:** Epic 1 - Persistent Knowledge Capture and Tenant-Aware Memory  
**Priority:** P0  
**Status:** Ready for Development  
**Created:** 2026-04-06  
**Estimated Effort:** 5 days with validation gates

---

## Overview

Integrate the existing trace logging infrastructure with the newly built RuVix kernel to provide **proof-gated, append-only execution traces** with full tenant isolation.

This is the **foundational story** for all persistence features—everything downstream depends on reliable trace logging.

---

## Goals

1. Route all trace operations through RuVix kernel `mutate` syscall
2. Enforce append-only semantics via kernel proof validation
3. Maintain tenant isolation via `group_id` in every operation
4. Enable queryable execution history with confidence scoring

---

## Acceptance Criteria

### Functional Requirements

- [ ] **AC-1:** Every agent action is logged to `events` table via kernel `mutate` syscall
  - Must use `RuVixKernel.mutate()` or `RuVixKernel.syscall("trace", ...)`
  - Must include valid proof-of-intent with nonce
  - Must pass POL-001 (Tenant Isolation) validation

- [ ] **AC-2:** Logs include required fields:
  - `id`: Auto-generated UUID
  - `group_id`: Tenant identifier (validated `allura-*` format)
  - `agent_id`: Agent making the request
  - `workflow_id`: Optional workflow context
  - `status`: Event status (pending/completed/failed)
  - `created_at`: ISO8601 timestamp
  - `evidence_ref`: Reference to detailed evidence

- [ ] **AC-3:** Append-only enforcement
  - Updates to existing traces are rejected by kernel
  - Deletes require explicit `delete_op` mutation type
  - Historical traces are immutable (Steel Frame versioning)

- [ ] **AC-4:** Confidence scoring
  - Every trace includes `confidence` field (0.0-1.0)
  - Tool calls default to 1.0
  - Errors default to 0.0
  - User overrides accepted via metadata

- [ ] **AC-5:** Query support
  - Query by `agent_id` with time range
  - Query by `group_id` (tenant-scoped)
  - Query by `trace_type` (contribution/decision/learning/error)
  - Query by `workflow_id`

### Non-Functional Requirements

- [ ] **NFR-1:** Type safety
  - Zero TypeScript errors (`npm run typecheck` passes)
  - All interfaces properly typed
  - No `any` types in kernel integration

- [ ] **NFR-2:** Runtime validation
  - No runtime errors in happy path
  - Graceful degradation on kernel failure
  - Proper error messages for validation failures

- [ ] **NFR-3:** Test coverage
  - ≥80% coverage for trace-logger.ts
  - Unit tests for kernel integration
  - Integration tests for PostgreSQL flow

- [ ] **NFR-4:** Performance
  - Trace logging overhead < 10ms (async, non-blocking)
  - Batch insert support for bulk operations
  - Connection pooling respected

---

## Technical Design

### Architecture

```
Agent Request
    │
    ▼
┌─────────────────────────────────────┐
│ RuVixKernel.mutate()               │
│ - Creates proof-of-intent          │
│ - Validates nonce, group_id         │
│ - Enforces POL-001, POL-005        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Kernel Syscall: trace               │
│ - Validates policy context          │
│ - Generates audit ID                │
│ - Calls executor                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ PostgreSQL Trace Logger             │
│ - Inserts to events table           │
│ - Returns success/failure           │
└─────────────────────────────────────┘
```

### Files to Modify

#### 1. `src/lib/postgres/trace-logger.ts`
**Current State:** Direct PostgreSQL insertion
**Target State:** Kernel-backed insertion

```typescript
// BEFORE (existing)
export async function logTrace(trace: TraceLog): Promise<void> {
  const client = await pool.connect();
  await client.query(/* INSERT SQL */);
}

// AFTER (with kernel)
export async function logTrace(trace: TraceLog): Promise<void> {
  const result = await RuVixKernel.syscall("trace", {
    table: "events",
    data: trace,
  }, {
    actor: trace.agent_id,
    group_id: trace.group_id,
    permission_tier: "plugin",
  });
  
  if (!result.success) {
    throw new Error(`Trace logging failed: ${result.error}`);
  }
}
```

#### 2. `src/lib/postgres/trace-logger.test.ts`
**Add:**
- Kernel integration tests
- Proof validation tests
- Policy enforcement tests
- Error handling tests

#### 3. `src/app/api/memory/traces/route.ts`
**Update:** API route to use kernel-backed trace logger
- Validate `group_id` in request
- Inject via kernel context
- Return proper error codes

#### 4. `src/kernel/__tests__/mutate-events.test.ts` **(NEW)**
**Create:** Integration tests for kernel → PostgreSQL flow
- Test transaction atomicity
- Test audit trail generation
- Test tenant isolation
- Test proof validation

### Database Schema

**Table: `events`** (existing)

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id VARCHAR(255) NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  trace_type VARCHAR(50) NOT NULL,
  content TEXT,
  confidence DECIMAL(3,2) DEFAULT 1.0,
  workflow_id VARCHAR(255),
  evidence_ref VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_group FOREIGN KEY (group_id) 
    REFERENCES groups(id) ON DELETE CASCADE,
  CONSTRAINT chk_group_format CHECK (group_id ~ '^allura-[a-z0-9-]+$'),
  CONSTRAINT chk_confidence_range CHECK (confidence >= 0.0 AND confidence <= 1.0)
);

-- Index for tenant-scoped queries
CREATE INDEX idx_events_group_created 
  ON events(group_id, created_at DESC);

-- Index for agent queries
CREATE INDEX idx_events_agent_created 
  ON events(agent_id, created_at DESC);
```

### Type Definitions

```typescript
// src/lib/postgres/types.ts

export interface TraceLog {
  id?: string;              // Auto-generated
  group_id: string;         // Tenant isolation
  agent_id: string;         // Acting agent
  trace_type: "contribution" | "decision" | "learning" | "error";
  content: string;
  confidence: number;
  workflow_id?: string;
  evidence_ref?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;      // ISO8601
}

export interface QueryTracesOptions {
  group_id: string;         // Required for tenant isolation
  agent_id?: string;
  trace_type?: TraceLog["trace_type"];
  workflow_id?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

export interface QueryTracesResult {
  traces: TraceLog[];
  total: number;
  hasMore: boolean;
}
```

---

## Implementation Plan

### Day 1: Setup & Tests

**Hour 0-2:** Create spec file (this document)
**Hour 2-4:** Write failing tests
- Unit test: Kernel integration
- Unit test: Proof validation
- Unit test: Policy enforcement
- Integration test: PostgreSQL flow

**Hour 4-8:** Type definitions
- Update TraceLog interface
- Create QueryTracesOptions
- Create QueryTracesResult
- Run typecheck until 0 errors

### Day 2: Kernel Integration

**Hour 1-4:** Update trace-logger.ts
- Import RuVixKernel
- Wrap logTrace with kernel syscall
- Handle kernel errors
- Maintain backward compatibility

**Hour 4-8:** Update trace-logger.test.ts
- Mock kernel for unit tests
- Test proof validation
- Test policy enforcement
- Test error scenarios

### Day 3: API Routes & Querying

**Hour 1-4:** Update API route
- POST /api/memory/traces
- Validate group_id
- Inject kernel context
- Error handling

**Hour 4-8:** Query implementation
- GET /api/memory/traces
- Filter by group_id (required)
- Filter by agent_id, type, workflow
- Pagination support

### Day 4: Integration & Validation

**Hour 1-4:** Integration tests
- End-to-end kernel → PostgreSQL
- Test tenant isolation
- Test append-only enforcement
- Test batch operations

**Hour 4-8:** Performance testing
- Benchmark trace logging overhead
- Test batch insert performance
- Connection pool validation

### Day 5: Review & Commit

**Hour 1-3:** Party mode review
- Multi-agent architectural review
- Security validation

**Hour 3-5:** Systematic review
- bmad-code-review skill
- Triage findings

**Hour 5-8:** Fixes & commit
- Address Critical + High findings
- Final validation
- Commit with approval

---

## Dependencies

### Required (Must Be Ready)

- [x] **RuVix Kernel** - proof.ts, policy.ts, syscalls.ts
- [x] **PostgreSQL MCP** - Connection configured
- [x] **Trace Logger** - Existing infrastructure
- [x] **Group ID Validation** - allura-* format

### External Services

- PostgreSQL 16 (Docker)
- Neo4j 5.26 (for relationship tracking - optional for this story)

---

## Validation Gates

### Gate 1: Type Safety
```bash
npm run typecheck
```
**Criteria:** 0 errors

### Gate 2: Unit Tests
```bash
bun vitest run src/lib/postgres/trace-logger.test.ts
```
**Criteria:** 100% pass, ≥80% coverage

### Gate 3: Integration Tests
```bash
bun vitest run src/kernel/__tests__/mutate-events.test.ts
```
**Criteria:** All integration tests pass

### Gate 4: Party Mode Review
**Criteria:** ≤2 Critical findings, no security blockers

### Gate 5: Systematic Review
**Criteria:** All Critical + High findings addressed

### Gate 6: Performance
```bash
npm run benchmark:traces
```
**Criteria:** < 10ms per trace, batch insert < 100ms for 100 traces

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Kernel integration bugs | Medium | High | Extensive integration tests |
| PostgreSQL performance | Low | Medium | Connection pooling, batching |
| Type errors in strict mode | Medium | Low | Incremental checking during dev |
| Tenant isolation bypass | Low | Critical | Kernel enforcement + tests |

---

## Success Criteria Summary

- [ ] All 6 functional acceptance criteria met
- [ ] All 4 non-functional requirements met
- [ ] All 6 validation gates passed
- [ ] Code reviewed (party mode + systematic)
- [ ] No Critical findings unresolved
- [ ] Committed to main branch
- [ ] Documentation updated
- [ ] sprint-status.yaml updated to "done"
- [ ] Next story (1.2) unblocked

---

## Definition of Done

**Story 1.1 is complete when:**

1. ✅ Trace logging flows through RuVix kernel
2. ✅ Every trace has valid proof-of-intent with nonce
3. ✅ Tenant isolation enforced (POL-001)
4. ✅ Append-only semantics enforced
5. ✅ Type checking passes with 0 errors
6. ✅ All tests pass (100%)
7. ✅ Integration tests verify kernel → PostgreSQL flow
8. ✅ Code reviewed and approved
9. ✅ Documented and committed
10. ✅ sprint-status.yaml shows "done"

---

## Handoff to Dev Agent

**Agent:** bmad-dev-story (Amelia)  
**Instructions:**

1. Read this spec file completely
2. Understand existing trace-logger.ts architecture
3. Write failing tests first (TDD)
4. Implement kernel integration
5. Run typecheck continuously
6. Ensure all tests pass
7. Report back with:
   - What was implemented
   - Test results (pass/fail counts)
   - Any blockers or questions

**Success Criteria:** All validation gates pass

**Estimated Effort:** 4-5 days

---

**Approved by:** MemoryOrchestrator  
**Ready for Development:** YES
