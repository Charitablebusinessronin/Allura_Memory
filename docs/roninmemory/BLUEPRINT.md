# roninmemory Blueprint

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of AI language models.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.

roninmemory is the persistent memory and knowledge curation infrastructure for the Charitable Business Ronin agent fleet. It transforms OpenClaw agents from stateless session-bots into goal-directed teammates by maintaining a semantic memory graph (Neo4j), a raw trace store (PostgreSQL), and an automated curation pipeline.

---

## 1. Core Concepts

### Insight
A versioned knowledge node in Neo4j representing a validated behavior-shaping rule or pattern. Never mutated — every update creates a new node linked by a `:SUPERSEDES` edge.

**States:** `active` | `degraded` | `expired`
**Key fields:** `runId`, `groupId`, `category`, `content`, `confidence`, `status`, `version`, `createdAt`, `notionPageId`

### AgentDesign
A promoted, versioned agent configuration node in Neo4j. Originates from ADAS evolutionary search. Spawning a live OpenClaw agent requires Aegis human sign-off.

**States:** `draft` → `evaluating` → `ranked` → `proposed` → `approved` → `promoted` | `rejected`
**States (Neo4j):** `active` | `deprecated`
**Key fields:** `runId`, `groupId`, `version`, `status`, `createdAt`, `design_id`, `domain`, `config.model`

### ADAS Run
A raw execution trace row in PostgreSQL — one candidate agent design evaluation.

**States:** `pending` | `running` | `succeeded` | `failed`
**Key fields:** `run_id`, `group_id`, `agent_design_json`, `fitness_score`, `promoted`

### Tenant
A scoped namespace isolating memory and agent configs per project.

**Key fields:** `group_id`, `is_global`, `display_name`

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
- **Tenant isolation:** All queries MUST scope by `groupId`
- **Aegis gate:** ADAS-promoted designs MUST NOT spawn live agents without human sign-off
- **No autonomous promotion:** Agent designs MUST NOT self-promote
- **Weight normalization:** `accuracyWeight + costWeight + latencyWeight` MUST sum to 1.0

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
