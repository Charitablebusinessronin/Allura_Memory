# roninmemory PROJECT

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of AI language models (Claude, GitHub Copilot).
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

roninmemory is the persistent memory and knowledge curation infrastructure for the Charitable Business Ronin agent fleet. It transforms OpenClaw agents from stateless session-bots into goal-directed teammates by maintaining a semantic memory graph (Neo4j), a raw trace store (PostgreSQL), and an automated curation pipeline — including the ADAS evolutionary agent design system — that promotes high-confidence discoveries into durable, versioned knowledge. Human oversight is enforced through Notion mirroring and a Mission Control Aegis sign-off gate.

**Primary operator:** Sabir Asheed, Charitable Business Ronin nonprofit, Charlotte NC.

---

## Table of Contents

- [1. Blueprint (Core Concepts & Scope)](#1-blueprint-core-concepts--scope)
- [2. Requirements Matrix](#2-requirements-matrix)
- [3. Solution Architecture](#3-solution-architecture)
- [4. Data Dictionary](#4-data-dictionary)
- [5. Risks & Decisions](#5-risks--decisions)
- [6. Tasks](#6-tasks)
- [7. Testing Protocol](#7-testing-protocol)
- [8. Operational Workflows](#8-operational-workflows)
- [9. References](#9-references)

---

## 1. Blueprint (Core Concepts & Scope)

### Insight

A versioned knowledge node in Neo4j representing a validated behavior-shaping rule or pattern. Never mutated — every update creates a new node linked by a `:SUPERSEDES` edge to the prior version.

**States:** `active` | `degraded` | `expired`
**Key fields:** `runId`, `groupId`, `category`, `content`, `confidence`, `status`, `version`, `createdAt`, `notionPageId`

### AgentDesign

A promoted, versioned agent configuration node in Neo4j. Originates from ADAS evolutionary search. Spawning a live OpenClaw agent requires Aegis human sign-off.

**States (ADAS lifecycle):** `draft` → `evaluating` → `ranked` → `proposed` → `approved` → `promoted` | `rejected`
**States (Neo4j):** `active` | `deprecated`
**Key fields:** `runId`, `groupId`, `version`, `status`, `createdAt`, `design_id`, `domain`, `config.model`, `config.reasoningStrategy`, `config.systemPrompt`, `config.tools`

### ADAS Run

A raw execution trace row in PostgreSQL — one candidate agent design evaluation. Immutable after insert except `status` and `promoted`.

**States:** `pending` | `running` | `succeeded` | `failed`
**Key fields:** `run_id`, `group_id`, `agent_design_json`, `fitness_score`, `promoted`, `started_at`, `finished_at`

### Tenant

A scoped namespace isolating memory and agent configs per project. Every node in Neo4j and every row in Postgres carries a `group_id` / `groupId`.

**Key fields:** `group_id` (e.g. `faith-meats`, `global-coding-skills`), `is_global`, `display_name`

### Curator

The automated Node.js ESM cron service that polls `v_curator_pending`, executes the 2-phase promotion protocol, and mirrors qualifying insights to Notion.

### Aegis Gate

Mandatory human sign-off in Mission Control. Required before any ADAS-promoted AgentDesign can spawn a live agent.

### ADAS (Automated Agent Design & Assistant System)

An evolutionary design system for AI agents. Generates, evaluates, mutates, and promotes agent designs using real LLM inference (Ollama) and HITL governance.

**Core subsystems:**

| Subsystem | Responsibility |
|-----------|---------------|
| **SearchLoop** | Evolutionary search — population, mutation, crossover, ranking |
| **EvaluationHarness** | Evaluates designs against ground-truth via Ollama, logs to PostgreSQL |
| **Sandbox** | Isolated code execution (process or Docker mode) |
| **PromotionDetector** | Detects when candidate qualifies for promotion |
| **SafetyMonitor** | Validates design safety before execution |
| **OllamaClient** | HTTP client for Ollama API — local + cloud routing, Bearer auth |

### DomainConfig

Defines evaluation context for a search — ground-truth cases, accuracy weighting, and cost/latency weights for composite scoring.

**Key fields:** `domainId`, `groundTruth[]`, `accuracyWeight`, `costWeight`, `latencyWeight` (must sum to 1.0)

### ModelConfig

Describes an Ollama model available for agent inference.

**Key fields:** `modelId`, `provider` (always `"ollama"`), `tier` (`"stable"` | `"experimental"`), `temperature`, `maxTokens`, `supportsTools`

### Memory Snapshot Cache

A Bun CLI-generated JSON cache (`memory-bank/index.json`) that summarizes canonical documentation trees. Used to accelerate session hydration to <30s without runtime filesystem scanning.

---

## 2. Requirements Matrix

### Business Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| B1 | Sabir can dictate or type daily work logs; Agent Zero captures them as CRM Activities + Tasks linked to the correct project | ✅ Implemented |
| B2 | Every OpenClaw agent session starts with current knowledge loaded automatically — no manual prompt engineering | ✅ Implemented |
| B3 | High-confidence ADAS designs are promoted to Neo4j and mirrored to Notion without manual intervention | ✅ Implemented |
| B4 | All promoted knowledge is traceable back to its raw execution evidence in PostgreSQL | ✅ Implemented |
| B5 | Project-specific knowledge takes priority over global knowledge in every session | ✅ Implemented |
| B6 | No ADAS-discovered design can deploy as a live agent without human Aegis sign-off | ✅ Implemented |
| B7 | The system must never mutate existing Neo4j nodes — all updates create new versioned nodes | ✅ Implemented |
| B8 | All services run in Docker — no local execution permitted | ✅ Implemented |
| B9 | Design AI agents automatically via evolutionary search — generate, evaluate, evolve via mutation/crossover | ✅ Implemented |
| B10 | Use real LLM inference (Ollama) for all agent execution — no mocked responses in production | ✅ Implemented |
| B11 | Provide a CLI entry point for standalone ADAS runs | ✅ Implemented |
| B12 | Persist all ADAS evaluation events and proposals to PostgreSQL — full audit trail | ✅ Implemented |
| B13 | Support two-tier model selection — stable for baselines, experimental opt-in | ✅ Implemented |

### Functional Requirements

#### Memory Loading (F1–F3)

| ID | Requirement | Traces To |
|----|-------------|-----------|
| F1 | On every OpenClaw session start, `before_prompt_build` hook queries Neo4j for `active` insights scoped to session `groupId` PLUS `global-coding-skills` | B2 |
| F2 | Results injected into system prompt; tenant-specific insights appear before global ones | B2, B5 |
| F3 | Agents may call `memory_write` tool; confidence < 0.5 → Postgres only; confidence ≥ 0.5 → Neo4j node + `:SUPERSEDES` edge | B3 |

#### Promotion Pipeline (F4–F8)

| ID | Requirement | Traces To |
|----|-------------|-----------|
| F4 | `adas_runs` rows with `fitness_score >= 0.7` and `status = succeeded` are auto-enqueued by `trg_auto_enqueue_curator` | B3, B4 |
| F5 | Curator performs 2-phase commit: Phase 1 writes Neo4j node; Phase 2 sets `promoted = true` in Postgres | B3, B4 |
| F6 | If Phase 2 fails after Phase 1 succeeds, a compensating `DETACH DELETE` removes the orphaned Neo4j node | B3 |
| F7 | Curator mirrors insights with `confidence >= 0.7` to Notion Master Knowledge Base (async, non-fatal) | B3 |
| F8 | `trg_promotion_guard` at DB level enforces `neo4j_written = true` before `promoted = true` is accepted | B4, B7 |

#### Multi-Tenancy (F9–F10)

| ID | Requirement | Traces To |
|----|-------------|-----------|
| F9 | Every Postgres row carries `group_id`; every Neo4j node carries `groupId` | B5, B8 |
| F10 | All queries are scoped by `groupId`; cross-tenant access is prohibited | B5, B8 |

#### ADAS Discovery (F11–F13)

| ID | Requirement | Traces To |
|----|-------------|-----------|
| F11 | ADAS meta-agent generates candidate designs; SearchLoop drives evolutionary search over AgentDesign space | B3, B9 |
| F12 | Each candidate runs in a sandbox: process mode with resource limits, or Docker mode with `--network=none`, `--cap-drop=ALL`, `--memory=256m`, `--read-only` | B8 |
| F13 | Fitness = `accuracyWeight * accuracy + costWeight * normCost + latencyWeight * normLatency`, range 0.0–1.0, written to `adas_runs` | B3, B12 |

#### ADAS Agent Design (F14–F16)

| ID | Requirement | Traces To |
|----|-------------|-----------|
| F14 | Generate random `AgentDesign` from a `SearchSpace` — random model, strategy, and prompt | B9 |
| F15 | Mutate an `AgentDesign` — change prompt, swap model (within tier), change reasoning strategy | B9 |
| F16 | Crossover two `AgentDesign` instances — combine configs to produce a child design | B9 |

#### ADAS Evaluation (F17–F20)

| ID | Requirement | Traces To |
|----|-------------|-----------|
| F17 | Evaluate candidate against `DomainConfig` ground truth — run forward function, compare output to expected | B9 |
| F18 | Log every evaluation event to PostgreSQL (`adas_trace_events` table) | B12 |
| F19 | Rank candidates by composite score — descending order | B9 |
| F20 | Support configurable population size, elite count, mutation rate, crossover rate, early stopping at `successThreshold` | B9, B11 |

#### ADAS Governance (F21–F23)

| ID | Requirement | Traces To |
|----|-------------|-----------|
| F21 | Generate `PromotionProposal` when candidate score >= promotion threshold (default 0.85) | B6 |
| F22 | Human reviewer approves/rejects/modifies proposal | B6 |
| F23 | Only `approved` designs may be promoted to active agent status | B6 |

#### Ollama Integration (F24–F26)

| ID | Requirement | Traces To |
|----|-------------|-----------|
| F24 | Route cloud models (`:cloud` suffix) to `OLLAMA_CLOUD_URL` with Bearer auth | B10 |
| F25 | Route local models to `OLLAMA_BASE_URL` (default `http://localhost:11434`) without auth | B10 |
| F26 | Track token usage and latency per Ollama call | B12 |

#### Observability (F27–F28)

| ID | Requirement | Traces To |
|----|-------------|-----------|
| F27 | `after_tool_call` hook upserts agent heartbeat, cumulative `token_cost_usd`, and task counters to `agents` table | B1, B2 |
| F28 | Anonymous sessions write raw traces to `adas_runs` for Curator candidate discovery | B3 |

---

## 3. Solution Architecture

### Components

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| OpenClaw | AI reasoning controller; task execution; MCP tool runtime | OpenClaw / Paperclip |
| PostgreSQL | Raw trace store; agent registry; ADAS runs/events; promotion queue; governance triggers | Postgres 16 |
| Neo4j | Persistent semantic memory graph; versioned `:Insight` / `:AgentDesign` nodes | Neo4j 5, Bolt port 7687 |
| Curator | 2-phase promotion cron; Notion mirror | Node.js 20 ESM, node-cron |
| ADAS Orchestrator | Meta-agent design search; evolutionary SearchLoop; DinD execution; fitness scoring | Node.js 20, Dockerode |
| OllamaClient | HTTP client for Ollama API — local + cloud routing, Bearer auth | TypeScript, `src/lib/ollama/client.ts` |
| DinD Sidecar | Blast-radius-bounded candidate execution | docker:26-dind |
| Notion | Human knowledge workspace; Aegis review surface | Notion API v1 |
| Mission Control | Agent spawn; monitoring; Aegis gate UI | OpenClaw Mission Control |
| Snapshot CLI | Bun CLI that generates `memory-bank/index.json` from doc trees | Bun, TypeScript |

### Component Overview

```mermaid
graph TD
  Sabir([Sabir / Operator]) -->|voice/text/task| OC[OpenClaw]
  OC -->|read context on session start| N4J[(Neo4j)]
  OC -->|write traces + heartbeat| PG[(PostgreSQL)]
  PG -->|v_curator_pending| CUR[Curator]
  CUR -->|Phase 1 write| N4J
  CUR -->|Phase 2 commit| PG
  CUR -->|mirror| NOT[Notion]
  NOT -->|Aegis sign-off| MC[Mission Control]
  MC -->|spawn approved agent| OC
  ADAS[ADAS Orchestrator] -->|run candidate| DIND[DinD Sandbox]
  DIND -->|fitness_score| PG
  ADAS -->|evaluate via| OC2[OllamaClient]
  OC2 -->|cloud models| OLLAMA_CLOUD[Ollama Cloud]
  OC2 -->|local models| OLLAMA_LOCAL[Ollama Local]
  SNAP[Snapshot CLI] -->|generate| MB[memory-bank/index.json]
  MB -->|hydrate| OC
```

### ADAS Execution Flow

```mermaid
flowchart TD
  Start([CLI invoked]) --> Config[Load domain + models]
  Config --> Init[Initialize population]
  Init --> Eval[Evaluate all candidates]
  Eval --> Rank[Rank by composite score]
  Rank --> Check{Success threshold?}
  Check -->|yes| Promote[Generate PromotionProposal]
  Check -->|no| Mutate[Mutate + crossover]
  Mutate --> Next[Next iteration]
  Next --> Eval
  Promote --> Human{Human review}
  Human -->|approve| Done[Return best design]
  Human -->|reject| Done
```

### Memory Session Flow

```mermaid
flowchart TD
  A[Session starts] --> B[before_prompt_build fires]
  B --> C[Dual-context Neo4j query]
  C --> D[Inject into system prompt]
  D --> E[Agent executes task]
  E --> F[after_tool_call: heartbeat upsert]
  E --> G{memory_write called?}
  G -->|confidence < 0.5| H[Postgres only]
  G -->|confidence >= 0.5| I[Neo4j node + SUPERSEDES]
  H --> J{fitness >= 0.7?}
  J -->|Yes| K[trg_auto_enqueue fires]
  K --> L[Curator Phase 1 → Neo4j]
  L --> M[Curator Phase 2 → Postgres]
  M --> N[Mirror to Notion]
  N --> O[Human Aegis review]
```

### ADAS Evaluation Sequence

```mermaid
sequenceDiagram
    participant CLI
    participant EH as EvaluationHarness
    participant OC as OllamaClient
    participant SC as Sandbox
    participant PG as PostgreSQL

    CLI->>EH: evaluateCandidate(design, forwardFn)
    EH->>SC: validate(design)
    SC-->>EH: valid
    loop for each ground truth case
        EH->>OC: complete(input, model)
        OC-->>EH: response text
        EH->>EH: compare(output, expected)
    end
    EH->>PG: insert trace events
    EH-->>CLI: EvaluationResult
```

---

## 4. Data Dictionary

### PostgreSQL Tables

#### `tenants`

Multi-tenant namespace isolation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | Yes | Primary key |
| `group_id` | string | Yes | Tenant namespace (e.g. `faith-meats`) |
| `display_name` | string | Yes | Human-readable name |
| `is_global` | boolean | Yes | Whether this is the global fallback tenant |
| `created_at` | datetime | Yes | When tenant was created |

**Constraints:** `group_id` UNIQUE, exactly one `is_global = true`

#### `adas_runs`

Raw execution traces from ADAS discovery. Immutable after insert except `status` and `promoted`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `run_id` | uuid | Yes | Unique run identifier |
| `group_id` | string | Yes | Tenant FK → `tenants.group_id` |
| `agent_design_json` | jsonb | Yes | Full agent design snapshot |
| `fitness_score` | numeric | Yes | Composite score 0.0–1.0 |
| `status` | string | Yes | `pending` \| `running` \| `succeeded` \| `failed` |
| `promoted` | boolean | Yes | Whether Curator promoted to Neo4j |
| `started_at` | datetime | Yes | Run start timestamp |
| `finished_at` | datetime | No | Run completion timestamp |
| `source` | string | No | Source tag (e.g. `smoke-test`) |

**Triggers:** `trg_auto_enqueue_curator` — fires when `fitness_score >= 0.7` AND `status = succeeded`

#### `adas_trace_events`

Every event during ADAS evaluation for audit/debugging.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event_id` | uuid | Yes | Unique event identifier |
| `run_id` | uuid | Yes | FK → `adas_runs.run_id` |
| `event_type` | varchar(50) | Yes | See event type catalogue below |
| `payload` | jsonb | Yes | Event-specific data |
| `created_at` | timestamp | Yes | Event timestamp (UTC) |

**`event_type` values:** `evaluation_started`, `ollama_request`, `ollama_response`, `ollama_error`, `test_case_passed`, `test_case_failed`, `evaluation_completed`, `evaluation_failed`

#### `adas_promotion_proposals`

HITL governance proposals.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `proposal_id` | uuid | Yes | Unique proposal identifier |
| `design_id` | uuid | Yes | Candidate design UUID |
| `design_snapshot` | jsonb | Yes | Full design at proposal time |
| `evaluation_metrics` | jsonb | Yes | Scores at proposal time |
| `status` | varchar(20) | Yes | `pending` \| `approved` \| `rejected` \| `modified` |
| `reviewer_notes` | text | No | Human feedback |
| `human_decision` | varchar(20) | No | `approved` \| `rejected` |
| `created_at` | timestamp | Yes | Proposal creation time |
| `decided_at` | timestamp | No | Human decision timestamp |

#### `curator_queue`

Curator promotion queue — tracks 2-phase commit state.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `queue_id` | uuid | Yes | Primary key |
| `run_id` | uuid | Yes | FK → `adas_runs.run_id` |
| `fitness_score` | numeric | Yes | Cached score at enqueue time |
| `neo4j_written` | boolean | Yes | Phase 1 complete flag |
| `neo4j_node_id` | string | No | Neo4j node ID from Phase 1 |
| `attempt_count` | integer | Yes | Retry counter (max 4) |
| `enqueued_at` | datetime | Yes | When entry was created |
| `resolved_at` | datetime | No | When Phase 2 committed |

**Constraints:** `trg_promotion_guard` — enforces `neo4j_written = true` before `adas_runs.promoted = true`

#### `agents`

Agent registry with heartbeat and cost tracking.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | Yes | Primary key |
| `name` | string | Yes | Agent identifier |
| `group_id` | string | Yes | Tenant FK |
| `status` | string | Yes | `active` \| `idle` \| `error` |
| `last_heartbeat` | datetime | Yes | Updated by `after_tool_call` hook |
| `token_cost_usd` | numeric | Yes | Cumulative cost across all sessions |
| `tasks_completed` | integer | Yes | Count of successful completions |
| `tasks_failed` | integer | Yes | Count of failed tasks |

#### `notion_sync_log`

Audit trail for Notion mirror operations.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `log_id` | uuid | Yes | Primary key |
| `run_id` | uuid | Yes | FK → `adas_runs.run_id` |
| `notion_page_id` | string | No | Notion page ID after successful sync |
| `sync_status` | string | Yes | `pending` \| `synced` \| `failed` |
| `synced_at` | datetime | No | When sync completed |
| `error_message` | text | No | Error details if failed |

### ER Diagram

```mermaid
erDiagram
  tenants ||--o{ adas_runs : "group_id"
  tenants ||--o{ agents : "group_id"
  adas_runs ||--o| curator_queue : "run_id"
  adas_runs ||--o{ notion_sync_log : "run_id"
  adas_runs ||--o{ adas_trace_events : "run_id"
  adas_runs ||--o| adas_promotion_proposals : "design_id"

  tenants {
    uuid id
    string group_id
    string display_name
    bool is_global
    datetime created_at
  }
  adas_runs {
    uuid run_id
    string group_id
    jsonb agent_design_json
    float fitness_score
    string status
    bool promoted
    datetime started_at
    datetime finished_at
  }
  adas_trace_events {
    uuid event_id
    uuid run_id
    string event_type
    jsonb payload
    datetime created_at
  }
  adas_promotion_proposals {
    uuid proposal_id
    uuid design_id
    jsonb design_snapshot
    jsonb evaluation_metrics
    string status
    string human_decision
    datetime created_at
    datetime decided_at
  }
  curator_queue {
    uuid queue_id
    uuid run_id
    float fitness_score
    bool neo4j_written
    string neo4j_node_id
    int attempt_count
    datetime resolved_at
  }
  agents {
    uuid id
    string name
    string group_id
    string status
    datetime last_heartbeat
    float token_cost_usd
    int tasks_completed
    int tasks_failed
  }
  notion_sync_log {
    uuid log_id
    uuid run_id
    string notion_page_id
    string sync_status
    datetime synced_at
  }
```

### Neo4j Graph Schema

Based on live Phase 0 inspect-graph results.

#### Node Labels

| Label | Purpose | Count (approx) |
|-------|---------|----------------|
| `Insight` | Versioned knowledge insights | 5+ |
| `Insight:KnowledgeItem` | Tagged knowledge items | 5+ |
| `InsightHead` | Version tracking heads | 5+ |
| `CodeFile` | Embedded code with vectors | — |
| `Entity` | Named entities | — |
| `Module` | Software modules | — |
| `Platform` | Technology platforms | — |
| `Test` | Test entities | 1 |

#### Relationship Types

| Type | Purpose | Count |
|------|---------|-------|
| `MENTIONS` | Entity mentions in content | — |
| `VERSION_OF` | Version chain links | 6 |
| `SUPERSEDES` | Knowledge lineage | — |

#### Key Node Properties

**`Insight`:** `id`, `insight_id`, `group_id`, `status`, `confidence`, `version`, `content`, `summary`, `source_type`, `source_ref`, `notion_page_id`, `promotion_status`, `promoted_at`, `created_at`, `updated_at`

**`Insight:KnowledgeItem`:** Extends `Insight` with `tags` (string[]), `notion_url`, `promoted_at`

**`InsightHead`:** `insight_id`, `group_id`, `current_version`, `current_id`, `created_at`, `updated_at`

**`CodeFile`:** `path`, `content`, `embedding` (float[]), `model`, `embedded_at`

### Views

**`v_curator_pending`** — Curator polling view:

```sql
SELECT * FROM adas_runs r
WHERE r.fitness_score >= 0.7
  AND r.status = 'succeeded'
  AND r.promoted = false
  AND NOT EXISTS (
    SELECT 1 FROM curator_queue q
    WHERE q.run_id = r.run_id AND q.neo4j_written = true
  );
```

**`v_sync_drift`** — Insights promoted but not synced to Notion:

```cypher
MATCH (i:Insight)
WHERE (i.promoted_to_notion = false OR i.promoted_to_notion IS NULL)
  AND i.status = 'promoted'
RETURN i.insight_id, i.group_id, i.promoted_at
```

### Constraints Summary

| Store | Constraint | Description |
|-------|------------|-------------|
| PostgreSQL | `trg_promotion_guard` | Prevents `promoted = true` without `neo4j_written = true` |
| PostgreSQL | `chk_attempt_limit` | `attempt_count < 5` on `curator_queue` |
| PostgreSQL | `uniq_group_id` | `group_id` must be unique on `tenants` |
| PostgreSQL | Unique `run_id` | Each EvaluationHarness gets unique runId |
| Neo4j | `insight_id` required | All insights need identifier |
| Neo4j | `group_id` required | Tenant isolation enforced |
| Neo4j | `insight_id` + `group_id` unique | One head per insight per tenant |

---

## 5. Risks & Decisions

### Architectural Decisions

| ID | Decision | Status | Rationale |
|----|----------|--------|-----------|
| AD-01 | 2-phase commit for Neo4j+Postgres promotion | ✅ Decided | Ensures atomicity; compensating transaction on failure |
| AD-02 | Immutable Neo4j nodes with `:SUPERSEDES` chain | ✅ Decided | Audit trail integrity; never lose history |
| AD-03 | Trigger-based auto-enqueue at DB level | ✅ Decided | Guarantees consistency; Curator just polls |
| AD-04 | Notion mirror is async and non-fatal | ✅ Decided | Prevents promotion blocking on Notion outages |
| AD-05 | DinD sandbox with `--network=none` | ✅ Decided | Blast radius containment for untrusted code |
| AD-06 | Docker-only execution | ✅ Decided | Reproducibility; eliminates "works on my machine" |
| AD-07 | Two-tier model selection (stable vs experimental) | ✅ Decided | Stable models for reproducible baselines; experimental opt-in per search |
| AD-08 | Ollama cloud vs local routing by `:cloud` suffix | ✅ Decided | Local models faster/free; cloud for larger models; suffix drives routing |
| AD-09 | HITL governance for agent promotion | ✅ Decided | No autonomous promotion; human sanity check required |
| AD-10 | PostgreSQL for all ADAS evaluation state | ✅ Decided | ACID guarantees, relational querying, existing infrastructure |
| AD-11 | Single-harness-per-evaluation (unique runId) | ✅ Decided | Avoids PostgreSQL unique constraint violations in parallel evaluation |

### Known Risks

| ID | Risk | Severity | Likelihood | Mitigation |
|----|------|----------|------------|------------|
| RK-01 | Phase 2 failure creates orphaned Neo4j node | Low | Low | Compensating `DETACH DELETE` in Curator error handler |
| RK-02 | Curator crash leaves queue entry unresolved | Low | Low | `attempt_count` limit; manual intervention for stuck entries |
| RK-03 | Notion API rate limits throttle mirror | Medium | Medium | Async queue; exponential backoff; non-fatal failures |
| RK-04 | Cross-tenant data leakage via missing `groupId` filter | High | Medium | Schema constraints; runtime validation; audit queries |
| RK-05 | DinD sandbox escape via kernel exploit | High | Low | `--cap-drop=ALL`, read-only fs, no network, resource limits |
| RK-06 | Ollama API errors causing evaluation failures | Medium | Medium | Catch errors, log `evaluation_failed`, return `accuracy=0`; retry logic pending |
| RK-07 | Promotion threshold gaming (hard-coded outputs) | Medium | Low | Human reviewer evaluates quality; diverse ground-truth test cases |
| RK-08 | Experimental model degrades search quality | Low | Low | Experimental opt-in only; stable models serve as anchors |

---

## 6. Tasks

### Completed ✅

| Task | Notes |
|------|-------|
| T1: Unified PROJECT.md | Blueprint, Architecture, Data Dictionary, Requirements, Risks, Tasks |
| T2: Core entity models | Insight, AgentDesign, ADAS Run, Tenant |
| T3: Neo4j/Postgres dual-write with `:SUPERSEDES` versioning | |
| T4: Curator 2-phase promotion pipeline | |
| T5: `trg_auto_enqueue_curator` trigger | |
| T6: `trg_promotion_guard` constraint trigger | |
| T7: Notion mirror with async queue | |
| T8: ADAS DinD sandbox | |
| T9: OpenClaw `before_prompt_build` hook | Dual-context loading |
| T10: OpenClaw `after_tool_call` hook | Heartbeat tracking |
| T11: `memory_write` MCP tool | Confidence threshold routing |
| T12: 6-phase testing protocol | |
| T13: Ollama client (local + cloud routing) | Bearer auth for cloud |
| T14: Two-tier model system | 2 stable, 4 experimental |
| T15: EvaluationHarness + PostgreSQL logging | Full audit trail |
| T16: Ranking by composite score | accuracy/cost/latency weighted |
| T17: ADAS CLI (evolutionary search) | `bun tsx src/lib/adas/cli.ts` |
| T18: HITL promotion workflow | Proposal → human review → approve/reject |
| T19: Safety monitor | Design validation before execution |
| T20: Mutation operators | Prompt, model, strategy mutation |
| T21: Crossover/recombination | Single-point crossover on designs |
| T22: 215 ADAS tests passing | |
| T23: Formal documentation suite | All docs generated |
| T24: Memory Snapshot Cache CLI | `bun run snapshot:build` |
| T25: Session hydration script | `bun run session:hydrate` |

### In Progress

| Task | Priority | Notes |
|------|----------|-------|
| T26: MCP Server ADAS Integration | P0 | Expose ADAS as MCP tools (`adas__run_search`, `adas__get_proposals`, `adas__approve_proposal`) |
| T27: Tool Implementations (replace stubs) | P1 | `web_search`, `file_read`, `file_write`, `code_execute`, `memory_search`, `http_get` |
| T28: Aegis Gate UI in Mission Control | P1 | |
| T29: OpenCode MCP Skill Reduction & Alignment | P1 | Reduce overlapping skills; consolidate to exclusively use `mcp-docker` (Exa, Neo4j, Prisma, Tavily, Notion, Playwright, YouTube Transcripts, Redis, Next.js DevTools, context 7 - keep under 50 tools) |
| T30: MemFS Reflection Layer | P1 | Git-backed markdown files (`~/.roninmemory/agents/`) and private `.md` journaling |

### Backlog

| Task | Priority | Notes |
|------|----------|-------|
| T30: Sandbox Docker Execution (test & configure) | P2 | Docker mode defined but not fully tested |
| T31: Web Dashboard — Search Progress & Proposals | P2 | Real-time leaderboard, approve/reject UI |
| T32: Search Persistence — Resume Interrupted Searches | P2 | Checkpoint to PostgreSQL after each iteration |
| T33: Multi-Model Comparison Benchmark | P3 | Run same domain across all models |
| T34: Prompt Templates Library | P3 | Pre-built prompt templates per domain |
| T35: Evolutionary Diversity Metrics | P3 | Hamming distance, entropy measures |
| T36: A/B Agent Deployment | P4 | Requires MCP integration first |
| T37: Agent Self-Improvement Loop | P4 | Self-modification proposals |
| T38: Smoke test automation for CI/CD | P2 | |
| T39: Operational runbooks | P2 | |

### Dependencies

```
MCP ADAS Integration (T26)
├── Requires: Clean public API in src/lib/adas/index.ts
└── Blocks: A/B Deployment (T36), Self-Improvement (T37)

Tool Implementations (T27)
├── Requires: Sandbox Docker Execution (T30)
└── Blocks: Real tool-calling agents

Sandbox Docker (T30)
└── Requires: Docker socket access configured

Search Persistence (T32)
└── Standalone feature
```

---

## 7. Testing Protocol

### Phase Summary

| Phase | What It Tests | Safe on Live? | Command |
|-------|---------------|---------------|---------|
| **Phase 0** | Graph discovery via `inspect-graph.cypher` | Always | `docker exec knowledge-neo4j cypher-shell ...` |
| **Phase 1** | Service health — 5 containers | Read-only | `./scripts/health-check.sh` |
| **Phase 2** | Promotion pipeline smoke test | Cleanup included | `./scripts/smoke-test.sh` |
| **Phase 3** | Dual-context query verification | Read-only | `./scripts/test-dual-context.sh` |
| **Phase 4** | ADAS discovery cycle | Requires `--profile adas` | `docker compose --profile adas run --rm adas` |
| **Phase 5** | Heartbeat verification | Read-only | `./scripts/test-heartbeat.sh` |

### Unit Tests

```bash
bun test                                    # All tests (1854+ passing)
bun vitest run src/lib/adas/               # ADAS tests (215)
bun vitest run -t "should build connection" # Single test by name
```

### Common Failure Modes

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| `Connection refused` on Neo4j | Container not started | `docker compose up -d neo4j` |
| `Authentication failure` | Wrong NEO4J_PASSWORD | Check `.env` file |
| Phase 2: `promoted` never true | Curator not running | Check `docker logs knowledge-curator` |
| Phase 2: `neo4j_written` false | Phase 1 failed | Check Neo4j connection |
| Phase 4: Sandbox timeout | Resource limits too tight | Increase memory limit in compose |

---

## 8. Operational Workflows

### Admin Quick Start

1. Clone repo, `cp .env.example .env`, fill required values
2. `docker compose up --build -d`
3. **Existing graph:** Run `scripts/inspect-graph.cypher` (read-only Phase 0)
4. **Fresh install:** Run `neo4j/init/seed.cypher`
5. `bash verify.sh` — confirm all 5 services healthy
6. `docker compose --profile adas run --rm adas` — first ADAS cycle
7. Monitor Curator logs for first promotion
8. Review promoted insight in Notion → Aegis sign-off

### Memory Snapshot Workflow

Build a deterministic doc snapshot and hydrate session context:

```bash
# Build snapshot
bun run snapshot:build \
  --source docs/roninmemory \
  --source docs/Carlos_plan_framework \
  --output memory-bank \
  --group-id roninmemory \
  --max-summary-chars 600

# Hydrate session
GROUP_ID=roninmemory bun run session:hydrate \
  --snapshot memory-bank/index.json \
  --metadata memory-bank/index.meta.json \
  --concurrency 4 \
  --dry-run

# Quick bootstrap (build + hydrate in one step)
bun run session:bootstrap [--group-id roninmemory] [--dry-run]
```

**Key flags:**

| Flag | Purpose |
|------|---------|
| `--max-summary-chars` | Summary truncation limit per document |
| `--priority-override <pattern>` | Force rebuild of matching entries |
| `--concurrency <n>` | Concurrent hydration workers |
| `--dry-run` | Preview without writing |
| `--no-incremental` | Force full rebuild |
| `--skip-snapshot` | Skip build step in bootstrap |

### ADAS CLI

```bash
bun tsx src/lib/adas/cli.ts --domain math --iterations 5 --population 5
```

**Options:** `--domain`, `--iterations`, `--population`, `--elite-count`, `--model-tier` (`stable`|`experimental`|`all`)

### Execution Rules

- **Promotion eligibility:** `fitness_score >= 0.7` AND `status = 'succeeded'` AND `promoted = false`
- **Phase 1 fail** → retry on next Curator poll (15 min interval)
- **Phase 2 fail** → compensating `DETACH DELETE`; queue entry left for retry
- **Notion fail** → non-fatal; logged; backfilled on next cycle
- **Curator retries:** up to `attempt_count = 4` (5th permanently skipped)
- **Mutation rules:** prompt mutation (char-level), model mutation (within tier), strategy mutation (random from `cot`/`react`/`plan-and-execute`/`reflexion`)
- **Crossover:** single-point on `systemPrompt`, inherit model from parent 1, strategy from parent 2

### Global Constraints

- **Docker-only:** All services MUST run inside Docker
- **Immutable nodes:** Neo4j nodes MUST NOT be mutated; all updates create `:SUPERSEDES` edges
- **2-phase ordering:** `promoted = true` MUST NOT be set before `neo4j_written = true`
- **Tenant isolation:** All queries MUST scope by `groupId`; cross-tenant access prohibited
- **Aegis gate:** ADAS-promoted designs MUST NOT spawn live agents without human sign-off
- **No autonomous promotion:** Agent designs MUST NOT self-promote
- **Weight normalization:** `accuracyWeight + costWeight + latencyWeight` MUST sum to 1.0
- **Unique run IDs:** Each EvaluationHarness MUST generate unique `runId`
- **Inspect before seed:** `inspect-graph.cypher` MUST run before `seed.cypher` on any live graph

### API Surface

roninmemory has no external REST API. All integration is via:

| Method | Channel | Used By |
|--------|---------|---------|
| `before_prompt_build` hook | OpenClaw plugin | Context load on session start |
| `after_tool_call` hook | OpenClaw plugin | Heartbeat + cost tracking |
| `memory_write` tool | OpenClaw MCP tool | Agent-initiated graph writes |
| ADAS CLI | Terminal | Standalone evolutionary search |
| Bolt (port 7687) | Neo4j driver | Curator, context-loader |
| Postgres TCP | pg client | Curator, ADAS, heartbeat hook |
| Notion REST API | HTTPS | Curator mirror |
| Mission Control | OpenClaw internal | Agent spawn, Aegis gate |

### Logging & Audit

| What | Where | Notes |
|------|-------|-------|
| ADAS runs | `adas_runs` | Immutable after insert |
| ADAS trace events | `adas_trace_events` | Per-event JSON payload |
| Promotion proposals | `adas_promotion_proposals` | Human decisions |
| Promotion events | `curator_queue` | `resolved_at` = Phase 2 timestamp |
| Notion sync | `notion_sync_log` | Drift via `v_sync_drift` |
| Agent heartbeats | `agents.last_heartbeat` | Updated every tool call |
| Agent cost | `agents.token_cost_usd` | Cumulative |

**Redacted fields** — must never appear in logs:
`ANTHROPIC_API_KEY`, `NEO4J_PASSWORD`, `POSTGRES_PASSWORD`, `NOTION_API_KEY`, `OPENAI_API_KEY`, `OLLAMA_API_KEY`

---

## 9. References

### Project Documents

- [`AI-GUIDELINES.md`](../../AI-GUIDELINES.md) — Documentation standards and AI policy
- [`AGENTS.md`](../../AGENTS.md) — Coding standards, build commands, TypeScript rules
- [`README.md`](../../README.md) — Quick start, usage, tech stack
- [`templates/PROJECT.template.md`](../../templates/PROJECT.template.md) — Document template
- [`archive/bmad-output/`](../../archive/bmad-output/) — Historical planning artifacts (6 epics, 1854+ tests)

### Source Code

- `src/lib/adas/` — ADAS runtime (search-loop, evaluation-harness, mutations, sandbox, promotion)
- `src/lib/ollama/client.ts` — Ollama HTTP client
- `src/lib/postgres/` — PostgreSQL client (Layer 1)
- `src/lib/neo4j/` — Neo4j client (Layer 2)
- `src/mcp/` — MCP server (30+ tools)
- `src/curator/` — Knowledge promotion pipeline
- `scripts/build-memory-snapshot.ts` — Snapshot CLI
- `scripts/hydrate-session-from-snapshot.ts` — Session hydration

### External Resources

- [Ollama API docs](https://docs.ollama.com/api/)
- [OpenClaw / Agent-Zero docs](https://agent-zero.ai/p/docs)
- [Neo4j Cypher Manual](https://neo4j.com/docs/cypher-manual/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Notion API Reference](https://developers.notion.com/)

---

*Last updated: April 2026 — consolidated from docs/roninmemory/, docs/Carlos_plan_framework/, docs/superpowers/, and memory-bank/*
