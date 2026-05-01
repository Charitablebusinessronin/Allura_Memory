# Allura Memory Migration Tracker

> Living document. Update as phases complete.

## Phase Map

| Phase | Scope | Status | Key Deliverables |
|-------|-------|--------|-----------------|
| P1 | Brain readiness | ✅ COMPLETE | HTTP gateway, `/ready` probe, pgvector, Neo4j schema |
| P2 | Skill implementations | ✅ COMPLETE | skill-neo4j-memory, skill-cypher-query, skill-database |
| P2.5 | Real executor wiring | ✅ COMPLETE | McpSkillExecutor, StdioClientTransport, pool |
| P3 | E2E verification + tracing | ✅ COMPLETE | e2e-smoke tests, orchestration-tracing, graceful degradation |
| P4 | Strip old custom MCP | ✅ COMPLETE | Remove session/routing/direct-DB logic from old MCP, update docs |
| P5 | MCP_DOCKER skill runtime | ✅ COMPLETE | Final config, discovery/add workflow |
| P6 | Neo4j Graph Population | ✅ COMPLETE | Agent/Team/Project nodes, Memory seeding, 133 relationships, seed script |
| P7 | Quality Benchmarking | 🔵 PLANNED | Precision/Recall/MRR benchmarks, UX 13-16-18 validation, retrieval quality metrics, competitive scoring |
| P8 | Hardening | 🔵 PLANNED | API schema validation, security audit, load testing, circuit breaker edge cases, error recovery hardening |
| P9 | Polish | 🔵 PLANNED | Dashboard UX refinements, token system WCAG fixes, documentation completeness, operational runbook validation |

## P1 — Brain Readiness ✅

- [x] HTTP gateway (`canonical-http-gateway.ts`)
- [x] `/ready` health probe (PG + Neo4j + MCP init check)
- [x] pgvector extension installed
- [x] `allura_memories` table with `vector(768)`
- [x] RuVector bridge patched (ruvector → vector type casts)
- [x] `memory_add` projects to `allura_memories` with embeddings
- [x] `memory_search` returns results via RuVector hybrid search
- [x] Neo4j graph adapter connected
- [x] Full schema applied (`scripts/neo4j-memory-indexes.cypher`)
- [x] Docker init service (`docker/neo4j-init/00-schema.cypher`)

## P2 — Skill Implementations ✅

- [x] `skill-neo4j-memory` — recall_insight, list_insights
- [x] `skill-cypher-query` — execute_cypher, get_schema_info (read-only guard, tenant scope)
- [x] `skill-database` — execute_sql, insert_trace, query_traces (read-only guard, tenant scope)
- [x] Helper/guardrail tests for each skill
- [x] Team RAM orchestrator contract (`orchestrator.ts`)
- [x] Orchestrator tests (5/5)

## P2.5 — Real Executor Wiring ✅

- [x] `McpSkillExecutor` implements `SkillExecutor`
- [x] `McpClientPool` manages stdio-spawned MCP connections
- [x] `createMcpSkillExecutor()` factory with env passthrough
- [x] Envelope unwrapping (success/failure/isError)
- [x] Connection pooling + lifecycle (destroy)
- [x] Executor tests (13/13)

## P3 — E2E Verification + Tracing ✅

- [x] `e2e-smoke.test.ts` (11/11, gated behind `RUN_E2E_TESTS`)
- [x] Skill selection unit tests
- [x] Live skill dispatch: skill-neo4j-memory, skill-cypher-query, skill-database
- [x] Full orchestration: parallel 3-skill dispatch → context assembly
- [x] Failure handling: simulated DB failure → context.failures
- [x] `orchestration-tracing.ts` (start/dispatch/end)
- [x] `createTracedOrchestrator()` factory
- [x] Graceful degradation (trace failures don't break orchestration)
- [x] Tracing tests (9/9)

## P4 — Strip Old Custom MCP ✅

- [x] Audit old MCP responsibilities vs new skill responsibilities
- [x] No removal of canonical-tools.ts operations needed — skills provide raw DB access, canonical operations provide governed memory operations
- [x] Health/readiness endpoints preserved

## P5 — MCP_DOCKER Skill Runtime ✅

- [x] Dockerfile.mcp updated — skill sources + launch-skill.sh
- [x] .dockerignore fixed — selective exclusion of .opencode
- [x] Docker image rebuilt and containers recreated
- [x] Skills verified inside container (launch-skill.sh)
- [x] Skills registered in OpenClaw MCP config (3 stdio servers)
- [x] Live MCP tool calls verified (recall_insight, get_schema_info, query_traces)
- [x] Health/readiness: PG ✅ Neo4j ✅ MCP ✅

## P6 — Neo4j Graph Population ✅

- [x] 19 Agent nodes seeded (10 RAM + 6 Durham + 3 Governance/Ship)
- [x] 2 Team nodes seeded (RAM, Durham)
- [x] 3 Project nodes seeded (Allura Memory, Agent OS, Creative Studio)
- [x] 35 Memory nodes seeded from Notion (approved knowledge)
- [x] 133 relationships seeded (AUTHORED_BY, RELATES_TO, CONTRIBUTES_TO, MEMBER_OF, DELEGATES_TO, ESCALATES_TO, HANDS_OFF_TO, PROPOSES_TO, APPROVES_PROMOTION)
- [x] Bidirectional traceability: Notion Neo4j ID field ↔ Neo4j notion_id property
- [x] 7 Memory Framework agents deleted (shadow org chart eliminated)
- [x] Seed script: `scripts/neo4j-seed-agents.cypher` (idempotent MERGE)
- [x] Documentation updated: DATA-DICTIONARY, BLUEPRINT, RISKS-AND-DECISIONS, DESIGN-MEMORY-SYSTEM, REQUIREMENTS-MATRIX

## Backlog

- [ ] Backfill 46,714 historical events into allura_memories
- [ ] Qwen3 embedding upgrade (768d→4096d schema migration)
- [ ] Neo4j healthcheck creds mismatch (container unhealthy but cypher-shell works)
- [ ] WhatsApp 499 reconnect loop
- [ ] Memory viewer UI: Agent/Team/Project graph visualization

## P7 — Quality Benchmarking 🔵 PLANNED

**Scope:** FR-1.2, FR-7, FR-8, FR-9.1

- [ ] Precision@5 / Recall@5 / MRR benchmark suite (target: P@5 ≥ 0.85, R@5 ≥ 0.90, MRR ≥ 0.80)
- [ ] Cross-group isolation verification (target: 100%)
- [ ] 13-16-18 UX validation framework scoring (target: ≥ 0.85)
- [ ] Retrieval gateway contract compliance tests (startup validator)
- [ ] Competitive benchmark comparison (mem0, Zep, Anthropic dual-DB)

## P8 — Hardening 🔵 PLANNED

**Scope:** FR-1.3, FR-11, FR-12

- [ ] API schema validation (Zod schemas for all endpoints)
- [ ] Budget enforcer edge cases (concurrent sessions, TTL auto-expiry, reset verification)
- [ ] Circuit breaker failure/recovery scenarios
- [ ] Load testing (k6 or equivalent, target: 100 req/s sustained)
- [ ] Security audit (auth bypass, injection, CORS validation)
- [ ] Error recovery hardening (Neo4j failover, PG connection loss, partial promotion rollback)

## P9 — Polish 🔵 PLANNED

**Scope:** FR-9.2, FR-10

- [ ] Dashboard UX refinements (responsive, accessibility)
- [ ] Token system WCAG contrast fixes (5 failing pairings — RK-18)
- [ ] Documentation completeness audit (all 6 canonical docs current)
- [ ] Operational runbook validation (new team member execution test)
- [ ] Sync contract automation (eliminate manual Graph-Notion sync)
