# roninmemory Blueprint

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of AI language models.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.

roninmemory (Allura Memory) is the persistent memory and knowledge curation infrastructure for the Charitable Business Ronin agent fleet. It transforms OpenClaw agents from stateless session-bots into goal-directed teammates by maintaining a semantic memory graph (Neo4j), a raw trace store (PostgreSQL), and an automated curation pipeline — governed by a Brooks-bound orchestrator and canonical subagent architecture.

---

## 1. Architecture Model

### Brooks-Bound Orchestrator

The primary orchestrator (`memory-orchestrator`) is bound to the **Frederick P. Brooks Jr. persona** — emphasizing:
- **Conceptual integrity** in system design
- **Plan-and-document** discipline before implementation
- **Second-system effect** awareness (avoid over-engineering)
- **Surgical team** model (specialist subagents, not generalists)

The orchestrator governs all memory operations and delegates execution to canonical subagents.

### Canonical Subagent Naming

All subagents use the `memory-*` naming convention:

| Subagent | Role |
|----------|------|
| `memory-scout` | Discovers context files before coding |
| `memory-archivist` | Fetches current docs for external packages |
| `memory-curator` | Breaks down complex features into atomic subtasks |
| `memory-chronicler` | Generates documentation |
| `memory-builder` | Executes delegated coding subtasks |
| `memory-tester` | Testing after implementation |
| `memory-guardian` | Reviews code quality and compliance |
| `memory-validator` | Validates builds and types |
| `memory-organizer` | Organizes context and knowledge |
| `memory-interface` | Designs UI components and interactions |
| `memory-infrastructure` | Manages infrastructure and deployment |

### Tenant Boundaries

The current persistence layer enforces project-level tenant isolation via `group_id`.

| Boundary | Scope | Usage |
|----------|-------|-------|
| `group_id` | Memory partition | Project-specific knowledge separation within the current schema |

**Example:**
- `group_id = "faith-meats"` — Faith Meats project memory partition
- `group_id = "global-coding-skills"` — Cross-project reusable patterns

---

## 2. Core Concepts

### Insight
A versioned knowledge node in Neo4j representing a validated behavior-shaping rule or pattern. Never mutated — every update creates a new node linked by a `:SUPERSEDES` edge.

**States:** `active` | `degraded` | `expired`
**Key fields:** `runId`, `organization_id`, `group_id`, `category`, `content`, `confidence`, `status`, `version`, `createdAt`, `notionPageId`

### AgentDesign
A promoted, versioned agent configuration node in Neo4j. Originates from ADAS evolutionary search. Spawning a live OpenClaw agent requires Aegis human sign-off.

**States (ADAS lifecycle):** `draft` → `evaluating` → `ranked` → `proposed` → `approved` → `promoted` | `rejected`
**States (Neo4j):** `active` | `deprecated`
**Key fields:** `runId`, `organization_id`, `group_id`, `version`, `status`, `createdAt`, `design_id`, `domain`, `config.model`

### ADAS Run
A raw execution trace row in PostgreSQL — one candidate agent design evaluation.

**States:** `pending` | `running` | `succeeded` | `failed`
**Key fields:** `run_id`, `organization_id`, `group_id`, `agent_design_json`, `fitness_score`, `promoted`

### Tenant
A scoped namespace isolating memory and agent configs per project. Every node in Neo4j and every row in Postgres carries:
- `organization_id` — business boundary (e.g., `charitable-business-ronin`)
- `group_id` — memory partition (snake_case, consistent across all systems)

**Key fields:** `organization_id`, `group_id` (e.g. `faith-meats`, `global-coding-skills`), `is_global`, `display_name`

### Dual Logging Policy

The system enforces dual-path logging for complete auditability:

| Store | Purpose | Content |
|-------|---------|---------|
| **PostgreSQL** | System of Record for the Present | Raw traces, events, audit logs, heartbeats |
| **Neo4j** | System of Reason | Curated insights, patterns, versioned knowledge |

**Writing:**
- Confidence `< 0.5` → PostgreSQL only (raw trace)
- Confidence `>= 0.5` → PostgreSQL + Neo4j (promoted insight with `:SUPERSEDES`)

**Reading:**
- Session hydration queries both stores
- Project-specific insight (`group_id=scoped`) before global (`group_id=global-coding-skills`)

### Curator
The automated Node.js ESM cron service that polls `v_curator_pending`, executes the 2-phase promotion protocol, and mirrors to Notion.

### MemFS & Reflections
A hierarchical suite of Git-backed Markdown files enabling agents to manage private journals (`reflections/`), persist project traits (`context/`), and dynamically pin static persona rules (`system/`).

### ADAS (Automated Agent Design & Assistant System)
An evolutionary design system for AI agents using Ollama and HITL governance.

---

## 2. Execution Rules

- **Promotion eligibility:** `fitness_score >= 0.7` AND `status = 'succeeded'` AND `promoted = false`
- **Phase 1 fail** → retry on next Curator poll
- **Phase 2 fail** → compensating `DETACH DELETE`; queue entry left for retry
- **Notion fail** → non-fatal; logged; backfilled on next cycle
- **Curator retries:** up to `attempt_count = 4` 
- **Mutation rules:** prompt mutation, model mutation (within tier), strategy mutation
- **Crossover:** single-point on `systemPrompt`

---

## 3. Global Constraints

- **Docker-only:** All services MUST run inside Docker
- **Immutable nodes:** Neo4j nodes MUST NOT be mutated; use `:SUPERSEDES`
- **2-phase ordering:** `promoted = true` MUST NOT be set before `neo4j_written = true`
- **Tenant isolation:** All queries MUST scope by both `organization_id` (business boundary) and `group_id` (memory partition)
- **Tenant isolation:** All queries MUST scope by `group_id` (memory partition); `organization_id` is not yet schema-enforced
- **Dual logging:** All writes MUST follow dual logging policy — PostgreSQL for events/audit, Neo4j for insights/patterns
- **Aegis gate:** ADAS-promoted designs MUST NOT spawn live agents without human sign-off
- **No autonomous promotion:** Agent designs MUST NOT self-promote
- **Weight normalization:** `accuracyWeight + costWeight + latencyWeight` MUST sum to 1.0
- **Brooks orchestration:** All memory operations governed by `memory-orchestrator` bound to Brooks persona

---

## 4. Logging & Audit

| What | Where | Notes |
|------|-------|-------|
| ADAS runs | `adas_runs` | Immutable after insert |
| ADAS trace events | `adas_trace_events` | Per-event JSON payload |
| Promotion proposals | `adas_promotion_proposals` | Human decisions |
| Promotion events | `curator_queue` | `resolved_at` = Phase 2 timestamp |
| Notion sync | `notion_sync_log` | Drift via `v_sync_drift` |
| Agent heartbeats | `agents.last_heartbeat` | Updated every tool call |
| Agent cost | `agents.token_cost_usd` | Cumulative |

**Redacted fields:** `ANTHROPIC_API_KEY`, `NEO4J_PASSWORD`, `POSTGRES_PASSWORD`, `NOTION_API_KEY`, `OPENAI_API_KEY`, `OLLAMA_API_KEY`

---

## 5. Admin Workflow

1. Clone repo, `cp .env.example .env`, fill required values
2. `docker compose up --build -d`
3. **Existing graph:** Run `scripts/inspect-graph.cypher`
4. **Fresh install:** Run `neo4j/init/seed.cypher`
5. `bash verify.sh` — confirm all services healthy
6. `docker compose --profile adas run --rm adas` — first ADAS cycle
7. Monitor Curator logs for first promotion
8. Review promoted insight in Notion → Aegis sign-off
