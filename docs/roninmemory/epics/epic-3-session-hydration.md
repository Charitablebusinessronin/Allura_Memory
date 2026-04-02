---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - PROJECT.md: roninmemory blueprint and architecture
---

# Epic 3: Memory Snapshot & Session Hydration

Produce an isolated sub-system to pre-parse extensive documentation sets and compress them into rapid-boot index structures for downstream reasoning agents.

## Overview

This epic introduces the deterministic caching capabilities. Because reading hundreds of Markdown files directly at every agent boot-up incurs heavy latency, these scripts compress documentation trees into JSON arrays (`memory-bank/index.json`) for <30s hydration.

## Requirements Inventory

### Functional Requirements

FR8: The system must provide structured session hydration by dumping markdown documentation into `index.json` arrays.
FR9: The system must support restoring session bounds in <30s without runtime filesystem scanning via memory-bank artifacts.

## Story 3.1: Memory Snapshot Compression CLI

As an AI engineer,
I want a CLI to compress documentation forests into a single structured snapshot,
So that boot operations don't incur recursive filesystem parsing blocking latency.

**Acceptance Criteria:**
**Given** the `snapshot:build` CLI fires
**When** provided specific `-source` directories
**Then** it compiles the markdown layout, strips irrelevant syntax, truncates to `--max-summary-chars`
**And** outputs a single, structured `index.json` optimized for agent ingest.

## Story 3.2: Concurrent Session Hydration

As an agent operator,
I want the bootloader to read the JSON file and instantly hydrate the localized context,
So that session bootstrapping completes under the 30 second threshold.

**Acceptance Criteria:**
**Given** a generated snapshot cache exists
**When** `session:hydrate` triggers
**Then** it reads the index and populates the memory structs concurrently based on the `--concurrency` flag
**And** supports `--dry-run` to validate context maps without overwriting live memory pointers.

## Sprint Status

| Story | Status | Owner |
|-------|--------|-------|
| 3.1 | COMPLETE | TBD |
| 3.2 | COMPLETE | TBD |

## Definition of Done

- [x] Snapshot script effectively parses markdown and YAML boundaries
- [x] Hydration loop executes within performance thresholds
- [x] Subsystem fully tested locally
