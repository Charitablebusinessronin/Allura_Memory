# Allura Memory Model

## Purpose

This reference defines how to think about persistent memory in **Allura Brain**.

Allura Brain is not one flat store. It is a governed memory system with distinct layers.

## Layers

### 1. Raw trace

Raw trace captures what happened.

- source events
- session breadcrumbs
- operational evidence
- task outcomes

Rules:

- append-only
- never treated as canonical truth by itself
- useful for audit, debugging, and promotion candidates

### 2. Curated insight

Curated insight captures what remains useful beyond one session.

- validated pattern
- architectural decision
- reusable debugging lesson
- stable entity fact

Rules:

- promote only after evidence review
- preserve lineage
- prefer new version nodes/records over in-place mutation

### 3. Retrieval context

Retrieval context is the context window loaded for the current task.

Rules:

- prefer the smallest useful subset
- prefer local/project context first
- add global context only if it materially improves reasoning

## Conceptual Entities

Common node or concept types:

- Event
- Outcome
- Insight
- ADR
- Entity
- Project
- Source

## Relationship Examples

- `(:Event)-[:RESULTED_IN]->(:Outcome)`
- `(:Outcome)-[:YIELDED]->(:Insight)`
- `(:Insight)-[:SUPERSEDES]->(:Insight)`
- `(:Insight)-[:DEPRECATED_BY]->(:Insight)`
- `(:Insight)-[:ABOUT]->(:Entity)`
- `(:Insight)-[:FOR_PROJECT]->(:Project)`
- `(:Insight)-[:SUPPORTED_BY]->(:Source)`

## Status Guidance

Prefer explicit version and status semantics over silent overwrite.

Use states such as:

- active
- deprecated
- superseded
- disputed
- deleted
- restored

## Repo Invariants

- `group_id` is required on every operation
- `group_id` must match `^allura-[a-z0-9-]+$`
- use `allura-roninmemory` unless the task explicitly says otherwise
- PostgreSQL traces remain append-only
- Neo4j knowledge evolves through lineage, never in-place mutation
