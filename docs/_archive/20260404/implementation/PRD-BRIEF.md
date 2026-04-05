# Allura Memory System — Product Requirements Document (PRD)

> **Canonical Brief** | Synthesized from 11 source documents  
> **Version**: 1.0  
> **Date**: 2026-04-04  
> **Owner**: System  
> **Group ID**: allura-system  

---

## 1. Executive Summary

**Allura Memory** is a persistent memory and knowledge curation infrastructure that transforms OpenClaw agents from stateless session-bots into goal-directed teammates. It maintains a semantic memory graph (Neo4j), a raw trace store (PostgreSQL), and an automated curation pipeline — governed by a Brooks-bound orchestrator and canonical subagent architecture.

### Mission
Give AI agents a brain that does not forget. We separate raw flight logs (PostgreSQL) from refined intel (Neo4j). Humans stay in control.

### Core Value Proposition
- **Dual-Layer Brain**: Raw logs → PostgreSQL. Curated truth → Neo4j.
- **Versioned Truth**: Knowledge is locked. Old truth is SUPERSEDED, never erased.
- **Human Checkpoint**: High-level changes require human YES (HITL).
- **Data Lockdown**: Projects separated by `group_id`. No cross-talk.
- **Audit Trails**: 5 layers of decision records for compliance.
- **MCP Ready**: Connects to Claude Desktop, OpenClaw, MCP agents.

---

## 2. Architecture Overview

### Five-Layer Model

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| **L1** | **Kernel (RuVix)** | 6 primitives, 12 syscalls, zero-trust execution |
| **L2** | **Services** | Dual-persistence split (PostgreSQL + Neo4j) |
| **L3** | **Agent Runtime** | Agent Contracts (ABI), deterministic lifecycle: spawn/pause/resume/checkpoint |
| **L4** | **Workflow & Orchestration** | DAGs, A2A bus, HITL gates at risky transitions |
| **L5** | **User & Application** | Paperclip (management), OpenClaw (gateway) |

### Core Components

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| **memory-orchestrator** | Brooks-bound primary orchestrator; governs all memory operations | OpenCode Agent |
| **memory-subagents** | Specialized execution agents (scout, archivist, curator, chronicler, builder, tester, guardian, validator, organizer, interface, infrastructure) | OpenCode Subagents |
| **PostgreSQL** | Raw trace store; agent registry; promotion queue; event audit trail | Postgres 16 |
| **Neo4j** | Persistent semantic memory graph; versioned insights with `:SUPERSEDES` | Neo4j 5.26 |
| **Curator** | 2-phase promotion cron; Notion mirror | Node.js 20 ESM, node-cron |
| **ADAS Orchestrator** | Meta-agent design search; evolutionary SearchLoop | Node.js 20, Dockerode |
| **OpenClaw** | AI reasoning controller; task execution; MCP tool runtime | OpenClaw / Paperclip |

---

## 3. Functional Requirements

### Memory Operations (F1-F3)

| ID | Requirement | Status |
|----|-------------|--------|
| **F1** | On every OpenClaw session start, `before_prompt_build` hook queries Neo4j for `active` insights scoped to session `group_id` PLUS `global-coding-skills` | ✅ Implemented |
| **F2** | Results injected into system prompt; tenant-specific insights appear before global ones | ✅ Implemented |
| **F3** | Agents may call `memory_write` tool; confidence < 0.5 → Postgres only; confidence ≥ 0.5 → Neo4j node + `:SUPERSEDES` edge | ✅ Implemented |

### Promotion Pipeline (F4-F8)

| ID | Requirement | Status |
|----|-------------|--------|
| **F4** | `adas_runs` rows with `fitness_score >= 0.7` and `status = succeeded` are auto-enqueued by `trg_auto_enqueue_curator` | ✅ Implemented |
| **F5** | Curator performs 2-phase commit: Phase 1 writes Neo4j node; Phase 2 sets `promoted = true` in Postgres | ✅ Implemented |
| **F6** | If Phase 2 fails after Phase 1 succeeds, a compensating `DETACH DELETE` removes the orphaned Neo4j node | ✅ Implemented |
| **F7** | Curator mirrors insights with `confidence >= 0.7` to Notion Master Knowledge Base (async, non-fatal) | ✅ Implemented |
| **F8** | `trg_promotion_guard` at DB level enforces `neo4j_written = true` before `promoted = true` is accepted | ✅ Implemented |

### HITL Governance (F21-F23)

| ID | Requirement | Status |
|----|-------------|--------|
| **F21** | Generate `PromotionProposal` when candidate score >= promotion threshold (default 0.85) | ✅ Implemented |
| **F22** | Human reviewer approves/rejects/modifies proposal via Notion Changes database | ✅ Implemented |
| **F23** | Only `approved` designs may be promoted to active agent status | ✅ Implemented |

---

## 4. Data Architecture

### Dual Logging Policy

| Store | Purpose | Content |
|-------|---------|---------|
| **PostgreSQL** | System of Record for the Present | Raw traces, events, audit logs, heartbeats |
| **Neo4j** | System of Reason | Curated insights, patterns, versioned knowledge |

### Key Entities

#### Insight (Neo4j)
A versioned knowledge node representing a validated behavior-shaping rule or pattern.

- **States**: `active` | `degraded` | `expired`
- **Key fields**: `runId`, `organization_id`, `group_id`, `category`, `content`, `confidence`, `status`, `version`, `createdAt`, `notionPageId`
- **Never mutated** — every update creates a new node linked by `:SUPERSEDES` edge

#### AgentDesign (Neo4j)
A promoted, versioned agent configuration node. Originates from ADAS evolutionary search.

- **States (ADAS lifecycle)**: `draft` → `evaluating` → `ranked` → `proposed` → `approved` → `promoted` | `rejected`
- **Key fields**: `runId`, `organization_id`, `group_id`, `version`, `status`, `createdAt`, `design_id`, `domain`, `config.model`

#### ADAS Run (PostgreSQL)
Raw execution trace from ADAS discovery.

- **States**: `pending` | `running` | `succeeded` | `failed`
- **Key fields**: `run_id`, `group_id`, `agent_design_json`, `fitness_score`, `promoted`

### PostgreSQL Tables

| Table | Purpose |
|-------|---------|
| `tenants` | Multi-tenant namespace isolation |
| `adas_runs` | Raw execution traces from ADAS discovery |
| `adas_trace_events` | Every event during ADAS evaluation |
| `adas_promotion_proposals` | HITL governance proposals |
| `curator_queue` | Curator promotion queue (2-phase commit state) |
| `agents` | Agent registry with heartbeat and cost tracking |
| `notion_sync_log` | Audit trail for Notion mirror operations |

---

## 5. Workflow Overview

### Memory Session Flow

```
Session starts
    ↓
before_prompt_build hook fires
    ↓
Dual-context Neo4j query (group_id + global)
    ↓
Inject into system prompt
    ↓
Agent executes task
    ↓
after_tool_call: heartbeat upsert
    ↓
memory_write called? (confidence check)
    ↓
[Confidence < 0.5] → PostgreSQL only
[Confidence >= 0.5] → Neo4j node + SUPERSEDES
    ↓
Fitness >= 0.7? → Curator auto-enqueues
    ↓
Phase 1: Write Neo4j
Phase 2: Commit Postgres
    ↓
Mirror to Notion
    ↓
Human Aegis review
```

### ADAS Discovery Flow

```
CLI invoked
    ↓
Load domain + models
    ↓
Initialize population
    ↓
Evaluate all candidates (in sandbox)
    ↓
Rank by composite score
    ↓
Success threshold? 
    ↓
YES → Generate PromotionProposal
NO → Mutate + crossover → Next iteration
    ↓
Human review (approve/reject)
    ↓
Approved → Return best design
```

---

## 6. Canonical Subagent Architecture

All subagents use the `memory-*` naming convention, bound to Brooks principles:

| Subagent | Role | Description |
|----------|------|-------------|
| `memory-scout` | Discovers context files before coding | Surveyor, read-only memory |
| `memory-archivist` | Fetches current docs for external packages | Librarian, DOCS_FETCHED logging |
| `memory-curator` | Breaks down complex features into atomic subtasks | Planner, TASKS_CREATED logging |
| `memory-chronicler` | Generates documentation | Scribe, ADR creation |
| `memory-builder` | Executes delegated coding subtasks | Mason, implements code |
| `memory-tester` | Testing after implementation | Inspector, verifies behavior |
| `memory-guardian` | Reviews code quality and compliance | Security/correctness reviewer |
| `memory-validator` | Validates builds and types | Build gatekeeper |
| `memory-organizer` | Organizes context and knowledge | Structures context |
| `memory-interface` | Designs UI components and interactions | Interface designer |
| `memory-infrastructure` | Manages infrastructure and deployment | DevOps specialist |

---

## 7. Governance & Constraints

### Global Constraints

- **Docker-only**: All services MUST run inside Docker
- **Immutable nodes**: Neo4j nodes MUST NOT be mutated; use `:SUPERSEDES`
- **2-phase ordering**: `promoted = true` MUST NOT be set before `neo4j_written = true`
- **Tenant isolation**: All queries MUST scope by `group_id`
- **Dual logging**: All writes MUST follow dual logging policy
- **Aegis gate**: ADAS-promoted designs MUST NOT spawn live agents without human sign-off
- **No autonomous promotion**: Agent designs MUST NOT self-promote
- **Brooks orchestration**: All memory operations governed by `memory-orchestrator`

### Quality Gates

- **Aegis Quality Gates**: Schema validation on all writes
- **Weekly Audits**: Drift detection and consistency checks
- **Executable Spec**: Types enforced at runtime

---

## 8. Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Language** | TypeScript 5.9 (strict) | Type-safe substrate |
| **Runtime** | Bun | High-performance execution |
| **Raw Storage** | PostgreSQL 16 | Bulk event storage |
| **Knowledge Graph** | Neo4j 5.26 (APOC) | Versioned insight graph |
| **Protocol** | MCP (Model Context Protocol) | Formal "system call" interface |
| **Testing** | Vitest | Test framework |
| **Observability** | OpenTelemetry (OTel) | Unified tracing |

---

## 9. Operations & Reliability

### Restore Runbook

**Quarterly rehearsal** for restoring both stores:
1. PostgreSQL restore (stop writers, restore backup, integrity checks)
2. Neo4j restore (stop graph writers, restore, validate constraints)
3. Cross-store consistency check (compare promoted run IDs)

### Service Level Objectives

- Session hydration: **<30s p95**
- Curator promotion: **<5s per batch**
- Notion sync: **best-effort, backfilled on next cycle**
- Recovery RTO: **<4 hours**
- Recovery RPO: **<1 hour**

---

## 10. Control Center Databases (Notion)

| Database | Purpose | Records |
|----------|---------|---------|
| **Agents** | Track OpenCode agents, statuses, roles | 25 agents |
| **Skills** | 106 reusable skills (including project-ingestion) | 70+ skills |
| **Commands** | 19 commands (including project-create) | Commands |
| **Changes** | Approval queue for HITL-gated promotions | ADR-001 approved |
| **Tasks** | Epic 7 stories for OpenAgents Control Registry | 10 tasks |
| **Frameworks** | Memory Bootstrap Protocol, AI-Assisted Documentation, etc. | 5 frameworks |

**Hub URL**: https://www.notion.so/3371d9be65b381a9b3bec24275444b68

---

## 11. Key Metrics

- ✅ **1,854 tests passing** across 6 heavy epics
- ✅ **106 skills** synced to Notion
- ✅ **19 commands** available
- ✅ **Project ingestion system** operational
- ✅ **Session 2 complete**: Tasks (10), Agents (25), Skills (70+), ADR-001 approved

---

## 12. Governance Rule

> **Allura governs. Runtimes execute. Curators promote.**

---

## 13. Quick Commands

```bash
# Start the system
docker compose up -d
bun run mcp

# Create new project
/project-create --project-name="X" --slug="x" --area=Dev --priority=High

# Run tests
bun test

# Sync registry to Notion
bun run registry:sync
```

---

## Document Sources

This PRD synthesizes:
1. ALLURA-CONTROL-CENTER.md — Executive brief
2. BLUEPRINT.md — Architecture and concepts
3. DATA-DICTIONARY.md — Data models and schemas
4. DESIGN.md — Design patterns
5. MEMORY-QUALITY-CHECKLIST.md — Quality gates
6. OPERATIONS-SLO.md — Service levels
7. PROJECT.md — Full project documentation
8. REQUIREMENTS-MATRIX.md — Business and functional requirements
9. RISKS-AND-DECISIONS.md — Risk management
10. RUNBOOK-RESTORE.md — Disaster recovery
11. SOLUTION-ARCHITECTURE.md — System architecture

---

*Built with conceptual integrity. No silver bullets. Just patient, disciplined labor.*
