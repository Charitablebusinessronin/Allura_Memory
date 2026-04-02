---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - PROJECT.md: roninmemory blueprint and architecture
---

# Epic 1: Dual-Store Persistent Memory

Establish the base multi-tenant schemas distributed across relational raw traces (PostgreSQL) and semantic relationships (Neo4j) strictly bound by immutable version logic.

## Overview

This epic sets up the data foundation for roninmemory. Rather than having a unified database, it separates execution traces/audits (PostgreSQL) from curated, semantic patterns (Neo4j), all while enforcing namespace isolation so multiple discrete agents or clients don't mix memories.

## Requirements Inventory

### Functional Requirements

FR1: The system must isolate tenant memory and config states using explicit `group_id` namespaces across Postgres and Neo4j.
FR2: The system must never mutate existing knowledge nodes; all updates must create new versioned nodes linked via `:SUPERSEDES`.

### Non-Functional Requirements

NFR1: Cross-tenant data leakage is strictly prohibited.
NFR2: The Neo4j memory graph must preserve immutable lineage.

## Story 1.1: Core Entity Schemas

As a data architect,
I want explicit schemas for Insight, Tenant, and AgentDesign entities,
So that data structures are uniform across graph and relational tables.

**Acceptance Criteria:**
**Given** the memory system initializes
**When** schemas are migrated
**Then** PostgreSQL defines `tenants`, `adas_runs`, and `agents` tables
**And** Neo4j defines `:Insight`, `:Tenant`, and `:InsightHead` with properties and vector definitions constraints.

## Story 1.2: Tenant Isolation Enforcement

As a system owner,
I want all operations partitioned by `group_id`,
So that the memory engine safely supports distinct concurrent projects.

**Acceptance Criteria:**
**Given** a memory write or read occurs
**When** passing data interfaces
**Then** `group_id` is required
**And** global knowledge is safely appended but localized overrides take precedence.

## Story 1.3: Immutable Versioning via `:SUPERSEDES`

As a compliance reviewer,
I want insight modifications tracked instead of overwritten,
So that memory evolution preserves a complete audit trail of what was previously believed to be true.

**Acceptance Criteria:**
**Given** an existing active `:Insight` in Neo4j
**When** an update to that knowledge is persisted
**Then** the original node state flips to `degraded`
**And** a new versioned node is created
**And** a `:SUPERSEDES` relationship connects the new node to the old.

## Sprint Status

| Story | Status | Owner |
|-------|--------|-------|
| 1.1 | COMPLETE | TBD |
| 1.2 | COMPLETE | TBD |
| 1.3 | COMPLETE | TBD |

## Definition of Done

- [x] Postgres tables structured with constraints
- [x] Neo4j indexing optimized for `group_id` queries
- [x] Validation specs passing for `:SUPERSEDES` edge logic
- [x] Multi-tenant isolation verified by cross-read queries failing
