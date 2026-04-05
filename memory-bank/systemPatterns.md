# System Patterns

> **Last Updated:** 2026-04-05
> **Pattern Source:** `_bmad-output/planning-artifacts/architectural-brief.md`

---

## Core Architecture: 5-Layer Model

```
┌─────────────────────────────────────────────────────┐
│ Layer 5: Paperclip + OpenClaw                       │
│         (Human interfaces)                           │
├─────────────────────────────────────────────────────┤
│ Layer 4: Workflow / DAGs / A2A Bus                  │
│         (Orchestration)                             │
├─────────────────────────────────────────────────────┤
│ Layer 3: Agent Runtime (OpenCode)                   │
│         (Agent framework)                           │
├─────────────────────────────────────────────────────┤
│ Layer 2: PostgreSQL 16 + Neo4j 5.26                 │
│         (Data layer)                                │
├─────────────────────────────────────────────────────┤
│ Layer 1: RuVix Kernel                               │
│         (Proof-gated mutation)                      │
└─────────────────────────────────────────────────────┘
```

---

## Tenant Isolation Pattern

### group_id Enforcement

**Every record MUST have a `group_id`**: Primary tenant isolation boundary.

```typescript
// PostgreSQL
interface TenantKeyed {
  group_id: string;        // Format: "allura-{org}"
  agent_id: string;
  workflow_id?: string;
  status: 'active' | 'pending' | 'archived' | 'deprecated';
  created_at: string;
  updated_at: string;
}
```

**Tenant Naming Convention:**
- `allura-faith-meats` — Faith Meats organization
- `allura-creative` — Creative Studio
- `allura-personal` — Personal Assistant
- `allura-nonprofit` — Nonprofit
- `allura-audits` — Bank Audits
- `allura-haccp` — HACCP

**Legacy (`roninclaw-*`) is deprecated.**

---

## Steel Frame Versioning

### Neo4j Insight Versioning

```
(v2-insight)-[:SUPERSEDES]->(v1-insight:deprecated)
```

Insights are immutable. Create new versions with explicit lineage.

---

## HITL Knowledge Promotion

**Governance Rule:** Agents CANNOT autonomously promote to Neo4j/Notion.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  PostgreSQL  │────▶│   Curator    │────▶│   Auditor    │
│  (Traces)    │     │  (Proposes)  │     │  (Approves)  │
└──────────────┘     └──────────────┘     └──────────────┘
                                                   │
                                                   ▼
                                          ┌──────────────┐
                                          │    Neo4j     │
                                          │  (Knowledge) │
                                          └──────────────┘
```

---

## ADR 5-Layer Framework

Every architectural decision captured with:

1. **Action Logging** — What was done
2. **Decision Context** — Why it mattered
3. **Reasoning Chain** — How we got here
4. **Alternatives Considered** — What else was possible
5. **Human Oversight Trail** — Who approved

---

## Documentation Hierarchy

```
docs/
├── allura/              ← HUMAN CANON (source of truth)
│   ├── source-of-truth.md
│   ├── prd-v2.md
│   ├── architectural-brief.md
│   ├── tenant-memory-boundary-spec.md
│   └── architectural-decisions.md
│
├── planning-artifacts/  ← BMAD GENERATED (superseded by allura/)
│
└── implementation-artifacts/ ← SPRINT STORIES
```

**When conflict:** `_bmad-output/planning-artifacts/` wins.

---

## BMad Workflow Architecture

### Input/Output Pattern

```
BMad Workflow Engine
    │
    ├─▶ READ: _bmad-output/planning-artifacts/* (canon context)
    │
    └─▶ WRITE:
           _bmad-output/planning-artifacts/* (PRDs, architecture)
           _bmad-output/implementation-artifacts/* (stories, specs)
```

### Agent & Skill Registry

**7 OpenCode Agents** (`.opencode/agent/Memory*.md`):
- `MemoryOrchestrator` — Coordination
- `MemoryArchitect` — Design
- `MemoryBuilder` — Implementation
- `MemoryAnalyst` — Metrics
- `MemoryCopywriter` — Prompts
- `MemoryRepoManager` — Git
- `MemoryScribe` — Docs

**70 BMad Skills** (`_bmad/_config/skill-manifest.csv`):
- Analysis: `bmad-product-brief`, `bmad-market-research`
- Planning: `bmad-create-prd`, `bmad-create-ux-design`
- Solutioning: `bmad-create-architecture`, `bmad-create-epics-and-stories`
- Implementation: `bmad-dev-story`, `bmad-quick-dev`

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Agent Framework | OpenCode |
| Language | TypeScript 5.7 strict |
| Runtime | Bun |
| CMS | Payload CMS |
| Frontend | Next.js |
| Raw Events | PostgreSQL 16 |
| Knowledge Graph | Neo4j 5.26 + APOC |
| Tool Protocol | MCP |
| Agent Protocol | A2A |

---

## Error Handling Patterns

1. **Fail Fast** — Missing env vars throw explicit errors
2. **Typed Domain Errors** — Validation/conflict cases use typed errors
3. **Preserve Causal Info** — Wrap errors with context
4. **Log with Context** — Module + identifiers
5. **Retry/Backoff** — Only for retryable failures (5xx, 429, transient)
6. **No Silent Failures** — Unless fallback is documented

---

## Naming Conventions

| Type | Convention |
|------|------------|
| Files | `kebab-case` |
| React Components | `PascalCase` |
| Hooks | `camelCase` with `use` prefix |
| Types/Interfaces/Classes | `PascalCase` |
| Constants | `SCREAMING_SNAKE_CASE` |
| DB Identifiers | `snake_case` |
| Tests | `should ... when ...` |
| Tenant IDs | `allura-{org}` |

---

## Agent Memory Pattern

### Knowledge Graph Schema

**Agent Nodes:**
```cypher
CREATE (a:Agent {
  id: 'agent.memory-{role}',
  name: 'Memory{Role}',
  group_id: 'allura-default',
  created: datetime(),
  model: '{model_name}',
  confidence: 0.0
})
```

**Agent Team Grouping:**
```cypher
CREATE (g:AgentGroup {
  id: 'allura-agent-team',
  name: 'Allura Agent Team',
  group_id: 'allura-default'
})
CREATE (g)-[:INCLUDES {since: datetime()}]->(a)
```

### Relationship Types

| Relationship | From → To | Purpose | Properties |
|--------------|-----------|---------|------------|
| `CONTRIBUTED` | Agent → Insight | Agent created/modified knowledge | `timestamp`, `confidence`, `action` |
| `LEARNED` | Agent → Session | Agent gained context | `timestamp`, `relevance_score` |
| `DECIDED` | Agent → Decision | Agent made governance decision | `timestamp`, `rationale`, `approved_by` |
| `COLLABORATED_WITH` | Agent → Agent | Agents worked together | `session_id`, `role`, `timestamp` |
| `SUPERSEDES` | Insight → Insight | Knowledge versioning | `timestamp`, `reason` |
| `INCLUDES` | AgentGroup → Agent | Team membership | `since`, `role` |
| `KNOWS` | Agent → Agent | Awareness for handoffs | `since`, `context` |

### Memory Flow

```
Agent executes → Log trace to PostgreSQL → Curator proposes insight 
→ Human approves in Notion → Insight promoted to Neo4j
```

### Agent Memory Capabilities

1. **Recall** — Query past contributions/decisions by relationship type
2. **Attribution** — Track confidence scores on contributed knowledge
3. **Collaboration** — Remember which agents worked together
4. **Handoff** — Know which agents to route tasks to