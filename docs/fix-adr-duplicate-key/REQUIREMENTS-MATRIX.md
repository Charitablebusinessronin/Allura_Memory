# Fix ADR Duplicate Key Issue: Requirements Matrix

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed. This is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

---

## Table of Contents

- [1. Business Requirements → Functional Requirements](#1-business-requirements--functional-requirements)
- [2. Functional Requirements Detail](#2-functional-requirements-detail)
- [3. Use Case Index](#3-use-case-index)

---

## 1. Business Requirements → Functional Requirements

| ID | Business Requirement | Functional Requirements | Use Cases |
|----|----------------------|------------------------|-----------|
| B1 | ADR logging must not fail with duplicate key errors | [F2](#f2), [F3](#f3), [F4](#f4) | FIX-UC1, FIX-UC3 |
| B2 | Each ADR must have unique `adr_id` per database constraint | [F1](#f1), [F2](#f2), [F4](#f4) | FIX-UC1, FIX-UC2 |
| B3 | Curator must complete full pipeline without ADR errors | [F3](#f3), [F5](#f5), [F6](#f6) | FIX-UC3, FIX-UC4 |

---

## 2. Functional Requirements Detail

### ID Generation (F1–F2)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f1"></a>F1 | `generateId()` must produce statistically unique IDs across 1000 sequential calls | `generateId()` with counter entropy · [BLUEPRINT.md](BLUEPRINT.md) §6 |
| <a name="f2"></a>F2 | `beginDecision()` must check ID uniqueness before inserting to PostgreSQL | `storage.findById()` check · [BLUEPRINT.md](BLUEPRINT.md) §6 |

### Error Handling (F3)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f3"></a>F3 | ADR logging must implement retry logic with bounded attempts on duplicate key errors | Try-catch with max 3 retries · [BLUEPRINT.md](BLUEPRINT.md) §6 |

### ID Enhancement (F4)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f4"></a>F4 | ID generation must include additional entropy (microsecond, process ID, or counter) | Module-level counter in `generateId()` · [BLUEPRINT.md](BLUEPRINT.md) §6 |

### Compatibility (F5–F6)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f5"></a>F5 | Existing ADRs must remain accessible after the fix | Backward-compatible ID format · [BLUEPRINT.md](BLUEPRINT.md) §7 |
| <a name="f6"></a>F6 | Retry attempts must be logged for debugging purposes | Warning-level log on each retry · [BLUEPRINT.md](BLUEPRINT.md) §6 |

---

## 3. Use Case Index

### FIX Use Cases

| ID | Name | Description | Requirements |
|----|------|-------------|--------------|
| FIX-UC1 | Generate unique ADR ID | ID generation produces unique identifier on first attempt | F1, F2 |
| FIX-UC2 | Handle ID collision via regeneration | When collision detected, regenerate ID and retry | F2, F4 |
| FIX-UC3 | Recover from duplicate key error | When insert fails with duplicate key, retry with new ID | F3 |
| FIX-UC4 | Complete curator pipeline | Curator runs full pipeline without ADR-related failures | F5, F6 |

---

**See also:**
- [BLUEPRINT.md](BLUEPRINT.md) - Core design
- [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) - Decisions and risks
- [TASKS.md](TASKS.md) - Implementation tasks
