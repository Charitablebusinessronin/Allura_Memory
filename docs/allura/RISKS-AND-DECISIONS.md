# Risks and Decisions: Allura

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> When in doubt, defer to the source code, schemas, and team consensus.

---

## Architectural Decisions

| ID | Decision | Status | Rationale |
|----|----------|--------|-----------|
| AD-01 | PostgreSQL for episodic memory | Decided | Append-only, ACID, mature tooling. Audit trail is non-negotiable. |
| AD-02 | Neo4j for semantic memory | Decided | Native graph relationships, SUPERSEDES lineage is idiomatic, semantic search via Cypher. |
| AD-03 | MCP as primary agent interface | Decided | Adopted standard. Works with Claude, GPT-4, any MCP-compatible runtime. No vendor lock-in. |
| AD-04 | `PROMOTION_MODE` env var governs Neo4j writes | Decided | Architectural gate. `soc2` mode requires human approval — enforced in code, not policy. `auto` mode uses score threshold. |
| AD-05 | 5-tool public API surface (`add/search/get/list/delete`) | Decided | mem0 UX parity. Developers see five tools. All internal complexity is hidden. |
| AD-06 | `group_id ~ '^allura-'` CHECK constraint in Postgres | Decided | Tenant isolation at schema level. Cannot be bypassed by application code. |
| AD-07 | No ADAS, Paperclip, curator pipeline, domain workflows | Decided | Essential complexity only. All removed 2026-04-07. Allura is a memory engine — nothing else. |
| AD-08 | Soft-delete only — no hard deletes | Decided | Append-only audit trail. Deletion records are events, not erasures. |
| AD-09 | Neo4j write failure is non-fatal | Decided | Postgres write is the source of truth. Neo4j is a promotion — its failure should degrade gracefully, not fail the operation. |
| AD-10 | RalphLoop for bounded validation tasks only | Decided | RalphLoop is designed for slice-by-slice validation, not full project execution. Bounded by `--max-iterations` flag and timeout guards. Prevents runaway validation loops. |
| AD-11 | Human-in-the-loop gating for validation evidence | Decided | Every RalphLoop slice requires human review before proceeding. Judge reviews all evidence; no automatic progression to next slice without explicit approval. |
| AD-12 | Slice-by-slice approach (no parallel slice definition) | Decided | Sequential slice execution ensures clear causation and evidence trails. Parallel slices would introduce race conditions and obscure failure attribution. |
| AD-13 | Canonical API validation uses bounded RalphLoop slices | Decided | Validate `/api/memory` with bounded, repeatable slices to preserve fast feedback, clear causality, and low architectural risk. |
| AD-14 | PostgreSQL required, Neo4j degradable at runtime | Decided | Canonical memory contract remains available when PostgreSQL is healthy. Neo4j is optional-at-runtime: failures must surface explicit degraded metadata in health and tool responses rather than causing silent partial success or full outage. |
| AD-15 | Unified agent taxonomy (AGENT_MANIFEST as single source of truth) | Decided | Three conflicting agent taxonomies (.opencode/agent/, scripts/agents/, agent-routing.md) unified into AGENT_MANIFEST (src/lib/agents/agent-manifest.ts). Persona names from .opencode/agent/ are canonical. Legacy agents (turing, hopper, etc.) preserved for backward compatibility but not in active manifest. CI routing driven by manifest data via dynamic-router.ts, replacing static bash case statement. |
| AD-16 | Ralph is an installed tool, not a built component | Decided | Ralph (`@th0rgal/ralph-wiggum`) is a CLI tool that wraps any AI coding agent in a self-correcting loop. We install it; we do not implement it. Our `ralph-loop.ts` is a thin harness: resolves the binary, constructs the command with Allura defaults, logs start/end to PostgreSQL, and passes through to the real `ralph` CLI. Previous `github-models` / `GITHUB_TOKEN` references were incorrect and have been removed. What model Ralph's agent uses (OpenCode default, Claude Code, Codex, Copilot) is configured via `--agent` and `--model` flags — not hardcoded. |
| AD-17 | 13-16-18 youth culture UX validation framework | Decided | Marketing principle: 13-year-olds spot emerging trends, 16-year-olds identify popularity gaps, 18-year-olds confirm mainstream readiness. Applied to Allura consumer UI review. Target score: 0.85+. Framework validates emotional resonance, not just functional correctness. |

---

## Decision Detail: Canonical API Validation Approach (merged)

**Context:** The Allura API validation strategy needed a scalable, maintainable approach to ensure contract compliance without slowing development velocity.

**Decision:** Adopted RalphLoop validation slices — atomic, bounded validation tasks that run sequentially with human-in-the-loop gating.

**Alternatives Rejected:**
- **Manual testing**: Too slow, error-prone, doesn't scale with API surface growth
- **Full test suites**: Overwhelming output, hard to diagnose failures, no incremental progress
- **Parallel validation**: Race conditions, unclear causation, difficult to attribute failures

**Consequences:**
- Validation is incremental and observable
- Human judgment gates each slice progression
- Clear audit trail of what was validated and by whom

---

## Risks

| ID | Risk | Impact | Mitigation | Status |
|----|------|--------|------------|--------|
| RK-01 | Neo4j graph bloat from duplicate promotions | Medium | Dedup check before every Neo4j write (`src/lib/dedup/`) | Active |
| RK-02 | Cross-tenant data leakage | High | `group_id` CHECK constraint + scoped queries on every Postgres + Neo4j operation | Mitigated |
| RK-03 | Auto-mode promotes low-quality memories | Medium | Tunable `AUTO_APPROVAL_THRESHOLD`. Score logged for observability. | Active |
| RK-04 | No BYOK — hosted cloud exposes memory data | High | Self-hosted deployment recommended. BYOK planned for future release. | Open |
| RK-05 | MCP server is a single point of failure | Medium | Stateless — restart recovers fully. Postgres + Neo4j are the durable stores. | Accepted |
| RK-06 | Postgres append-only table grows unbounded | Low | `TRACE_RETENTION_DAYS` env var controls retention. TTL cleanup planned. | Active |
| RK-07 | Schema drift between Postgres and Neo4j | High | Sync validation in health check endpoint. Schema version field in both stores. Alert on mismatch. | Active |
| RK-08 | Embedding provider latency spikes | Medium | Circuit breaker pattern + fallback caching. Timeout after 5s. Return cached embeddings on provider failure. | Active |
| RK-09 | Neo4j promotion conflicts (concurrent writes) | High | Optimistic locking via `version` field. Retry on `SUPERSEDES` conflict. Max 3 retries. | Mitigated |
| RK-10 | Validation slice false positives | Medium | Human judge reviews all evidence before approving next slice. No automatic progression without explicit sign-off. | Active |
| RK-11 | RalphLoop runaway (infinite loops) | Medium | `--max-iterations` flag (default: 100) + hard timeout (30 min). Slice counter enforced. Graceful degradation on limit. | Mitigated |

---

## Monitoring & Observability

| Signal | Source | Alert Threshold |
|--------|--------|-----------------|
| Neo4j promotion failures | `src/lib/neo4j/promotion.ts` | > 5 failures in 5 min |
| Embedding latency | Provider response time | p99 > 3s |
| Schema drift detection | Health check endpoint | Version mismatch |
| RalphLoop iterations | Slice counter log | > 80 per session |
| Cross-tenant query attempts | Query middleware | Any occurrence |
| Postgres trace growth | Table size metric | > 100GB |

---

## References

- **Architecture Canon**: `docs/allura/BLUEPRINT.md`
- **Validation Guide**: merged into `docs/allura/SOLUTION-ARCHITECTURE.md` §9 (Validation Topology)
- **Memory System Design**: `memory-bank/systemPatterns.md`
- **Active Context**: `memory-bank/activeContext.md`
