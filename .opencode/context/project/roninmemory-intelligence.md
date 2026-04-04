---
description: "RoninMemory Project Intelligence - Unified AI Memory System"
version: "1.0.0"
last_updated: "2026-03-29"
---

# RoninMemory Project Intelligence

## Overview

RoninMemory is building a **Unified AI Engineering Brain** - a goal-directed, closed-loop control system that separates raw execution traces from curated knowledge, enabling audit reconstruction and HITL governance.

### Core Architecture

```
AI Reasoning (OpenClaw)
    ↓ Traces logged to
Raw Trace Layer (PostgreSQL)
    ↓ Promotion Gate (HITL)
Promoted Knowledge (Neo4j)
    ↓ Mirroring
Human Workspace (Notion)
```

### OpenAgents Control Registry

The OpenAgents Control Registry provides 5 canonical Notion databases:
- **Agents** — Track OpenCode agents, statuses, roles
- **Skills** — Reusable skills and usage notes
- **Commands** — Commands and their intent
- **Workflows** — BMad/WDS workflow definitions
- **Sync Registry** — Drift detection and sync runs

**Sync**: `bun run registry:sync`
**Dry-run**: `bun run registry:dry-run`

### Notion Surfaces

| Surface | ID | Role |
|---------|-----|------|
| Backend Hub | `6581d9be65b38262a2218102c1e6dd1d` | Structural governance — templates, registries, migrations |
| OpenAgents Control | `3371d9be65b38041bc59fd5cf966ff98` | CLI team registry — agent roster, skills, commands |
| Allura Memory Control Center | `3371d9be65b381a9b3bec24275444b68` | HITL oversight — approvals, sync model |

## Memory Bank System

This project uses a structured Memory Bank for persistent context. Always read in this order:

1. `memory-bank/activeContext.md` - Current focus and blockers
2. `memory-bank/progress.md` - What's been done  
3. `memory-bank/systemPatterns.md` - How things are built
4. `memory-bank/techContext.md` - Tools and constraints
5. `memory-bank/projectbrief.md` - Overall scope and goals
6. `_bmad-output/implementation-artifacts/` - Story specs

## Architecture Patterns

### Steel Frame Versioning
All Insights are immutable. Create new versions with SUPERSEDES relationships:
```cypher
(v2-insight)-[:SUPERSEDES]->(v1-insight:deprecated)
```

### group_id Enforcement
Every node MUST have a `group_id` property. Schema constraint rejects nodes without it.

### HITL Knowledge Promotion
Agents CANNOT autonomously promote to Neo4j/Notion. Human approval required.

### ADR 5-Layer Framework
Every architectural decision captured with:
1. Action Logging
2. Decision Context
3. Reasoning Chain
4. Alternatives Considered
5. Human Oversight Trail

### Task Status Clarification

- **T30**: MemFS Reflection Layer (P1, In Progress)
- **T31**: Sandbox Docker Execution (P2, Backlog)
- Tasks T31-T40 re-sequenced (see PROJECT.md Backlog)

## Current Sprint

**Epic 1: Persistent Knowledge Capture and Tenant-Aware Memory**

| Story | Status |
|-------|--------|
| 1.1 Record Raw Execution Traces | `ready-for-dev` |
| 1.2-1.7 | `backlog` |

## Tech Stack

- **Framework**: Next.js 16 + React 19
- **Language**: TypeScript 5.9, strict mode
- **Runtime**: Bun for scripts/tests, npm entrypoints
- **Data Stores**: PostgreSQL (append-only traces) + Neo4j (versioned knowledge)
- **Validation**: Zod
- **State/UI**: Zustand + shadcn/ui + Tailwind v4

## Critical Guardrails

### Do Not Violate
- PostgreSQL traces are append-only - never mutate historical rows
- Enforce `group_id` in every tenant-scoped read/write path
- Neo4j insight updates must use version lineage (`SUPERSEDES`), not in-place mutation
- Query dual context where required: project scope + global scope
- Human approval (HITL gate) is required before behavior-changing promotion flows
- No secrets in source, docs, memory artifacts, or logs

## Verification Commands

```bash
# Database health
docker exec knowledge-postgres pg_isready -U ronin4life -d memory
curl -s http://localhost:7474 | jq .neo4j_version

# Quality gate
npm run typecheck
npm run lint
npm test
```

## Agent Commands

- `/ralph-loop` - Start iterative loop for persistent tasks
- `/cancel-ralph` - Cancel active Ralph loop

## Important Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | PostgreSQL and Neo4j containers |
| `AGENTS.md` | Complete agent operating handbook |
| `opencode.json` | Project-level OpenCode agent configuration |
| `.opencode/context/project/bmad-integration.md` | BMad workflow routing and agent naming map |
| `_bmad/` | Source-of-truth BMad workflows, configs, and module docs |
| `_bmad-output/planning-artifacts/epics.md` | Story definitions |
| `_bmad-output/implementation-artifacts/tech-spec-*.md` | Technical specifications |

## References

- [Memory Bank System - Tweag Agentic Coding Handbook](https://tweag.github.io/agentic-coding-handbook/WORKFLOW_MEMORY_BANK/)
