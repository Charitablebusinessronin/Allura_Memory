# System Patterns: Unified AI Knowledge System

## Architecture Overview

### 4-Layer Knowledge Stack

The system implements a strict separation between noisy execution data and curated knowledge:

```
AI Reasoning (OpenClaw)
    ↓ Traces logged to
Raw Trace Layer (PostgreSQL)
    ↓ Promotion Gate (HITL)
Promoted Knowledge (Neo4j)
    ↓ Mirroring
Human Workspace (Notion)
```

Each layer has distinct responsibilities:
- **AI Reasoning**: Goal-directed control loops, MCP/REST interfaces
- **Raw Trace**: Durable append-only storage, evidence for promotion
- **Promoted Knowledge**: Versioned Insights, entity relationships, Steel Frame
- **Human Workspace**: Approval workflows, curated documentation

### Memory Layer Architecture

Three types of memory with different lifecycles:

| Layer | Storage | Purpose | Lifecycle |
|-------|---------|---------|-----------|
| Working Context | Session state | Immediate prompt context | Per-session |
| Episodic Memory | PostgreSQL | Interaction traces | Append-only, 12-month retention |
| Semantic Knowledge | Neo4j | Long-term facts and patterns | Versioned, promotion-based |

### Generic Agent Loop

```
loop:
  1. BuildContext: Load agent-specific + project + global memory from Neo4j
  2. PlanStep: LLM proposes next action/subgoal (reasoning_chain captured)
  3. ExecuteTool: Typed invocation via MCP/REST (policy gateway mediation)
  4. UpdateState: Log result to PostgreSQL traces (append-only)
     IF behavior_changing: promote to Neo4j (after human approval)
end loop
```

## Core Patterns

### Pattern: Steel Frame Versioning

All Insights are immutable. Versioning uses SUPERSEDES relationships:

```
(v2-insight)-[:SUPERSEDES]->(v1-insight:deprecated)
```

**Properties:**
- Never edit Insights in place
- Always create new versions with SUPERSEDES link
- Old versions marked `deprecated` or `expired`
- Query "current truth" by filtering out nodes with incoming SUPERSEDES

**Status Transitions:**
- `active` → `deprecated` (superseded by newer version)
- `active` → `expired` (age-based decay)
- `deprecated` → `reverted` (rollback scenario)

### Pattern: Entity Deduplication

Prevent knowledge graph chaos from duplicate entities:

1. **Canonical Name Registry**: Single source of truth (e.g., "Neo4j" = "Neo4j Graph Database")
2. **Resolution Before Creation**: Check canonical names before creating new entities
3. **Embedding Similarity + Levenshtein**: Detect near-duplicates automatically
4. **Merge with Audit Trail**: Preserve all relationships when merging duplicates

### Pattern: Dual-Context Query

Every query returns both project-specific AND global context:

```cypher
MATCH (i:Insight)
WHERE i.group_id = $project_group_id OR i.group_id = 'global'
RETURN i
ORDER BY i.confidence DESC, i.timestamp DESC
```

This ensures agents reason with local context and shared best practices together.

### Pattern: ADR 5-Layer Framework

Every architectural decision captured with 5 audit layers:

1. **Action Logging**: What changed, when, agent/model version
2. **Decision Context**: Situation that triggered the decision
3. **Reasoning Chain**: Step-by-step logic in human terms
4. **Alternatives Considered**: What was rejected and why
5. **Human Oversight Trail**: Who approved, when, approval status

**GDPR Compliance**: All explanations must be human-understandable (not "the algorithm decided").

### Pattern: HITL Knowledge Promotion Gate

Agents CANNOT autonomously promote to knowledge graph:

```
PostgreSQL Trace (candidate)
    ↓ Curator proposes
Notion Approval Page
    ↓ Human approves
Neo4j Insight (active)
    ↓ confidence ≥ 0.7
Notion Mirror (human-readable)
```

### Pattern: group_id Enforcement

Every node MUST have a `group_id` property. Schema constraint rejects nodes without it.

**Rules:**
- Project-scoped queries include `group_id` filter
- Global knowledge uses `group_id = 'global'`
- Cross-project contamination is prevented at schema level

## Key Decisions

### Decision 1: Neo4j as Knowledge Store
- **Rationale**: Graph structure essential for Insight versioning and entity relationships
- **Alternative**: PostgreSQL with JSON columns (rejected: weak querying of relationships)
- **Consequence**: Need Cypher expertise, APOC plugin for advanced operations

### Decision 2: MCP for Tool Interfaces
- **Rationale**: Standard protocol for AI tool integration
- **Alternative**: Custom REST API (rejected: vendor lock-in)
- **Consequence**: Tools must be typed and versioned contracts

### Decision 3: HITL Over Automatic Enforcement
- **Rationale**: Humans stay in control of behavior-changing knowledge
- **Alternative**: Automatic promotion above thresholds (rejected: trust/safety)
- **Consequence**: Mission Control approval interface needed

### Decision 4: Steel Frame Over Mutation
- **Rationale**: Audit requires immutable history
- **Alternative**: Update-in-place with audit log (rejected: reconstructibility)
- **Consequence**: More storage, simpler reasoning about state

### Decision 5: PostgreSQL for Raw Traces
- **Rationale**: Append-only, durable, ACID guarantees
- **Alternative**: Elasticsearch (rejected: operational complexity)
- **Consequence**: Standard SQL tooling, clear separation from graph

## Design Principles

1. **Separation of Concerns**: AI reasoning kernel MUST NOT interact directly with data
2. **Evidence Before Knowledge**: All promoted insights trace back to raw evidence
3. **Human Authority**: Every behavior-changing decision requires human approval
4. **Trace-Driven Debugging**: Primary debugging substrate is trace history, not ad-hoc logs
5. **Graceful Degradation**: When limits hit, fail with structured summary (not crash)

## Anti-Patterns to Avoid

❌ **Storing secrets in memory bank** - Never include tokens, passwords, or API keys
❌ **Large code snippets** - Use file references instead
❌ **Cross-group queries** - Always filter by `group_id`
❌ **Editing Insights** - Always supersede, never mutate
❌ **Autonomous promotion** - Humans must approve knowledge changes