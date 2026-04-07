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
