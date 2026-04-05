# Progress

> **Last Updated:** 2026-04-05
> **Epic:** Epic 1 — Persistent Knowledge Capture and Tenant-Aware Memory

---

## Sprint Status

**Epic 1: Persistent Knowledge Capture and Tenant-Aware Memory**

| Story | Status | Notes |
|-------|--------|-------|
| 1.1 Record Raw Execution Traces | `ready-for-dev` | Critical blocker: ARCH-001 |
| 1.2-1.7 | `backlog` | Blocked by ARCH-001 |

---

## Milestones

### 2026-04-05 — Epics Documentation and Bun Security

**Completed:**
- ✅ Created comprehensive `_bmad-output/planning-artifacts/epics.md` with all stories
- ✅ Documented ARCH-001 critical blocker
- ✅ Updated all MCP configs to use `bunx` instead of `npx`
- ✅ Updated all plugin specs for Bun-only strategy
- ✅ Added security notes to AGENTS.md, techContext.md, copilot-instructions.md
- ✅ Updated Notion with Bun security note

**Security Improvement:**
- Replaced `npx -y` with `bunx` for all MCP servers
- Added security warnings about npm supply chain risks
- Documented Bun-only package strategy

**Completed:**
- ✅ 7 Agent nodes created in Neo4j knowledge graph
- ✅ 7 Agent records synced to PostgreSQL `agents` table
- ✅ AgentGroup "Allura Agent Team" created with INCLUDES relationships
- ✅ KNOWS relationships established (MemoryOrchestrator knows all)
- ✅ Session logged to PostgreSQL (Event ID: 27146)
- ✅ Session insight created in Neo4j
- ✅ Relationship schemas documented in Notion (CONTRIBUTED, LEARNED, DECIDED, COLLABORATED_WITH, SUPERSEDES)
- ✅ Plugin Architecture comparison table added to Notion (Claude Code, OpenCode, OpenClaw)

**Knowledge Graph Entities:**
- MemoryOrchestrator, MemoryArchitect, MemoryBuilder, MemoryGuardian, MemoryScout, MemoryAnalyst, MemoryChronicler
- Allura Agent Team (AgentGroup)
- Session 2026-04-04 Memory System Wiring
- Agent Memory Architecture Complete (Insight)

**In Progress:**
- ⏳ memory() TypeScript wrapper for MCP Docker tools
- ⏳ CONTRIBUTED/LEARNED/DECIDED relationship creation in actual sessions
- ⏳ Complete Claude Code plugin (6 more agents)
- ⏳ Create OpenClaw plugin

---

### 2026-04-05 — Epics Documentation and Plugin Specs

**Completed:**
- ✅ Created `_bmad-output/planning-artifacts/epics.md` — Comprehensive epic and story definitions
- ✅ Documented all 6 epics with stories and acceptance criteria
- ✅ Updated `_bmad-output/planning-artifacts/source-of-truth.md` — Added epics.md to canon
- ✅ Updated all plugin specs for Bun-only strategy
- ✅ Replaced all `npx -y` with `bunx` in MCP configs
- ✅ Added security notes to AGENTS.md, techContext.md, copilot-instructions.md
- ✅ Updated Notion with Bun security note and plugin architecture

**Files Updated:**
- `_bmad-output/planning-artifacts/epics.md` — New comprehensive epics document
- `_bmad-output/planning-artifacts/opencode-plugin-spec.md` — Bun security note
- `_bmad-output/planning-artifacts/claude-code-plugin-spec.md` — Bun installation
- `_bmad-output/planning-artifacts/openclaw-plugin-spec.md` — Bun security note
- `_bmad-output/planning-artifacts/source-of-truth.md` — Added epics.md to canon
- `claude-plugin-allura/.mcp.json` — Bunx for all MCP servers
- `memory-bank/progress.md` — This update
- `memory-bank/techContext.md` — Bun security note
- `AGENTS.md` — Bun security note
- `.github/copilot-instructions.md` — Bun security rule
- Notion Allura Memory Control Center — Updated plugin architecture

---

### 2026-04-04 — OpenCode Configuration Fix

**Completed:**
- ✅ Created 4 missing agent prompt files: `coder.md`, `reviewer.md`, `contextscout.md`, `documentation.md`
- ✅ Fixed invalid color `muted` → `secondary` for `memory-scout` agent
- ✅ Created error pattern doc: `_bmad-output/planning-artifacts/error-patterns/opencode-config-errors.md`
- ✅ Logged to PostgreSQL (Event ID: 27144)
- ✅ Updated `activeContext.md`

**Valid OpenCode theme colors:** `primary`, `secondary`, `accent`, `success`, `warning`, `error`, `info`, or hex `#RRGGBB`

---

### 2026-04-04 — Documentation Canon Established

**Completed:**
- ✅ Created `_bmad-output/planning-artifacts/source-of-truth.md` — Document hierarchy
- ✅ Fixed tenant naming in `_bmad-output/planning-artifacts/tenant-memory-boundary-spec.md`
- ✅ Added supersession headers to `_bmad-output/planning-artifacts/*.md`
- ✅ Created `memory-bank/activeContext.md`
- ✅ Created `memory-bank/systemPatterns.md`
- ✅ Created `memory-bank/progress.md`
- ✅ Created `memory-bank/techContext.md`
- ✅ Created `memory-bank/productContext.md`
- ✅ Created `memory-bank/projectbrief.md`
- ✅ Deleted unused `bmad-output/` directory
- ✅ Reconciled BMad workflow architecture
- ✅ Verified `.opencode/agent/` and `_bmad/` clean (no naming drift)

**Documentation Architecture:**
- `_bmad-output/planning-artifacts/` → Human canon (you control)
- `_bmad-output/planning-artifacts/` → BMad generated (marked superseded)
- `_bmad-output/implementation-artifacts/` → Sprint stories
- `_bmad/` → Skill/workflow definitions
- `.opencode/context/` → Agent instructions

**Critical Blocker:** ARCH-001 `groupIdEnforcer.ts` fix required.

---

## Blockers

| ID | Description | Story | Status |
|----|-------------|-------|--------|
| ARCH-001 | `groupIdEnforcer.ts` broken | 1.1 | Ready for dev |
| RK-01 | Group ID enforcement not working | 1.1 | Critical |

---

## Next Actions

1. **Fix ARCH-001** — `groupIdEnforcer.ts` must enforce `group_id` on all DB operations
2. **Resume Story 1.1** — Record Raw Execution Traces
3. **Validate canon** — Ensure all generated docs use `allura-*` naming

---

## Decisions Made

### 2026-04-04 — Tenant Naming Convention

**Decision:** Standardize on `allura-*` namespace for all tenant IDs.

**Rationale:**
- Notion uses `allura-*` naming
- Aligns with platform vision (Allura Agent-OS)
- Legacy `roninclaw-*` is deprecated

**Impact:**
- All new docs use `allura-*`
- All code must enforce `allura-*` pattern
- Legacy references are drift to be flagged

---

### 2026-04-04 — Documentation Canon Lock

**Decision:** `_bmad-output/planning-artifacts/` is the single source of truth for all human-curated documentation.

**Hierarchy:**
1. Notion Allura Memory Control Center — Product vision
2. `_bmad-output/planning-artifacts/*` — Implementation canon
3. `_bmad-output/planning-artifacts/*` — BMad outputs (superseded)
4. `_bmad-output/implementation-artifacts/*` — Sprint stories
5. `memory-bank/*` — Session context

**Impact:**
- BMad workflows read from `_bmad-output/planning-artifacts/*`
- When conflict, `_bmad-output/planning-artifacts/` wins
- Generated docs marked as superseded