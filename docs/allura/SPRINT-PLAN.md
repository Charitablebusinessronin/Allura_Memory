# Team RAM Sprint Plan — Curator Pipeline + Skills + Catalog

> **Branch:** `team-ram/curator-skills-catalog` (from `main`)
> **Status:** Ready for assignment
> **GO Checklist:** CONDITIONAL GO — all hard gates pass (89/89 tests green)
> **Notion:** https://www.notion.so/34b1d9be65b381ea87d5d640a0f452ac

---

## Context

GO checklist passed. All hard security and governance gates green. The remaining work is implementation, not architecture. This sprint wires the Curator approve/reject pipeline, creates missing skill artifacts, and builds the MCP catalog governance layer.

---

## Sprint 1: Wire the Curator Approve Flow

**Owner:** Bellard (Code Subagents)
**Persona:** Bellard — implementer, surgical execution
**Branch:** `team-ram/curator-skills-catalog`
**Priority:** P0 — blocks everything else

### What exists
- `POST /api/curator/approve` — accepts `proposal_id`, `group_id`, `decision`, `curator_id`, `rationale`
- `insert-insight.ts` — creates Neo4j Memory node with SUPERSEDES
- `canonical_proposals` table — 13 proposals stuck at `status=pending`
- `/admin/approvals` UI — lists proposals

### What's missing
1. **Reject endpoint** — `POST /api/curator/reject` that sets `status=rejected`, records `curator_id`, `rationale`, `decided_at`
2. **Batch process script** — `src/scripts/process-pending-proposals.ts` that iterates pending proposals and either auto-approves (if `PROMOTION_MODE=auto` + score ≥ threshold) or leaves for HITL
3. **Admin UI approve/reject buttons** — wire the existing `/admin/approvals` page to call the approve and reject endpoints
4. **Auto-promotion trigger** — in `PROMOTION_MODE=auto`, after `memory_add` creates a proposal with score ≥ threshold, immediately call approve (or a service function that does the same thing without HTTP roundtrip)
5. **E2E smoke test** — write → proposal → approve → promoted → recall returns approved memory

### Acceptance criteria
- [ ] `POST /api/curator/reject` returns 200 and sets `status=rejected` in PG
- [ ] Admin UI has working Approve and Reject buttons
- [ ] `PROMOTION_MODE=auto` promotes eligible proposals without human intervention
- [ ] E2E test: `memory_add` → `status=pending` → approve → Neo4j node created → `memory_search` returns it
- [ ] All 13 stuck proposals can be resolved (approve or reject) via the new endpoints
- [ ] `linkInsightToAgent()` stub tracked as RK-14 (not blocking)

### Files to create/modify
- `src/app/api/curator/reject/route.ts` (NEW)
- `src/scripts/process-pending-proposals.ts` (NEW)
- `src/app/admin/approvals/page.tsx` (MODIFY — add buttons)
- `src/lib/curator/auto-promote.ts` (NEW)
- `src/__tests__/curator-reject.test.ts` (NEW)
- `src/__tests__/curator-pipeline.e2e.test.ts` (MODIFY — add reject path)

---

## Sprint 2: Allura Skills Artifacts

**Owner:** Hightower (Core Subagents)
**Persona:** Hightower — architect, specification
**Branch:** `team-ram/curator-skills-catalog`
**Priority:** P1 — after Sprint 1 merge

### What exists
- `allura-memory-skill/SKILL.md` — has trigger, allowed-tools, guardrails for recall/evidence/write

### What's missing
4 dedicated skill artifacts, each with: trigger, inputs (must include `group_id`), MCP tool allowlist, output contract, guardrails.

| Skill | Trigger | Allowlist | Output Contract |
|-------|---------|----------|----------------|
| `allura.graph_debug_readonly` | "show me the graph for X" or admin debug | `neo4j-cypher` (read-only queries only) | `{nodes: int, edges: int, depth: int}` |
| `allura.propose_promotion` | memory score ≥ threshold in SOC2 mode | `allura-brain_memory_promote`, `allura-brain_memory_search` | `{proposal_id, status, score}` |
| `allura.approve_promotion` | HITL curator action | `allura-brain_memory_promote`, `allura-brain_memory_search` | `{memory_id, status, witness_hash}` |
| `allura.health_observability` | "check allura health" or periodic heartbeat | `allura-brain_memory_search`, `MCP_DOCKER_execute_sql` | `{postgres: {status, latency_ms}, neo4j: {status, latency_ms}, queue: {pending_count, oldest_age}, degraded: bool}` |

### Acceptance criteria
- [ ] Each skill has a `SKILL.md` with all 5 sections
- [ ] Each skill specifies `group_id` as a required input
- [ ] Each skill lists its MCP tool allowlist explicitly
- [ ] Each skill defines what it must NEVER do (guardrails)
- [ ] Skills are registered in `.opencode/mcp-approved-servers.json`

### Files to create
- `.opencode/skills/allura-graph-debug/SKILL.md` (NEW)
- `.opencode/skills/allura-propose-promotion/SKILL.md` (NEW)
- `.opencode/skills/allura-approve-promotion/SKILL.md` (NEW)
- `.opencode/skills/allura-health-observability/SKILL.md` (NEW)
- `.opencode/mcp-approved-servers.json` (UPDATE)

---

## Sprint 3: MCP Catalog Governance

**Owner:** Brooks (Core)
**Persona:** Brooks — architect, reviewer
**Branch:** `team-ram/curator-skills-catalog`
**Priority:** P2 — after Sprint 2 merge

### What exists
- `.opencode/mcp-approved-servers.json` — static approved server list (6 servers)
- `src/lib/mcp/trace-middleware.ts` — logs every MCP call

### What's missing
Formal TypeScript schemas for the catalog governance workflow: ToolCandidate → ApprovedTool → ToolProfile → ToolApproval → ToolInvocationLog.

### Scope
1. Create `src/lib/mcp-catalog/types.ts` — TypeScript interfaces for all 5 entities
2. Create `src/lib/mcp-catalog/registry.ts` — CRUD operations backed by PG
3. Create `src/app/api/mcp-catalog/` — REST endpoints for import/approve/profile/list
4. Wire gateway allowlist to read from `ToolProfile` instead of static JSON

### Acceptance criteria
- [ ] `ToolCandidate` can be imported from Docker MCP catalog
- [ ] `ApprovedTool` created with version and immutability
- [ ] `ToolProfile` (e.g., `allura-core`) can be created and tools added/removed
- [ ] Gateway reads allowlist from `ToolProfile`, not static JSON
- [ ] `ToolInvocationLog` append-only entries written for every MCP call
- [ ] Write-capable tools require `always_ask` confirmation in SOC2 mode

---

## Sprint 4: Phase 6 Closure ADR

**Owner:** Brooks
**Priority:** P2 — can run in parallel with Sprint 3

Write ADR closing Phase 6:
- DLQ shipped
- Knowledge Hub Bridge shipped
- Auth layer shipped
- CSV Export shipped
- SDK shipped
- CORS shipped
- Sentry shipped
- Log `ADR_CREATED` event to Postgres

### Files to create
- `docs/allura/RISKS-AND-DECISIONS.md` (UPDATE — add AD-25: Phase 6 Closure)

---

## Sprint 5: Observability Surface

**Owner:** Wozniak (Core Subagents)
**Priority:** P3 — after Sprint 1 merge

### What exists
- `GET /api/health` — postgres/neo4j status + latency
- `TraceMiddleware` — logs every MCP call to `events` table

### What's missing
Dedicated metrics endpoint:
- Queue health: `# pending proposals, oldest proposal age`
- Recall latency: `p50/p95` for `memory_search`
- Promotion stats: `success/failure count` last 24h
- Degraded mode counters: `neo4j_unavailable`, `scope_error`

### Acceptance criteria
- [ ] `GET /api/health/metrics` returns structured JSON
- [ ] Queue health queryable
- [ ] Recall latency tracked
- [ ] Degraded mode counters visible

---

## Not run this sprint

| Item | Why | Tracked As |
|------|-----|------------|
| k6 load validation (VU=100) | Need stable Curator pipeline first | Blocked by Sprint 1 |
| RuVector migration | Target arch, not sprint work | B6/B7 in Requirements Matrix |
| Notion doc sync (Solution Arch, Data Dictionary) | Update after Sprint 1 changes | Post-sprint cleanup |
| `postcss-import` commit | Needs separate PR, not blocking | Housekeeping |

---

## Execution rules

1. **Canon wins.** If anything in `docs/allura/` conflicts with this plan, the canon wins — call it out.
2. **Worktrees.** Create a Team RAM worktree. Merge to `main` only after tests pass.
3. **One PR per sprint.** Sprint 1 PR before Sprint 2 starts. No stacking.
4. **Test evidence required.** Every acceptance criterion must have test output or log evidence.
5. **No direct DB access.** All database operations go through MCP tools or the canonical service layer.
6. **group_id on every call.** No exceptions.

---

> *"The programmer, like the poet, works only slightly removed from pure thought-stuff."* — Frederick Brooks