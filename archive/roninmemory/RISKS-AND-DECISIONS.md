# roninmemory Risks & Decisions

> [!NOTE]
> **AI-Assisted Documentation**
> Content has not yet been fully reviewed. This is a working design reference.

This document captures key architectural and design decisions made in the roninmemory service, along with known risks.

---

## 1. Architectural Decisions

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
| AD-12 | Exclusive use of Bun over npm | ✅ Decided | Eliminates CanisterWorm/npm supply chain attack vectors (no postinstall hooks by default, separate auth) |
| AD-13 | MemFS self-editing layers | ✅ Decided | Enables Letta-inspired reflection, background consolidation, and Git-backed private memory journaling |
| AD-14 | Brooks-bound orchestrator with canonical subagents | ✅ Decided | Ensures conceptual integrity (per Fred Brooks), plan-and-document discipline, surgical team specialization |
| AD-15 | Two-tier tenant isolation (organization_id + group_id) | ✅ Decided | Business boundary separation plus project-level memory partitions enable multi-org SaaS deployment |
| AD-16 | Dual logging policy (PostgreSQL + Neo4j) | ✅ Decided | Complete auditability: raw traces in Postgres, curated insights in Neo4j with `:SUPERSEDES` versioning |

---

## 2. Risks

| ID | Risk | Severity | Likelihood | Mitigation |
|----|------|----------|------------|------------|
| RK-01 | Phase 2 failure creates orphaned Neo4j node | Low | Low | Compensating `DETACH DELETE` in Curator error handler |
| RK-02 | Curator crash leaves queue entry unresolved | Low | Low | `attempt_count` limit; manual intervention for stuck entries |
| RK-03 | Notion API rate limits throttle mirror | Medium | Medium | Async queue; exponential backoff; non-fatal failures |
| RK-04 | Cross-tenant data leakage via missing `group_id` filter | High | Medium | Schema constraints; runtime validation; audit queries |
| RK-05 | DinD sandbox escape via kernel exploit | High | Low | `--cap-drop=ALL`, read-only fs, no network, resource limits |
| RK-06 | Ollama API errors causing evaluation failures | Medium | Medium | Catch errors, log `evaluation_failed`, return `accuracy=0`; retry logic pending |
| RK-07 | Promotion threshold gaming (hard-coded outputs) | Medium | Low | Human reviewer evaluates quality; diverse ground-truth test cases |
| RK-08 | Experimental model degrades search quality | Low | Low | Experimental opt-in only; stable models serve as anchors |
| RK-09 | Subagent coordination failure under orchestrator | Medium | Low | Brooks persona enforces plan-and-document; clear delegation contracts via `memory-*` canonical names |
| RK-10 | `organization_id`/`group_id` confusion in queries | Medium | Medium | Schema constraints; enforced dual-scope in all queries; audit logging |
