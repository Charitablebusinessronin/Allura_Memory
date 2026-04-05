# Epic [E##]: [Epic Name]

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

<!-- One-paragraph summary of what this epic delivers, why it matters, and which workspace or business goal it serves. -->

---

## Table of Contents

- [1. Epic Overview](#1-epic-overview)
- [2. Goals & Success Criteria](#2-goals--success-criteria)
- [3. Stories](#3-stories)
- [4. Architecture Impact](#4-architecture-impact)
- [5. Dependencies & Blockers](#5-dependencies--blockers)
- [6. Risks](#6-risks)
- [7. Definition of Done](#7-definition-of-done)
- [8. References](#8-references)

---

## 1. Epic Overview

| Field | Detail |
|-------|--------|
| **Epic ID** | E## |
| **Name** | <!-- Short epic name --> |
| **Status** | <!-- planned \| in-progress \| complete --> |
| **Priority** | <!-- P0 \| P1 \| P2 \| P3 \| P4 --> |
| **workspace / group_id** | <!-- allura-{org} or "platform" --> |
| **Owner** | <!-- Agent or human responsible --> |
| **Target Sprint** | <!-- Sprint or date range --> |

### Problem Statement

<!-- What problem does this epic solve? Who is affected? What breaks if this is not done? -->

### Scope

**In scope:**
- <!-- Bullet list of what this epic delivers -->

**Out of scope:**
- <!-- Bullet list of what is explicitly excluded -->

---

## 2. Goals & Success Criteria

### Business Goals

| # | Goal | Metric |
|---|------|--------|
| G1 | <!-- Operator-facing outcome --> | <!-- How to measure success --> |
| G2 | | |

### Acceptance Criteria

<!-- What must be true for this epic to be considered complete? -->

- [ ] <!-- Criterion 1 -->
- [ ] <!-- Criterion 2 -->
- [ ] <!-- Criterion 3 -->

---

## 3. Stories

<!-- List all stories in this epic. Each story should be independently deliverable. -->

| Story | Title | Status | Blocked By |
|-------|-------|--------|------------|
| [S##-01](#s##-01-story-title) | <!-- Title --> | <!-- ready-for-dev \| in-progress \| complete \| blocked --> | <!-- Story or ARCH ID, or — --> |
| [S##-02](#s##-02-story-title) | <!-- Title --> | | |

---

### S##-01: [Story Title]

**Status:** `<!-- ready-for-dev | in-progress | complete | blocked -->`
**Priority:** <!-- P0–P4 -->
**Goal:** <!-- One sentence: what this story delivers -->

**Acceptance Criteria:**
- [ ] <!-- Criterion -->
- [ ] <!-- Criterion -->

**Implementation Notes:**
<!-- Key files, patterns, or constraints relevant to this story -->

**Definition of Done:**
- [ ] Tests written and passing
- [ ] `group_id` enforced on all DB paths
- [ ] TypeScript strict — no `any`
- [ ] Documentation updated

---

### S##-02: [Story Title]

**Status:** `<!-- ready-for-dev | in-progress | complete | blocked -->`
**Priority:** <!-- P0–P4 -->
**Goal:** <!-- One sentence -->

**Acceptance Criteria:**
- [ ] <!-- Criterion -->

**Definition of Done:**
- [ ] Tests written and passing
- [ ] `group_id` enforced on all DB paths
- [ ] TypeScript strict — no `any`
- [ ] Documentation updated

---

<!-- Copy the story block above for each additional story. -->

---

## 4. Architecture Impact

<!-- Which layers of the 5-layer Allura architecture does this epic touch? -->

| Layer | Component | Impact |
|-------|-----------|--------|
| L1 — Kernel (RuVix) | <!-- component --> | <!-- None \| Read \| Write \| New --> |
| L2 — Services (PG + Neo4j) | <!-- component --> | |
| L3 — Agent Runtime | <!-- component --> | |
| L4 — Workflow / DAGs | <!-- component --> | |
| L5 — User / Application | <!-- component --> | |

### New Invariants Introduced

<!-- Any new architecture rules this epic adds that future work must respect. -->

- <!-- Invariant -->

---

## 5. Dependencies & Blockers

| ID | Type | Description | Status |
|----|------|-------------|--------|
| <!-- ARCH-001 --> | <!-- Blocker \| Dependency --> | <!-- What must be done first --> | <!-- 🔴 Open \| ✅ Resolved --> |

---

## 6. Risks

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| [RK-##](#rk--short-title) | <!-- Short title --> | <!-- High \| Medium \| Low --> | <!-- 🔴 Open \| ✅ Mitigated --> |

### RK-##: [Short title]

| Field | Detail |
|-------|--------|
| **Severity** | <!-- High \| Medium \| Low --> |
| **Likelihood** | <!-- High \| Medium \| Low --> |
| **Status** | <!-- 🔴 Open \| ✅ Mitigated --> |
| **Description** | <!-- What can go wrong --> |
| **Mitigation** | <!-- How it is managed --> |

---

## 7. Definition of Done

Epic is complete when **all** of the following are true:

- [ ] All stories marked `complete`
- [ ] All acceptance criteria checked off
- [ ] `bun test` passes (no regressions)
- [ ] `bun run typecheck` passes
- [ ] `group_id` enforced on every new DB path
- [ ] ADR logged in `_bmad-output/planning-artifacts/architectural-decisions.md` for any new architectural decision
- [ ] Memory bank updated: `memory-bank/progress.md` and `memory-bank/activeContext.md`
- [ ] HITL approval obtained for any Neo4j knowledge promotion

---

## 8. References

- [`_bmad-output/planning-artifacts/epics.md`](../_bmad-output/planning-artifacts/epics.md) — Master epic registry
- [`_bmad-output/planning-artifacts/architectural-brief.md`](../_bmad-output/planning-artifacts/architectural-brief.md) — Architecture canon
- [`_bmad-output/planning-artifacts/source-of-truth.md`](../_bmad-output/planning-artifacts/source-of-truth.md) — Document hierarchy
- <!-- Link to related BLUEPRINT.template.md, DESIGN-*.md, or PRD-BRIEF.template.md -->
