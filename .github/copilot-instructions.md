# Copilot Memory Bank

This project uses a **Memory Bank** to provide persistent context for AI coding agents. The Memory Bank is a structured, markdown-based documentation system that acts as long-term memory across sessions.

## How It Works

1. **Read first**: Always read the Memory Bank files at the start of each session
2. **Update regularly**: Update `activeContext.md` and `progress.md` as work progresses
3. **Keep current**: Update `systemPatterns.md` when architectural decisions are made

## Memory Bank Files

| File | Purpose | When to Read/Update |
|------|---------|---------------------|
| `memory-bank/projectbrief.md` | Overall scope and goals | Start of project, major changes |
| `memory-bank/productContext.md` | UX, users, problems being solved | Understanding requirements |
| `memory-bank/systemPatterns.md` | Architecture, patterns, decisions | Before making design choices |
| `memory-bank/techContext.md` | Stack, dependencies, constraints | Before implementing |
| `memory-bank/activeContext.md` | Current task, working notes | Start of each session |
| `memory-bank/progress.md` | Status log, completed items | End of each session |

## Project Overview

The `memory` project is building a **Unified AI Engineering Brain** - a goal-directed, closed-loop control system that:

1. **Separates noise from signal**: Raw traces in PostgreSQL, curated knowledge in Neo4j
2. **Enables audit reconstruction**: 6-12 month decision trails with ADR 5-layer framework
3. **Implements HITL governance**: Human approval required for behavior-changing knowledge
4. **Provides dual-context queries**: Project-specific + global best practices together

## Architecture Snapshot

```
AI Reasoning (OpenClaw)
    ↓ Traces logged to
Raw Trace Layer (PostgreSQL)
    ↓ Promotion Gate (HITL)
Promoted Knowledge (Neo4j)
    ↓ Mirroring
Human Workspace (Notion)
```

## Current Sprint

**Epic 1: Persistent Knowledge Capture and Tenant-Aware Memory**

| Story | Status |
|-------|--------|
| 1.1 Record Raw Execution Traces | `ready-for-dev` |
| 1.2-1.7 | `backlog` |

## Key Patterns to Follow

### Steel Frame Versioning
All Insights are immutable. Create new versions with SUPERSEDES relationships:
```
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

## Memory Retrieval Order

When working on this project, read in this order:

1. `memory-bank/activeContext.md` - Current focus and blockers
2. `memory-bank/progress.md` - What's been done
3. `memory-bank/systemPatterns.md` - How things are built
4. `memory-bank/techContext.md` - Tools and constraints
5. `_bmad-output/implementation-artifacts/` - Story specs and tech details

## Project-Specific Rules

1. **Use Zustand** for client state management (existing pattern in `src/stores/`)
2. **Use shadcn/ui** for UI components
3. **Use server actions** for state persistence (pattern in `src/server/`)
4. **Use group_id** in all database operations for tenant isolation
5. **Use append-only** for PostgreSQL traces - never mutate
6. **Use SUPERSEDES** for Neo4j versioning - never edit Insights

## Important Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | PostgreSQL and Neo4j containers |
| `_bmad-output/planning-artifacts/epics.md` | Story definitions |
| `_bmad-output/implementation-artifacts/tech-spec-*.md` | Technical specifications |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Current sprint status |

## Verification Commands

```bash
# Check PostgreSQL
docker exec knowledge-postgres pg_isready -U ronin4life -d memory

# Check Neo4j
curl -s http://localhost:7474 | jq .neo4j_version

# Test Neo4j Cypher
docker exec knowledge-neo4j cypher-shell -u neo4j -p 'Kamina2025*' "RETURN 1 AS test"
```

## Updating Memory Bank

When making significant changes:

1. **After completing a story**: Update `progress.md`
2. **When starting new work**: Update `activeContext.md`
3. **Making architectural decisions**: Update `systemPatterns.md`
4. **Adding new dependencies**: Update `techContext.md`
5. **Major scope changes**: Update `projectbrief.md`

## References

- [Memory Bank System - Tweag Agentic Coding Handbook](https://tweag.github.io/agentic-coding-handbook/WORKFLOW_MEMORY_BANK/)
- [How to Use a Memory Bank in Copilot](https://www.loom.com/share/152cea77575148b8af9fe8538ed30c30)
- [10x your Cursor Workflow with Memory Bank](https://www.youtube.com/watch?v=Uufa6flWid4)