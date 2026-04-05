# PRD Brief: [Feature / Initiative Name]

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

<!-- One-paragraph plain-language summary: what is being built, who it serves, and why now. -->

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

<!-- Why does this initiative exist? What changed — in the business, the architecture, or the user needs — that makes this necessary now? -->

### Problem Statement

<!-- In one or two sentences: what specific problem are we solving, and for whom? -->

### Current State

<!-- What exists today? What breaks, fails, or is missing? Be concrete — name files, modules, or behaviors. -->

---

## 2. Goals

<!-- Ordered by priority. Each goal should be independently verifiable. -->

| # | Goal | Rationale |
|---|------|-----------|
| G1 | <!-- What we want to achieve --> | <!-- Why it matters --> |
| G2 | | |
| G3 | | |

---

## 3. Non-Goals

<!-- What is explicitly out of scope for this initiative. This prevents scope creep. -->

- <!-- Not doing X because Y -->
- <!-- Not doing X in this phase — deferred to Epic ## -->

---

## 4. Users & Workspaces

<!-- Who benefits from this? Which Allura workspaces are in scope? -->

| Workspace | group_id | Impact | Priority |
|-----------|----------|--------|----------|
| <!-- Faith Meats --> | `allura-faith-meats` | <!-- How they benefit --> | <!-- P1–P4 --> |
| <!-- Bank Audits --> | `allura-audits` | | |

### User Stories (High-Level)

<!-- Brief narrative format — not detailed acceptance criteria (those live in EPIC.template.md) -->

- As a **[role]**, I want **[capability]** so that **[outcome]**.
- As a **[role]**, I want **[capability]** so that **[outcome]**.

---

## 5. Core Requirements

### Must Have (P0)

| # | Requirement | Rationale |
|---|-------------|-----------|
| B1 | <!-- Non-negotiable requirement --> | <!-- Why it is required --> |
| B2 | | |

### Should Have (P1)

| # | Requirement | Rationale |
|---|-------------|-----------|
| B3 | <!-- Important but not blocking --> | |

### Nice to Have (P2+)

| # | Requirement | Notes |
|---|-------------|-------|
| B4 | <!-- Deferred or optional --> | |

---

## 6. Solution Overview

<!-- High-level description of the proposed approach. Not a tech spec — that goes in BLUEPRINT.template.md and SOLUTION-ARCHITECTURE.template.md. -->

### Approach

<!-- 3–5 sentences: what are we building, how does it fit into the 5-layer Allura architecture, and what is the key design choice? -->

### Architecture Layers Touched

| Layer | Component | Change |
|-------|-----------|--------|
| L1 — Kernel (RuVix) | | <!-- None \| Modified \| New --> |
| L2 — Services (PG + Neo4j) | | |
| L3 — Agent Runtime | | |
| L4 — Workflow / DAGs | | |
| L5 — User / Application | | |

### Key Invariants (non-negotiable)

- `group_id` enforced on every DB read/write path
- PostgreSQL traces are append-only — no mutations
- Neo4j knowledge versioned via `SUPERSEDES` — no edits
- HITL approval required before any knowledge promotion
- Bun only — no `npm` or `npx`

---

## 7. Key Decisions

<!-- Decisions that shape this initiative. Full ADR detail goes in RISKS-AND-DECISIONS.template.md. -->

| Decision | Choice | Rationale |
|----------|--------|-----------|
| <!-- What was decided --> | <!-- The chosen option --> | <!-- Why --> |

---

## 8. Risks & Open Questions

### Risks

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| RK-## | <!-- Short title --> | <!-- High \| Medium \| Low --> | <!-- 🔴 Open \| ✅ Mitigated --> |

### Open Questions

<!-- Questions that must be answered before or during implementation. -->

- [ ] <!-- Question --> — **Owner:** <!-- who resolves this -->
- [ ] <!-- Question --> — **Owner:**

---

## 9. Success Metrics

<!-- How do we know this initiative succeeded? Prefer measurable, binary criteria. -->

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| <!-- e.g., Tests passing --> | <!-- e.g., 100% --> | <!-- e.g., bun test --> |
| <!-- e.g., group_id enforced --> | <!-- All paths --> | <!-- grep audit --> |
| <!-- e.g., Time to onboard workspace --> | <!-- < 30 min --> | <!-- Manual test --> |

---

## 10. References

- [`_bmad-output/planning-artifacts/source-of-truth.md`](../_bmad-output/planning-artifacts/source-of-truth.md) — Document hierarchy
- [`_bmad-output/planning-artifacts/epics.md`](../_bmad-output/planning-artifacts/epics.md) — Epic registry
- [`_bmad-output/planning-artifacts/prd-v2.md`](../_bmad-output/planning-artifacts/prd-v2.md) — Master PRD
- [`_bmad-output/planning-artifacts/architectural-brief.md`](../_bmad-output/planning-artifacts/architectural-brief.md) — Architecture canon
- [`templates/EPIC.template.md`](./EPIC.template.md) — Epic & story breakdown
- [`templates/BLUEPRINT.template.md`](./BLUEPRINT.template.md) — Technical blueprint
- <!-- Link to Notion page if applicable -->
