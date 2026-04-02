---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - PROJECT.md: roninmemory blueprint and architecture
---

# roninmemory - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the roninmemory persistent knowledge system. It exclusively covers the persistence backend, data routing, curation machinery, and cache generation (omitting ADAS discovery and OpenClaw plugin integration).

## Requirements Inventory

### Functional Requirements

FR1: The system must isolate tenant memory and config states using explicit `group_id` namespaces across Postgres and Neo4j.
FR2: The system must never mutate existing knowledge nodes; all updates must create new versioned nodes linked via `:SUPERSEDES`.
FR3: The system must enforce a 2-phase commit pipeline: Phase 1 writes to Neo4j, Phase 2 commits `promoted=true` in PostgreSQL.
FR4: The system must auto-enqueue discovered insights based on score logic via database-level triggers (`trg_auto_enqueue_curator`).
FR5: The system must enforce dual-write integrity at the database level so Postgres cannot claim success unless Neo4j succeeds (`trg_promotion_guard`).
FR6: The system must mirror promoted, high-confidence knowledge back to the Notion Master Knowledge Base.
FR7: The system must handle Notion API rate limits and network errors via an async, non-fatal retry queue.
FR8: The system must provide structured session hydration by dumping markdown documentation into `index.json` arrays.
FR9: The system must support restoring session bounds in <30s without runtime filesystem scanning via memory-bank artifacts.

### Non-Functional Requirements

NFR1: Cross-tenant data leakage is strictly prohibited; queries must route exclusively to the scoped `group_id`.
NFR2: The Neo4j memory graph must preserve immutable lineage using the Steel Frame pattern.
NFR3: Retries and failure loops on async mirroring must not block core system threads.

### Additional Requirements

- The database must handle phase 1 fail rollbacks with a compensating `DETACH DELETE`.
- Memory snapshots and hydration scripts must be built as deterministic Bun CLIs.

### FR Coverage Map

FR1: Epic 1 - Enforce multi-tenant boundaries
FR2: Epic 1 - Persistent immutable graph versioning
FR3: Epic 2 - 2-phase promotion commit
FR4: Epic 2 - Database layer auto-enqueue
FR5: Epic 2 - Database constraints on promotion
FR6: Epic 2 - Notion mirroring
FR7: Epic 2 - Retry queues for APIs
FR8: Epic 3 - JSON dump caching for session reads
FR9: Epic 3 - Hydration loop optimizations

## Epic List

### Epic 1: Dual-Store Persistent Memory
Establish the base multi-tenant schemas distributed across relational raw traces (PostgreSQL) and semantic relationships (Neo4j) strictly bound by immutable version logic.
**FRs covered:** FR1, FR2

### Epic 2: Automated Knowledge Curation
Implement the internal polling service that safely elevates trace data to permanent graphical insights and syncs a human-readable copy to Notion without risking database deadlock.
**FRs covered:** FR3, FR4, FR5, FR6, FR7

### Epic 3: Memory Snapshot & Session Hydration
Produce an isolated sub-system to pre-parse extensive documentation sets and compress them into rapid-boot index structures for downstream reasoning agents.
**FRs covered:** FR8, FR9
