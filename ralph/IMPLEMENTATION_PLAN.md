# S7 Implementation Plan — Allura Memory Stabilization

**Sprint:** S7-allura-memory-stabilization  
**Created:** 2026-04-19  
**Status:** IN PROGRESS

## P0 Tasks (MUST complete first)

- [x] **S7-8**: Fix MODEL_REGISTRY provider prefixes
  - Files: `.claude/docs/MODEL_REGISTRY.md` (actual canonical registry in repo)
  - Fix: `ollama-cloud/gpt-5.4` → `openai/gpt-5.4`, `ollama-cloud/gpt-5.4-mini` → `openai/gpt-5.4-mini`
  - Fix: Cross-runtime registry entries now match current provider prefixes used by `.opencode/agent/*.md` frontmatter
  - Acceptance: `grep 'ollama-cloud/gpt-5\.4\|ollama-cloud/gpt-5\.4-mini' .claude/docs/MODEL_REGISTRY.md` returns zero matches

- [x] **S7-9**: Align agent-routing.md primary/fallback models
  - Files: `.opencode/rules/agent-routing.md`, `.claude/rules/agent-routing.md`
  - Fix: routing tables now mirror `.opencode/agent/*.md` frontmatter exactly for `model` and declared `fallback_model`
  - Fix: removed stale specialist override claims, corrected `opencode.json` path, and simplified routing YAML to role-first frontmatter alignment
  - Acceptance: Every agent row in both routing docs matches `.opencode/agent/*.md` frontmatter

- [ ] **S7-10**: Add NOTION_API_KEY + env vars
  - Files: `.env.example`, `docker/docker-compose.yml`, `src/curator/config.ts`, `src/lib/notion/client.ts`
  - Add: NOTION_API_KEY, NOTION_INSIGHTS_DB_ID, NOTION_KNOWLEDGE_DB_ID, NOTION_AGENTS_DB_ID
  - Throw on missing NOTION_API_KEY in production
  - Acceptance: App throws clear error on startup if NOTION_API_KEY missing in production

## P1 Tasks (after all P0s)

- [ ] **S7-11**: Fix Docker health check (wget → curl)
  - Files: `docker-compose.yml`, `docker/docker-compose.yml`, `Dockerfile`
  - Fix: Replace `wget` in healthcheck with `curl` or install wget in Dockerfile
  - Acceptance: `docker ps` shows `allura-web` as `(healthy)`
  - BLOCKED BY: None (independent)

- [ ] **S7-12**: Purge 773 orphan load-test proposals (SQL, append-only)
  - SQL: Mark proposals as `cancelled` (never DELETE)
  - Cancel DLQ test artifact
  - Acceptance: Orphan query returns 0 results
  - BLOCKED BY: None (independent)

- [ ] **S7-4**: Resolve 28 stuck notion_sync_pending events
  - BLOCKED BY: S7-10 (need NOTION_API_KEY first)
  - After API key is configured, re-process or resolve stuck events

## P2 Tasks (after all P1s)

- [ ] **S7-7**: Update Neo4j agent-nodes.ts to Team RAM naming
  - File: `src/lib/neo4j/agent-nodes.ts`
  - Replace legacy `memory-*` agent names with Team RAM names
  - Add all 10 agents, matching `.md` frontmatter models
  - Add `fallback_model` to AgentInsert interface
  - BLOCKED BY: S7-8, S7-9 (model fixes must land first)

- [ ] **S7-5**: Commit untracked .opencode/rules/ files
  - Files: `.opencode/rules/AI-GUIDELINES.md`, `.opencode/rules/_bootstrap.md`
  - Acceptance: `git status` shows zero untracked files in `.opencode/rules/`

## S8 Tasks: 2-Store RuVector Ecosystem Migration (Slices C-F)

**Parent ADR:** 70325 (2-Store RuVector Ecosystem Decision)
**Status:** IN PROGRESS

### Slice C: RuVector Graph Adapter (P0 - MUST complete first)

- [ ] **S8-C1**: Create IGraphAdapter interface
  - Files: `src/lib/graph/adapter.ts`
  - Methods: createNode, createEdge, query, traverse, getNodeById, updateNode
  - Include proper TypeScript types for all parameters and returns
  - Acceptance: Interface compiles and exports all required methods

- [ ] **S8-C2**: Implement Neo4j adapter wrapper
  - Files: `src/lib/graph/neo4j-adapter.ts`
  - Wrap existing neo4j driver behind IGraphAdapter interface
  - Implement all interface methods using existing Neo4j queries
  - Acceptance: All existing graph operations work through adapter

- [ ] **S8-C3**: Add ruvector-graph service to docker-compose
  - Files: `docker-compose.yml`
  - Service: ruvnet/ruvector-graph:latest
  - Ports: 7474 (HTTP), 7687 (Bolt)
  - Healthcheck configured
  - Acceptance: docker compose up starts ruvector-graph container

- [ ] **S8-C4**: Implement ruvector-graph adapter
  - Files: `src/lib/graph/ruvector-graph-adapter.ts`
  - Connect to ruvector-graph service
  - Implement all IGraphAdapter methods using ruvector-graph Cypher
  - Handle connection errors gracefully
  - Acceptance: Adapter connects and executes basic Cypher queries

- [ ] **S8-C5**: Migrate memory_writer.ts to adapter pattern
  - Files: `src/lib/memory/writer.ts`
  - Replace direct neo4j calls with adapter methods
  - Use factory pattern to select adapter based on GRAPH_BACKEND env
  - Acceptance: memory_write operations go through adapter interface

- [ ] **S8-C6**: Migrate memory_search graph fallback to adapter
  - Files: `src/lib/memory/search.ts`
  - Use IGraphAdapter for graph fallback path
  - Acceptance: Search uses adapter when falling back from RuVector

- [ ] **S8-C7**: Implement GRAPH_BACKEND feature flag
  - Files: `src/lib/graph/factory.ts`, `.env`, `docker-compose.yml`
  - Env var GRAPH_BACKEND supporting 'neo4j' or 'ruvector'
  - Factory returns appropriate adapter based on env
  - Default to 'neo4j' for backward compatibility until Slice E
  - Acceptance: Switching env var changes active adapter

- [ ] **S8-C8**: Adapter parity tests
  - Files: `src/lib/graph/__tests__/adapter-parity.test.ts`
  - Tests run same queries through both adapters
  - Verify identical results for: node creation, edge creation, queries, traversals
  - Acceptance: All parity tests pass

### Slice D: Insight Promotion Migration (P1 - after all P0s)

- [ ] **S8-D1**: Port insights schema to ruvector-graph
  - Files: `src/lib/graph/schema/insights-ruvector-graph.cypher`
  - Create nodes: Insight, InsightHead
  - Create relationships: VERSION_OF, SUPERSEDES
  - Acceptance: Schema loads and creates expected node types

- [ ] **S8-D2**: Migrate insert-insight to adapter
  - Files: `src/lib/neo4j/queries/insert-insight.ts` → `src/lib/graph/queries/insert-insight.ts`
  - Use IGraphAdapter instead of direct Neo4j driver
  - Acceptance: Insight creation works with both adapters

- [ ] **S8-D3**: Migrate get-insight to adapter
  - Files: `src/lib/neo4j/queries/get-insight.ts` → `src/lib/graph/queries/get-insight.ts`
  - Use IGraphAdapter for all queries
  - Acceptance: Insight retrieval works with both backends

- [ ] **S8-D4**: Migrate get-dual-context to adapter
  - Files: `src/lib/neo4j/queries/get-dual-context.ts` → `src/lib/graph/queries/get-dual-context.ts`
  - Use IGraphAdapter for dual-context queries
  - Acceptance: Dual context queries work with both backends

- [ ] **S8-D5**: Update knowledge-promotion for ruvector-graph
  - Files: `src/lib/memory/knowledge-promotion.ts`
  - Change write target to ruvector-graph when GRAPH_BACKEND=ruvector
  - Ensure SUPERSEDES relationships are created correctly
  - Acceptance: Curator promotions create nodes in ruvector-graph

- [ ] **S8-D6**: Update curator approve route
  - Files: `src/app/api/curator/approve/route.ts`
  - Use adapter for promotion target
  - Acceptance: Approval endpoint works with ruvector-graph

- [ ] **S8-D7**: Create data migration script
  - Files: `scripts/migrate-insights-to-ruvector-graph.ts`
  - Migrate all Neo4j Insight nodes to ruvector-graph
  - Preserve IDs, versions, SUPERSEDES relationships
  - Validate migration: count match, relationships intact
  - Acceptance: All existing insights migrated and verified

- [ ] **S8-D8**: End-to-end curator test
  - Set GRAPH_BACKEND=ruvector
  - Submit proposal → approve → verify insight visible
  - Check version lineage query works
  - Verify SUPERSEDES relationships preserved
  - Acceptance: Full curator pipeline works

### Slice E: Remove Neo4j Dependency (P2 - after all P1s)

- [ ] **S8-E1**: Remove neo4j service from docker-compose
  - Files: `docker-compose.yml`
  - Delete neo4j service block
  - Remove depends_on references
  - Acceptance: docker compose up doesn't start neo4j

- [ ] **S8-E2**: Remove NEO4J env vars
  - Files: `docker-compose.yml` (web, mcp, http-gateway services)
  - Remove all NEO4J_* variables
  - Acceptance: No Neo4j references in compose env

- [ ] **S8-E3**: Remove neo4j-driver dependency
  - Files: `package.json`
  - Remove neo4j-driver from dependencies
  - Run bun install
  - Acceptance: No neo4j-driver in node_modules

- [ ] **S8-E4**: Archive Neo4j source code
  - Move `src/lib/neo4j/` to `archive/neo4j-legacy/`
  - Verify no imports from @/lib/neo4j (except adapter)
  - Acceptance: Typecheck passes

- [ ] **S8-E5**: Update health probes
  - Files: `src/lib/health/probes.ts`
  - Remove Neo4j checks
  - Health endpoint only checks PG + ruvector-graph
  - Acceptance: Tests pass

- [ ] **S8-E6**: Remove direct Neo4j imports from canonical-tools
  - Files: `src/mcp/canonical-tools.ts`
  - Only adapter imports neo4j when neo4j backend selected
  - Acceptance: Typecheck passes

- [ ] **S8-E7**: Verify tests without Neo4j
  - Stop Neo4j container
  - Run full test suite
  - Acceptance: 60+ files pass, 0 failures

### Slice F: Cleanup and Documentation (P3 - after all P2s)

- [ ] **S8-F1**: Remove fallback SQL files
  - Files: `docker/postgres-init/12-ruvector-fallback.sql`, `17-ruvector-fallback-sync.sql`
  - Acceptance: Files removed, no references remain

- [ ] **S8-F2**: Update MCP integration rules
  - Files: `.claude/rules/mcp-integration.md`
  - Remove Neo4j refs
  - Document ruvector-graph as graph backend
  - Acceptance: Documentation reflects 2-store architecture

- [ ] **S8-F3**: Update agent definitions
  - Files: `.opencode/agent/*.md`
  - Replace Neo4j with ruvector-graph in Brain refs
  - Acceptance: Agent docs accurate

- [ ] **S8-F4**: Update CLAUDE.md Architecture
  - Files: `CLAUDE.md`
  - Update Architecture section
  - Show ruvector-postgres + ruvector-graph
  - Acceptance: Docs accurate

- [ ] **S8-F5**: Archive Cypher scripts
  - Files: `scripts/neo4j-*.cypher` → `archive/`
  - Acceptance: No active neo4j scripts

- [ ] **S8-F6**: Final .env cleanup
  - Remove all NEO4J_* variables
  - Add RUVECTOR_GRAPH_* if needed
  - Document new env vars
  - Acceptance: Clean .env.example

- [ ] **S8-F7**: Update docs/allura/*
  - Files: `docs/allura/BLUEPRINT.md`, `SOLUTION-ARCHITECTURE.md`
  - Update data layer documentation
  - Acceptance: No Neo4j references

- [ ] **S8-F8**: Write final migration ADR
  - Files: `docs/allura/ADR-2026-04-19-ruvector-migration.md`
  - Document full 2-store migration
  - Reference parent ADR 70325
  - Include rollback plan, performance benchmarks
  - Acceptance: ADR complete and reviewed

## Progress Log

| Time | Task | Action | Result |
|------|------|--------|--------|
| 2026-04-19 06:00Z | - | Ralph loop started | - |
| 2026-04-19 08:15Z | P1-P4 | ULW Loop files created | ulw-loop.sh, PROMPT_ulw.md, updated plan, command |
| 2026-04-21 07:00Z | S7-8 | Fixed MODEL_REGISTRY provider prefixes in canonical registry | `.claude/docs/MODEL_REGISTRY.md` updated; typecheck passed |
| 2026-04-21 07:20Z | S7-9 | Aligned routing docs with live agent frontmatter | `.opencode/rules/agent-routing.md` + `.claude/rules/agent-routing.md`; typecheck passed |
