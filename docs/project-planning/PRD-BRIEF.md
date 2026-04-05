# PRD Brief: Allura Agent-OS v2 — Persistent Memory & Multi-Tenant Governance

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

- PostgreSQL and Neo4j containers running but MCP connectivity broken
- `groupIdEnforcer.ts` is broken (ARCH-001) — blocks all multi-tenant features
- 7 OpenCode agents defined but not fully integrated with memory pipeline
- Curator pipeline partially implemented — 2-phase commit not production-ready
- No Paperclip dashboard deployed
- OpenClaw gateway not configured

---

## 2. Goals

| # | Goal | Rationale |
|---|------|-----------|
| G1 | Fix `groupIdEnforcer.ts` (ARCH-001) | Blocks everything — no multi-tenant work without it |
| G2 | Complete Curator 2-phase commit pipeline | Enables reliable PostgreSQL → Neo4j promotion |
| G3 | Deploy Paperclip dashboard | Human governance interface for HITL approvals |
| G4 | Implement all 12 Anthropic Agent Primitives | Production readiness for any workspace |
| G5 | Faith Meats Payload CMS live | First production workspace (P1) |
| G6 | All 6 workspaces operational | Full multi-tenant coverage |

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
| RK-04 | Cross-tenant data leakage via missing `group_id` | High | 🔴 Open — ARCH-001 |
| RK-10 | `group_id` confusion in queries | Medium | 🔴 Open — ARCH-001 |
| RK-05 | DinD sandbox escape via kernel exploit | High | ✅ Mitigated |
| RK-03 | Notion API rate limits throttle mirror | Medium | ✅ Mitigated |

### Open Questions

- [ ] What is the exact MCP_DOCKER networking fix for PostgreSQL/Neo4j connectivity? — **Owner:** Infrastructure
- [ ] When will Paperclip dashboard be deployed? — **Owner:** Product
- [ ] Which workspace goes live first after ARCH-001? — **Owner:** Winston

---

## 9. Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| `group_id` enforcement coverage | 100% — zero cross-tenant leaks | grep audit + schema constraint |
| Agent session persistence | 100% — every run has AER | Trace audit |
| HITL approval rate | 100% — no unreviewed promotions | Notion queue audit |
| Token budget compliance | 100% — no runaway costs | Budget enforcement logs |
| Faith Meats Payload CMS live | Q2 2026 | Deployment verification |
| All 6 workspaces operational | Q3 2026 | Workspace health check |
| 12 Primitives implemented | Q2 2026 | Primitive checklist |

---

## 10. References

- [`_bmad-output/planning-artifacts/source-of-truth.md`](../_bmad-output/planning-artifacts/source-of-truth.md) — Document hierarchy
- [`_bmad-output/planning-artifacts/prd-v2.md`](../_bmad-output/planning-artifacts/prd-v2.md) — Master PRD
- [`_bmad-output/planning-artifacts/architectural-brief.md`](../_bmad-output/planning-artifacts/architectural-brief.md) — Architecture canon
- [`_bmad-output/planning-artifacts/epics.md`](../_bmad-output/planning-artifacts/epics.md) — Epic registry
- [`templates/BLUEPRINT.template.md`](./templates/BLUEPRINT.template.md) — Technical blueprint
- [`_bmad-output/implementation-artifacts/ARCH-001-rk01-fix.md`](../_bmad-output/implementation-artifacts/ARCH-001-rk01-fix.md) — RK-04 / RK-10 fix spec
