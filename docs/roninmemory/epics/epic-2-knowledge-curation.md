---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - PROJECT.md: roninmemory blueprint and architecture
---

# Epic 2: Automated Knowledge Curation

Implement the internal polling service that safely elevates trace data to permanent graphical insights and syncs a human-readable copy to Notion without risking database deadlock.

## Overview

This epic introduces the "Curator," a background daemon that watches raw execution traces in Postgres and identifies findings that deserve long-term promotion. It securely orchestrates the dual-write to Neo4j and the HTTP boundary push to Notion.

## Requirements Inventory

### Functional Requirements

FR3: The system must enforce a 2-phase commit pipeline: Phase 1 writes to Neo4j, Phase 2 commits `promoted=true` in PostgreSQL.
FR4: The system must auto-enqueue discovered insights based on score logic via database-level triggers.
FR5: The system must enforce dual-write integrity at the database layer.
FR6: The system must mirror promoted, high-confidence knowledge back to the Notion Master Knowledge Base.
FR7: The system must handle Notion API rate limits and network errors via an async, non-fatal retry queue.

## Story 2.1: Automated Enqueue Triggers

As a backend engineer,
I want PostgreSQL to automatically queue high-fitness tasks for promotion,
So that no external application code is responsible for spotting successful candidates.

**Acceptance Criteria:**
**Given** an execution completes
**When** `fitness_score >= 0.7` and `status = succeeded`
**Then** `trg_auto_enqueue_curator` trigger pushes the `run_id` into `curator_queue`.

## Story 2.2: Dual-Write 2-Phase Commit Daemon

As a system architect,
I want the promotion service to handle partial failures gracefully,
So that no orphaned Neo4j logic remains if the Postgres confirmation fails.

**Acceptance Criteria:**
**Given** the Curator polls the queue
**When** Phase 1 (Neo4j write) completes and Phase 2 (Postgres finalize) fails
**Then** a compensating `DETACH DELETE` removes the orphaned graph node
**And** `trg_promotion_guard` rejects any manual `promoted=true` override if `neo4j_written=false`.

## Story 2.3: Non-Fatal Notion Synchronization

As a project manager,
I want a human-readable copy of the promoted semantic graph synced to Notion,
So that I can verify the active capabilities of the platform.

**Acceptance Criteria:**
**Given** an insight successfully commits Phase 2
**When** the Notion API returns a rate limit or 500 error
**Then** the failure is logged and re-queued
**And** it does not crash or block the underlying Curator daemon.

## Sprint Status

| Story | Status | Owner |
|-------|--------|-------|
| 2.1 | COMPLETE | TBD |
| 2.2 | COMPLETE | TBD |
| 2.3 | COMPLETE | TBD |

## Definition of Done

- [x] Database triggers deployed via migration
- [x] Curator Node.js daemon polls and commits correctly
- [x] Failure edge cases effectively roll back graph mutations
- [x] Master Knowledge Base mirror functions properly
