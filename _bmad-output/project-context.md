# Project Context — roninmemory (Allura Agent-OS)

> **Generated:** 2026-04-04  
> **Type:** Brownfield — established codebase with active development  
> **Rule:** Allura governs. Runtimes execute. Curators promote.

---

## What This Project Is

**roninmemory** is the memory engine for the **Allura Agent-OS** — a 5-layer, Docker-first AI operating system that gives agents persistent, governed, multi-tenant memory across sessions.

It solves the core problem of stateless AI: agents forget everything between runs. Allura provides dual-database persistence (PostgreSQL for raw traces + Neo4j for curated knowledge), tenant isolation via `group_id`, and human-in-the-loop approval before any knowledge is promoted.

---

## Critical Blocker

**ARCH-001 / RK-01** — `src/lib/runtime/groupIdEnforcer.ts` is broken. Until fixed, no multi-tenant feature can safely proceed. See `_bmad-output/implementation-artifacts/ARCH-001-rk01-fix.md`.

---

## Architecture (5 Layers)

| Layer | Component | Runs On |
|-------|-----------|---------|
| L1 | RuVix Kernel (proof-gated mutation) | Docker |
| L2 | PostgreSQL 16 + Neo4j 5.26 | Docker |
| L3 | Agent Runtime (OpenCode) | Docker |
| L4 | Workflow / DAGs / A2A Bus | Docker |
| L5 | Paperclip + OpenClaw | Docker / Ubuntu |

---

## Tenants

| Workspace | `group_id` | Priority |
|-----------|------------|----------|
| 🥩 Faith Meats | `allura-faith-meats` | P1 |
| 🎨 Creative Studio | `allura-creative` | P2 |
| 👤 Personal Assistant | `allura-personal` | P2 |
| 🏛️ Nonprofit | `allura-nonprofit` | P3 |
| 🏦 Bank Audits | `allura-audits` | P3 |
| 🌡️ HACCP | `allura-haccp` | P3 |

---

## Tech Stack

- **Runtime:** Bun (npm/npx banned)
- **Language:** TypeScript 5.7 strict
- **DB:** PostgreSQL 16 (append-only traces) + Neo4j 5.26 + APOC (versioned knowledge)
- **CMS:** Payload CMS + Next.js (Faith Meats)
- **Protocols:** MCP (tools), A2A (agents)
- **DB Access:** MCP_DOCKER tools only — never `docker exec`

---

## Non-Negotiable Invariants

1. `group_id` on every DB read/write — missing it causes schema constraint failure
2. PostgreSQL traces are append-only — no UPDATE/DELETE ever
3. Neo4j versioning via `SUPERSEDES` — never edit nodes, create new versions
4. HITL required for all Neo4j knowledge promotion
5. `allura-*` tenant namespace — `roninclaw-*` is deprecated drift

---

## What Is Already Built

The core memory system is implemented. Archive documentation confirms B1–B16 all `✅ Implemented`:

- PostgreSQL dual-store with full schema (`tenants`, `events`, `adas_runs`, `adas_trace_events`, `curator_queue`, `agents`, `notion_sync_log`, `decisions`, `audit_history`, `rule_versions`)
- Neo4j knowledge graph with `SUPERSEDES` versioning, `InsightHead` tracking, `TenantScope_*` labels
- Curator 2-phase promotion pipeline with `trg_auto_enqueue_curator` + `trg_promotion_guard` triggers
- ADAS evolutionary search with DinD sandbox, OllamaClient, fitness scoring
- `before_prompt_build` / `after_tool_call` hooks
- MemoryOrchestrator Brooks-bound governance
- 16 architectural decisions (AD-01–AD-16), all decided
- 33 functional requirements (F1–F33), 31 implemented, 2 pending (F29–F30 MemFS)

**What is NOT yet done:** `groupIdEnforcer.ts` (ARCH-001) — the tenant validation layer is broken despite the schema being correct.

---

## Sprint Status

See `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Current:**
- ARCH-001 → `ready-for-dev` (🔴 critical blocker)
- Epic 1 → `in-progress` (stories 1.3, 1.4 done; 1.1, 1.2, 1.5–1.7 backlog pending ARCH-001)
- Epic 2 → `in-progress` (all 4 stories done)
- Epics 3–6 → `backlog`

---

## Key Paths

| What | Where |
|------|-------|
| Planning canon | `_bmad-output/planning-artifacts/` |
| Implementation specs | `_bmad-output/implementation-artifacts/` |
| Permanent project knowledge | `docs/` |
| Source code | `src/` |
| Agent definitions | `.opencode/agent/` |
| Claude commands | `.claude/commands/` |
| BMad config | `_bmad/bmm/config.yaml` |
| Memory bank | `memory-bank/` |
