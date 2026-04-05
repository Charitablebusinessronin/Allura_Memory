# 📚 Allura Documentation — Source of Truth

**Version:** 1.0  
**Date:** 2026-04-04  
**Status:** Canon Lock  
**Maintainer:** Winston (Architect)

---

## Canonical Hierarchy

When documents conflict, follow this precedence:

| Priority | Source | Scope | Notes |
|----------|--------|-------|-------|
| 1 | **Notion — Allura Memory Control Center** | Product vision, priorities | Product owner maintains |
| 2 | **`_bmad-output/planning-artifacts/*`** | Planning canon | PRD, architecture, epics, ADRs |
| 3 | **`_bmad-output/implementation-artifacts/*`** | Implementation canon | Specs, schemas, plugin docs |
| 4 | **`docs/_archive/*`** | Historical reference | Superseded documents |
| 5 | **`memory-bank/*`** | Session context | Working memory, not canon |

---

## Governance Rule

> **Allura governs. Runtimes execute. Curators promote.**

This rule is the architectural invariant that applies across all documentation:
- **Allura** is the governance layer (Paperclip dashboard, approval workflows, ADRs)
- **Runtimes** (OpenCode, OpenClaw, ADAS) execute within governed constraints
- **Curators** propose knowledge promotion; **Auditors** approve via HITL

---

## Canonical Naming Convention

### Tenant Namespace

**Standard:** All tenant `group_id` values use the `allura-*` namespace.

| Workspace | `group_id` | Type | Priority |
|-----------|------------|------|----------|
| 🥩 Faith Meats | `allura-faith-meats` | For-profit | P1 |
| 🎨 Creative Studio | `allura-creative` | For-profit | P2 |
| 👤 Personal Assistant | `allura-personal` | For-profit | P2 |
| 🏛️ Nonprofit | `allura-nonprofit` | Nonprofit | P3 |
| 🏦 Bank Audits | `allura-audits` | For-profit | P3 |
| 🌡️ HACCP | `allura-haccp` | For-profit | P3 |

**Legacy naming** (`roninclaw-*`) appears in historical documents but is **not canon**. If you see `roninclaw-*` in active code or specs, treat it as drift needing correction.

---

## Document Registry

### Product Canon (Notion)

| Page | Canonical For | URL |
|------|---------------|-----|
| Allura Memory Control Center | Product dashboard, priorities | `https://www.notion.so/3371d9be65b381a9b3bec24275444b68` |
| Architectural Brief | 5-layer OS model, proof-gated mutation | `https://www.notion.so/3381d9be65b3814a8d4dcd29f45791b8` |
| PRD — Allura Agent-OS v2 | Product requirements | `https://www.notion.so/3381d9be65b381b499e8f9b492c0b754` |
| Architectural Decisions | ADR registry | `https://www.notion.so/2ceffe07124b4bf487a27c703e0ee954b` |
| Tenant & Memory Boundary Spec | Isolation, audit, promotion rules | `https://www.notion.so/3371d9be65b381b3ad87f7e8f0fe3289b` |

### Planning Canon (`_bmad-output/planning-artifacts/`)

| File | Status | Purpose |
|------|--------|---------|
| `source-of-truth.md` | ✅ Canonical | Document hierarchy and governance rules |
| `prd-v2.md` | ✅ Canonical | PRD — Allura Agent-OS v2 |
| `architectural-brief.md` | ✅ Canonical | 5-layer architecture (RuVix kernel, proof-gated mutation) |
| `architectural-decisions.md` | ✅ Canonical | AD-01–AD-16 + RK-01–RK-10 (promoted from archive) |
| `requirements-matrix.md` | ✅ Canonical | B1–B16 + F1–F33 traceability (promoted from archive) |
| `epics.md` | ✅ Canonical | Epic and story definitions |
| `tenant-memory-boundary-spec.md` | ✅ Canonical | Tenant isolation, audit, promotion rules |
| `README.md` | ✅ Canonical | Index |

### Implementation Artifacts (`_bmad-output/implementation-artifacts/`)

| File | Status | Purpose |
|------|--------|---------|
| `ARCH-001-rk01-fix.md` | ✅ Canonical | RK-01 groupIdEnforcer fix spec |
| `sprint-status.yaml` | ✅ Canonical | Sprint tracker — all epics and stories |
| `solution-architecture.md` | ✅ Canonical | Mermaid diagrams, component topology, API surface (promoted from archive) |
| `data-dictionary.md` | ✅ Canonical | Full PG + Neo4j schema definitions (promoted from archive) |
| `postgres-notion-trace-sync.md` | ✅ Canonical | Postgres → Notion trace sync spec |
| `payload-schema.md` | ✅ Canonical | Payload CMS schema definitions |
| `opencode-plugin-spec.md` | ✅ Canonical | OpenCode plugin specification |
| `claude-code-plugin-spec.md` | ✅ Canonical | Claude Code plugin specification |
| `openclaw-plugin-spec.md` | ✅ Canonical | OpenClaw plugin specification |
| `mcp-docker-integration.md` | ✅ Canonical | MCP Docker tools usage |
| `quick-start.md` | ✅ Canonical | Getting started guide |
| `memory-ui.md` | ✅ Canonical | Memory system UI design |
| `ux-specs/allura-control-center.md` | ✅ Canonical | Paperclip dashboard UX |
| `ux-specs/openclaw-gateway.md` | ✅ Canonical | OpenClaw gateway UX |
| `ux-specs/paperclip-dashboard.md` | ✅ Canonical | Management interface UX |
| `error-patterns/opencode-config-errors.md` | ✅ Canonical | OpenCode configuration errors |

### Historical Reference (`docs/_archive/`)

Superseded documents are archived at `docs/_archive/20260404/`. Read for historical context only — all canon lives in `_bmad-output/planning-artifacts/`.

| Archived Path | Canonical Replacement |
|---------------|-----------------------|
| `_archive/.../planning-artifacts/prd.md` | `_bmad-output/planning-artifacts/prd-v2.md` |
| `_archive/.../planning-artifacts/prd-v2.md` | `_bmad-output/planning-artifacts/prd-v2.md` |
| `_archive/.../planning-artifacts/architecture.md` | `_bmad-output/planning-artifacts/architectural-brief.md` |
| `_archive/.../planning-artifacts/tenant-memory-boundary-spec.md` | `_bmad-output/planning-artifacts/tenant-memory-boundary-spec.md` |
| `_archive/.../planning-artifacts/ux-spec-*.md` | `_bmad-output/implementation-artifacts/ux-specs/*.md` |
| `_archive/.../migration/` | Completed — no replacement needed |

---

## Architecture Canon

### 5-Layer Model (Authoritative)

| Layer | Component | Runs On | Purpose |
|-------|-----------|---------|---------|
| L1 | RuVix Kernel | Docker | Proof-gated mutation kernel |
| L2 | PostgreSQL 16 + Neo4j 5.26 | Docker | Raw events (PG) + curated knowledge (Neo4j) |
| L3 | Agent Runtime (OpenCode) | Docker | Primary agent framework |
| L4 | Workflow / DAGs / A2A Bus | Docker | Orchestration and inter-agent communication |
| L5 | Paperclip + OpenClaw | Docker/Ubuntu | Human interfaces |

**Source:** `_bmad-output/planning-artifacts/architectural-brief.md` + Notion Architectural Brief

### Old Model (Deprecated)

The 3-layer brownfield decision log in `_bmad-output/planning-artifacts/architecture.md` is **not canon** for the Allura platform. It documents historical decisions for the roninmemory codebase before the Allura convergence.

---

## First Production Workflow

**Bank-auditor (`allura-audits`)** is the first production workflow.

**Critical Blocker:** RK-01 — `groupIdEnforcer.ts` must be fixed before any multi-tenant feature work proceeds. See `_bmad-output/implementation-artifacts/ARCH-001-rk01-fix.md`.

---

## Agent Taxonomy (Canon)

### Core Agents

| Agent | Role | Latency Class |
|-------|------|---------------|
| Curator | Sifts PostgreSQL traces → proposes Neo4j insights | DT |
| Auditor (HITL) | Aegis quality gate — human sign-off | DT |
| Meta-Agent (ADAS) | Iteratively improves agent building blocks | SRT |
| Planner | Strategic decomposition, sprint planning | SRT |
| Builder | Implementation agent | RT |
| Orchestrator | Workflow coordination | SRT |
| Architect | Design authority, ADR authoring | SRT |

### Workflow-Specific Agents (Paperclip)

| Workspace | Agent | Purpose |
|-----------|-------|---------|
| `allura-faith-meats` | faithmeats-agent | Payload CMS management, HACCP |
| `allura-audits` | audits-agent | Bank audit automation |
| `allura-creative` | creative-agent | Content production |
| `allura-personal` | personal-agent | Daily ops, scheduling |
| `allura-nonprofit` | nonprofit-agent | Grant/donor management |
| `allura-haccp` | haccp-agent | Food safety monitoring |

---

## Drift Detection

If you see any of these in active documents, flag as drift:

1. `roninclaw-*` naming in new specs → Should be `allura-*`
2. 3-layer architecture references → Should be 5-layer RuVix model
3. OpenAgentsControl / ClawCoder / ClawAgent references → Should be OpenCode/ADAS/Curator
4. "Memory system" language without Allura context → Should specify Allura Agent-OS
5. Missing `group_id` in schema definitions → Must include tenant key

---

## How to Update This Document

This file is locked. To propose changes:

1. Create ADR in `_bmad-output/planning-artifacts/architectural-decisions.md`
2. Get approval from Architect (Winston) + Product (Notion update)
3. Update this file with new canonical decision
4. Add supersession headers to old documents

---

## BMad Workflow Integration

### How BMad Works with This Canon

**BMad Config** (`_bmad/bmm/config.yaml`) tells workflows where to read/write:

| Direction | Path | Purpose |
|-----------|------|---------|
| READ | `{project-root}/docs/` | Input context (includes `_bmad-output/planning-artifacts/`) |
| WRITE | `_bmad-output/planning-artifacts/` | Generated PRDs, architecture, UX specs |
| WRITE | `_bmad-output/implementation-artifacts/` | Sprint stories, tech specs |

**When BMad runs a workflow:**
1. Reads `_bmad-output/planning-artifacts/*` for canon context
2. Generates artifacts to `_bmad-output/planning-artifacts/` or `_bmad-output/implementation-artifacts/`
3. If conflict, `_bmad-output/planning-artifacts/` wins (this file establishes hierarchy)

### Agent & Skill Registry

**7 OpenCode Agents** (Winston's hands):
- `MemoryOrchestrator` - BMad workflow coordination
- `MemoryArchitect` - System design lead
- `MemoryBuilder` - Infrastructure implementation
- `MemoryAnalyst` - Memory system metrics
- `MemoryCopywriter` - Agent prompt writing
- `MemoryRepoManager` - Git operations
- `MemoryScribe` - Documentation/specs

**70 BMad Skills** (from `_bmad/_config/skill-manifest.csv`):
- Analysis: `bmad-product-brief`, `bmad-market-research`, `bmad-domain-research`
- Planning: `bmad-create-prd`, `bmad-create-ux-design`, `bmad-validate-prd`
- Solutioning: `bmad-create-architecture`, `bmad-create-epics-and-stories`
- Implementation: `bmad-dev-story`, `bmad-quick-dev`, `bmad-sprint-planning`

### Workflow Output Directories

| Directory | Purpose | Who Writes |
|-----------|---------|-----------|
| `_bmad-output/planning-artifacts/` | Human canon | You |
| `_bmad-output/planning-artifacts/` | BMad outputs | BMad workflows |
| `_bmad-output/implementation-artifacts/` | Sprint stories | BMad workflows |
| `bmad-output/` | Unused legacy | **DELETE** |

---

## References

- [Notion — Allura Memory Control Center](https://www.notion.so/3371d9be65b381a9b3bec24275444b68)
- [BMad Agent Manifest](../_bmad/_config/agent-manifest.csv)
- [BMad Skill Manifest](../_bmad/_config/skill-manifest.csv)
- [BMad Configuration](../_bmad/bmm/config.yaml)
- [Memory Bank — System Patterns](../../memory-bank/systemPatterns.md)
- [Agent Instructions](../.opencode/context/navigation.md)

---

**Lock Date:** 2026-04-04  
**Next Review:** When first production workflow (bank-auditor) goes live