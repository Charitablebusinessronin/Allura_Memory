# System Patterns

> **Last Updated:** 2026-04-06
> **Pattern Source:** `_bmad-output/planning-artifacts/architectural-brief.md`

---

## Type System as Contract Enforcer

### Rule: Interface Changes Are Atomic

When modifying interfaces/types:
1. Update the interface
2. Update all consumers in same commit
3. Update all test mocks in same commit
4. Run `bun run typecheck` before commit

**Why:** The TypeScript compiler is a canary in the coal mine. When it sings, contracts have diverged. A developer changed an interface without updating consumers. Tests mock a fantasy. Types make assumptions the system now rejects.

### Rule: Tests Must Not Speculate

Tests for modules that don't exist are fantasies.

Options:
- The module exists → write the test
- The module doesn't exist → write the module first, then the test
- Need to test now → create mock with `@mcp-docker/*` path mapping in `tsconfig.json` and `vitest.config.ts`

### Rule: CI Must Enforce Typecheck

`bun run typecheck` is not optional. If it fails, the PR is blocked. The type system is the canary—do not silence it.

### Rule: Pre-commit Hook Required

Pre-commit hook at `.githooks/pre-commit` enforces typecheck before every commit.

**Setup (one-time):**
```bash
git config core.hooksPath .githooks
```

**The hook runs:**
```bash
bun run typecheck
```

**If typecheck fails:**
```
❌ TypeScript errors found. Fix before committing.
Memory rule: Contracts must be honored.
```

**Hook also prevents:**
- Committing `.env` files with secrets
- Committing files with potential secrets (password, api_key, token patterns)

### The Tar Pit Warning

If you fix type errors without addressing the process, you will be here again in a month. The type system is not the enemy. It is the messenger. Shooting the messenger does not fix the kingdom.

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

## Session Persistence Pattern (NEW — 2026-04-05)

**Course Correction:** From Claude Code leak analysis — sessions must survive crashes.

```
Session Start → Load state from .opencode/state/session-{id}.json
     ↓
Each Event → Persist state update (async, non-blocking)
     ↓
Crash → Resume from last checkpoint
     ↓
Session End → Archive state, clear temp files
```

**State Schema:**
```typescript
interface SessionState {
  session_id: string;
  agent_id: string;
  group_id: string;
  workflow_stage: 'planned' | 'discovering' | 'approved' | 'executing' | 'validating' | 'complete';
  token_usage: { input: number; output: number; turns: number };
  permissions_granted: string[];
  subagent_results: Record<string, any>;
  checkpoint_data: any;
  created_at: string;
  updated_at: string;
}
```

---

## Workflow State Machine (NEW — 2026-04-05)

**Course Correction:** Conversation state ≠ workflow state. Persist transitions explicitly.

```
planned → discovering → approved → executing → validating → complete
   ↓          ↓           ↓           ↓           ↓
 failed      failed      failed      failed      failed
```

**PostgreSQL Schema:**
```sql
CREATE TABLE workflow_states (
  id UUID PRIMARY KEY,
  group_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('planned', 'discovering', 'approved', 'executing', 'validating', 'complete', 'failed')),
  checkpoint_data JSONB,
  retry_safe BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Token Budget Pattern (NEW — 2026-04-05)

**Course Correction:** Pre-turn checks prevent runaway consumption.

```
Before Each Turn:
  1. Check remaining budget
  2. If remaining < MIN_TURN_TOKENS → stop execution, notify user
  3. If OK → proceed with API call
  4. After call → update used/remaining counters
```

**Key Principle:** "Anthropic puts in checks that are not beneficial to Anthropic, they're beneficial to the long-term health of the customer."

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