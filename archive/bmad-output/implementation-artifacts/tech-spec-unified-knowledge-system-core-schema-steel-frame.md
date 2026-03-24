---
title: 'Memory Card - Self-Improving AI Knowledge System'
slug: 'memory-card-self-improving-knowledge-system'
created: '2026-03-15'
updated: '2026-03-24'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 16', 'TypeScript', 'Zustand', 'Zod', 'shadcn/ui', 'Tailwind CSS v4', 'PostgreSQL 16', 'Neo4j 5.26', 'Docker', 'Ubuntu', 'MCP_DOCKER']
files_to_modify: ['docker-compose.yml', 'src/lib/knowledge/', 'src/lib/neo4j/', 'src/lib/postgres/', 'src/lib/mcp/', 'src/stores/', 'src/lib/workers/']
code_patterns: ['Zustand state management', 'Server actions', 'App Router route groups', 'shadcn/ui components']
test_patterns: ['Vitest + Playwright - needs setup']
---

# Tech-Spec: Memory Card - Self-Improving AI Knowledge System

**Created:** 2026-03-15  
**Updated:** 2026-03-24 - Added Memory Card concept, OhMyOpenCode/OpenClaw toolchain, MCP_DOCKER integration

## Overview

### Problem Statement

The `memory` project needs a **Unified AI Engineering Brain** - a goal-directed, closed-loop control system that persists state across multiple projects. Unlike standard RAG systems, this system must:

1. **Separate noisy events from promoted knowledge** - Raw traces in PostgreSQL, curated knowledge in Neo4j
2. **Enable dual-context queries** - Every query loads both local project context AND global best practices
3. **Maintain audit-ready decision trails** - 6-12 month reconstruction of agent reasoning
4. **Implement entity deduplication** - Merge nodes representing the same entity to prevent ADAS search degradation

Without the Steel Frame, the knowledge graph becomes chaos with stale, conflicting data. Without entity deduplication, search accuracy degrades. Without promotion gates, behavior-changing knowledge enters the system without human oversight.

### The Memory Card Concept

This system implements a **Memory Card** for AI agents - inspired by the Reddit post about "Building a unified AI knowledge system with Notion + Neo4j". The key insight:

> **"Separate 'raw traces' from 'promoted knowledge'. Let agents dump noisy Event/Outcome detail into a cheaper store (PostgreSQL), then run a periodic 'knowledge curator' agent that proposes normalized Insights back into Neo4j and Notion, with humans approving anything that changes behavior."**

**The Memory Card enables:**
1. **Persistent Memory** - Every action remembered in PostgreSQL
2. **Learning & Improvement** - Insights promoted to Neo4j via HITL curation
3. **Self-Correction** - Ralph loops enable bounded self-improvement
4. **Cross-Session Recall** - Knowledge persists across agent sessions
5. **Unified Toolchain** - Works with OhMyOpenCode (CLI) and OpenClaw (MCP)

### Solution

Build the **Core Cognitive Kernel** as a **Goal-Directed System** with clean separation of reasoning from execution:

**4-Layer Stack Architecture (Memory Card):**

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI Agent Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ OhMyOpenCode │  │   OpenClaw   │  │  Human Operators     │  │
│  │   (Agent)    │  │   (Agent)    │  │  (Mission Control)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘  │
└─────────┼──────────────────┼───────────────────────────────────┘
          │                  │
          ▼                  ▼
┌──────────────────────────────────────────────────────────────────┐
│              MCP_DOCKER Layer (Docker Hub MCP)                  │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │  mcp-add, mcp-exec, mcp-find, mcp-config-set, etc.   │  │
│    └────────────────────────┬────────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    MCP Server Layer                              │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│    │ ronin-memory │  │ notion-mcp   │  │   github-mcp     │  │
│    │ (custom)     │  │ (docker hub) │  │  (docker hub)    │  │
│    └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└───────────┼──────────────────┼────────────────────┼────────────┘
            │                │                    │
            ▼                ▼                    ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
│   PostgreSQL     │ │    Neo4j     │ │     Notion       │
│ (Layer 1: Raw)   │ │(Layer 2/3/4: │ │ (Human Workspace)│
│                  │ │  Semantic)   │ │                  │
│  • Events        │ │              │ │  • Approvals     │
│  • Outcomes      │ │  • Insights  │ │  • Documentation │
│  • Traces        │ │  • Agents    │ │  • Registry      │
│  • ADAS Runs     │ │  • Knowledge │ │                  │
└──────────────────┘ └──────────────┘ └──────────────────┘
          │                │                │
          └────────────────┴────────────────┘
                           │
                           ▼
                 ┌──────────────────┐
                 │ Knowledge        │
                 │ Curator Pipeline │
                 │ (HITL Promotion) │
                 └──────────────────┘
```

**Toolchain Flow:**

```
Agents (OhMyOpenCode, OpenClaw)
    ↓ use MCP_DOCKER commands
MCP_DOCKER (mcp-add, mcp-exec from Docker Hub MCP registry)
    ↓ connects to
MCP Servers (ronin-memory, notion-mcp, github-mcp, etc.)
    ↓ read/write
Data Sources (PostgreSQL, Neo4j, Notion, GitHub)
```

**How MCP_DOCKER works:**
- `MCP_DOCKER_mcp-find` - Search Docker Hub MCP registry
- `MCP_DOCKER_mcp-add` - Add an MCP server to session
- `MCP_DOCKER_mcp-exec` - Execute tools on a server
- `MCP_DOCKER_mcp-config-set` - Configure server settings
- `MCP_DOCKER_tavily_*` - Web search tools
- `MCP_DOCKER_resolve-library-id` - Library docs lookup

All MCP servers are pulled from [Docker Hub MCP](https://hub.docker.com/mcp) - this saves context window by using pre-built containers instead of inline tool definitions.
┌─────────────────────────────────────────────────────────────────┐
│                     AI Agent Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ OhMyOpenCode │  │   OpenClaw   │  │  Human Operators     │  │
│  │  (CLI)       │  │ (MCP Reasoner)│  │  (Mission Control)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘  │
└─────────┼──────────────────┼───────────────────────────────────┘
          │                  │
          │    ┌─────────────▼─────────────────────────────────┐
          │    │         Policy Gateway                       │
          │    │    (RBAC, allow/deny rules)                  │
          │    └─────────────────┬─────────────────────────────┘
          │                      │
          ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                    MCP Server Layer                              │
│              ronin-memory (src/mcp/memory-server.ts)             │
│     ┌──────────────────────────────────────────────────────┐     │
│     │  Tools: search_events, create_insight, promote_     │     │
│     │        get_context, record_decision, ...             │     │
│     └────────────────────┬─────────────────────────────────┘     │
└──────────────────────────┼──────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
│   PostgreSQL     │ │    Neo4j     │ │     Notion       │
│ (Layer 1: Raw)   │ │(Layer 2/3/4: │ │ (Human Workspace)│
│                  │ │  Semantic)   │ │                  │
│  • Events        │ │              │ │  • Approvals     │
│  • Outcomes      │ │  • Insights  │ │  • Documentation │
│  • Traces        │ │  • Agents      │ │  • Registry      │
│  • ADAS Runs     │ │  • Knowledge │ │                  │
└──────────────────┘ └──────────────┘ └──────────────────┘
          │                │                │
          └────────────────┴────────────────┘
                           │
                           ▼
                 ┌──────────────────┐
                 │ Knowledge        │
                 │ Curator Pipeline │
                 │ (HITL Promotion) │
                 └──────────────────┘
```

**Toolchain Flow:**

```
OhMyOpenCode (CLI Agent Runner)
    ↓ invokes
OpenClaw (MCP Reasoner)
    ↓ calls tools via MCP_DOCKER
ronin-memory MCP Server
    ↓ reads/writes
PostgreSQL (Raw Traces) + Neo4j (Knowledge Graph)
```

**Layer Responsibilities:**

1. **AI Agent Layer** - Entry points for agent sessions
   - **OhMyOpenCode**: CLI agent session runner
   - **OpenClaw**: MCP reasoner that processes tool calls
   - **Human Operators**: Mission Control for approvals

2. **Policy Gateway** - Enforces RBAC, allow/deny rules
   - Mediates all tool calls
   - Circuit breakers for operational safety
   - Budget enforcement for bounded autonomy

3. **MCP Server Layer** - Unified memory interface
   - `ronin-memory` exposes memory tools via MCP protocol
   - Tools accessed through MCP_DOCKER
   - Type-safe, versioned interfaces

4. **Data Layer** - Dual storage with separation of concerns
   - **PostgreSQL (Layer 1)**: Append-only raw traces, events, outcomes
   - **Neo4j (Layer 2/3/4)**: Versioned insights, knowledge graph, agent relationships
   - **Notion**: Human workspace for approvals and documentation

5. **Knowledge Curator Pipeline** - HITL promotion flow
   - Scans PostgreSQL traces for promotable insights
   - Creates candidates in Neo4j with "pending" status
   - Mirrors to Notion for human review
   - On approval: updates status to "active"

**Memory Layer Architecture:**

- **Working Context** - Immediate prompt and session state
- **Episodic Memory** - Interaction traces stored in PostgreSQL
- **Semantic Knowledge** - Long-term facts stored in Neo4j

**Generic Agent Loop (Algorithm 1):**
```
loop:
  1. BuildContext: Load agent-specific memory + project context from Neo4j
  2. PlanStep: LLM proposes next action/subgoal based on context
  3. ExecuteTool: Typed invocation via MCP/REST
  4. UpdateState: Log result to PostgreSQL (raw traces)
     IF behavior_changing: promote to Neo4j (knowledge)
end loop
```

Implement the **Insight Versioning Steel Frame** as the core knowledge spine: immutable Insight nodes with status transitions (active → deprecated), versioning edges (`SUPERSEDES`, `DEPRECATED`, `REVERTED`), and confidence-based truth queries.

Implement the **ADAS Promotion Workflow** for discovering agent designs:
- Candidate Generation → Evaluation → Promotion Gate → Finalization to Neo4j/Notion

### Scope

**In Scope:**
- Neo4j schema: `KnowledgeItem`, `AIAgent`, `AgentDesign`, `Event`, `Outcome`, `Insight`, `Evidence`, `Decision`, `System`, `Project`, `Tag`, `Domain` nodes
- Steel Frame logic: version constraints, supersession edges, confidence decay queries
- Entity deduplication: canonical name resolution, merge procedures
- MCP tool gateway: `search_memories`, `create_entities`, `create_relations` for Neo4j
- Group ID multi-tenancy: project isolation with global crossover
- Reasoning counterfactuals in Event/Insight nodes
- Promotion gates: PostgreSQL → Neo4j → Notion flow with human approval checkpoints
- ADR 5-layer auditability: Action Logging, Decision Context, Reasoning Chain, Alternatives Considered, Human Oversight Trail
- **HITL Governance Layer**: Knowledge promotion gate, policy escalation, Mission Control approval interface, fail-safe termination reports
- **Restricted Tools Approval Flow**: High-risk actions (deletions, rollbacks, financial) require human authorization
- **Audit Compliance**: SOC 2, GDPR, ISO 27001 requirements for human accountability

**Out of Scope:**
- Circuit breakers, budgeted autonomy, Kmax limits - future spec (HITL escalation without limits is still in scope)
- Automated enforcement (no automatic termination) - HITL escalation instead
- Notion UI implementation - schema only, UI in future spec
- Multi-cluster Neo4j deployment - single instance for now
- Advanced governance automation (automated decay scheduling) - foundation only

## Context for Development

### Current State / Gap Analysis

**Existing Foundation:**
- OpenClaw (AI reasoning)
- OpenCode (execution environment)
- Ubuntu Docker (containerization)

**Infrastructure RUNNING (verified 2026-03-15):**

| Container | Image | Status | URL |
|-----------|-------|--------|-----|
| `knowledge-postgres` | PostgreSQL 16 | ✅ Healthy | `localhost:5432` |
| `knowledge-neo4j` | Neo4j 5.26 + APOC | ✅ Healthy | Browser: `http://localhost:7474`<br>Bolt: `bolt://localhost:7687` |

**Credentials (configured):**
- PostgreSQL: `POSTGRES_USER=ronin4life`, `POSTGRES_PASSWORD=KaminaTHC*`, `POSTGRES_DB=memory`
- Neo4j: `NEO4J_USER=neo4j`, `NEO4J_PASSWORD=KaminaTHC*`

**Missing Components (MUST BE IMPLEMENTED):**

| Layer | Component | Status | Priority |
|-------|-----------|--------|----------|
| Data Access | PostgreSQL connection layer | ❌ Need TypeScript client | P0 |
| Data Access | Neo4j connection layer | ❌ Need TypeScript client | P0 |
| Human Workspace | Notion MCP Integration | ❌ Missing | P0 |
| Knowledge | Neo4j schema constraints/indexes | ❌ Need cypher scripts | P0 |
| Knowledge | Neo4j Steel Frame setup | ❌ Need versioning logic | P0 |
| Knowledge | group_id constraint enforcement | ❌ Need schema constraint | P0 |
| ADAS | Evaluation Harness (evaluate_forward_fn) | ❌ Missing | P1 |
| ADAS | Search/Registry Logic | ❌ Missing | P1 |
| ADAS | Promotion Gate Workflow | ❌ Missing | P1 |
| Governance | Entity Deduplication Worker | ❌ Missing | P1 |
| Auditability | ADR 5-Layer Framework | ❌ Need implementation | P0 |
| Integration | PostgreSQL → Neo4j bridge | ❌ Need ETL/streaming spec | P1 |

**Critical Gap: TypeScript Code Layer**
No existing `src/lib/knowledge/`, `src/lib/neo4j/`, `src/lib/postgres/`, or `src/lib/mcp/` directories. Pure greenfield implementation needed.

### Codebase Patterns

**Technology Stack:**
- **Framework:** Next.js 16 with App Router
- **UI:** shadcn/ui, Tailwind CSS v4
- **State:** Zustand (preferences-store pattern)
- **Language:** TypeScript
- **Node:** 20-alpine
- **Validation:** Zod (available in node_modules)

**Existing Patterns:**
- Sidebar-based dashboard layout with theme/font preferences
- Server actions for cookie-based state persistence
- Route groups: `(main)`, `(external)`
- Component library: 50+ shadcn/ui components

**Files to Reference:**

| File | Purpose |
| ---- | ------- |
| `docker-compose.yml` | Existing PostgreSQL + Neo4j configuration |
| `src/stores/preferences/preferences-store.ts` | Zustand pattern reference |
| `src/server/server-actions.ts` | Server action pattern reference |
| `src/config/app-config.ts` | App configuration pattern |
| `src/lib/preferences/preferences-storage.ts` | Storage abstraction pattern |

### Technical Decisions

1. **Neo4j as primary knowledge store** - Graph structure essential for Insight versioning and entity relationships
2. **PostgreSQL for raw traces** - Durable event storage before promotion
3. **MCP (Model Context Protocol) for integration** - Standard tool interface for Neo4j and Notion
4. **Insight immutability** - Never edit Insights in place; always create new versions with `SUPERSEDES`
5. **Entity canonical names** - Single source of truth for entity resolution (e.g., "Neo4j" = "Neo4j Graph Database")
6. **group_id constraint** - Every node MUST have group_id; schema rejects nodes without it
7. **Extending Zustand pattern** - Consistent with existing preferences-store
8. **Neo4j username must be `neo4j`** - Neo4j requirement (fixed in .env)
9. **Creating new lib directories** - `src/lib/knowledge/`, `src/lib/neo4j/`, `src/lib/postgres/`, `src/lib/mcp/`

### Group ID Strategy

Groups are dynamically discoverable from Neo4j. Known groups include (but are not limited to):

| Group ID | Description |
|----------|-------------|
| `faith-meats` | Jerky business |
| `difference-driven` | Non-profit organization |
| `patriot-awning` | Freelance account |
| `global` | Cross-project shared knowledge |

**Rules:**
- Every node MUST have a `group_id` property
- Schema constraint rejects nodes without `group_id`
- Queries use dual-context pattern: project-specific + global insights

### Verification Commands

```bash
# PostgreSQL status
docker exec knowledge-postgres pg_isready -U ronin4life -d memory
# Output: /var/run/postgresql:5432 - accepting connections

# Neo4j status
curl -s http://localhost:7474 | jq .neo4j_version
# Output: "5.26.22"

# Neo4j Cypher Shell
docker exec knowledge-neo4j cypher-shell -u neo4j -p 'KaminaTHC*' "RETURN 1 AS test"
# Output: test\n1
```

## Implementation Plan

### Tasks

**Phase 1: Neo4j Schema Foundation**

- [ ] Task 1.1: Verify Neo4j 5.26 container is running with APOC plugin
  - File: `docker-compose.yml`
  - Action: Verify container health and APOC availability
  - Notes: Already configured, verify status

- [ ] Task 1.2: Create TypeScript Neo4j connection layer
  - File: `src/lib/neo4j/connection.ts` (CREATE)
  - Action: Create TypeScript client with connection pooling using neo4j-driver
  - Notes: Connection string from environment, pool size configuration

- [ ] Task 1.3: Define node type TypeScript interfaces
  - File: `src/lib/neo4j/types.ts` (CREATE)
  - Action: Create interfaces for KnowledgeItem, AIAgent, AgentDesign, Event, Outcome, Insight, Evidence, Decision, System, Project, Tag, Domain
  - Notes: Export all types from index.ts

- [ ] Task 1.4: Create schema initialization script
  - File: `src/lib/neo4j/schema/init-constraints.cypher` (CREATE)
  - Action: Create UNIQUE constraints on topic_key, group_id, canonical names
  - Notes: Include group_id NOT NULL constraint

- [ ] Task 1.5: Create indexes for performance
  - File: `src/lib/neo4j/schema/init-indexes.cypher` (CREATE)
  - Action: Create indexes on confidence, timestamp, status fields
  - Notes: Compound indexes for common query patterns

- [ ] Task 1.6: Run schema initialization
  - File: `src/lib/neo4j/schema/init.ts` (CREATE)
  - Action: Execute constraints and indexes via cypher-shell
  - Notes: Idempotent, safe to re-run

- [ ] Task 1.7: Create seed data for System and Project nodes
  - File: `src/lib/neo4j/seed/initial-data.ts` (CREATE)
  - Action: Create initial System (OpenClaw, OpenCode, etc.) and Project nodes with group_id
  - Notes: Use group_id 'global' for shared systems

- [ ] Task 1.8: **GAP CHECKPOINT** - Verify Neo4j connectivity and schema
  - Action: Run verification script, confirm constraints exist
  - Notes: Block until passed

---

**Phase 1.5: PostgreSQL Raw Trace Layer**

- [ ] Task 1.5.1: Verify PostgreSQL 16 container is running
  - File: `docker-compose.yml`
  - Action: Verify container health
  - Notes: Already configured, verify status

- [ ] Task 1.5.2: Create TypeScript PostgreSQL connection layer
  - File: `src/lib/postgres/connection.ts` (CREATE)
  - Action: Create TypeScript client using pg library
  - Notes: Connection string from environment, pool configuration

- [ ] Task 1.5.3: Define raw trace schema
  - File: `src/lib/postgres/schema/traces.sql` (CREATE)
  - Action: Create tables: events, outcomes, adas_runs
  - Notes: Include indexes on timestamp, agent_id, group_id

- [ ] Task 1.5.4: Create trace insertion functions
  - File: `src/lib/postgres/queries/insert-trace.ts` (CREATE)
  - Action: Create typed insertion functions for events and outcomes
  - Notes: Include group_id in every insertion

- [ ] Task 1.5.5: Create trace retrieval functions
  - File: `src/lib/postgres/queries/retrieve-trace.ts` (CREATE)
  - Action: Create typed retrieval for evidence linking
  - Notes: Filter by group_id and date range

- [ ] Task 1.5.6: **GAP CHECKPOINT** - Verify PostgreSQL connectivity
  - Action: Run verification script, confirm tables exist
  - Notes: Block until passed

---

**Phase 2: Core Node Types**

- [ ] Task 2.1: Implement KnowledgeItem node creation
  - File: `src/lib/neo4j/queries/create-knowledge-item.ts` (CREATE)
  - Action: Create function with group_id enforcement
  - Notes: Validate group_id exists before creation

- [ ] Task 2.2: Implement AIAgent node creation
  - File: `src/lib/neo4j/queries/create-ai-agent.ts` (CREATE)
  - Action: Create active operator nodes with group_id
  - Notes: Link to KnowledgeItem if assigned

- [ ] Task 2.3: Implement AgentDesign node creation
  - File: `src/lib/neo4j/queries/create-agent-design.ts` (CREATE)
  - Action: Create ADAS candidate nodes with group_id
  - Notes: Track version and design metadata

- [ ] Task 2.4: Implement Event → Outcome → Insight chain
  - File: `src/lib/neo4j/queries/create-decision-chain.ts` (CREATE)
  - Action: Create chain with group_id propagation
  - Notes: Each node inherits group_id from parent

- [ ] Task 2.5: Implement Evidence and Decision node creation
  - File: `src/lib/neo4j/queries/create-evidence-decision.ts` (CREATE)
  - Action: Create Evidence nodes linked to Insights
  - Notes: Include trace_ref to PostgreSQL

- [ ] Task 2.6: Implement USES_KNOWLEDGE relationship
  - File: `src/lib/neo4j/queries/link-agent-knowledge.ts` (CREATE)
  - Action: Create (:AIAgent)-[:USES_KNOWLEDGE]->(:KnowledgeItem)
  - Notes: Validate both nodes have same group_id or target is global

- [ ] Task 2.7: **GAP CHECKPOINT** - Verify all core node types
  - Action: Integration test for each node type
  - Notes: Block until passed

---

**Phase 3: Steel Frame Logic (Insight Versioning)**

- [ ] Task 3.1: Implement Insight version creation with SUPERSEDES
  - File: `src/lib/neo4j/queries/version-insight.ts` (CREATE)
  - Action: Create new version, link with SUPERSEDES, deprecate old
  - Notes: Immutable - never edit, always supersede

- [ ] Task 3.2: Implement fetch current truth query
  - File: `src/lib/neo4j/queries/fetch-current-insight.ts` (CREATE)
  - Action: Query returns only active Insight with no incoming SUPERSEDES
  - Notes: Filter by topic_key and group_id

- [ ] Task 3.3: Implement confidence decay queries
  - File: `src/lib/neo4j/queries/confidence-decay.ts` (CREATE)
  - Action: Calculate effective confidence based on age
  - Notes: Decay function configurable

- [ ] Task 3.4: Implement status transitions
  - File: `src/lib/neo4j/queries/transition-status.ts` (CREATE)
  - Action: Transition active → deprecated with full audit trail
  - Notes: Requires SUPERSEDES relationship for deprecation

- [ ] Task 3.5: **GAP CHECKPOINT** - Verify Steel Frame logic
  - Action: Test version chain queries
  - Notes: Block until passed

---

**Phase 4: Entity Deduplication**

- [ ] Task 4.1: Define canonical name registry
  - File: `src/lib/neo4j/queries/canonical-names.ts` (CREATE)
  - Action: Create registry of canonical entity names
  - Notes: E.g., "Neo4j" = "Neo4j Graph Database"

- [ ] Task 4.2: Implement entity resolution before creation
  - File: `src/lib/neo4j/queries/resolve-entity.ts` (CREATE)
  - Action: Check canonical names before creating new entities
  - Notes: Use embedding similarity + Levenshtein distance

- [ ] Task 4.3: Implement merge procedure for duplicates
  - File: `src/lib/neo4j/queries/merge-entities.ts` (CREATE)
  - Action: Merge duplicate nodes, preserve relationships
  - Notes: Audit trail of merge in Evidence node

- [ ] Task 4.4: Add deduplication to node creation flow
  - File: `src/lib/neo4j/queries/create-safe-entity.ts` (CREATE)
  - Action: Wrap all entity creation with resolution check
  - Notes: Prevent duplicate creation at source

- [ ] Task 4.5: **GAP CHECKPOINT** - Verify deduplication
  - Action: Test with known duplicate names
  - Notes: Block until passed

---

**Phase 5: MCP Integration Layer**

- [ ] Task 5.1: Configure MCP tools for Neo4j
  - File: `src/lib/mcp/neo4j-tools.ts` (CREATE)
  - Action: Configure mcp-neo4j-memory tools
  - Notes: Export tool definitions

- [ ] Task 5.2: Implement search_memories with dual-context
  - File: `src/lib/mcp/search-memories.ts` (CREATE)
  - Action: Query returns project-specific + global insights
  - Notes: Order by confidence DESC, timestamp DESC

- [ ] Task 5.3: Implement create_entities with deduplication
  - File: `src/lib/mcp/create-entities.ts` (CREATE)
  - Action: Create entities with resolution check
  - Notes: Return canonical entity if duplicate

- [ ] Task 5.4: Implement create_relations with validation
  - File: `src/lib/mcp/create-relations.ts` (CREATE)
  - Action: Create relationships with group_id validation
  - Notes: Prevent cross-group pollution

- [ ] Task 5.5: **GAP CHECKPOINT** - Verify MCP connectivity
  - Action: Integration test for each MCP tool
  - Notes: Block until passed

---

**Phase 6: Group ID Multitenancy**

- [ ] Task 6.1: Implement group_id derivation from tags
  - File: `src/lib/knowledge/group-id.ts` (CREATE)
  - Action: Derive group_id from Notion Tags field
  - Notes: Default to 'global' if no tags

- [ ] Task 6.2: Create dual-context query pattern
  - File: `src/lib/knowledge/dual-context.ts` (CREATE)
  - Action: Query returns (project insights + global insights)
  - Notes: Union with ordering

- [ ] Task 6.3: Add group_id constraint enforcement
  - File: `src/lib/neo4j/schema/group-id-constraint.cypher` (CREATE)
  - Action: Schema constraint that rejects nodes without group_id
  - Notes: Critical for preventing cross-project contamination

- [ ] Task 6.4: Implement access control based on group_id
  - File: `src/lib/knowledge/access-control.ts` (CREATE)
  - Action: Filter queries by allowable group_ids
  - Notes: Agent context determines allowable groups

- [ ] Task 6.5: **GAP CHECKPOINT** - Verify multi-tenant isolation
  - Action: Test cross-group queries are blocked
  - Notes: Block until passed

---

**Phase 6.5: Tool Registry**

- [ ] Task 6.5.1: Implement Tool Registry for agent discoverability
  - File: `src/lib/knowledge/tool-registry.ts` (CREATE)
  - Action: Create registry of available tools with metadata
  - Notes: Include version information

- [ ] Task 6.5.2: Add agent versioning support
  - File: `src/lib/neo4j/queries/version-agent.ts` (CREATE)
  - Action: Track agent versions in Neo4j
  - Notes: Link to AgentDesign nodes

- [ ] Task 6.5.3: Implement access control for agent definitions
  - File: `src/lib/knowledge/agent-access-control.ts` (CREATE)
  - Action: Filter agent visibility by group_id
  - Notes: Cross-group agents must be global

- [ ] Task 6.5.4: **GAP CHECKPOINT** - Verify Tool Registry
  - Action: Test agent discovery queries
  - Notes: Block until passed

---

**Phase 6.6: Agent Activation Protocol**

- [ ] Task 6.6.1: Implement Load agent definition from Notion
  - File: `src/lib/mcp/load-agent-definition.ts` (CREATE)
  - Action: Fetch agent definition from Notion AI Agents Registry
  - Notes: Notion is human source of truth

- [ ] Task 6.6.2: Implement Sync to Neo4j via MCP
  - File: `src/lib/mcp/sync-agent-to-neo4j.ts` (CREATE)
  - Action: Create/update AIAgent node via create_entities
  - Notes: Derive group_id from Tags

- [ ] Task 6.6.3: Build USES_KNOWLEDGE relationships from Notion
  - File: `src/lib/mcp/sync-agent-knowledge.ts` (CREATE)
  - Action: Create (:AIAgent)-[:USES_KNOWLEDGE]->(:KnowledgeItem)
  - Notes: From Notion "Assigned Agents" field

- [ ] Task 6.6.4: Build INTEGRATES_WITH relationships
  - File: `src/lib/mcp/sync-agent-integrations.ts` (CREATE)
  - Action: Create (:AIAgent)-[:INTEGRATES_WITH]->(:System)
  - Notes: From Notion "Integration Points" field

- [ ] Task 6.6.5: Implement Load persistent memory
  - File: `src/lib/knowledge/load-agent-memory.ts` (CREATE)
  - Action: Load agent-specific + project + global context from Neo4j
  - Notes: Dual-context query pattern

- [ ] Task 6.6.6: Implement execution loop with PostgreSQL logging
  - File: `src/lib/knowledge/agent-execution-loop.ts` (CREATE)
  - Action: Begin loop, log traces to PostgreSQL
  - Notes: No circuit breakers in this scope

- [ ] Task 6.6.7: Implement Promote behavior-changing knowledge
  - File: `src/lib/knowledge/promote-insight.ts` (CREATE)
  - Action: Promotion flow: PostgreSQL trace → Neo4j Insight
  - Notes: Requires confidence ≥ 0.7, tested, reviewed

- [ ] Task 6.6.8: **GAP CHECKPOINT** - Verify end-to-end activation
  - Action: Full integration test
  - Notes: Block until passed

---

**Phase 6.7: Notion-Neo4j Sync Health**

- [ ] Task 6.7.1: Implement weekly Sync Drift Detection Queries
  - File: `src/lib/knowledge/sync-drift-detection.ts` (CREATE)
  - Action: Identify items in Notion but missing in Neo4j
  - Notes: Schedule as weekly cron job

- [ ] Task 6.7.2: Implement weekly Tag Validation Query
  - File: `src/lib/knowledge/tag-validation.ts` (CREATE)
  - Action: Detect typos and casing variations via Cypher MCP
  - Notes: Flag for human correction

- [ ] Task 6.7.3: Implement incomplete agent validation
  - File: `src/lib/knowledge/validate-agent-complete.ts` (CREATE)
  - Action: Query for agents missing required fields
  - Notes: Required: Name, Module, Primary Function, Tags

- [ ] Task 6.7.4: Create group_id derivation from Tags
  - File: `src/lib/knowledge/derive-group-from-tags.ts` (CREATE)
  - Action: Standardize tag → group_id mapping
  - Notes: Known groups: faith-meats, difference-driven, patriot-awning, global

- [ ] Task 6.7.5: Implement scheduled sync
  - File: `src/lib/knowledge/scheduled-sync.ts` (CREATE)
  - Action: Hourly/daily sync for conflict resolution
  - Notes: Notion webhook trigger for immediate updates (future)

- [ ] Task 6.7.6: **GAP CHECKPOINT** - Verify sync health
  - Action: Test drift detection queries
  - Notes: Block until passed

---

**Phase 7: Reasoning Counterfactuals**

- [ ] Task 7.1: Add reasoning_chain property to Insight nodes
  - File: `src/lib/neo4j/queries/insight-properties.ts` (CREATE)
  - Action: Add step-by-step logic in human-understandable terms
  - Notes: Required for ADR auditability

- [ ] Task 7.2: Add alternatives_considered property
  - File: `src/lib/neo4j/queries/insight-properties.ts` (UPDATE)
  - Action: Add list of rejected candidates from ADAS
  - Notes: Source: PostgreSQL ADASRun traces

- [ ] Task 7.3: Add rejection_rationale property
  - File: `src/lib/neo4j/queries/insight-properties.ts` (UPDATE)
  - Action: Add why each alternative was discarded
  - Notes: Human-readable explanation

- [ ] Task 7.4: Add trace_ref property
  - File: `src/lib/neo4j/queries/insight-properties.ts` (UPDATE)
  - Action: Link to PostgreSQL raw trace for full evidence
  - Notes: UUID or timestamp-based reference

- [ ] Task 7.5: Add context_snapshot property
  - File: `src/lib/neo4j/queries/insight-properties.ts` (UPDATE)
  - Action: Capture model_version, prompt_version, environment
  - Notes: Enables reconstruction of decision context

- [ ] Task 7.6: Link promoted Insight to ADAS traces
  - File: `src/lib/neo4j/queries/link-insight-adas.ts` (CREATE)
  - Action: Connect loser candidates as counterfactuals
  - Notes: Via trace_ref reference

- [ ] Task 7.7: Implement GDPR-compliant explanations
  - File: `src/lib/knowledge/gdpr-explanation.ts` (CREATE)
  - Action: Generate human-understandable decision explanations
  - Notes: Not "the algorithm decided"

---

**Phase 8: Promotion Gates**

- [ ] Task 8.1: Define promotion criteria
  - File: `src/lib/knowledge/promotion-criteria.ts` (CREATE)
  - Action: confidence ≥ 0.7, tested = true, reviewed = true
  - Notes: Configurable thresholds

- [ ] Task 8.2: Implement PostgreSQL → Neo4j promotion flow
  - File: `src/lib/knowledge/promote-to-neo4j.ts` (CREATE)
  - Action: Copy validated trace data to Insight node
  - Notes: Create Evidence nodes linked to trace_ref

- [ ] Task 8.3: Implement Neo4j → Notion mirroring
  - File: `src/lib/mcp/mirror-to-notion.ts` (CREATE)
  - Action: Mirror high-value Insights to Notion pages
  - Notes: confidence ≥ 0.7 threshold

- [ ] Task 8.4: Add human approval checkpoint
  - File: `src/lib/knowledge/approval-workflow.ts` (CREATE)
  - Action: Require human review before final promotion
  - Notes: Notion integration for approval workflow

- [ ] Task 8.5: **GAP CHECKPOINT** - Verify promotion flow
  - Action: End-to-end promotion test
  - Notes: Block until passed

---

**Phase 9: Notion MCP Integration**

- [ ] Task 9.1: Configure Notion MCP tools
  - File: `src/lib/mcp/notion-tools.ts` (CREATE)
  - Action: Configure mcp-notion tools
  - Notes: API key from environment

- [ ] Task 9.2: Implement KnowledgeItem ↔ Notion page sync
  - File: `src/lib/mcp/sync-knowledge-item.ts` (CREATE)
  - Action: Bidirectional sync with conflict resolution
  - Notes: Notion is source of truth for human edits

- [ ] Task 9.3: Implement AI Agents Registry sync
  - File: `src/lib/mcp/sync-agent-registry.ts` (CREATE)
  - Action: Sync Notion AI Agents Registry to Neo4j
  - Notes: Create AIAgent nodes from Notion pages

- [ ] Task 9.4: Implement promoted Insight mirroring
  - File: `src/lib/mcp/mirror-promoted-insights.ts` (CREATE)
  - Action: Create Notion page for high-value Insights
  - Notes: Link to parent KnowledgeItem

- [ ] Task 9.5: Implement human approval workflow
  - File: `src/lib/mcp/approval-workflow.ts` (CREATE)
  - Action: Create Notion approval request pages
  - Notes: Poll for approval status

- [ ] Task 9.6: **GAP CHECKPOINT** - Verify Notion MCP connectivity
  - Action: End-to-end Notion sync test
  - Notes: Block until passed

---

**Phase 10: ADR 5-Layer Framework**

- [ ] Task 10.1: Define ADR node type
  - File: `src/lib/neo4j/types.ts` (UPDATE)
  - Action: Add ADR node type with 5-layer structure
  - Notes: Context, Decision, Consequences, Alternatives, Status

- [ ] Task 10.2: Implement ADR creation
  - File: `src/lib/neo4j/queries/create-adr.ts` (CREATE)
  - Action: Create ADR nodes with all 5 layers
  - Notes: Required before promoting Insights

- [ ] Task 10.3: Implement ADR status transitions
  - File: `src/lib/neo4j/queries/adr-status.ts` (CREATE)
  - Action: proposed → accepted → deprecated → superseded
  - Notes: SUPERSEDES relationship for versioning

- [ ] Task 10.4: Link ADR to Insights
  - File: `src/lib/neo4j/queries/link-adr-insight.ts` (CREATE)
  - Action: Create (:ADR)-[:INFORMS]->(:Insight)
  - Notes: Every promoted Insight should have ADR backing

- [ ] Task 10.5: **GAP CHECKPOINT** - Verify ADR framework
  - Action: Create and query ADR chain
  - Notes: Block until passed

---

**Phase 10.5: HITL Governance Layer**

- [ ] Task 10.5.1: Implement Knowledge Promotion Gate
  - File: `src/lib/knowledge/promotion-gate.ts` (CREATE)
  - Action: Curator agent proposes insights, humans MUST approve before Neo4j/Notion promotion
  - Notes: No autonomous promotion to knowledge graph or global context

- [ ] Task 10.5.2: Define restricted tools list
  - File: `src/lib/knowledge/restricted-tools.ts` (CREATE)
  - Action: List high-risk tools requiring HITL: financial transactions, data deletions, infrastructure rollbacks
  - Notes: Extensible list per group_id

- [ ] Task 10.5.3: Implement approval escalation flow
  - File: `src/lib/knowledge/escalation-flow.ts` (CREATE)
  - Action: Route restricted tools through explicit approval flow
  - Notes: Block until human authorization received

- [ ] Task 10.5.4: Create Mission Control approval interface
  - File: `src/lib/knowledge/mission-control-approval.ts` (CREATE)
  - Action: Define sensitive tasks requiring human sign-off
  - Notes: OpenClaw Mission Control as operations surface

- [ ] Task 10.5.5: Implement human oversight trail attachment
  - File: `src/lib/knowledge/human-oversight-trail.ts` (CREATE)
  - Action: Attach approval record to ADR: who authorized, when, context
  - Notes: Required for SOC 2, GDPR, ISO 27001 compliance

- [ ] Task 10.5.6: Implement fail-safe termination report
  - File: `src/lib/postgres/queries/fail-safe-report.ts` (CREATE)
  - Action: Generate human-understandable report when agent hits limits
  - Notes: Progress summary, bottlenecks, suggested alternatives

- [ ] Task 10.5.7: Implement progress summary for escalation
  - File: `src/lib/knowledge/progress-summary.ts` (CREATE)
  - Action: When escalation triggered, provide structured summary to human operator
  - Notes: What completed, what blocked, recommendations

- [ ] Task 10.5.8: Implement budget escalation workflow
  - File: `src/lib/knowledge/budget-escalation.ts` (CREATE)
  - Action: When budget/step limit approached, escalate to human before exhausting
  - Notes: Human decides: grant more budget, take over manually, or terminate

- [ ] Task 10.5.9: Create ADR template for Notion
  - File: `docs/adr-template.md` (CREATE)
  - Action: Template capturing 5 layers: Action Logging, Decision Context, Reasoning Chain, Alternatives, Oversight Trail
  - Notes: Auto-populated by agents for human review

- [ ] Task 10.5.10: **GAP CHECKPOINT** - Verify HITL governance
  - Action: Test promotion gate, restricted tool escalation, Mission Control approval
  - Notes: Block until passed

---

**Phase 11: Generic Agent Loop (Simplified)**

- [ ] Task 11.1: Implement BuildContext step
  - File: `src/lib/knowledge/agent-loop/build-context.ts` (CREATE)
  - Action: Load agent-specific + project + global memory from Neo4j
  - Notes: Dual-context query pattern

- [ ] Task 11.2: Implement PlanStep step
  - File: `src/lib/knowledge/agent-loop/plan-step.ts` (CREATE)
  - Action: LLM proposes next action/subgoal
  - Notes: Include reasoning_chain in output

- [ ] Task 11.3: Implement ExecuteTool step
  - File: `src/lib/knowledge/agent-loop/execute-tool.ts` (CREATE)
  - Action: Typed MCP/REST invocation
  - Notes: No circuit breakers in this scope

- [ ] Task 11.4: Implement UpdateState step
  - File: `src/lib/knowledge/agent-loop/update-state.ts` (CREATE)
  - Action: Log result to PostgreSQL raw traces
  - Notes: Include group_id in every trace

- [ ] Task 11.5: Implement WriteMemory step
  - File: `src/lib/knowledge/agent-loop/write-memory.ts` (CREATE)
  - Action: Promote to Neo4j if behavior_changing
  - Notes: Run promotion criteria check

- [ ] Task 11.6: Implement loop iteration
  - File: `src/lib/knowledge/agent-loop/run-loop.ts` (CREATE)
  - Action: BuildContext → PlanStep → ExecuteTool → UpdateState → WriteMemory
  - Notes: Loop until task complete or max iterations

- [ ] Task 11.7: Implement working context management
  - File: `src/lib/knowledge/agent-loop/working-context.ts` (CREATE)
  - Action: Manage immediate prompt state
  - Notes: Session-scoped

- [ ] Task 11.8: Implement episodic memory storage
  - File: `src/lib/postgres/queries/episodic-memory.ts` (CREATE)
  - Action: Store interaction traces in PostgreSQL
  - Notes: Timestamp and session-scoped

- [ ] Task 11.9: Implement semantic knowledge query
  - File: `src/lib/neo4j/queries/semantic-knowledge.ts` (CREATE)
  - Action: Query long-term facts from Neo4j
  - Notes: Confidence-weighted retrieval

- [ ] Task 11.10: **GAP CHECKPOINT** - Verify agent loop
  - Action: Run simplified loop end-to-end
  - Notes: Block until passed

---

**Phase 12: Entity Deduplication Worker**

- [ ] Task 12.1: Create scheduled worker process
  - File: `src/lib/workers/deduplication-worker.ts` (CREATE)
  - Action: Weekly cron job for entity deduplication
  - Notes: Run in background process

- [ ] Task 12.2: Implement embedding generation
  - File: `src/lib/workers/embedding-generation.ts` (CREATE)
  - Action: Generate embeddings for entity names
  - Notes: Use OpenAI embeddings or sentence-transformers

- [ ] Task 12.3: Implement similarity scoring
  - File: `src/lib/workers/similarity-scoring.ts` (CREATE)
  - Action: Calculate embedding similarity + Levenshtein distance
  - Notes: Threshold for duplicate detection

- [ ] Task 12.4: Implement merge with audit trail
  - File: `src/lib/workers/merge-duplicates.ts` (CREATE)
  - Action: Merge confirmed duplicates, log to Evidence
  - Notes: Preserve all relationships

- [ ] Task 12.5: **GAP CHECKPOINT** - Verify deduplication worker
  - Action: Run weekly job manually, verify results
  - Notes: Block until passed

---

**Phase 13: Signed Intent Propagation**

- [ ] Task 13.1: Implement verifiable metadata structure
  - File: `src/lib/knowledge/signed-intent.ts` (CREATE)
  - Action: Create signature structure for task delegation
  - Notes: Cryptographic signature of root intent

- [ ] Task 13.2: Add signature field propagation
  - File: `src/lib/knowledge/signed-intent.ts` (UPDATE)
  - Action: Propagate signature through delegation chain
  - Notes: Preserved without modification

- [ ] Task 13.3: Implement sub-task validation
  - File: `src/lib/knowledge/validate-subtask.ts` (CREATE)
  - Action: Validate sub-task against signed intent before execution
  - Notes: Reject if divergent

- [ ] Task 13.4: Implement alignment checks
  - File: `src/lib/knowledge/alignment-check.ts` (CREATE)
  - Action: Periodic root-goal alignment verification
  - Notes: Fire divergence signal if mismatch

- [ ] Task 13.5: Log signed intent chain
  - File: `src/lib/postgres/queries/intent-chain.ts` (CREATE)
  - Action: Store intent chain in PostgreSQL for audit
  - Notes: Retrospective validation support

- [ ] Task 13.6: **GAP CHECKPOINT** - Verify intent propagation
  - Action: Test delegation chain validation
  - Notes: Block until passed

---

### Acceptance Criteria

**AC-1: Schema Validation**
```
Given the Neo4j database is running
When constraints are created
Then all constraint names exist and are UNIQUE
And all indexes exist and are ONLINE
And group_id NOT NULL constraint exists
```

**AC-2: Insight Versioning**
```
Given an Insight with version 1 exists
When a new Insight is created for the same topic_key
Then the old Insight has status 'deprecated'
And the new Insight has version 2
And (new)-[:SUPERSEDES]->(old) relationship exists
```

**AC-3: Current Truth Query**
```
Given multiple Insight versions exist for topic_key "auth-pattern"
When fetching current truth
Then only the active Insight with no incoming SUPERSEDES is returned
And all Evidence and Decision nodes are included
And result is ordered by confidence DESC, timestamp DESC
```

**AC-4: Entity Deduplication**
```
Given "Neo4j" and "Neo4j Graph Database" would both be created as System nodes
When entity resolution runs
Then only one System node "Neo4j" exists
And any references are updated to the canonical entity
And Evidence node records the merge
```

**AC-5: Dual-Context Query**
```
Given Insight exists with group_id "faith-meats"
And Insight exists with group_id "global"
When agent queries for project context with group_id "faith-meats"
Then both project-specific AND global insights are returned
ORDERED BY confidence DESC, timestamp DESC
```

**AC-6: Reasoning Counterfactuals**
```
Given an agent makes a decision logged as an Insight
When the Insight node is created
Then reasoning_chain contains step-by-step logic in human-understandable terms
And alternatives_considered lists rejected candidates from ADAS search
And rejection_rationale explains why each alternative was discarded
And trace_ref links to PostgreSQL raw trace for full execution evidence
And context_snapshot captures model_version, prompt_version, environment
And GDPR compliance: explanation is human-understandable
```

**AC-6.1: ADAS Counterfactual Evidence**
```
Given an ADASRun evaluates multiple agent designs
When the winning design is promoted to Insight
Then all losing designs are captured in alternatives_considered
And performance_metrics for each loser are preserved in trace_ref
And an auditor can reconstruct why the winner was chosen
```

**AC-7: Promotion Gate**
```
Given an Insight with confidence 0.85 in PostgreSQL traces
When promotion criteria are met (confidence ≥ 0.7, tested = true, reviewed = true)
Then Insight is promoted to Neo4j with status 'active'
And if confidence >= 0.7, Insight is mirrored to Notion
And Evidence nodes link to PostgreSQL trace_ref
```

**AC-8: Group ID Enforcement**
```
Given a node creation request without group_id
When the request reaches Neo4j
Then schema constraint rejects the request
And error message indicates group_id is required
And cross-project contamination is prevented
```

**AC-9: ADR 5-Layer Auditability**
```
Given an Insight is promoted to Neo4j
When an auditor reviews the Insight
Then Context layer is available (situation that triggered the decision)
And Decision layer is available (what was chosen)
And Consequences layer is available (expected trade-offs)
And Alternatives layer is available (what was rejected and why)
And Status layer is available (proposed → accepted → deprecated → superseded)
And all 5 layers can be reconstructed 6-12 months later
```

**AC-9.1: ADR Immutability**
```
Given an ADR with flawed reasoning is identified
When the reasoning needs correction
Then the original ADR remains unmodified in Neo4j
And a new ADR is created with version = old_version + 1
And new ADR has SUPERSEDES relationship to old ADR
And old ADR status changes to 'deprecated'
And audit trail preserves the history
```

**AC-10: HITL Knowledge Promotion Gate**
```
Given a Curator agent identifies a potential insight
When the insight is proposed for promotion
Then PostgreSQL stores the raw trace as candidate
And Neo4j does NOT receive the insight autonomously
And Notion receives an approval request page
And human MUST explicitly approve before Neo4j promotion
And Insight with confidence ≥ 0.7 also mirrors to Notion after approval
```

**AC-10.1: HITL Restricted Tools**
```
Given an agent attempts a restricted tool (deletion, rollback, financial)
When the tool execution reaches the gateway
Then tool is BLOCKED until human authorization
And escalation request is created in Mission Control
And human operator approves or rejects in Mission Control
And authorization timestamp and operator identity are logged to ADR
And tool proceeds ONLY after explicit approval
```

**AC-10.2: HITL Fail-Safe Termination Report**
```
Given an agent hits operational limits (step limit, budget exhaustion)
When fail-safe termination is triggered
Then system does NOT crash
And progress summary is generated (completed, blocked, recommendations)
And PostgreSQL stores fail-safe report with:
  - Action Logging: what changed, when, agent/model version
  - Decision Context: authorized data, policies, environment
  - Reasoning Chain: step-by-step logic in human terms
  - Alternatives Considered: what was rejected and why
  - Human Oversight Trail: escalation status, operator response (if any)
And human operator can review and decide: grant more budget, take over, or terminate
```

**AC-10.3: HITL Human Oversight Trail**
```
Given a human approves an agent action
When the approval is recorded
Then ADR human_oversight_trail captures:
  - notification_sent_to: operator identifier
  - cooldown_period_minutes: time allowed for review
  - manual_override_triggered: boolean
  - approval_status: approved/rejected/pending
  - approver_identity: who authorized
  - approval_timestamp: when authorized
And 6-12 months later, auditor can identify who approved the action
```

**AC-10.4: HITL Budget Escalation**
```
Given an agent approaches budget or step limits
When escalation threshold is reached (e.g., 80% of limit)
Then agent provides structured summary to human operator
And human decides: grant additional budget, take over manually, or terminate
And decision is logged to ADR human_oversight_trail
And agent continues ONLY with explicit human authorization
```

**AC-11: Generic Agent Loop (Simplified)**
```
Given an agent session begins
When the agent loop executes
Then BuildContext loads agent-specific memory AND project context from Neo4j
And PlanStep proposes next action/subgoal with reasoning_chain
And ExecuteTool performs typed invocation via MCP/REST
And UpdateState logs result to PostgreSQL raw traces
And IF behavior_changing: WriteMemory promotes to Neo4j
```

**AC-11.1: BuildContext Step**
```
Given an agent is initializing
When BuildContext executes
Then working_context (immediate prompt) is loaded
And episodic_memory (interaction traces) is loaded from PostgreSQL
And semantic_knowledge (long-term facts) is queried from Neo4j
And dual-context query pattern loads project-specific AND global insights
```

**AC-12: Agent Storage Architecture**
```
Given the unified knowledge system is initialized
When an agent is registered or activated
Then agent definition exists in Notion AI Agents Registry (human source of truth)
And agent is synced to Neo4j as (:AIAgent) or (:AgentDesign) node
And relationships exist: (:AIAgent)-[:USES_KNOWLEDGE]->(:KnowledgeItem)
And raw execution traces are logged to PostgreSQL
And Tool Registry provides discoverability, versioning, access control
```

**AC-12.1: Agent Activation Protocol**
```
Given an agent session begins
When activation protocol executes
Then agent definition is loaded from Notion (human-managed)
And definition is synced to Neo4j via MCP
And persistent memory is loaded: agent-specific + project + global contexts
And execution begins with PostgreSQL trace logging
And behavior-changing results are promoted to Neo4j after completion
```

**AC-13: Notion-Neo4j Sync Workflow**
```
Given an agent definition in Notion AI Agents Registry
When the sync process executes
Then required properties (Name, Module, Primary Function, Tags) are validated
And Tags determine group_id for multi-tenancy
And mcp-neo4j-memory create_entities creates (:AIAgent) or (:AgentDesign) node
And create_relations builds (:AIAgent)-[:USES_KNOWLEDGE]->(:KnowledgeItem)
And create_relations builds (:AIAgent)-[:INTEGRATES_WITH]->(:System)
```

**AC-13.1: Sync Drift Detection**
```
Given weekly Sync Drift Detection is scheduled
When the query runs
Then items in Notion but missing from Neo4j are identified
And stale Neo4j nodes (Notion updated, Neo4j not) are identified
And sync health report is generated for audit
```

**AC-13.2: Tag Governance**
```
Given weekly Tag Validation Query is scheduled
When the query runs via Cypher MCP
Then typos and casing variations in Tags are detected
And invalid tags are flagged for correction
And group_id routing integrity is verified
```

**AC-14: Signed Intent Propagation**
```
Given a hierarchical command structure (CEO → Manager → Worker)
When a goal is delegated down the chain
Then verifiable metadata (signature) accompanies the task
And original root intent is preserved without modification
And every delegated sub-task is validated against signed intent before execution
And periodic root-goal alignment checks verify leaf actions serve root objectives
```

**AC-14.1: Intent Semantics Preservation**
```
Given a task moves from root orchestrator to leaf worker
When the task passes through each delegation layer
Then core intent semantics are preserved (no "telephone effect")
And leaf-level actions do not diverge from root objectives
And divergence detection signal fires if mismatch detected
And signed intent chain is logged in PostgreSQL for audit
```

**AC-14.2: Contract Enforcement**
```
Given a worker receives a delegated sub-task
When the worker attempts to execute
Then sub-task MUST be validated against original signed intent
If validation FAILS: sub-task is REJECTED with divergence explanation
If validation PASSES: sub-task proceeds with audit trail
And validation result is logged for retrospective analysis
```

## Additional Context

### Dependencies

- **Neo4j** (5.x+) - Graph database for persistent memory
- **PostgreSQL** (14+) - Relational database for raw traces
- **MCP Server** - `memory` MCP tool for Neo4j integration
- **Notion MCP** - Notion integration for human workspace sync
- **TypeScript** - Language
- **Zod** - Schema validation
- **Text Embedding Library** - For entity deduplication (sentence-transformers or OpenAI)

### Red Flags to Address Before Production

| Red Flag | Status | Action Needed |
|----------|--------|---------------|
| group_id constraint | ❌ Not implemented | Create Neo4j schema constraint that rejects nodes without group_id |
| PostgreSQL ↔ Neo4j bridge | ❌ Not documented | Specify ETL or streaming spec for raw trace promotion |
| SUPERSEDES relationship | ❌ Not tested | Define and test version chain schema in Neo4j |
| ADR template | ❌ Missing | Add Notion template page under Config database |
| Restricted tools list | ❌ Not defined | Create extensible list of high-risk tools per group_id |
| Mission Control interface | ❌ Not implemented | OpenClaw Mission Control for approval flows |

### Testing Strategy

1. **Unit Tests** - Neo4j Cypher query validation
2. **Integration Tests** - MCP tool round-trip tests
3. **Schema Tests** - Constraint/index verification
4. **Version Tests** - Insight supersession chain tests
5. **Deduplication Tests** - Entity resolution edge cases
6. **ADAS Tests** - Candidate promotion workflow validation
7. **ADR Tests** - 5-layer reconstruction
8. **Agent Loop Tests** - BuildContext, PlanStep, ExecuteTool, UpdateState, WriteMemory steps
9. **Layer Separation Tests** - Verify group_id isolation
10. **Signed Intent Tests** - Delegation chain validation
11. **HITL Governance Tests** - Promotion gates, restricted tools, fail-safe reports, human oversight trails

### Notes

- **ADR Framework**: Each architectural decision must be logged with all 5 layers: Action Logging, Decision Context, Reasoning Chain, Alternatives Considered, Human Oversight Trail
- **Promotion Criteria**: Insights must have confidence ≥ 0.7 AND be tested AND be reviewed before promotion
- **HITL Knowledge Promotion**: Agents CANNOT autonomously promote to Neo4j or Notion; human approval required for all behavior-changing knowledge
- **HITL Restricted Tools**: Deletions, rollbacks, financial transactions blocked until human authorization via Mission Control
- **HITL Fail-Safe**: When limits hit, system provides structured progress summary to human operator (not crash)
- **Fail-Safe Report**: Must include 5 audit layers for SOC 2, GDPR, ISO 27001 compliance
- **Group ID Strategy**: Dynamically discoverable from Neo4j; known groups include faith-meats, difference-driven, patriot-awning, global
- **Counterfactual Properties**: Every Insight node MUST include:
  - `reasoning_chain`: Step-by-step logic in human-understandable terms
  - `alternatives_considered`: List of rejected candidates (from ADAS or manual decision)
  - `rejection_rationale`: Why each alternative was discarded
  - `trace_ref`: Link to PostgreSQL raw trace for full execution evidence
  - `context_snapshot`: Model version, prompt version, environment at decision time
- **Auditability Standard**: All reasoning must be reconstructible 6-12 months later by an auditor
- **4-Layer Stack**: OpenClaw (AI Reasoning) → PostgreSQL (Raw Traces) → Neo4j (Promoted Knowledge) → Notion (Human Workspace)
- **Steel Frame Status Edges**: `SUPERSEDES`, `DEPRECATED`, `REVERTED` for version tracking
- **Weekly Entity Deduplication**: embedding similarity + Levenshtein distance
- **Goal-Directed Agents**: Agents are not passive prompt-response generators; they use iterative control loops with perception, planning, and adaptation
- **Generic Agent Loop**: BuildContext → PlanStep → ExecuteTool → UpdateState → WriteMemory (no circuit breakers in this scope)
- **Layer Separation**: LLM reasoning core MUST NOT interact directly with data; all interactions mediated
- **ADAS for Agent Discovery**: Use Meta Agent Search to discover optimal agent designs; promote winners to versioned Insights
- **Gap Analysis Priority**: P0 (foundational) items MUST be complete before P1 (advanced) items
- **Signed Intent Propagation**: Verifiable metadata accompanies task delegation; sub-tasks validated against root intent

## Implementation Checklist Summary

### P0 (Foundational - MUST BE COMPLETE FIRST)

- [ ] Set up PostgreSQL for raw trace logging
- [ ] Set up Neo4j and implement the "Steel Frame" versioning constraints
- [ ] Add group_id constraint that rejects nodes without group_id
- [ ] Connect Notion via MCP tools to act as the human source of truth
- [ ] Implement ADR 5-Layer Framework (Action Logging, Decision Context, Reasoning Chain, Alternatives, Human Oversight Trail)
- [ ] Implement HITL Knowledge Promotion Gate (humans MUST approve Neo4j/Notion promotion)
- [ ] Implement HITL Restricted Tools approval flow (Mission Control interface)
- [ ] Implement Insight Versioning (immutable records, SUPERSEDES edges)
- [ ] Verify data separation: noisy execution (PostgreSQL) vs promoted knowledge (Neo4j)

### P1 (Advanced - AFTER P0 COMPLETE)

- [ ] Define Evaluation Metrics (accuracy, cost, latency) for target ADAS domain
- [ ] Implement evaluate_forward_fn for domain-specific candidate measurement
- [ ] Implement Search/Registry Logic for discovered AgentDesign nodes
- [ ] Implement Promotion Gate workflow (PostgreSQL → Neo4j → Notion)
- [ ] Implement Entity Deduplication Worker (weekly, embedding similarity + Levenshtein)
- [ ] Implement Knowledge Curator agent for promotion proposals
- [ ] Specify PostgreSQL → Neo4j bridge (ETL or streaming)