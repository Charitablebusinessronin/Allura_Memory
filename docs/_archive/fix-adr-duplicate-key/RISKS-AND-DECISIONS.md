# Fix ADR Duplicate Key Issue: Risks and Decisions

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed. This is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

---

## Table of Contents

- [1. Architectural Decisions](#1-architectural-decisions)
- [2. Risks](#2-risks)

---

## 1. Architectural Decisions

---

### AD-01: Pre-insert uniqueness check

| Field | Detail |
|-------|--------|
| **Status** | Decided |
| **Decision** | Before inserting an ADR, query PostgreSQL with `findById()` to verify the ID does not already exist. If it exists, regenerate before attempting insert. |
| **Rationale** | Catches collisions in the single-threaded path before hitting the unique constraint, reducing database errors and log noise. |
| **Alternatives considered** | Skip pre-check, rely on try-catch only — rejected because it generates unnecessary database errors. |
| **Consequences** | Extra SELECT query per ADR creation. Acceptable tradeoff for reliability. |
| **Owner** | Memory project team |
| **References** | [BLUEPRINT.md](BLUEPRINT.md) §6 "Uniqueness Check" |

---

### AD-02: Counter-based entropy for ID generation

| Field | Detail |
|-------|--------|
| **Status** | Decided |
| **Decision** | Add a module-level counter to `generateId()` that increments on each call. Include this counter as part of the ID: `adr_random_timestamp_counter`. |
| **Rationale** | Provides monotonic increasing sequence within a process, eliminating collisions from same-millisecond calls. Counter is simpler than microsecond precision or process ID. |
| **Alternatives considered** | Microsecond precision — rejected (not available in standard JS). Process ID — rejected (would require Node.js-specific APIs). UUID — rejected (breaks existing format convention). |
| **Consequences** | IDs become slightly longer. Existing IDs remain valid. New IDs have extra `_counter` suffix. |
| **Owner** | Memory project team |
| **References** | [BLUEPRINT.md](BLUEPRINT.md) §6, [DATA-DICTIONARY.md](DATA-DICTIONARY.md) §ID Generation Format |

---

## 2. Risks

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| [RK-01](#rk-01-residual-id-collisions) | Residual ID collisions after fix | Low | 🔴 Open |
| [RK-02](#rk-02-race-condition-across-processes) | Race condition across multiple processes | Low | 🔴 Open |
| [RK-03](#rk-03-performance-impact) | Performance impact from pre-check queries | Low | 🔴 Open |

---

### RK-01: Residual ID collisions

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Likelihood** | Low |
| **Status** | 🔴 Open |
| **Description** | Even with counter entropy and pre-check, extremely unlikely collisions could still occur due to: 1) Counter overflow and wrap, 2) Database clock skew, 3) Random component collision with counter coincidence. |
| **Mitigation** | Retry logic handles residual collisions. Bounded attempts (max 3) prevent infinite loops. |
| **Owner** | Memory project team |
| **Related decision** | AD-02 |

---

### RK-02: Race condition across processes

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Likelihood** | Low |
| **Status** | 🔴 Open |
| **Description** | If multiple Curator instances run simultaneously in separate processes, they share the same PostgreSQL database but have independent counters. Two processes could theoretically generate the same ID if random and timestamp match. |
| **Mitigation** | Retry logic in `beginDecision()` handles this at insert time. Counter + random + timestamp makes this extremely unlikely. |
| **Owner** | Memory project team |
| **Related decision** | AD-01 |

---

### RK-03: Performance impact

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Likelihood** | Medium |
| **Status** | 🔴 Open |
| **Description** | Pre-check requires an extra SELECT query per ADR creation. At high volume, this could add latency to the Curator pipeline. |
| **Mitigation** | The fix targets correctness over performance. Monitor curator execution times. If performance becomes an issue, consider caching recently used IDs in memory. |
| **Owner** | Memory project team |
| **Related decision** | AD-01 |

---

**See also:**
- [BLUEPRINT.md](BLUEPRINT.md) — System design
- [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md) — Requirement traceability
- [TASKS.md](TASKS.md) — Implementation tasks
