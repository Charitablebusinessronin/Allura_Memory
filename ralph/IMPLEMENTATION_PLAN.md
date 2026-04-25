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

- [x] **S7-10**: Correct Notion integration plan to MCP_DOCKER remote
  - Files: `ralph/IMPLEMENTATION_PLAN.md`
  - Finding: planned direct Notion app wiring is stale; `src/curator/config.ts` and `src/lib/notion/client.ts` do not exist in this repo
  - Finding: repo guidance already says Notion integration uses remote MCP tools exclusively and should not block startup on a local `NOTION_API_KEY`
  - Replacement direction: use MCP_DOCKER/remote Notion tooling for sync and hydration paths; treat any required secrets/config as MCP server configuration, not app-runtime env gating
  - Acceptance: Ralph plan no longer instructs direct app-runtime Notion API wiring that contradicts current repo architecture

## P1 Tasks (after all P0s)

- [x] **S7-11**: Fix Docker health check (wget → curl)
  - Files: `docker-compose.yml`, `docker/docker-compose.yml`, `Dockerfile`
  - Fix: Replace `wget` in healthcheck with `curl` in `docker/Dockerfile.enterprise`, `docker/docker-compose.enterprise.yml`, `docker/Dockerfile.prod`
  - Acceptance: No `wget` references remain in any Docker health check
  - BLOCKED BY: None (independent)
  - **Status**: DONE — commit b6fb6272

- [x] **S7-12**: Purge 773 orphan load-test proposals (SQL, append-only)
  - Finding: Database query found **0** proposals matching any load-test pattern (`%-loadtest`, `%loadtest%`, `%load%`)
  - Total canonical_proposals: 333 (308 approved, 25 pending) — no load-test entries exist
  - Conclusion: Orphans already cleaned or count was projection; acceptance criteria "orphan query returns 0 results" already satisfied
  - Acceptance: Orphan query returns 0 results ✅
  - BLOCKED BY: None (independent)
  - **Status**: DONE — no action needed, zero orphans confirmed

- [ ] **S7-4**: Resolve 28 stuck notion_sync_pending events
  - BLOCKED BY: MCP_DOCKER remote Notion configuration validation
  - After remote Notion MCP configuration is verified, re-process or resolve stuck events

## P2 Tasks (after all P1s)

- [x] **S7-7**: Update Neo4j agent-nodes.ts to Team RAM naming
  - File: `src/lib/neo4j/agent-nodes.ts`
  - Replaced legacy `memory-*` agent names with Team RAM names (brooks, jobs, woz, scout, knuth, bellard, carmack, pike, fowler, hightower)
  - Added all 10 agents matching `.opencode/agent/*.md` frontmatter models
  - Added `fallback_model` to AgentInsert interface (already present in AgentNode)
  - Acceptance: Typecheck passes, all 10 agents defined with correct models
  - BLOCKED BY: S7-8, S7-9 (model fixes must land first)
  - **Status**: DONE — commit dcf9b8d2

- [x] **S7-5**: Commit untracked .opencode/rules/ files
  - Files: `.opencode/rules/AI-GUIDELINES.md`, `.opencode/rules/_bootstrap.md`
  - Finding: No untracked files — all `.opencode/rules/*` already tracked in git
  - Acceptance: `git status` shows zero untracked files in `.opencode/rules/`
  - BLOCKED BY: None
  - **Status**: DONE — already clean

## S8 Tasks: 2-Store RuVector Ecosystem Migration (Slices C-F)

**Parent ADR:** 70325 (2-Store RuVector Ecosystem Decision)
**Status:** IN PROGRESS

### Slice C: RuVector Graph Adapter (P0 - MUST complete first)

**Status:** Partially complete. `src/lib/graph-adapter/` already exists with IGraphAdapter (`types.ts`), Neo4j adapter (`neo4j-adapter.ts`), RuVector adapter (`ruvector-adapter.ts`), and factory (`factory.ts`).

- [x] **S8-C1**: Create IGraphAdapter interface — DONE (exists in `src/lib/graph-adapter/types.ts`)
- [x] **S8-C2**: Implement Neo4j adapter wrapper — DONE (`src/lib/graph-adapter/neo4j-adapter.ts`)
- [x] **S8-C3**: Add ruvector-graph service to docker-compose
  - Files: `docker-compose.yml`
  - Finding: No separate ruvector-graph Docker service needed. The RuVectorGraphAdapter stores graph data in PostgreSQL tables (`graph_memories`, `graph_supersedes`) in the existing postgres service (migration 21). This replaces the original plan's `ruvnet/ruvector-graph:latest` service — there is no such image.
  - The existing docker-compose already has: `GRAPH_BACKEND` env var on web/mcp/http-gateway, `RUVECTOR_HOST=postgres` routing, and `createGraphAdapter({ pg, neo4j })` in canonical-tools.ts correctly selects RuVectorGraphAdapter when `GRAPH_BACKEND=ruvector`.
  - Acceptance: GRAPH_BACKEND=ruvector works via existing postgres service, adapter factory selects RuVectorGraphAdapter ✅
- [x] **S8-C4**: Implement ruvector-graph adapter — DONE (`src/lib/graph-adapter/ruvector-adapter.ts`)
- [x] **S8-C5**: Migrate memory_writer.ts to adapter pattern
  - Files: `src/lib/memory/writer.ts`, `docker/postgres-init/24-graph-structural-context.sql`
  - `memory()` now selects backend based on `GRAPH_BACKEND` env var:
    - `neo4j` (default): routes through `readTransaction`/`writeTransaction` (unchanged)
    - `ruvector`: routes through `IGraphAdapter` for Memory/Insight-labeled nodes + PG structural tables for other labels
  - Added `graph_structural_nodes` and `graph_structural_edges` tables (migration 24) for non-Memory labeled nodes
  - Added `memoryWithAdapter()` export for dependency-injected usage
  - When GRAPH_BACKEND=ruvector: raw Cypher `query()` throws (not supported in PG mode)
  - Acceptance: memory_write operations go through adapter interface ✅
- [x] **S8-C6**: Migrate memory_search graph fallback to adapter
  - Files: `src/lib/memory/search.ts`
  - `searchMemories()`, `getMemoriesByType()`, `searchAgents()` now dispatch based on `GRAPH_BACKEND`:
    - `neo4j` (default): routes through `readTransaction` with Cypher (unchanged)
    - `ruvector`: routes through `IGraphAdapter.searchMemories`/`listMemories` + `graph_structural_nodes` for agents
  - Acceptance: Search uses adapter when falling back from RuVector ✅
- [x] **S8-C7**: Implement GRAPH_BACKEND feature flag — DONE (`src/lib/graph-adapter/factory.ts`)
- [x] **S8-C8**: Adapter parity tests
  - Files: `src/lib/graph-adapter/__tests__/adapter-parity.test.ts`
  - 14 parity tests verifying both adapters produce identical results for: createMemory, checkDuplicate (found/not found), getMemory (not found), softDeleteMemory (found/not found), checkCanonical, getVersion, countMemories, isHealthy (healthy/unreachable), restoreMemory, linkMemoryContext, interface contract (all 16 methods implemented)
  - Acceptance: All parity tests pass ✅

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

## S9 Tasks: Allura Memory Dashboard v2.0 Design System

**Design Spec:** `docs/branding/deliverables/06_allura-memory_brand-truth.json` + JSON design prompt
**Context File:** `ralph/ulw-context.md`
**Agent Routing:** Woz (primary builder), Pike (interface review), Bellard (perf audit), Jobs (acceptance gates), Fowler (maintainability review)
**New Dependency:** `@xyflow/react` (Phase 6 only)

### Phase 1: Design Token Integration (~2h)

- [ ] **S9-1**: Create allura theme preset (`src/styles/presets/allura.css`)
  - Brand primitives as CSS custom properties: `--allura-deep-navy` (#1A2B4A), `--allura-coral` (#E85A3C), `--allura-trust-green` (#4CAF50), `--allura-clarity-blue` (#5B8DB8), `--allura-pure-white` (#F5F5F5), `--allura-ink-black` (#1A1A1A), `--allura-warm-gray` (#737373)
  - Semantic tokens mapped to shadcn/ui variables under `[data-theme-preset="allura"]`: `--background`, `--foreground`, `--card`, `--primary`, `--accent`, `--border`, etc.
  - Shadow tokens: `--allura-shadow-card`, `--allura-shadow-hover`, `--allura-shadow-modal`, `--allura-shadow-flat`
  - Radius tokens: card 16px, badge 6px, button 8px, input 10px
  - WCAG constraint: coral never on pure_white background (1.3:1 fail)
  - Acceptance: allura preset selectable, colors match hex values exactly, Outfit loads for `.font-display`

- [ ] **S9-2**: Add Outfit display font utility class
  - Add `.font-display { font-family: var(--font-outfit); }` in `globals.css` `@layer utilities`
  - Verify Outfit font already registered in `src/lib/fonts/registry.ts`
  - Acceptance: `font-display` class renders text in Outfit 700

- [ ] **S9-3**: Add allura to theme switcher and import in globals.css
  - File: `src/app/(main)/dashboard/_components/sidebar/theme-switcher.tsx`
  - Add "allura" as selectable preset option
  - File: `src/app/globals.css` — add `@import "../styles/presets/allura.css"` alongside existing presets
  - Acceptance: "allura" appears in theme switcher, selecting it applies brand tokens

### Phase 2: Shared Brand Components (~4h)

- [ ] **S9-4**: Create StatusBadge component (`src/components/allura/status-badge.tsx`)
  - Variants: `active` (bg: #4CAF50, text: #FFFFFF, label: "Active"), `proposed` (bg: #5B8DB8, text: #FFFFFF, label: "Proposed"), `forgotten` (bg: #9B9B9B, text: #FFFFFF, label: "Forgotten"), `low_confidence` (bg: #E85A3C, text: #FFFFFF, label: "Low Confidence")
  - 6px radius, Inter 600/12px uppercase
  - Acceptance: 4 variants render with correct colors and labels

- [ ] **S9-5**: Create ConfidenceBar component (`src/components/allura/confidence-bar.tsx`)
  - Props: `value: number` (0-100), width 120px, `--allura-deep-navy` fill, `#E2E6EA` track, 4px radius
  - Acceptance: fills correctly for values 0, 50, 100; renders at 120px width

- [ ] **S9-6**: Create TraceCard component (`src/components/allura/trace-card.tsx`)
  - Background: #F5F5F5, 8px radius, shows tool call name + input snippet + timestamp (Inter 400/12px warm_gray)
  - Acceptance: renders 3 fields; reused in ProvenanceDrawer and CuratorQueue

- [ ] **S9-7**: Create EmptyState component (`src/components/allura/empty-state.tsx`)
  - Props: `text: string`, `cta?: ReactNode`; no error icons, centered, warm_gray color
  - Acceptance: renders with text only and text+CTA variants

- [ ] **S9-8**: Create PanelDrawer component (`src/components/allura/panel-drawer.tsx`)
  - 420px desktop / 100% mobile right-sliding panel
  - Header: "← Back" button + section H4 title
  - Sections: Origin (coral uppercase overline, agent name + trace count), Evidence (coral uppercase overline, TraceCard list), Actions (Promote deep_navy filled, Edit deep_navy outlined, Deprecate ghost)
  - Border radius: 16px 0 0 16px, modal shadow
  - Lazy-loads on open (not on mount)
  - Focus trap and keyboard nav (Escape to close)
  - Loading: "Finding source traces…" with pulse animation on overline bar
  - Empty: "Source not available" warm_gray centered, no error icon
  - Acceptance: slides from right, focus trap works, responsive, lazy-loads

- [ ] **S9-9**: Create brand-compliant MemoryCard component (`src/components/allura/memory-card.tsx`)
  - Composes StatusBadge + ConfidenceBar
  - bg: #FFFFFF, 16px radius, card shadow, hover→hover shadow
  - Memory text: Inter 400/16px/#1A1A1A max 3 lines, caption: Inter 500/12px/#737373
  - Actions: "View Source" deep_navy link left, "Forget" coral ghost right
  - Mobile: swipe-left reveals coral Forget button
  - Acceptance: card renders with badge, bar, text, actions; hover elevates shadow

### Phase 3: Memory List Page (~4h)

- [ ] **S9-10**: Create branded memory layout (`src/app/memory/layout.tsx`)
  - Deep navy (#1A2B4A) top navbar: allura wordmark (from `docs/branding/assets/logos/allura-logo/Wordmark.png`) left, user avatar right, "+ Add Memory" coral CTA button
  - No sidebar, full-width, mobile-first, single column
  - Navbar: Inter 600, coral button 8px radius, `page_bg: #F5F5F5` background below navbar
  - Acceptance: layout renders without sidebar, navbar matches spec

- [ ] **S9-11**: Redesign /memory page (`src/app/memory/page.tsx`)
  - Hero: "What does your system know?" Inter 700/40px/#1A1A1A
  - Search: full width, "Search what your system remembers…", 10px radius, #E2E6EA border, #9B9B9B placeholder
  - Tabs: "Memories" / "Recently Forgotten" / "Graph" — active tab: deep_navy underline 2px
  - Memory cards: new MemoryCard component from S9-9
  - Empty states: new EmptyState component from S9-7 ("Nothing saved yet. Add the first memory.")
  - Search empty: "No memories match '[query]'. Save it manually?"
  - Wire up useMemoryList hook (existing data layer)
  - Acceptance: page matches design prompt, `bun run typecheck` passes

### Phase 4: Provenance Drawer (~2h)

- [ ] **S9-12**: Wire View Source to PanelDrawer
  - MemoryCard "View Source" action opens PanelDrawer
  - Origin section: agent name + trace count (Inter 500/14px)
  - Evidence section: TraceCard list (reuse TraceCard from S9-6)
  - Actions: Promote (deep_navy filled), Edit (deep_navy outlined), Deprecate (ghost)
  - Loading: "Finding source traces…" with pulse animation
  - Empty: "Source not available" warm_gray, no error icon
  - Acceptance: drawer opens on View Source click, all sections render, loading/empty states work

### Phase 5: Curator Queue Redesign (~3h)

- [ ] **S9-13**: Restructure curator to two-column layout (`src/app/(main)/dashboard/curator/page.tsx`)
  - Left panel: 300px fixed width, compact cards (summary 2 lines, confidence %, trace count, status badge)
  - Right panel: flex-1, expanded detail (summary text, confidence bar, evidence traces via TraceCard, actions row)
  - Actions: Approve ✓ (deep_navy filled), Edit ✎ (outlined charcoal), Reject ✕ (ghost, coral on hover)
  - Empty state: "All caught up. No insights waiting for review." (reuse EmptyState)
  - Reuse existing curator API (`/api/curator/proposals`, `/api/curator/approve`)
  - Acceptance: two-column layout renders, selection works, approve/reject actions functional, typecheck passes

### Phase 6: Graph Tab (~5h)

- [ ] **S9-14**: Install @xyflow/react and create GraphTab skeleton (`src/components/allura/graph-tab.tsx`)
  - Run: `bun add @xyflow/react`
  - React Flow force-directed layout with `@xyflow/react`
  - Node types: people (#F5F5F5 fill/#1A2B4A border), topics (#FFFFFF fill/#4CAF50 border), decisions (#FFFFFF fill/#1A1A1A border), traces (#F8F8F8 fill/#9B9B9B border)
  - Edge types: derived_from (deep_navy dashed), approved_by (trust_green solid), supersedes (ink_black solid with arrowhead)
  - 100 node cap with neighborhood mode at 80+ nodes (show connected neighborhood + toast)
  - Search overlay (top-left), zoom controls (bottom-right), neighborhood toggle button
  - Node click → opens PanelDrawer (reuse S9-8)
  - Overflow toast: "Showing neighborhood only. Zoom out to see more."
  - Acceptance: graph renders with correct node/edge types, 100-node cap enforced, PanelDrawer opens on node click

- [ ] **S9-15**: Add Graph tab to /memory page
  - File: `src/app/memory/page.tsx`
  - Third tab "Graph" renders `<GraphTab />`
  - Pass group_id and search query context to GraphTab
  - Acceptance: tab switches to graph view, typecheck passes

### Phase 7: Polish & QA (~2h)

- [ ] **S9-16**: WCAG and copy audit
  - Verify no coral-on-white foreground pairs (1.3:1 ratio fail per design spec)
  - Verify all copy matches design prompt rules:
    - ✅ "What does your system know?", "View Source", "Forget", "All caught up.", "Source not available", "Nothing saved yet."
    - ❌ "Query the index", "Inspect provenance", "Record deleted", "Null", "Model score", "Zero results", "Node limit exceeded"
  - Verify empty states have no error icons
  - Verify keyboard navigation and focus rings on all interactive elements
  - Acceptance: zero WCAG AA failures, zero forbidden copy phrases

- [ ] **S9-17**: Final typecheck and test pass
  - Run: `bun run typecheck && bun test`
  - Verify all new components render without runtime errors
  - Verify existing pages unaffected by allura preset addition
  - Acceptance: 0 type errors, 0 test failures

## Progress Log

| Time | Task | Action | Result |
|------|------|--------|--------|
| 2026-04-19 06:00Z | - | Ralph loop started | - |
| 2026-04-19 08:15Z | P1-P4 | ULW Loop files created | ulw-loop.sh, PROMPT_ulw.md, updated plan, command |
| 2026-04-21 07:00Z | S7-8 | Fixed MODEL_REGISTRY provider prefixes in canonical registry | `.claude/docs/MODEL_REGISTRY.md` updated; typecheck passed |
| 2026-04-21 07:20Z | S7-9 | Aligned routing docs with live agent frontmatter | `.opencode/rules/agent-routing.md` + `.claude/rules/agent-routing.md`; typecheck passed |
| 2026-04-21 07:35Z | S7-10 | Corrected stale Notion slice to MCP_DOCKER remote architecture | Direct `NOTION_API_KEY` app wiring removed from plan |
