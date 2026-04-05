# PRD Brief: Allura Agent-OS v2 — Persistent Memory & Multi-Tenant Governance

> **Last Updated:** 2026-04-05
> **Status:** ARCH-001 COMPLETE, 3 Critical Primitives Missing

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has been reviewed against `_bmad-output/planning-artifacts/` canon.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

Allura Agent-OS v2 transforms stateless session agents into goal-directed teammates with institutional memory. It provides a persistent, bitemporal memory graph (roninmemory), a governed execution environment (RuVix Kernel), multi-tenant workspace isolation (`group_id`), and a human-in-the-loop approval layer (Aegis + Paperclip).

---

## Table of Contents

- [1. Context & Problem](#1-context--problem)
- [2. Goals](#2-goals)
- [3. Non-Goals](#3-non-goals)
- [4. Users & Workspaces](#4-users--workspaces)
- [5. Core Requirements](#5-core-requirements)
- [6. Solution Overview](#6-solution-overview)
- [7. Key Decisions](#7-key-decisions)
- [8. Risks & Open Questions](#8-risks--open-questions)
- [9. Success Metrics](#9-success-metrics)
- [10. References](#10-references)

---

## 1. Context & Problem

### Background

Modern agentic systems start every session from zero. They cannot remember past decisions, learn from mistakes, or build institutional knowledge. Every agent run is stateless, ungoverned, and unauditable.

### Problem Statement

Agents lack persistent memory, multi-tenant isolation, and human governance — making them unsuitable for production workspaces where audit trails, data isolation, and controlled behavior changes are mandatory.

### Current State

- ✅ PostgreSQL and Neo4j containers running with MCP connectivity
- ✅ `groupIdEnforcer.ts` FIXED (ARCH-001 COMPLETE) — multi-layer enforcement implemented
- ✅ 7 OpenCode agents defined and integrated with memory pipeline
- ✅ 1,032+ traces logged to PostgreSQL (append-only)
- ✅ 7 Agent nodes created in Neo4j knowledge graph
- ⏳ Curator pipeline partially implemented — 2-phase commit not production-ready
- ⏳ No Paperclip dashboard deployed
- ⏳ OpenClaw gateway not configured
- ⏳ 3 critical primitives missing: Session Persistence, Workflow State, Token Budget

---

## 2. Goals

| # | Goal | Status | Rationale |
|---|------|--------|-----------|
| G1 | Fix `groupIdEnforcer.ts` (ARCH-001) | ✅ COMPLETE | Multi-layer enforcement implemented |
| G2 | Complete Curator 2-phase commit pipeline | ⏳ In Progress | Enables reliable PostgreSQL → Neo4j promotion |
| G3 | Deploy Paperclip dashboard | ⏳ Planned | Human governance interface for HITL approvals |
| G4 | Implement all 12 Anthropic Agent Primitives | ⏳ In Progress | 4/12 complete, 5/12 partial, 3/12 missing |
| G5 | Faith Meats Payload CMS live | ⏳ Planned | First production workspace (P1) |
| G6 | All 6 workspaces operational | ⏳ Planned | Full multi-tenant coverage |

---

## 3. Non-Goals

- No local execution outside Docker (except OpenClaw on Ubuntu)
- No PII in memory logs
- No agent self-modification without HITL gate
- No cloud-only lock-in — system must be self-hostable
- Not building custom MCP wrappers when catalog servers exist

---

## 4. Users & Workspaces

| Workspace | group_id | Impact | Priority |
|-----------|----------|--------|----------|
| Faith Meats | `allura-faith-meats` | Payload CMS + Next.js + HACCP | P1 |
| Creative Studio | `allura-creative` | Content + branding agents | P2 |
| Personal Assistant | `allura-personal` | Daily ops, scheduling | P2 |
| Nonprofit | `allura-nonprofit` | 501(c)(3) — different privilege rules | P3 |
| Bank Audits | `allura-audits` | GLBA data — most restricted | P3 |
| HACCP | `allura-haccp` | Food safety monitoring | P3 |

### User Stories (High-Level)

- As an **operator**, I want agents to remember past decisions so that I don't repeat the same mistakes every session.
- As a **workspace owner**, I want my data isolated from other workspaces so that no cross-tenant leakage occurs.
- As an **auditor**, I want a complete trail of every agent action so that I can reconstruct decisions months later.
- As a **governor**, I want to approve behavior-changing promotions before they go live so that agents don't autonomously modify their capabilities.

---

## 5. Core Requirements

### Must Have (P0)

| # | Requirement | Rationale |
|---|-------------|-----------|
| B1 | `group_id` enforced on every DB read/write | Zero cross-tenant leaks |
| B2 | PostgreSQL traces are append-only | Audit reconstruction |
| B3 | Neo4j insights use `SUPERSEDES` — never UPDATE | Immutable knowledge lineage |
| B4 | HITL approval required for behavior-changing promotions | Core governance invariant |
| B5 | All execution runs in Docker | Reproducibility, blast radius containment |
| B6 | Bun only — no npm or npx | Supply chain security |

### Should Have (P1)

| # | Requirement | Rationale |
|---|-------------|-----------|
| B7 | Curator 2-phase commit with compensating rollback | Atomic promotion across PG + Neo4j |
| B8 | Async Notion mirror (non-fatal) | Human review queue |
| B9 | Agent Contracts with capabilities, budgets, latency class | Deterministic agent lifecycle |
| B10 | Token budget pre-turn checks | No runaway spending |

### Nice to Have (P2+)

| # | Requirement | Notes |
|---|-------------|-------|
| B11 | ADAS evolutionary search for auto-agent design | Deferred to Epic 4 |
| B12 | DinD sandbox for untrusted code execution | Security hardening |
| B13 | OpenClaw Ubuntu gateway | Human comms channel |

---

## 6. Solution Overview

### Approach

Allura Agent-OS uses a 5-layer architecture parallel to a classical operating system. The RuVix Kernel (L1) provides proof-gated mutation. PostgreSQL + Neo4j (L2) separate raw traces from curated knowledge. OpenCode agents (L3) execute within governed contracts. Workflows and HITL gates (L4) orchestrate. Paperclip + OpenClaw (L5) provide human interfaces.

### Architecture Layers Touched

| Layer | Component | Change |
|-------|-----------|--------|
| L1 — Kernel (RuVix) | Proof-gated mutation | Modified — ARCH-001 fix |
| L2 — Services (PG + Neo4j) | Dual-persistence | Modified — Curator pipeline |
| L3 — Agent Runtime | OpenCode agents | New — 7 canonical agents |
| L4 — Workflow / DAGs | BMad workflows | New — HITL gates |
| L5 — User / Application | Paperclip + OpenClaw | New — human interfaces |

### Key Invariants (non-negotiable)

- `group_id` enforced on every DB read/write path
- PostgreSQL traces are append-only — no mutations
- Neo4j knowledge versioned via `SUPERSEDES` — no edits
- HITL approval required before any knowledge promotion
- Bun only — no `npm` or `npx`

---

## 7. Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Dual persistence | PostgreSQL (raw) + Neo4j (curated) | Separation of noise from signal |
| Steel Frame versioning | `SUPERSEDES` chain, never UPDATE | Immutable audit trail |
| Single-tier tenant isolation | `allura-*` `group_id` only | Two-tier added complexity without benefit |
| Bun exclusive | No npm/npx | Supply chain security |
| Docker-only execution | No local except OpenClaw | Reproducibility, blast radius |
| HITL governance | Human sign-off required | Prevents autonomous self-modification |

---

## 8. Risks & Open Questions

### Risks

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| RK-04 | Cross-tenant data leakage via missing `group_id` | High | ✅ RESOLVED — ARCH-001 complete |
| RK-10 | `group_id` confusion in queries | Medium | ✅ RESOLVED — ARCH-001 complete |
| RK-01 | Session crash = total state loss | High | 🔴 Open — Session Persistence missing |
| RK-02 | Runaway token costs | High | 🔴 Open — Token Budget missing |
| RK-03 | Notion API rate limits throttle mirror | Medium | ✅ Mitigated |
| RK-05 | DinD sandbox escape via kernel exploit | High | ✅ Mitigated |

### Open Questions

- [x] ~~What is the exact MCP_DOCKER networking fix for PostgreSQL/Neo4j connectivity?~~ — **RESOLVED:** MCP connectivity working
- [ ] When will Paperclip dashboard be deployed? — **Owner:** Product
- [ ] Which workspace goes live first after ARCH-001? — **Owner:** Winston
- [ ] How do we implement Session Persistence for crash recovery? — **Owner:** Engineering (P1)
- [ ] How do we implement Workflow State Machine? — **Owner:** Engineering (P1)
- [ ] How do we implement Token Budget Pre-Turn Checks? — **Owner:** Engineering (P1)

---

## 9. Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| `group_id` enforcement coverage | 100% — zero cross-tenant leaks | 100% | ✅ Complete |
| Agent session persistence | 100% — every run has AER | 0% | 🔴 Missing |
| PostgreSQL traces | Append-only, queryable | 1,032+ traces | ✅ Working |
| Neo4j knowledge graph | 7 Agent nodes, relationships | 7 nodes | ✅ Working |
| HITL approval rate | 100% — no unreviewed promotions | 0% | ⏳ Not implemented |
| Token budget compliance | 100% — no runaway costs | 0% | 🔴 Missing |
| Workflow state machine | Explicit state transitions | 0% | 🔴 Missing |
| Faith Meats Payload CMS live | Q2 2026 | Not started | ⏳ Planned |
| All 6 workspaces operational | Q3 2026 | Not started | ⏳ Planned |
| 12 Primitives implemented | Q2 2026 | 4/12 complete | ⏳ In Progress |

---

## 10. References

- [`_bmad-output/planning-artifacts/source-of-truth.md`](../_bmad-output/planning-artifacts/source-of-truth.md) — Document hierarchy
- [`_bmad-output/planning-artifacts/prd-v2.md`](../_bmad-output/planning-artifacts/prd-v2.md) — Master PRD
- [`_bmad-output/planning-artifacts/architectural-brief.md`](../_bmad-output/planning-artifacts/architectural-brief.md) — Architecture canon
- [`_bmad-output/planning-artifacts/agent-primitives-audit.md`](../_bmad-output/planning-artifacts/agent-primitives-audit.md) — 12 primitives scorecard vs. Claude Code
- [`_bmad-output/planning-artifacts/course-correction-agent-primitives.md`](../_bmad-output/planning-artifacts/course-correction-agent-primitives.md) — Gap analysis from Claude Code leak
- [`_bmad-output/planning-artifacts/epics.md`](../_bmad-output/planning-artifacts/epics.md) — Epic registry
- [`templates/BLUEPRINT.template.md`](./templates/BLUEPRINT.template.md) — Technical blueprint
- [`_bmad-output/implementation-artifacts/ARCH-001-rk01-fix.md`](../_bmad-output/implementation-artifacts/ARCH-001-rk01-fix.md) — RK-04 / RK-10 fix spec
