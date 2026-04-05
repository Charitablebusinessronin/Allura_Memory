# ADAS Risks & Decisions Matrix

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model (Claude).
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.

---

## Table of Contents

- [1. Architectural Decisions](#1-architectural-decisions)
- [2. Risks](#2-risks)

---

## 1. Architectural Decisions

---

### AD-01: Two-tier model selection (stable vs experimental)

| Field | Detail |
|-------|--------|
| **Status** | Decided |
| **Decision** | Models are partitioned into `stable` and `experimental` tiers. Stable models are used for baseline comparisons; experimental models are opt-in per search. |
| **Rationale** | Stable models provide reproducible results for benchmarking. Experimental models allow trying new models without polluting baseline comparisons. |
| **Alternatives considered** | Single-tier (all models equal) — rejected because it makes longitudinal comparison impossible. Dynamic discovery — rejected because it introduces non-determinism. |
| **Consequences** | Users must explicitly opt into experimental models. CLI flag `--model-tier` controls selection. |
| **Owner** | ADAS team |
| **References** | [BLUEPRINT.md](BLUEPRINT.md) §1 `ModelConfig` |

---

### AD-02: Ollama cloud vs local routing by model name suffix

| Field | Detail |
|-------|--------|
| **Status** | Decided |
| **Decision** | Models with `:cloud` suffix route to `OLLAMA_CLOUD_URL` (`https://ollama.com`) with Bearer auth. All other models route to `OLLAMA_BASE_URL` (`http://localhost:11434`) without auth. |
| **Rationale** | Local models are faster and free; cloud models provide access to larger models when local GPU is insufficient. Auth is only needed for cloud. |
| **Alternatives considered** | Config flag per model — rejected (error-prone). Environment variable per model — rejected (complex). |
| **Consequences** | User must append `:cloud` to model ID to use cloud. Local models must NOT have this suffix. |
| **Owner** | ADAS team |
| **References** | [BLUEPRINT.md](BLUEPRINT.md) §7 `OLLAMA_BASE_URL`, `OLLAMA_CLOUD_URL` |

---

### AD-03: HITL governance for agent promotion

| Field | Detail |
|-------|--------|
| **Status** | Decided |
| **Decision** | No agent design may be promoted to active status without human review. A `PromotionProposal` is generated when composite score >= threshold, and a human must explicitly approve. |
| **Rationale** | Autonomous agent promotion risks unchecked behavior in production. HITL provides a human sanity check. |
| **Alternatives considered** | Fully autonomous promotion (score-based auto-promote) — rejected (safety). All proposals reviewed by default — rejected (friction for low-risk changes). |
| **Consequences** | Search results include proposals pending review. Human reviewer must be available. |
| **Owner** | ADAS team |
| **References** | [BLUEPRINT.md](BLUEPRINT.md) §1 `PromotionProposal` |

---

### AD-04: PostgreSQL for all evaluation state

| Field | Detail |
|-------|--------|
| **Status** | Decided |
| **Decision** | All ADAS state — runs, trace events, proposals — persists to PostgreSQL. Neo4j is used for agent memory graph (future). |
| **Rationale** | PostgreSQL provides ACID guarantees, relational querying, and existing infrastructure in the memory project. |
| **Alternatives considered** | In-memory only — rejected (no persistence across restarts). JSON files — rejected (no querying). Neo4j for everything — rejected (overkill for run metadata). |
| **Consequences** | PostgreSQL must be running for ADAS to function. Connection via `POSTGRES_HOST`/`POSTGRES_PORT` env vars. |
| **Owner** | Memory project team |
| **References** | [BLUEPRINT.md](BLUEPRINT.md) §5 `adas_runs`, `adas_trace_events` |

---

### AD-05: Single-harness-per-evaluation to avoid run ID collision

| Field | Detail |
|-------|--------|
| **Status** | Decided |
| **Decision** | Each evaluation creates a fresh `EvaluationHarness` instance with a unique `runId` (UUID). Harness instances are NOT reused across evaluations. |
| **Rationale** | PostgreSQL has a unique constraint on `adas_runs.run_id`. Reusing harness instances caused duplicate key errors when running multiple evaluations in parallel. |
| **Alternatives considered** | UUID pre-generation + reuse — rejected (complex). Unique constraint removal — rejected (audit integrity). |
| **Consequences** | CLI creates harness per candidate in the loop. Parallel evaluation requires one harness per candidate. |
| **Owner** | ADAS team |
| **References** | [BLUEPRINT.md](BLUEPRINT.md) §6 `runId` uniqueness |

---

## 2. Risks

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| [RK-01](#rk-01-ollama-api-errors) | Ollama API errors causing evaluation failures | Medium | 🔴 Open |
| [RK-02](#rk-02-sandbox-escape) | Sandbox escape — agent code breaks containment | High | 🔴 Open |
| [RK-03](#rk-03-promotion-threshold-gaming) | Candidate gaming promotion threshold | Medium | 🔴 Open |
| [RK-04](#rk-04-model-tier-poisoning) | Experimental model degrades search quality | Low | 🔴 Open |

---

### RK-01: Ollama API errors

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Likelihood** | Medium |
| **Status** | 🔴 Open |
| **Description** | Ollama API calls may fail due to network issues, model unavailability, or rate limits. Failed evaluations produce no metrics, degrading search quality. |
| **Mitigation** | `EvaluationHarness` catches errors, logs `evaluation_failed` event, returns `accuracy=0, cost=0`. CLI shows warning. Retry logic not yet implemented. |
| **Owner** | ADAS team |
| **Related decision** | AD-04 |

---

### RK-02: Sandbox escape

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Likelihood** | Low |
| **Status** | 🔴 Open |
| **Description** | Malicious or buggy agent code escapes the sandbox (process resource limits or docker container isolation) and gains unintended access to the host system. |
| **Mitigation** | Docker mode uses read-only filesystem, no network, limited CPU/memory. Process mode uses Node.js `child_process` with explicit resource limits. SafetyMonitor validates tool definitions before execution. |
| **Owner** | ADAS team |
| **Related decision** | AD-03 |

---

### RK-03: Promotion threshold gaming

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Likelihood** | Low |
| **Status** | 🔴 Open |
| **Description** | An agent design is crafted to pass ground-truth test cases (high accuracy) without genuinely solving the domain problem — e.g., hard-coded outputs that match test cases but fail on real inputs. |
| **Mitigation** | Human reviewer evaluates design quality and real-world generalizability. Ground-truth cases should be diverse and non-trivial. Future: adversarial test cases. |
| **Owner** | ADAS team |
| **Related decision** | AD-03 |

---

### RK-04: Model tier poisoning

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Likelihood** | Low |
| **Status** | 🔴 Open |
| **Description** | An experimental model with poor quality drags down evolutionary search — mutations based on bad parent models produce consistently worse children. |
| **Mitigation** | Experimental models are opt-in. Stable models serve as anchors. Search can use `all` tier but defaults to `stable`. |
| **Owner** | ADAS team |
| **Related decision** | AD-01 |

---

**See also:**
- [BLUEPRINT.md](BLUEPRINT.md) — system design
- [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md) — requirement traceability
