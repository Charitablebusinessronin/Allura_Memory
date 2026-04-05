# Risks & Decisions Matrix: Allura Memory (roninmemory)

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has been reviewed against `_bmad-output/planning-artifacts/architectural-decisions.md` canon.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

This document captures the 16 architectural decisions and 10 risks that shape Allura Memory's design, the rationale behind each, the alternatives considered, and the risks they introduce.

---

## Table of Contents

- [1. Architectural Decisions](#1-architectural-decisions)
- [2. Risks](#2-risks)

---

## 1. Architectural Decisions

| ID | Title | Status |
|----|-------|--------|
| [AD-01](#ad-01) | 2-phase commit for Neo4j + Postgres promotion | ✅ Decided |
| [AD-02](#ad-02) | Immutable Neo4j nodes with `SUPERSEDES` chain | ✅ Decided |
| [AD-03](#ad-03) | Trigger-based auto-enqueue at DB level | ✅ Decided |
| [AD-04](#ad-04) | Notion mirror is async and non-fatal | ✅ Decided |
| [AD-05](#ad-05) | DinD sandbox with `--network=none` | ✅ Decided |
| [AD-06](#ad-06) | Docker-only execution | ✅ Decided |
| [AD-07](#ad-07) | Two-tier model selection (stable vs experimental) | ✅ Decided |
| [AD-08](#ad-08) | Ollama cloud vs local routing by `:cloud` suffix | ✅ Decided |
| [AD-09](#ad-09) | HITL governance for agent promotion | ✅ Decided |
| [AD-10](#ad-10) | PostgreSQL for all ADAS evaluation state | ✅ Decided |
| [AD-11](#ad-11) | Single-harness-per-evaluation (unique `runId`) | ✅ Decided |
| [AD-12](#ad-12) | Exclusive use of Bun over npm | ✅ Decided |
| [AD-13](#ad-13) | MemFS self-editing layers | ✅ Decided |
| [AD-14](#ad-14) | Brooks-bound orchestrator with canonical agents | ✅ Decided |
| [AD-15](#ad-15) | Single-tier tenant isolation via `allura-*` `group_id` | ✅ Decided |
| [AD-16](#ad-16) | Dual logging policy (PostgreSQL + Neo4j) | ✅ Decided |

---

### AD-01: 2-Phase Commit for Promotion

| Field | Detail |
|-------|--------|
| **Status** | ✅ Decided |
| **Decision** | Use a 2-phase commit for all Curator promotions from PostgreSQL to Neo4j. Phase 1 writes the Neo4j node; Phase 2 sets `promoted = true` in PostgreSQL. |
| **Rationale** | Ensures atomicity across two transactional systems with no native distributed transaction support. A compensating `DETACH DELETE` handles Phase 1 success / Phase 2 failure. |
| **Alternatives considered** | Single-phase write: rejected — no rollback path on partial failure. Saga with event queue: rejected — adds infrastructure complexity with no additional benefit at current scale. |
| **References** | `src/curator/`, [RK-01](#rk-01), [RK-02](#rk-02) |

---

### AD-02: Immutable Neo4j Nodes with SUPERSEDES

| Field | Detail |
|-------|--------|
| **Status** | ✅ Decided |
| **Decision** | Neo4j Insight nodes are never mutated in place. Every update creates a new node version linked to the previous by a `(:new)-[:SUPERSEDES]->(:old)` relationship. The old node is marked `status: superseded`. |
| **Rationale** | Preserves complete audit trail and lineage. Agents can reason about "what was true then" vs "what is true now." Regulator-grade evidence requires immutable history. |
| **Alternatives considered** | In-place UPDATE: rejected — destroys history, breaks audit queries. Soft-delete with `deleted_at`: rejected — requires custom query guards everywhere. |
| **References** | [AD-16](#ad-16), `tenant-memory-boundary-spec.md` §4 |

---

### AD-03: Trigger-Based Auto-Enqueue

| Field | Detail |
|-------|--------|
| **Status** | ✅ Decided |
| **Decision** | Auto-enqueue eligible ADAS runs to `curator_queue` via PostgreSQL trigger `trg_auto_enqueue_curator` — fires when `fitness_score >= 0.7` AND `status = 'succeeded'`. |
| **Rationale** | Guarantees consistency without application-layer polling. Curator just polls `v_curator_pending` — no risk of missed enqueues if the application crashes between evaluation and enqueue. |
| **Alternatives considered** | Application-level enqueue: rejected — race condition between evaluation completion and enqueue step. |
| **References** | `data-dictionary.md` — `v_curator_pending`, `trg_auto_enqueue_curator` |

---

### AD-04: Notion Mirror is Async and Non-Fatal

| Field | Detail |
|-------|--------|
| **Status** | ✅ Decided |
| **Decision** | Notion mirror operations are async, non-fatal, and non-blocking. Promotion proceeds even if Notion sync fails. Failed syncs are logged to `notion_sync_log` and backfilled on next cycle. |
| **Rationale** | Prevents Notion API rate limits or outages from blocking the core promotion pipeline. Knowledge is already safely in Neo4j. |
| **Alternatives considered** | Synchronous Notion write: rejected — Notion API has rate limits and availability issues that would propagate failures upstream. |
| **References** | `data-dictionary.md` — `notion_sync_log`, [RK-03](#rk-03) |

---

### AD-05: DinD Sandbox with --network=none

| Field | Detail |
|-------|--------|
| **Status** | ✅ Decided |
| **Decision** | ADAS candidate execution runs in a DinD (Docker-in-Docker) sidecar with `--network=none`, `--cap-drop=ALL`, `--memory=256m`, `--read-only`. |
| **Rationale** | Blast radius containment for untrusted, AI-generated code. Completely isolated from host network and filesystem. |
| **Alternatives considered** | Process isolation only: rejected — insufficient for untrusted code execution. VM-per-candidate: rejected — too slow for evolutionary search throughput. |
| **References** | [RK-05](#rk-05) |

---

### AD-06: Docker-Only Execution

| Field | Detail |
|-------|--------|
| **Status** | ✅ Decided |
| **Decision** | All services run in Docker. No local execution except OpenClaw (Ubuntu gateway). |
| **Rationale** | Reproducibility, environment consistency, and blast radius containment. Eliminates "works on my machine" failures across the team. |
| **Alternatives considered** | Local Bun runtime: rejected — environment drift across machines and sessions. |
| **References** | `architectural-brief.md` §VII, `prd-v2.md` §2 |

---

### AD-07: Two-Tier Model Selection

| Field | Detail |
|-------|--------|
| **Status** | ✅ Decided |
| **Decision** | Two-tier model selection: stable models for reproducible ADAS baselines; experimental models opt-in per search run. |
| **Rationale** | Stable models provide anchor baselines for evolutionary search. Experimental models can discover better solutions without corrupting baseline measurements. |
| **Alternatives considered** | Single model tier: rejected — no way to control for model quality drift in search results. |
| **References** | [RK-07](#rk-07), [RK-08](#rk-08) |

---

### AD-08: Ollama Cloud vs Local Routing

| Field | Detail |
|-------|--------|
| **Status** | ✅ Decided |
| **Decision** | Ollama routing is driven by model name suffix: `:cloud` suffix routes to `OLLAMA_CLOUD_URL` with Bearer auth; no suffix routes to `OLLAMA_BASE_URL` (local, no auth). |
| **Rationale** | Simple, zero-config routing. Local models are faster and free; cloud for larger models. The suffix makes the routing decision explicit at call sites. |
| **Alternatives considered** | Separate client instances: rejected — more config burden per call site. Environment variable per call: rejected — too verbose. |
| **References** | F24, F25 |

---

### AD-09: HITL Governance for Agent Promotion

| Field | Detail |
|-------|--------|
| **Status** | ✅ Decided |
| **Decision** | No agent design can be promoted to active status without explicit human Aegis sign-off. Promotion proposals are queued in Notion for human review before any design becomes live. |
| **Rationale** | Prevents autonomous agent self-modification without human oversight. Core governance invariant of Allura Agent-OS. |
| **Alternatives considered** | Fully autonomous promotion above score threshold: rejected — insufficient safety guarantee for behavior-changing promotions. |
| **References** | F21, F22, F23, `tenant-memory-boundary-spec.md` §3 |

---

### AD-10: PostgreSQL for All ADAS Evaluation State

| Field | Detail |
|-------|--------|
| **Status** | ✅ Decided |
| **Decision** | All ADAS evaluation state (runs, trace events, proposals, queue) lives in PostgreSQL. |
| **Rationale** | ACID guarantees, relational querying, existing infrastructure. ADAS state is operational, not semantic — PostgreSQL is the correct store. |
| **Alternatives considered** | Redis for queue: rejected — requires additional infrastructure and loses ACID guarantees. Neo4j for ADAS state: rejected — wrong data model for relational operational state. |
| **References** | [AD-16](#ad-16), `data-dictionary.md` |

---

### AD-11: Single-Harness-Per-Evaluation

| Field | Detail |
|-------|--------|
| **Status** | ✅ Decided |
| **Decision** | Each `EvaluationHarness` instantiation receives a unique `runId` generated before the evaluation starts. |
| **Rationale** | Avoids PostgreSQL unique constraint violations when multiple evaluations run in parallel. Each parallel run has its own isolated audit trail. |
| **Alternatives considered** | Shared run ID per search generation: rejected — causes constraint violations in parallel evaluation. |
| **References** | `data-dictionary.md` — `adas_runs`, `adas_trace_events` |

---

### AD-12: Exclusive Use of Bun Over npm

| Field | Detail |
|-------|--------|
| **Status** | ✅ Decided |
| **Decision** | Bun is the exclusive package manager and runtime. npm and npx are banned. |
| **Rationale** | Eliminates npm supply chain attack vectors (no `postinstall` hooks by default, separate auth). Zero-trust supply chain policy. |
| **Alternatives considered** | npm/yarn: rejected — `postinstall` hooks run arbitrary code during install; supply chain risk. |
| **References** | `AGENTS.md`, `prd-v2.md` §5 |

---

### AD-13: MemFS Self-Editing Layers

| Field | Detail |
|-------|--------|
| **Status** | ✅ Decided |
| **Decision** | MemFS self-editing layers — Git-backed Markdown files for private agent reflection, context, and system configuration. Letta-inspired sleep-time consolidation daemon. |
| **Rationale** | Enables agents to maintain private journals, project traits, and persona rules outside the shared memory graph. Background consolidation escalates worthy insights to Neo4j. |
| **Alternatives considered** | All memory in shared graph only: rejected — no private reflection channel, no sleep-time processing. |
| **References** | F29, F30, `memory-bank/` |

---

### AD-14: Brooks-Bound Orchestrator

| Field | Detail |
|-------|--------|
| **Status** | ✅ Decided |
| **Decision** | Primary orchestrator (`MemoryOrchestrator`) is bound to the Frederick P. Brooks Jr. persona — emphasizing conceptual integrity, plan-and-document discipline, and surgical team specialization via canonical `Memory{Role}` agents. |
| **Rationale** | Ensures system-wide conceptual integrity (per Brooks). Clear delegation contracts prevent generalist agents from accumulating uncontrolled scope. |
| **Alternatives considered** | Flat peer agent model: rejected — no central governance, scope creep risk. Single monolithic agent: rejected — context window limits, no specialization. |
| **References** | `AGENTS.md`, `.opencode/agent/` |

---

### AD-15: Single-Tier Tenant Isolation

| Field | Detail |
|-------|--------|
| **Status** | ✅ Decided |
| **Decision** | Single-tier tenant isolation via `group_id` using the `allura-*` namespace. The old two-tier `organization_id` + `group_id` model is deprecated. |
| **Rationale** | The two-tier model added complexity without benefit at current scale. All workspaces are owned by the same operator. The `allura-*` namespace provides sufficient scoping. |
| **Alternatives considered** | Two-tier `organization_id` + `group_id` (archived): deprecated — unnecessary complexity, drift risk between the two fields. |
| **References** | `source-of-truth.md`, `tenant-memory-boundary-spec.md` §1 |

---

### AD-16: Dual Logging Policy

| Field | Detail |
|-------|--------|
| **Status** | ✅ Decided |
| **Decision** | Dual logging policy: all events and audit data write to PostgreSQL (system of record for the present); promoted insights and patterns write to Neo4j (system of reason). |
| **Rationale** | Complete auditability — raw traces in Postgres, curated knowledge in Neo4j. Separation of concerns: operational noise vs institutional knowledge. Confidence threshold (`>= 0.5`) determines which store receives a write. |
| **Alternatives considered** | Single-store (Postgres only): rejected — no semantic graph for reasoning. Single-store (Neo4j only): rejected — no ACID audit trail for raw events. |
| **References** | `architectural-brief.md` §III, `data-dictionary.md` |

---

## 2. Risks

| ID | Title | Severity | Likelihood | Status |
|----|-------|----------|------------|--------|
| [RK-01](#rk-01) | Phase 2 failure creates orphaned Neo4j node | Low | Low | ✅ Mitigated |
| [RK-02](#rk-02) | Curator crash leaves queue entry unresolved | Low | Low | ✅ Mitigated |
| [RK-03](#rk-03) | Notion API rate limits throttle mirror | Medium | Medium | ✅ Mitigated |
| [RK-04](#rk-04) | Cross-tenant data leakage via missing `group_id` | High | Medium | 🔴 Open — ARCH-001 |
| [RK-05](#rk-05) | DinD sandbox escape via kernel exploit | High | Low | ✅ Mitigated |
| [RK-06](#rk-06) | Ollama API errors causing evaluation failures | Medium | Medium | ✅ Mitigated |
| [RK-07](#rk-07) | Promotion threshold gaming (hard-coded outputs) | Medium | Low | ✅ Mitigated |
| [RK-08](#rk-08) | Experimental model degrades search quality | Low | Low | ✅ Mitigated |
| [RK-09](#rk-09) | Agent coordination failure under orchestrator | Medium | Low | ✅ Mitigated |
| [RK-10](#rk-10) | `group_id` confusion in queries | Medium | Medium | 🔴 Open — ARCH-001 |

---

### RK-01: Phase 2 Failure Creates Orphaned Neo4j Node

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Likelihood** | Low |
| **Status** | ✅ Mitigated |
| **Description** | Phase 2 (Postgres `promoted = true`) fails after Phase 1 (Neo4j write) succeeds, leaving an orphaned Neo4j node with no corresponding Postgres record. |
| **Mitigation** | Compensating `DETACH DELETE` in Curator error handler removes the orphaned node. `curator_queue` entry remains for retry. |
| **Related decision** | [AD-01](#ad-01) |

---

### RK-02: Curator Crash Leaves Queue Entry Unresolved

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Likelihood** | Low |
| **Status** | ✅ Mitigated |
| **Description** | Curator process crash leaves a `curator_queue` entry in an unresolved state, blocking that run from promotion indefinitely. |
| **Mitigation** | `attempt_count` limit (max 4) with exponential backoff. Entries exceeding the limit surface for manual intervention. |
| **Related decision** | [AD-01](#ad-01) |

---

### RK-03: Notion API Rate Limits Throttle Mirror

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Likelihood** | Medium |
| **Status** | ✅ Mitigated |
| **Description** | Notion API rate limits or outages throttle or block the Notion mirror step, delaying human review of promoted insights. |
| **Mitigation** | Async queue with exponential backoff. Mirror is non-fatal ([AD-04](#ad-04)) — promotion proceeds regardless. Failed syncs logged to `notion_sync_log` and backfilled. |
| **Related decision** | [AD-04](#ad-04) |

---

### RK-04: Cross-Tenant Data Leakage

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Likelihood** | Medium |
| **Status** | 🔴 Open — blocked on ARCH-001 |
| **Description** | Cross-tenant data leakage if any query omits `group_id` filter. An agent in `allura-faith-meats` could read data belonging to `allura-audits`. |
| **Mitigation** | Schema constraints enforce NOT NULL `group_id`. `groupIdEnforcer.ts` validates format and injects `group_id` on all queries. **ARCH-001 must be fixed before this risk is mitigated.** |
| **Related decision** | [AD-15](#ad-15) |

---

### RK-05: DinD Sandbox Escape

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Likelihood** | Low |
| **Status** | ✅ Mitigated |
| **Description** | ADAS DinD sandbox escape via kernel exploit allows untrusted AI-generated code to access the host system. |
| **Mitigation** | `--cap-drop=ALL`, `--read-only` filesystem, `--network=none`, `--memory=256m` resource limits. Defense-in-depth: even a container escape reaches only the DinD layer, not the host. |
| **Related decision** | [AD-05](#ad-05) |

---

### RK-06: Ollama API Errors

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Likelihood** | Medium |
| **Status** | ✅ Mitigated |
| **Description** | Ollama API errors during candidate evaluation cause ADAS evaluation failures, corrupting fitness scores or halting the search loop. |
| **Mitigation** | Errors caught, logged as `evaluation_failed` event, and return `accuracy=0` to prevent score corruption. Retry logic pending full implementation. |
| **Related decision** | [AD-08](#ad-08) |

---

### RK-07: Promotion Threshold Gaming

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Likelihood** | Low |
| **Status** | ✅ Mitigated |
| **Description** | Promotion threshold gaming — a candidate design hard-codes expected outputs to achieve high fitness scores without genuine capability. |
| **Mitigation** | Human reviewer evaluates quality during Aegis sign-off ([AD-09](#ad-09)). Diverse ground-truth test cases reduce the probability of gaming. |
| **Related decision** | [AD-09](#ad-09) |

---

### RK-08: Experimental Model Degrades Search Quality

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Likelihood** | Low |
| **Status** | ✅ Mitigated |
| **Description** | An experimental model selected for a search run produces degraded, inconsistent results that pollute the ADAS fitness rankings. |
| **Mitigation** | Experimental models are opt-in per run only. Stable models serve as anchors for baseline comparisons. Degraded results stay in Postgres only (not promoted). |
| **Related decision** | [AD-07](#ad-07) |

---

### RK-09: Agent Coordination Failure

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Likelihood** | Low |
| **Status** | ✅ Mitigated |
| **Description** | Agent coordination failure — subagents operating without clear delegation contracts from `MemoryOrchestrator` produce conflicting or duplicated work. |
| **Mitigation** | Brooks persona enforces plan-and-document discipline before execution. Clear delegation contracts via `Memory{Role}` canonical naming. `MemoryOrchestrator` owns all memory operations. |
| **Related decision** | [AD-14](#ad-14) |

---

### RK-10: group_id Confusion in Queries

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Likelihood** | Medium |
| **Status** | 🔴 Open — blocked on ARCH-001 |
| **Description** | `group_id` confusion in queries — agents use wrong tenant key, wrong format, or mix old `roninclaw-*` naming with new `allura-*` naming. |
| **Mitigation** | `groupIdEnforcer.ts` validates format against `allura-{org}` pattern and rejects non-conforming keys. Drift detection in `validate-repo` command. **ARCH-001 must be fixed before this risk is mitigated.** |
| **Related decision** | [AD-15](#ad-15) |

---

**See also:**
- [`BLUEPRINT.md`](./BLUEPRINT.md) — system design this document is based on
- [`_bmad-output/planning-artifacts/architectural-decisions.md`](../../_bmad-output/planning-artifacts/architectural-decisions.md) — canonical AD/RK registry
- [`_bmad-output/implementation-artifacts/ARCH-001-rk01-fix.md`](../../_bmad-output/implementation-artifacts/ARCH-001-rk01-fix.md) — RK-04 / RK-10 fix spec
