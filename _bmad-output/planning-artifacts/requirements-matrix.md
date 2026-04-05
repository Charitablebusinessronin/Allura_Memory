# Requirements Traceability Matrix — roninmemory

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

Promoted from archive `roninmemory/REQUIREMENTS-MATRIX.md`. Updated to Allura v2 naming.

---

## Table of Contents

- [1. Business Requirements](#1-business-requirements)
- [2. Functional Requirements](#2-functional-requirements)
- [3. Epic Coverage Map](#3-epic-coverage-map)

---

## 1. Business Requirements

All 16 business requirements are implemented.

| ID | Requirement | Status |
|----|-------------|--------|
| B1 | Operator can dictate or type daily work logs; agents capture them as structured activities linked to the correct workspace | ✅ Implemented |
| B2 | Every agent session starts with current knowledge loaded automatically — no manual prompt engineering | ✅ Implemented |
| B3 | High-confidence ADAS designs are promoted to Neo4j and mirrored to Notion without manual intervention | ✅ Implemented |
| B4 | All promoted knowledge is traceable back to its raw execution evidence in PostgreSQL | ✅ Implemented |
| B5 | Workspace-specific knowledge takes priority over platform knowledge in every session | ✅ Implemented |
| B6 | No ADAS-discovered design can deploy as a live agent without human Aegis sign-off | ✅ Implemented |
| B7 | The system must never mutate existing Neo4j nodes — all updates create new versioned nodes via `SUPERSEDES` | ✅ Implemented |
| B8 | All services run in Docker — no local execution permitted (except OpenClaw on Ubuntu) | ✅ Implemented |
| B9 | Design AI agents automatically via evolutionary search — generate, evaluate, evolve via mutation/crossover | ✅ Implemented |
| B10 | Use real LLM inference (Ollama) for agent execution — no mocked responses in production | ✅ Implemented |
| B11 | Provide a CLI entry point for standalone ADAS runs | ✅ Implemented |
| B12 | Persist all ADAS evaluation events and proposals to PostgreSQL — full audit trail | ✅ Implemented |
| B13 | Support two-tier model selection — stable for baselines, experimental opt-in | ✅ Implemented |
| B14 | All memory operations governed by `MemoryOrchestrator` (Brooks-bound) | ✅ Implemented |
| B15 | Tenant isolation enforced via `group_id` using `allura-*` namespace — no cross-workspace data leakage | ✅ Implemented |
| B16 | Dual logging policy: PostgreSQL for events/audit, Neo4j for insights/patterns | ✅ Implemented |

---

## 2. Functional Requirements

### Memory Loading (F1–F3)

| ID | Requirement | Traces To | Status |
|----|-------------|-----------|--------|
| F1 | On every agent session start, `before_prompt_build` hook queries Neo4j for `active` insights scoped to session `group_id` PLUS `allura-platform` (global) | B2 | ✅ |
| F2 | Results injected into system prompt; workspace-specific insights appear before platform-wide ones | B2, B5 | ✅ |
| F3 | Agents may call `memory_write` tool; confidence `< 0.5` → Postgres only; confidence `>= 0.5` → Neo4j node + `SUPERSEDES` edge | B3 | ✅ |

### Promotion Pipeline (F4–F8)

| ID | Requirement | Traces To | Status |
|----|-------------|-----------|--------|
| F4 | `adas_runs` rows with `fitness_score >= 0.7` and `status = succeeded` are auto-enqueued by `trg_auto_enqueue_curator` | B3, B4 | ✅ |
| F5 | Curator performs 2-phase commit: Phase 1 writes Neo4j node; Phase 2 sets `promoted = true` in Postgres | B3, B4 | ✅ |
| F6 | If Phase 2 fails after Phase 1 succeeds, a compensating `DETACH DELETE` removes the orphaned Neo4j node | B3 | ✅ |
| F7 | Curator mirrors insights with `confidence >= 0.7` to Notion Master Knowledge Base (async, non-fatal) | B3 | ✅ |
| F8 | `trg_promotion_guard` at DB level enforces `neo4j_written = true` before `promoted = true` is accepted | B4, B7 | ✅ |

### Multi-Tenancy (F9–F10)

| ID | Requirement | Traces To | Status |
|----|-------------|-----------|--------|
| F9 | Every Postgres row and Neo4j node carries `group_id` (snake_case, `allura-*` namespace, consistent across all systems) | B5, B8, B15 | ✅ |
| F10 | All queries are scoped by `group_id`; cross-tenant access is prohibited except via explicit `AccessGrant` or platform promotion | B5, B8, B15 | ✅ |

### ADAS Discovery (F11–F13)

| ID | Requirement | Traces To | Status |
|----|-------------|-----------|--------|
| F11 | ADAS meta-agent generates candidate designs; SearchLoop drives evolutionary search over AgentDesign space | B3, B9 | ✅ |
| F12 | Each candidate runs in a sandbox: process mode with resource limits, or DinD with `--network=none`, `--cap-drop=ALL`, `--memory=256m`, `--read-only` | B8 | ✅ |
| F13 | `fitness = accuracyWeight * accuracy + costWeight * normCost + latencyWeight * normLatency`, range 0.0–1.0, written to `adas_runs` | B3, B12 | ✅ |

### ADAS Agent Design (F14–F16)

| ID | Requirement | Traces To | Status |
|----|-------------|-----------|--------|
| F14 | Generate random `AgentDesign` from a `SearchSpace` — random model, strategy, and prompt | B9 | ✅ |
| F15 | Mutate an `AgentDesign` — change prompt, swap model (within tier), change reasoning strategy | B9 | ✅ |
| F16 | Crossover two `AgentDesign` instances — combine configs to produce a child design | B9 | ✅ |

### ADAS Evaluation (F17–F20)

| ID | Requirement | Traces To | Status |
|----|-------------|-----------|--------|
| F17 | Evaluate candidate against `DomainConfig` ground truth — run forward function, compare output to expected | B9 | ✅ |
| F18 | Log every evaluation event to PostgreSQL (`adas_trace_events` table) | B12 | ✅ |
| F19 | Rank candidates by composite score — descending order | B9 | ✅ |
| F20 | Support configurable population size, elite count, mutation rate, crossover rate, early stopping at `successThreshold` | B9, B11 | ✅ |

### ADAS Governance (F21–F23)

| ID | Requirement | Traces To | Status |
|----|-------------|-----------|--------|
| F21 | Generate `PromotionProposal` when candidate score `>= 0.85` (promotion threshold) | B6 | ✅ |
| F22 | Human reviewer approves/rejects/modifies proposal via Notion Aegis gate | B6 | ✅ |
| F23 | Only `approved` designs may be promoted to active agent status | B6 | ✅ |

### Ollama Integration (F24–F26)

| ID | Requirement | Traces To | Status |
|----|-------------|-----------|--------|
| F24 | Route cloud models (`:cloud` suffix) to `OLLAMA_CLOUD_URL` with Bearer auth | B10 | ✅ |
| F25 | Route local models to `OLLAMA_BASE_URL` (default `http://localhost:11434`) without auth | B10 | ✅ |
| F26 | Track token usage and latency per Ollama call | B12 | ✅ |

### Observability (F27–F28)

| ID | Requirement | Traces To | Status |
|----|-------------|-----------|--------|
| F27 | `after_tool_call` hook upserts agent heartbeat, cumulative `token_cost_usd`, and task counters to `agents` table | B1, B2 | ✅ |
| F28 | Anonymous sessions write raw traces to `adas_runs` for Curator candidate discovery | B3 | ✅ |

### MemFS & Reflection — Letta-Inspired (F29–F30)

| ID | Requirement | Traces To | Status |
|----|-------------|-----------|--------|
| F29 | System provides Git-backed Markdown files for private session reflection, context, and system configuration logic | B2 | ⏳ Not Started |
| F30 | Non-blocking sleep-time daemon consolidates private agent insights and escalates them to the persistent graph | B5 | ⏳ Not Started |

### Orchestrator Governance (F31–F33)

| ID | Requirement | Traces To | Status |
|----|-------------|-----------|--------|
| F31 | All memory operations must be initiated by `MemoryOrchestrator` (Brooks-bound) | B14 | ✅ |
| F32 | Agent delegation uses canonical `Memory{Role}` naming convention | B14 | ✅ |
| F33 | Dual logging policy enforced: events/audit to PostgreSQL, insights/patterns to Neo4j | B16 | ✅ |

---

## 3. Epic Coverage Map

| Epic | Scope | Functional Requirements |
|------|-------|-------------------------|
| Epic 1 | Persistent Knowledge Capture and Tenant-Aware Memory | F1–F10, F29–F30 |
| Epic 2 | Multi-Organization Plugin Architecture | F31–F33 |
| Epic 3 | Human-in-the-Loop Governance | F21–F23 |
| Epic 4 | Cross-Organization Knowledge Sharing | F9–F10 (cross-org extension) |
| Epic 5 | Regulator-Grade Audit Trail | F4–F8, F18 |
| Epic 6 | Production Workflows | B1, B2, B5 |

### ADAS Coverage

ADAS requirements (F11–F28) span Epics 1 and 3 — the meta-agent loop feeds both the memory foundation and the governance pipeline.

---

## See Also

- [`_bmad-output/planning-artifacts/epics.md`](./epics.md) — epic and story definitions
- [`_bmad-output/planning-artifacts/prd-v2.md`](./prd-v2.md) — product requirements
- [`_bmad-output/planning-artifacts/architectural-decisions.md`](./architectural-decisions.md) — decision rationale
- [`_bmad-output/implementation-artifacts/data-dictionary.md`](..implementation-artifacts/data-dictionary.md) — schema definitions
