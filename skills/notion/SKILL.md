---
name: notion
name: ronin-notion
---

# Ronin Notion Workspace

## Overview

This skill provides comprehensive knowledge of the Ronin Notion workspace structure, database schemas, and agent organization. Use this skill when working with Ronin's Notion-based agent registry, insights database, or learning log system.

## Workspace Structure

The Ronin Notion workspace is organized around agent management and knowledge curation:

### Primary Databases

1. **Ronin Agents Command Center** - Master registry of all 40+ AI agents
2. **Insights** - Curated, approved knowledge patterns
3. **Agent Learning Log Entries** - Operational learnings and rules

### Key Pages

- **Ronin Command Center** - Single source of truth with full agent roster
- **Ronin's Notion Hub** - Master directory and navigation hub

## Ronin Agents Command Center

**Database URL:** https://www.notion.so/f1bb3b77065845458acfb2081fbe8690

### Schema

| Property | Type | Description |
|----------|------|-------------|
| Name | title | Agent name (e.g., "BMAD Master — Gillian") |
| Module | select | Core, BMM, BMB, CIS, GDS, WDS, External |
| Platform | select | Claude, GPT-4, Gemini, Ollama, Custom, OpenClaw, OpenCode |
| Type | select | System, Role, Persona, Technical, Analysis, External |
| Status | select | Active, Testing, Planned, Reference, Drafting |
| Confidence | number | 0.0-1.0 confidence score |
| Function | text | Agent's purpose and capabilities |
| Source Path | url | Link to agent definition file |

### Module Organization

**Core (2 agents):**
- BMAD Master (Gillian) - Workflow orchestrator
- TEA - Testing & Evidence Agent

**BMM - BMAD Method Agile Suite (9 agents):**
- Mary (Business Analyst)
- John (Product Manager)
- Winston (Architect)
- Bob (Scrum Master)
- Amelia (Developer)
- Quinn (QA Engineer)
- Barry (Quick Flow Solo Dev)
- Sally (UX Designer)
- Paige (Technical Writer)

**CIS - Creative & Innovation Suite (6 agents):**
- Victor (Innovation Strategist)
- Caravaggio (Presentation Master)
- Maya (Design Thinking Coach)
- Sophia (Storyteller)
- Dr. Quinn (Creative Problem Solver)
- Carson (Brainstorming Coach)

**GDS - Game Development Suite (7 agents):**
- Cloud Dragonborn (Game Architect)
- Samus Shepard (Game Designer)
- Link Freeman (Game Developer)
- Max (Game Scrum Master)
- GLaDOS (Game QA)
- Paige (Tech Writer)
- Indie (Game Solo Dev)

**WDS - Web Development Suite (2 agents):**
- Freya (WDS Designer)
- Saga (WDS Analyst)

**External & Specialized (14 agents):**
- OpenClaw Main Agent
- Frederick P. Brooks Jr. General
- Simon Sinek (Business Strategist)
- PESTLE Agent
- Memory Curator
- Neo4j Knowledge Graph Builder
- Sanity.io Agent
- Mike Power (Copywriter)
- Plus 6 testing agents

## Insights Database

**Purpose:** Store approved, high-confidence knowledge patterns

**Key Fields:**
- Title/Content
- Confidence score
- Related systems
- Status (Approved, Candidate, Deprecated)

**Notable Insights:**
- Canonical tags should remain system slugs (0.91 confidence)

## Agent Learning Log

**Purpose:** Track operational rules and learnings from agent execution

**Approved Rules:**
1. Approved-only retrieval reduces context pollution
2. Full replay requires behavior-plane versioning
3. Never mutate approved truth in place
4. Payload work should be retrieval-grounded and policy-scoped
5. Separate raw traces from promoted knowledge

## Using Notion MCP Tools

### Search

```bash
smithery tool call notion-smithery notion-search '{"query": "agent name", "query_type": "internal", "page_size": 10}'
```

### Fetch Page/Database

```bash
smithery tool call notion-smithery notion-fetch '{"id": "page-or-database-id"}'
```

### Query Database

Use the data source URL from fetch results (format: `collection://uuid`)

### Create Pages

```bash
smithery tool call notion-smithery notion-create-pages '{"parent": {"page_id": "parent-uuid"}, "pages": [{"properties": {"title": "Page Title"}, "content": "# Content"}]}'
```

## Memory System Integration

**Critical Rule:** All agent memories are stored in Neo4j ONLY. Notion is for:
- Agent registry and metadata
- Approved insights (curated knowledge)
- Learning logs (operational rules)
- Work in progress tracking

**Operating Principle:**
- OpenClaw writes drafts
- Postgres records evidence
- Neo4j stores approved patterns
- Notion shows work in progress
- Sabir approves submission

## Resources

### references/
- `workspace-schema.md` - Detailed database schemas and relationships
- `agent-manifest.md` - Complete agent roster with metadata

### scripts/
- `query-agents.py` - Query agents by module, status, or platform
- `export-insights.py` - Export approved insights for Neo4j import
