---
Document Type: BRIEF
Project Slug: allura-memory
Group ID: allura-system
Owner: System
Status: Active
Source of Truth: https://www.notion.so/3371d9be65b381a9b3bec24275444b68
Sync to Dashboard: Yes
Sync Targets: Projects
---

# Allura Memory — Executive Brief

## Mission
Give AI agents a brain that does not forget. We separate raw flight logs (PostgreSQL) from refined intel (Neo4j). Humans stay in control.

## The Problem
AI agents wake up with amnesia. They do not remember past missions. They repeat mistakes. They build zero ongoing knowledge.

## The Solution
A 6-layer memory system that locks in agent knowledge with strict rules, clear audit trails, and totally isolated project zones.

## Core Capabilities

| Feature | Description |
|---------|-------------|
| **Dual-Layer Brain** | Raw logs → PostgreSQL. Curated truth → Neo4j. |
| **Versioned Truth** | Knowledge is locked. Old truth is SUPERSEDED, never erased. |
| **Human Checkpoint** | High-level changes require human YES. |
| **Data Lockdown** | Projects separated by `group_id`. No cross-talk. |
| **Audit Trails** | 5 layers of decision records for compliance. |
| **MCP Ready** | Connects to Claude Desktop, OpenClaw, MCP agents. |

## Architecture: Five-Layer Model

1. **Kernel (RuVix)**: 6 primitives, 12 syscalls, zero-trust execution
2. **Services**: Dual-persistence split (PostgreSQL + Neo4j)
3. **Agent Runtime**: Agent Contracts (ABI), deterministic lifecycle
4. **Workflow & Orchestration**: DAGs, A2A bus, HITL gates
5. **User & Application**: Paperclip (management), OpenClaw (gateway)

## Control Center

**URL**: https://www.notion.so/3371d9be65b381a9b3bec24275444b68

### Databases
- **Agents**: Track OpenCode agents, statuses, roles
- **Skills**: 106 reusable skills (including project-ingestion)
- **Commands**: 19 commands (including project-create)
- **Changes**: Approval queue for HITL-gated promotions

### Documentation
- Project Allura (Vision & Architecture)
- Data Dictionary (PostgreSQL + Neo4j schemas)
- Architectural Design Document (5-layer model)
- System Architecture (3-plane separation)

## Project Ingestion System

**Command**: `/project-create`

Creates new projects with:
1. Projects database entry
2. 7 canonical documentation pages (PROJECT, Architecture, Data Model, Runbook, Tools, Boundary, Changelog)
3. Hydrated Control Center registries

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript 5.9 (strict) |
| Runtime | Bun |
| Raw Storage | PostgreSQL 16 |
| Knowledge Graph | Neo4j 5.26 |
| Protocol | MCP (Model Context Protocol) |
| Testing | Vitest |

## Governance Rule

**Allura governs. Runtimes execute. Curators promote.**

## Quick Commands

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

## Status

✅ **1,854 tests passing** across 6 heavy epics
✅ **106 skills** synced to Notion
✅ **19 commands** available
✅ **Project ingestion system** operational

---

*Built with conceptual integrity. No silver bullets. Just patient, disciplined labor.*
