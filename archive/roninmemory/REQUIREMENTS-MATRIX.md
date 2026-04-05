# roninmemory Requirements Matrix

> [!NOTE]
> **AI-Assisted Documentation**
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.

This matrix traces every Business Requirement and Functional Requirement across the roninmemory design documentation.

---

## 1. Business Requirements

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
| B10 | Use real LLM inference (Ollama) for agent execution — no mocked responses in production | ✅ Implemented |
| B11 | Provide a CLI entry point for standalone ADAS runs | ✅ Implemented |
| B12 | Persist all ADAS evaluation events and proposals to PostgreSQL — full audit trail | ✅ Implemented |
| B13 | Support two-tier model selection — stable for baselines, experimental opt-in | ✅ Implemented |
| B14 | All memory operations governed by Brooks-bound orchestrator (`memory-orchestrator`) | ✅ Implemented |
| B15 | Tenant isolation enforced at two levels: `organization_id` (business) and `group_id` (memory partition) | ✅ Implemented |
| B16 | Dual logging policy: PostgreSQL for events/audit, Neo4j for insights/patterns | ✅ Implemented |

---

## 2. Functional Requirements

### Memory Loading (F1–F3)
| ID | Requirement | Traces To |
|----|-------------|-----------|
| F1 | On every OpenClaw session start, `before_prompt_build` hook queries Neo4j for `active` insights scoped to session `group_id` PLUS `global-coding-skills` | B2 |
| F2 | Results injected into system prompt; tenant-specific insights appear before global ones | B2, B5 |
| F3 | Agents may call `memory_write` tool; confidence < 0.5 → Postgres only; confidence ≥ 0.5 → Neo4j node + `:SUPERSEDES` edge | B3 |

### Promotion Pipeline (F4–F8)
| ID | Requirement | Traces To |
|----|-------------|-----------|
| F4 | `adas_runs` rows with `fitness_score >= 0.7` and `status = succeeded` are auto-enqueued by `trg_auto_enqueue_curator` | B3, B4 |
| F5 | Curator performs 2-phase commit: Phase 1 writes Neo4j node; Phase 2 sets `promoted = true` in Postgres | B3, B4 |
| F6 | If Phase 2 fails after Phase 1 succeeds, a compensating `DETACH DELETE` removes the orphaned Neo4j node | B3 |
| F7 | Curator mirrors insights with `confidence >= 0.7` to Notion Master Knowledge Base (async, non-fatal) | B3 |
| F8 | `trg_promotion_guard` at DB level enforces `neo4j_written = true` before `promoted = true` is accepted | B4, B7 |

### Multi-Tenancy (F9–F10)
| ID | Requirement | Traces To |
|----|-------------|-----------|
| F9 | Every Postgres row carries `organization_id` and `group_id`; every Neo4j node carries both properties (consistent snake_case naming) | B5, B8, B15 |
| F10 | All queries are scoped by both `organization_id` and `group_id`; cross-tenant access is prohibited | B5, B8, B15 |

### Orchestrator Governance (F31–F33)
| ID | Requirement | Traces To |
|----|-------------|-----------|
| F31 | All memory operations must be initiated by `memory-orchestrator` (Brooks-bound) | B14 |
| F32 | Subagent delegation uses canonical `memory-*` naming convention | B14 |
| F33 | Dual logging policy enforced: events/audit to PostgreSQL, insights/patterns to Neo4j | B16 |

### ADAS Discovery (F11–F13)
| ID | Requirement | Traces To |
|----|-------------|-----------|
| F11 | ADAS meta-agent generates candidate designs; SearchLoop drives evolutionary search over AgentDesign space | B3, B9 |
| F12 | Each candidate runs in a sandbox: process mode with resource limits, or Docker mode with `--network=none`, `--cap-drop=ALL`, `--memory=256m`, `--read-only` | B8 |
| F13 | Fitness = `accuracyWeight * accuracy + costWeight * normCost + latencyWeight * normLatency`, range 0.0–1.0, written to `adas_runs` | B3, B12 |

### ADAS Agent Design (F14–F16)
| ID | Requirement | Traces To |
|----|-------------|-----------|
| F14 | Generate random `AgentDesign` from a `SearchSpace` — random model, strategy, and prompt | B9 |
| F15 | Mutate an `AgentDesign` — change prompt, swap model (within tier), change reasoning strategy | B9 |
| F16 | Crossover two `AgentDesign` instances — combine configs to produce a child design | B9 |

### ADAS Evaluation (F17–F20)
| ID | Requirement | Traces To |
|----|-------------|-----------|
| F17 | Evaluate candidate against `DomainConfig` ground truth — run forward function, compare output to expected | B9 |
| F18 | Log every evaluation event to PostgreSQL (`adas_trace_events` table) | B12 |
| F19 | Rank candidates by composite score — descending order | B9 |
| F20 | Support configurable population size, elite count, mutation rate, crossover rate, early stopping at `successThreshold` | B9, B11 |

### ADAS Governance (F21–F23)
| ID | Requirement | Traces To |
|----|-------------|-----------|
| F21 | Generate `PromotionProposal` when candidate score >= promotion threshold (default 0.85) | B6 |
| F22 | Human reviewer approves/rejects/modifies proposal | B6 |
| F23 | Only `approved` designs may be promoted to active agent status | B6 |

### Ollama Integration (F24–F26)
| ID | Requirement | Traces To |
|----|-------------|-----------|
| F24 | Route cloud models (`:cloud` suffix) to `OLLAMA_CLOUD_URL` with Bearer auth | B10 |
| F25 | Route local models to `OLLAMA_BASE_URL` (default `http://localhost:11434`) without auth | B10 |
| F26 | Track token usage and latency per Ollama call | B12 |

### Observability (F27–F28)
| ID | Requirement | Traces To |
|----|-------------|-----------|
| F27 | `after_tool_call` hook upserts agent heartbeat, cumulative `token_cost_usd`, and task counters to `agents` table | B1, B2 |
| F28 | Anonymous sessions write raw traces to `adas_runs` for Curator candidate discovery | B3 |

### MemFS & Reflection (Letta-Inspired) (F29–F30)

**Status:** Not Started (pending MemFS implementation).

| ID | Requirement | Traces To |
|----|-------------|-----------|
| F29 | System provides git-backed Markdown files for private session reflection, context, and system configuration logic | B2 |
| F30 | Non-blocking sleep-time daemon consolidates private agent insights and escalates them to the persistent graph | B5 |

---

## 3. Epic Coverage Map

| Epic | Scope | Functional Requirements |
|------|-------|-------------------------|
| Epic 1 | Dual-store persistent memory foundations (tenant isolation + immutable versioning) | Core memory foundation requirements |
| Epic 2 | Automated promotion + curation pipeline | F4–F8 |
| Epic 3 | Snapshot caching + hydration performance | Session hydration performance requirements |
| Epic 4 | Operational observability + reflection memory | F27–F30 |

> **Traceability note:** `epics/epics.md` uses Epic-local aliases `FR10–FR13` for Epic 4 planning readability. These map 1:1 to canonical `F27–F30`.

### Epic Documents

- `docs/roninmemory/epics/epics.md`
- `docs/roninmemory/epics/epic-1-dual-store-memory.md`
- `docs/roninmemory/epics/epic-2-knowledge-curation.md`
- `docs/roninmemory/epics/epic-3-session-hydration.md`
- `docs/roninmemory/epics/epic-4-operational-memory-observability-reflection.md`

> **Note:** `docs/roninmemory/epics/` contains the four canonical memory epics. `_bmad-output/implementation-artifacts/epics-openagents-control-registry.md` is a separate implementation artifact for the OpenAgents Control Registry and should not be conflated with the core epic set.
