# Allura Agent-OS Epics

> **Source of Truth:** This document defines all epics and stories for the Allura Agent-OS project.
> **Last Updated:** 2026-04-05
> **Status:** Active

---

## Epic Overview

| Epic | Name | Status | Priority |
|------|------|--------|----------|
| 1 | Persistent Knowledge Capture and Tenant-Aware Memory | `in-progress` | P0 |
| 2 | Multi-Organization Plugin Architecture | `planned` | P1 |
| 3 | Human-in-the-Loop Governance | `planned` | P2 |
| 4 | Cross-Organization Knowledge Sharing | `planned` | P3 |
| 5 | Regulator-Grade Audit Trail | `planned` | P3 |
| 6 | Production Workflows | `planned` | P4 |

---

## Epic 1: Persistent Knowledge Capture and Tenant-Aware Memory

**Status:** `in-progress`
**Priority:** P0 (Critical)
**Goal:** Enable agents to persist context across sessions with proper tenant isolation.

### Architecture Foundation

**Story ARCH-001: Fix groupIdEnforcer.ts (RK-01)**

**Status:** `ready-for-dev`
**Priority:** 🔴 Critical (Blocks all multi-tenant features)
**Risk:** High (Security boundary)
**Target:** `src/lib/runtime/groupIdEnforcer.ts`

**Problem:** The `groupIdEnforcer.ts` module is non-functional, breaking tenant isolation.

**Acceptance Criteria:**
- [ ] Enforcer validates `group_id` is provided (not null, undefined, or empty)
- [ ] Enforcer validates `group_id` format matches `allura-{org}` pattern
- [ ] PostgreSQL queries include `WHERE group_id = $1` clause
- [ ] Neo4j queries filter by `group_id` property
- [ ] Cross-tenant data access returns empty results
- [ ] Error includes specific code: `RK-01`
- [ ] Error is logged to audit trail with full context

**Definition of Done:**
- [ ] Unit tests cover all validation scenarios (100% branch coverage)
- [ ] Integration tests verify end-to-end enforcement
- [ ] Security tests confirm tenant isolation
- [ ] MCP servers updated to use enforcer
- [ ] Documentation updated

**Blocker:** This must be fixed before any other stories can proceed.

---

### Story 1.1: Record Raw Execution Traces

**Status:** `ready-for-dev` (Blocked by ARCH-001)
**Priority:** P0
**Goal:** Log all agent actions to PostgreSQL with append-only semantics.

**Acceptance Criteria:**
- [ ] Every agent action is logged to `events` table
- [ ] Logs include: `id`, `group_id`, `agent_id`, `workflow_id`, `status`, `created_at`, `evidence_ref`
- [ ] Logs are append-only (never mutated)
- [ ] Logs include confidence scoring
- [ ] Logs are queryable by agent, type, and date range

**Implementation Status:**
- ✅ `src/lib/postgres/trace-logger.ts` — Created
- ✅ `src/lib/postgres/trace-logger.test.ts` — Test suite created
- ⏳ Awaiting ARCH-001 fix

---

### Story 1.2: Implement NOTION_SYNC Workflow

**Status:** `backlog`
**Priority:** P1
**Goal:** Sync traces to Notion Knowledge Hub for human review.

**Acceptance Criteria:**
- [ ] Traces sync to Notion database
- [ ] Human review queue in Notion
- [ ] Approval workflow triggers promotion
- [ ] Sync status tracked in PostgreSQL

---

### Story 1.3: Create Agent Knowledge Nodes

**Status:** `completed`
**Priority:** P1
**Goal:** Create persistent Neo4j nodes for each agent.

**Acceptance Criteria:**
- [x] 7 Agent nodes created in Neo4j
- [x] Agent records synced to PostgreSQL
- [x] AgentGroup with INCLUDES relationships
- [x] KNOWS relationships established

**Completed:** 2026-04-05

---

### Story 1.4: Implement Relationship Schemas

**Status:** `completed`
**Priority:** P1
**Goal:** Define and document agent relationships.

**Acceptance Criteria:**
- [x] CONTRIBUTED relationship schema documented
- [x] LEARNED relationship schema documented
- [x] DECIDED relationship schema documented
- [x] COLLABORATED_WITH relationship schema documented
- [x] SUPERSEDES relationship schema documented
- [x] INCLUDES relationship documented
- [x] KNOWS relationship documented

**Completed:** 2026-04-05

---

### Story 1.5: Implement CONTRIBUTED Relationship

**Status:** `backlog`
**Priority:** P2
**Goal:** Track agent knowledge contributions.

**Acceptance Criteria:**
- [ ] `CONTRIBUTED` relationship creates on agent insight creation
- [ ] Properties: `timestamp`, `confidence`, `action`
- [ ] Queryable by agent and time range
- [ ] Auditable via Neo4j

---

### Story 1.6: Implement LEARNED Relationship

**Status:** `backlog`
**Priority:** P2
**Goal:** Track agent session learning.

**Acceptance Criteria:**
- [ ] `LEARNED` relationship creates on agent session completion
- [ ] Properties: `timestamp`, `relevance_score`
- [ ] Queryable by session and agent
- [ ] Enables context recall

---

### Story 1.7: Create memory() TypeScript Wrapper

**Status:** `backlog`
**Priority:** P2
**Goal:** Simplified interface for MCP Docker tools.

**Acceptance Criteria:**
- [ ] `memory.createEntity()` wrapper
- [ ] `memory.createRelationship()` wrapper
- [ ] `memory.query()` wrapper
- [ ] `memory.search()` wrapper
- [ ] Automatic `group_id` injection
- [ ] TypeScript type definitions

---

## Epic 2: Multi-Organization Plugin Architecture

**Status:** `planned`
**Priority:** P1
**Goal:** Enable Allura to run on multiple agent platforms.

### Story 2.1: OpenCode Plugin Documentation

**Status:** `completed`
**Priority:** P1
**Goal:** Document existing OpenCode plugin structure.

**Acceptance Criteria:**
- [x] Directory structure documented
- [x] Agent definitions documented (8 agents)
- [x] Skills documented (100+)
- [x] MCP configuration documented
- [x] Installation documented

**Completed:** 2026-04-05

---

### Story 2.2: Claude Code Plugin Specification

**Status:** `completed`
**Priority:** P1
**Goal:** Create Claude Code plugin specification.

**Acceptance Criteria:**
- [x] Plugin manifest format documented
- [x] Agent migration plan documented
- [x] Skill definitions documented
- [x] MCP configuration documented
- [x] Installation documented
- [ ] Remaining 6 agents migrated

**Status:** Partial (1/8 agents migrated)

---

### Story 2.3: OpenClaw Plugin Specification

**Status:** `completed`
**Priority:** P1
**Goal:** Create OpenClaw plugin specification.

**Acceptance Criteria:**
- [x] Native format specified
- [x] Bundle mode specified
- [x] OpenClaw API documented
- [x] Installation documented
- [ ] Plugin created (not started)

**Status:** Specification complete, implementation not started

---

### Story 2.4: Bun-Only Package Strategy

**Status:** `completed`
**Priority:** P1
**Goal:** Use Bun exclusively for package management.

**Acceptance Criteria:**
- [x] All `npx` replaced with `bunx`
- [x] Documentation updated
- [x] MCP configurations updated
- [x] Security note added

**Completed:** 2026-04-05

---

## Epic 3: Human-in-the-Loop Governance

**Status:** `planned`
**Priority:** P2
**Goal:** Enable human approval for sensitive operations.

### Story 3.1: Paperclip Dashboard Foundation

**Status:** `backlog`
**Priority:** P2
**Goal:** Create governance dashboard foundation.

**Acceptance Criteria:**
- [ ] Organization management UI
- [ ] HITL approval queue
- [ ] Token budget monitoring
- [ ] Audit log viewer

---

### Story 3.2: Approval Workflow Implementation

**Status:** `backlog`
**Priority:** P2
**Goal:** Implement approval workflow for promotions.

**Acceptance Criteria:**
- [ ] Propose insight for promotion
- [ ] Curator review interface
- [ ] Approval/rejection workflow
- [ ] Audit trail for approvals

---

## Epic 4: Cross-Organization Knowledge Sharing

**Status:** `planned`
**Priority:** P3
**Goal:** Enable sanitized knowledge sharing across organizations.

### Story 4.1: Sanitization Engine

**Status:** `backlog`
**Priority:** P3
**Goal:** Sanitize tenant-specific data before promotion.

**Acceptance Criteria:**
- [ ] Remove tenant identifiers
- [ ] Anonymize sensitive data
- [ ] Create abstracted patterns
- [ ] Validate sanitization

---

### Story 4.2: Platform Library

**Status:** `backlog`
**Priority:** P3
**Goal:** Create platform-wide knowledge library.

**Acceptance Criteria:**
- [ ] Store promoted insights
- [ ] Search across organizations
- [ ] Track adoption metrics
- [ ] Version control

---

## Epic 5: Regulator-Grade Audit Trail

**Status:** `planned`
**Priority:** P3
**Goal:** Enable regulator-grade audit queries.

### Story 5.1: Audit Query Interface

**Status:** `backlog`
**Priority:** P3
**Goal:** Create audit query interface.

**Acceptance Criteria:**
- [ ] Query decision provenance
- [ ] Query rule versions
- [ ] Reconstruct evidence chains
- [ ] Review human overrides
- [ ] Export audit trail

---

## Epic 6: Production Workflows

**Status:** `planned`
**Priority:** P4
**Goal:** Implement production-ready workflows for first customers.

### Story 6.1: Bank-Auditor Workflow

**Status:** `backlog`
**Priority:** P4
**Goal:** Implement banking audit workflow.

**Acceptance Criteria:**
- [ ] Upload loan decision documents
- [ ] AI analysis for compliance
- [ ] Flag suspicious decisions
- [ ] HITL approval workflow
- [ ] Audit trail export

---

### Story 6.2: Faith Meats Operations

**Status:** `backlog`
**Priority:** P4
**Goal:** Implement Faith Meats business operations.

**Acceptance Criteria:**
- [ ] Inventory management
- [ ] HACCP compliance tracking
- [ ] Order processing
- [ ] Business intelligence dashboards

---

## Story Status Legend

| Status | Description |
|--------|-------------|
| `ready-for-dev` | Ready to start, no blockers |
| `in-progress` | Currently being worked on |
| `completed` | Fully completed and verified |
| `blocked` | Blocked by dependency |
| `backlog` | Not yet scheduled |
| `planned` | Planned but not started |

---

## Critical Path

```
ARCH-001 (groupIdEnforcer.ts)
    ↓
Story 1.1 (Record Raw Execution Traces)
    ↓
Story 1.5-1.7 (Relationships + Wrapper)
    ↓
Story 2.1-2.4 (Plugin Architecture) ✅ Complete
    ↓
Epic 3-6 (Governance + Workflows)
```

**Current Blocker:** ARCH-001 must be fixed before any other Epic 1 stories can proceed.

---

## References

- [PRD v2](./prd-v2.md) — Product requirements
- [Architectural Brief](./architectural-brief.md) — Architecture overview
- [Tenant & Memory Boundary Spec](./tenant-memory-boundary-spec.md) — Tenant isolation
- [Data Dictionary](./data-dictionary.md) — Field definitions
- [Source of Truth](./source-of-truth.md) — Document hierarchy