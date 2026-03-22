# Product Context: Unified AI Knowledge System

## Why This Project Exists

AI coding agents like Copilot and Cursor lack persistent memory. They forget everything when you close the tab. The `memory` project solves this by:

1. **Externalizing Memory**: Persisting decisions, patterns, and knowledge in structured files that AI agents can read, reference, and update
2. **Separating Noise from Signal**: Raw traces in PostgreSQL, curated knowledge in Neo4j
3. **Enabling Audit**: Full decision reconstruction for compliance (SOC 2, GDPR, ISO 27001)

## Problems Being Solved

### Problem 1: Stateless AI Agents
- **Current State**: AI models start from zero each session
- **Impact**: Teams waste time re-explaining project context, patterns, and decisions
- **Solution**: Persistent memory that AI can load and update

### Problem 2: Knowledge Chaos
- **Current State**: Useful insights get lost in chat history or scattered documents
- **Impact**: Same mistakes repeated, no learning accumulation
- **Solution**: Promotion gates move only validated knowledge to the permanent graph

### Problem 3: No Audit Trail
- **Current State**: Agent decisions are opaque and unrecoverable
- **Impact**: Compliance failures, inability to explain "why did the AI do that?"
- **Solution**: ADR 5-Layer Framework capturing reasoning chains, counterfactuals, and human oversight

### Problem 4: Cross-Project Contamination
- **Current State**: Multi-tenant projects leak data between teams
- **Impact**: Security breaches, wrong context to wrong project
- **Solution**: Mandatory `group_id` constraint with schema-level enforcement

## User Experience Goals

### For AI Engineering Teams
- **Fast Context Load**: Agent loads relevant project memory in <2 seconds
- **Dual-Context Queries**: Get both local project context AND global best practices
- **No Manual Memory Updates**: Curator agent proposes promotions automatically

### For Platform Owners
- **Clear Tenant Boundaries**: `group_id` prevents cross-project data leaks
- **Bounded Autonomy**: Agents operate within defined operational budgets
- **Mission Control**: Human oversight surface for approval workflows

### For Compliance Officers
- **Full Reconstruction**: Every ADR reconstructible 6-12 months later
- **Evidence Lineage**: Navigate from Insight → Evidence → PostgreSQL raw trace
- **Human Oversight Trail**: Who approved what, when, and why

## Business Context

### Architecture Vision
The system implements a **4-Layer Knowledge Stack**:

```
┌─────────────────────────────────────────────────────────────┐
│  Human Workspace (Notion)                                   │
│  - Source of truth for structured documentation            │
│  - Approval workflows and dashboards                        │
└─────────────────────────────────────────────────────────────┘
                              ↑ Mirroring
┌─────────────────────────────────────────────────────────────┐
│  Promoted Knowledge (Neo4j)                                 │
│  - Versioned Insights with Steel Frame                      │
│  - Entity relationships and canonical names                 │
│  - group_id multi-tenancy                                   │
└─────────────────────────────────────────────────────────────┘
                              ↑ Promotion Gate (HITL)
┌─────────────────────────────────────────────────────────────┐
│  Raw Trace Layer (PostgreSQL)                              │
│  - Append-only event logs                                  │
│  - Workflow traces, execution outputs                      │
│  - Evidence for future promotion                            │
└─────────────────────────────────────────────────────────────┘
                              ↑ Execution
┌─────────────────────────────────────────────────────────────┐
│  AI Reasoning (OpenClaw)                                    │
│  - Goal-directed control loops                             │
│  - MCP/REST tool interfaces                                 │
│  - Policy enforcement gateway                               │
└─────────────────────────────────────────────────────────────┘
```

### Key Relationships

| Relationship | Purpose |
|--------------|---------|
| `(:Insight)-[:SUPERSEDES]->(:Insight)` | Immutable versioning - never edit, always supersede |
| `(:AIAgent)-[:USES_KNOWLEDGE]->(:KnowledgeItem)` | Agent context composition |
| `(:Evidence)-[:LINKS_TO]->(:Event)` | Trace lineage for audit |
| `(:ADR)-[:INFORMS]->(:Insight)` | Decision backing for compliance |

### Group ID Strategy

Groups are dynamically discoverable from Neo4j. Known groups:

| Group ID | Description |
|----------|-------------|
| `faith-meats` | Jerky business |
| `difference-driven` | Non-profit organization |
| `patriot-awning` | Freelance account |
| `global` | Cross-project shared knowledge |

## Constraints

1. **No Autonomous Promotion**: Agents cannot promote to Neo4j/Notion without human approval
2. **Restricted Tools**: High-risk actions (deletions, rollbacks, financial) require explicit authorization
3. **Append-Only Raw Traces**: PostgreSQL events are never mutated
4. **Immutable Insights**: Neo4j Insights are superseded, never edited

## What Success Looks Like

1. An AI agent loads context in seconds using dual-context queries
2. The Curator agent proposes insights that humans approve or reject
3. An auditor can reconstruct any decision made 6 months ago
4. No entity duplicates exist in the knowledge graph
5. Each project sees only its own data plus approved global knowledge