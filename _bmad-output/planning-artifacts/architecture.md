---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - /home/ronin704/dev/projects/memory/_bmad-output/planning-artifacts/prd.md
  - /home/ronin704/dev/projects/memory/_bmad-output/project-context.md
  - /home/ronin704/dev/projects/memory/memory-bank/systemPatterns.md
  - /home/ronin704/dev/projects/memory/memory-bank/techContext.md
  - /home/ronin704/dev/projects/memory/docs/api/notion.md
  - /home/ronin704/dev/projects/memory/docs/api/policy.md
  - /home/ronin704/dev/projects/memory/docs/api/ralph.md
  - /home/ronin704/dev/projects/memory/docs/api/sync.md
  - /home/ronin704/dev/projects/memory/docs/api/adr.md
workflowType: 'architecture'
project_name: 'memory'
user_name: 'Sabir'
date: '2026-03-20'
lastStep: 8
status: 'complete'
completedAt: '2026-03-20T17:43:30-04:00'
---

# Architecture Decision Document

This document defines the governing architecture for the governed auto-promotion initiative inside `memory`. It is intentionally brownfield: preserve the existing 4-layer memory system, tighten conceptual integrity, and add a single coherent approval/promotion path that AI agents can implement consistently.

## Project Context Analysis

### Requirements Overview

**Functional Requirements**

The initiative adds a governed promotion pipeline on top of the existing memory platform. The core functional scope is:
- capture evidence in PostgreSQL and semantic insight state in Neo4j
- evaluate promotable insights through explicit policy gates
- auto-approve strong insights into the human knowledge surface through Smithery MCP-backed Notion sync
- notify operators immediately in Discord
- preserve immediate revocation and full ADR lineage
- keep BMAD as the governing method for planning and story execution
- keep Ralph loops bounded and story-scoped
- use existing OpenCode/Ollama Cloud/OpenAI configuration rather than inventing a second orchestration harness

**Non-Functional Requirements**

The NFRs driving architecture are:
- promotion latency below user-attention thresholds
- reliable sync with retry/backoff around Smithery-backed Notion operations
- append-only raw trace integrity in PostgreSQL
- immutable versioning and lineage in Neo4j
- bounded autonomy for Ralph loops
- tenant isolation via `group_id`
- reversible promotion through revoke flow rather than hard deletion
- no secrets in code or memory artifacts

### Scale & Complexity

- Primary domain: developer tool / governed AI workflow system
- Complexity level: high
- Architectural style: brownfield modular monolith with MCP surface and external control-plane integrations
- Cross-cutting concerns: policy enforcement, auditability, sync consistency, revocation semantics, multi-model orchestration, tenant isolation, and BMAD story governance

### Technical Constraints & Dependencies

- Runtime stays on Next.js 16 + TypeScript 5.9.2 + Node 20
- Existing persistence remains PostgreSQL 16 + Neo4j 5.26/APOC
- Smithery MCP is the Notion integration path
- Discord webhook is the operator intervention surface
- `qwen3-embedding:8b` is available for duplicate detection and retrieval support
- `memory-server.ts` currently contains fragmented promotion/approval wrappers that must be unified
- existing system rules still describe HITL promotion; this initiative explicitly introduces governed auto-approval with human revocation for this workflow

### Cross-Cutting Concerns Identified

- **Governance**: promote under policy, not by ad hoc tool calls
- **Conceptual integrity**: one approval orchestration service, not multiple overlapping code paths
- **Brooks discipline**: BMAD doctrine above runtime orchestration; no loop runs before story structure exists
- **Audit**: ADR and raw events must explain promotion, revocation, and counterfactuals
- **Safety**: proceed unless revoked, but always leave an operator kill switch

## Core Architectural Decisions

### Runtime / Orchestration Decisions

- **BMAD is the governing method** for planning and implementation sequencing
- **Sisyphus is the runtime orchestrator** inside the OpenCode/oh-my-openagent layer
- **Prometheus plans**, **Sisyphus orchestrates**, **Hephaestus executes deep coding**, **Oracle/Momus review hard logic**, **Explore/Librarian gather supporting context**
- Ralph loops are bounded and may run only after BMAD has created stories
- Ralph loops operate at story scope, not free-form repo scope
- Brooks principles are explicit constraints:
  - conceptual integrity over local optimization
  - story-first execution
  - no premature abstraction
  - one epic at a time
  - minimize communication overhead by centralizing decisions in architecture and stories

### Data Architecture

- **PostgreSQL remains Layer 1** for append-only evidence, status events, notification events, and rollback traces
- **Insight Layer (Neo4j) remains versioned** with `SUPERSEDES`, `DEPRECATED`, and `REVERTED` semantics preserved
- **Decision Layer (ADR)** records every approval, rejection, revoke, and policy counterfactual
- **Knowledge Access Layer** is the projection layer: Smithery-backed Notion mirror, dual-context retrieval, and Discord intervention signals

### Integration Rules

- Keep MCP as transport only; orchestration lives in service code
- Keep Smithery MCP as the Notion write path; no direct Notion SDK path added here
- Preserve append-only PostgreSQL events and immutable Neo4j lineage
- Model runtime approval using explicit state transitions, not implied booleans
- Store `Approved By = agent:<name>` on auto-approved items
- Keep `AI Accessible` as the hard runtime control bit
- Require that Discord notifications fire only after durable state transition completes

## Implementation Patterns & Consistency Rules

### Enforcement Guidelines

**All AI Agents MUST**
- route promotion actions through the unified orchestration service
- honor BMAD story boundaries before any Ralph loop execution
- preserve append-only evidence and immutable semantic lineage
- apply Brooks principles as architectural constraints, not optional style guidance

**Anti-Patterns**
- returning `smithery tool call notion-create-page ...` as the normal success path
- approving in Neo4j without updating the human-facing projection
- sending notifications before state is durable
- starting Ralph loops against unstructured work

## Project Structure & Boundaries

### Architectural Boundaries

- `src/mcp/memory-server.ts` is transport and validation only
- promotion tools delegate to orchestration service
- Smithery interactions are isolated behind a client/adapter boundary
- PostgreSQL is raw evidence and event stream
- Neo4j is semantic state and lineage
- Smithery-backed Notion is the approved projection surface
- Discord is the operator control surface

## Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**First Implementation Priority**
Refactor approval and promotion into a single orchestration service, then wire Smithery-backed Notion sync and Discord notifications through that service.
