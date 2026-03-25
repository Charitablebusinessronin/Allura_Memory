# Active Context: Allura's Memory

## Project Status: PRODUCTION READY

**All 6 Epics Complete** — 1854+ tests passing, system fully operational.

---

## Completed Epics

| Epic | Status | Stories | Tests |
|------|--------|---------|-------|
| Epic 1: Persistent Knowledge Capture | ✅ Complete | 7 stories | 400+ |
| Epic 2: ADAS Discovery Pipeline | ✅ Complete | 5 stories | 250+ |
| Epic 3: Governed Runtime | ✅ Complete | 7 stories | 350+ |
| Epic 4: Knowledge Lifting Pipeline | ✅ Complete | 6 stories | 300+ |
| Epic 5: Notion Integration Hardening | ✅ Complete | 6 stories | 300+ |
| Epic 6: Agent Persistence & Lifecycle | ✅ Complete | 10 stories | 254+ |

**Total:** 40 stories implemented, 1854+ tests passing

---

## Current Focus

**OpenCode Configuration Migration**

Migrated from global to project-only OpenCode setup:
- ✅ Created `.opencode/` directory structure
- ✅ Copied `oh-my-opencode.json` to project (project precedence)
- ✅ Removed `oh-my-opencode@latest` plugin from global config
- ✅ Migrated 10 user-installed skills to `.opencode/skills/`
- ✅ Removed all skills from `.opencode/skills/` (using built-ins only)
- ✅ Added `.opencode/oh-my-opencode.json` to `.gitignore`

**Result**: Project now uses built-in OpenCode skills only (playwright, git-master, frontend-ui-ux, dev-browser).

---

## Architecture Overview

### 4-Layer Memory Stack (Memory Card)

```
Agent Layer (OhMyOpenCode, OpenClaw)
    ↓ uses MCP_DOCKER commands
MCP_DOCKER CLI (mcp-add, mcp-exec, etc.)
    ↓ pulls from Docker Hub MCP registry
MCP Servers (ronin-memory, notion-mcp, github-mcp, etc.)
    ↓ connect to
Data Sources (PostgreSQL, Neo4j, Notion, GitHub)

AI Reasoning (OpenClaw)
    ↓ Traces logged to
Raw Trace Layer (PostgreSQL)
    ↓ Promotion Gate (HITL)
Promoted Knowledge (Neo4j)
    ↓ Mirroring
Human Workspace (Notion)
```

### 6-Layer Memory Architecture

1. **Raw Memory** (PostgreSQL) — Append-only event logs
2. **Semantic Memory** (Neo4j) — Knowledge graph with versioned insights
3. **Control** (Ralph) — Self-correcting execution loops
4. **Discovery** (ADAS) — Automated agent design testing
5. **Governance** (Policy Gateway) — HITL approval gates, circuit breakers
6. **Audit** (ADR) — 5-layer Agent Decision Records

---

## Key Patterns

### Steel Frame Versioning
- All Insights are immutable
- New versions link to old via `SUPERSEDES` edges
- Query "current truth" by filtering incoming SUPERSEDES

### HITL Knowledge Promotion
Agents CANNOT autonomously promote to Neo4j/Notion:
```
PostgreSQL Trace (candidate)
    ↓ Curator proposes
Notion Approval Page
    ↓ Human approves
Neo4j Insight (active)
```

### group_id Multi-Tenancy
- Every node MUST have `group_id` property
- Schema constraint enforces tenant isolation
- Dual-context queries: project + global insights

---

## Infrastructure Status

| Service | Status | URL |
|---------|--------|-----|
| PostgreSQL 16 | ✅ Healthy | `localhost:5432` |
| Neo4j 5.26 + APOC | ✅ Healthy | `http://localhost:7474` |

---

## Documentation Locations

| Location | Purpose |
|----------|---------|
| `AGENTS.md` | Agent coding guide, patterns, rules |
| `README.md` | Project overview, quick start |
| `memory-bank/activeContext.md` | Current work focus |
| `memory-bank/progress.md` | Completed work log |
| `memory-bank/systemPatterns.md` | Architecture patterns |
| `memory-bank/techContext.md` | Tech stack, environment |
| `archive/bmad-output/INDEX.md` | Historical artifact index |

---

## Open Items

1. **Qwen3-Embedding-8B Integration** — Local embeddings available for semantic search
2. **Documentation Polish** — Consolidate remaining archive references
3. **OpenCode Skills Strategy** — Decide which skills to re-install to project (if any)

---

*Last Updated: 2026-03-25*
