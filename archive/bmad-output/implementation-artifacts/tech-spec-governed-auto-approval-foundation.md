---
title: 'Governed Auto-Approval Foundation'
slug: 'governed-auto-approval-foundation'
created: '2026-03-20T17:48:28-04:00'
status: 'ready-for-development'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - TypeScript 5.9.2
  - Next.js 16
  - PostgreSQL 16
  - Neo4j 5.26
  - Smithery MCP
  - Discord Webhooks
  - OpenCode / oh-my-openagent
files_to_modify:
  - src/mcp/memory-server.ts
  - src/curator/approval-sync.service.ts
  - src/curator/index.ts
  - src/integrations/notion.client.ts
  - src/lib/policy/gateway.ts
  - src/lib/sync/insight-mirror.test.ts
  - src/__tests__/promotion-governance.e2e.test.ts
code_patterns:
  - MCP transport delegates to service layer
  - Policy gateway mediates side-effecting actions
  - Neo4j remains versioned semantic state
  - PostgreSQL remains append-only evidence log
  - Notion writes go through Smithery MCP adapter
  - Ralph loops execute only after BMAD story structure exists
test_patterns:
  - Vitest unit tests beside modules
  - E2E tests in src/__tests__
  - rollback/consistency assertions across PG + Neo4j + Notion
---

# Tech-Spec: Governed Auto-Approval Foundation

**Created:** 2026-03-20T17:48:28-04:00

## Overview

### Problem Statement

The current governed promotion flow is fragmented. `src/mcp/memory-server.ts` mutates Neo4j and returns manual Smithery command strings instead of executing the real Notion sync path, while `src/curator/approval-sync.service.ts` separately updates Notion and Neo4j for human review outcomes. This leaves no single orchestration path for auto-approval, revocation, Discord notification, or durable rollback semantics.

### Solution

Introduce a single approval orchestration foundation that becomes the only path for promote, approve, reject, and revoke operations. MCP tools stay as transport wrappers, Smithery MCP remains the Notion integration boundary, PostgreSQL/Neo4j remain authoritative state stores, and Discord becomes the operator control surface for immediate intervention.

### Scope

**In Scope:**
- define the authoritative approval lifecycle for the initiative
- unify promote/approve/reject/revoke into one orchestration path
- route Notion page create/update through Smithery-backed integration instead of manual command strings
- emit durable events and ADR-compatible state transitions for every decision
- prepare the seam for Discord notification and revoke handling
- encode BMAD + Brooks rules so runtime orchestration stays subordinate to stories

**Out of Scope:**
- predictive promotion
- broad review-queue UI beyond current surfaces
- replacing the full memory platform architecture
- redesigning existing raw trace or Neo4j storage primitives
- implementing all downstream notification UX refinements in this slice

## Context for Development

### Codebase Patterns

- `src/mcp/memory-server.ts` already acts as the MCP tool transport layer, but promotion tools currently short-circuit into direct state mutation and command-string responses.
- `src/curator/index.ts` already wires `CuratorService`, `ApprovalSyncService`, `NotionClientImpl`, and `Neo4jClientImpl`, which makes it the most natural place to add an authoritative orchestration boundary.
- `src/curator/approval-sync.service.ts` already knows the correct Notion property semantics (`Status`, `Review Status`, `AI Accessible`, `Approved By`, `Approved At`) and contains rollback behavior when Neo4j update fails.
- `src/integrations/notion.client.ts` already talks to Smithery-backed Notion tools (`notion-create-pages`, `notion-update-page`, `notion-fetch`) and should remain the only page-operation adapter.
- `src/lib/policy/gateway.ts` is already the mandatory entry point for side-effecting tool calls and should gate the orchestration service, not be bypassed.
- Brooks principles for this initiative: conceptual integrity first, story-first execution, one epic at a time, and no Ralph loop before BMAD stories exist.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/mcp/memory-server.ts` | Current MCP promotion wrappers and fragmentation point |
| `src/curator/approval-sync.service.ts` | Existing approve/reject/supersede sync logic |
| `src/curator/index.ts` | Existing wiring seam for curator services |
| `src/integrations/notion.client.ts` | Smithery-backed Notion adapter |
| `src/lib/policy/gateway.ts` | Mandatory interceptor for side-effecting actions |
| `_bmad-output/planning-artifacts/prd.md` | Initiative intent, FRs, NFRs, and governance model |
| `memory-bank/systemPatterns.md` | Existing memory architecture and legacy HITL rules to supersede deliberately |
| `_bmad-output/planning-artifacts/epics.md` | Existing BMAD story structure and execution discipline |

### Technical Decisions

- Keep MCP as transport only; orchestration lives in service code.
- Keep Smithery MCP as the Notion write path; no direct Notion SDK path added here.
- Preserve append-only PostgreSQL events and immutable Neo4j lineage.
- Model runtime approval using explicit state transitions, not implied booleans.
- Store `Approved By = agent:<name>` on auto-approved items.
- Keep `AI Accessible` as the hard runtime control bit.
- Require that Discord notifications fire only after durable state transition completes.

## Implementation Plan

### Tasks

1. `src/curator/approval-orchestrator.ts`: add a new orchestration service that owns `promote`, `approve`, `reject`, and `revoke` transitions.
   - Define explicit input/output contracts.
   - Write PostgreSQL events for every transition.
   - Delegate Notion operations through `NotionClientImpl`.
   - Delegate semantic state updates through existing Neo4j client/service seams.

2. `src/mcp/memory-server.ts`: refactor promotion-related MCP tools to call the orchestration service instead of mutating Neo4j inline or returning manual Smithery commands.
   - `promote_insight_to_notion` must stop returning `smithery tool call ...` as the normal success path.
   - `approve_insight`, `reject_insight`, and new `revoke_insight` should all flow through the same service.

3. `src/curator/approval-sync.service.ts`: either fold into the new orchestrator or narrow it to a specialized adapter so approval semantics are not duplicated.
   - Reuse its correct property-mapping logic.
   - Preserve rollback behavior, but move state authority into the new orchestration flow.

4. `src/integrations/notion.client.ts`: ensure the adapter exposes the operations needed by the orchestration service without leaking Smithery tool naming into higher layers.
   - Keep page create/update/fetch here.
   - Add any missing method needed for revoke/status transitions.

5. `src/lib/policy/` integration: ensure promotion/revocation actions pass through gateway-approved execution context.
   - No direct side-effect path may bypass policy mediation.

6. Tests:
   - add unit coverage for orchestrator happy path and rollback path
   - add integration/E2E coverage for promote -> approve -> revoke lifecycle
   - assert PG + Neo4j + Smithery-backed Notion consistency

### Acceptance Criteria

1. **Given** a promotable insight passes policy gates, **when** promotion is triggered, **then** the system updates semantic state, creates or updates the Notion page through Smithery, writes a PostgreSQL event, and returns a structured success payload without requiring a manual Smithery command.
2. **Given** an approved insight is auto-approved by policy, **when** the transition completes, **then** the projection stores `Approved`, `Approved By = agent:<name>`, and `AI Accessible = true`, and downstream agents can treat it as accessible.
3. **Given** approval, rejection, or revocation is requested, **when** the operation runs, **then** the same orchestration path handles PG logging, Neo4j state, and Notion projection updates.
4. **Given** a Notion or Neo4j write fails mid-transition, **when** the orchestration service detects partial failure, **then** it performs rollback or compensating state change and records the failure durably.
5. **Given** the runtime reaches this story during implementation, **when** Sisyphus executes it, **then** BMAD story boundaries and Brooks principles remain intact: one story at a time, no free-form Ralph looping, conceptual integrity preserved.

## Additional Context

### Dependencies

- Existing Smithery-backed Notion adapter in `src/integrations/notion.client.ts`
- Existing curator service entrypoint in `src/curator/index.ts`
- Existing policy gateway in `src/lib/policy/gateway.ts`
- Existing PostgreSQL event infrastructure from Epic 1 foundation stories
- Existing Neo4j insight state and approval metadata conventions
- Discord webhook secret should be env-driven and rotated after setup because it was exposed in chat

### Testing Strategy

- Unit test the new orchestrator with mocked Notion/Neo4j/Postgres adapters.
- Validate rollback when Neo4j succeeds and Notion fails, and vice versa.
- Validate MCP wrappers only delegate and do not mutate core state directly.
- Add end-to-end lifecycle test covering `promote -> approve -> revoke`.
- Verify event log rows contain stable ids, actor identity, and `group_id`.

### Notes

- This quick spec intentionally targets the first useful slice of the governed auto-approval initiative, not the legacy `1-1-record-raw-execution-traces` story, which is already marked `done` in this repo.
- The current architecture still contains explicit HITL language in `memory-bank/systemPatterns.md`; implementation should treat this initiative as a deliberate policy evolution, not an accidental bypass.
- Sisyphus remains the runtime orchestrator, but BMAD remains the governing doctrine. Prometheus plans, Sisyphus orchestrates, and Ralph loops stay story-scoped.
