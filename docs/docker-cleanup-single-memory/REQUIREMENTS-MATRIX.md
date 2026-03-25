# Requirements Traceability Matrix: Docker Cleanup for Single-Memory Architecture

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

This matrix traces every Business Requirement, Functional Requirement, and Use Case for the Docker cleanup operation. It provides bidirectional traceability from business goals through to implementation tasks.

---

## Table of Contents

- [1. Business Requirements → Functional Requirements](#1-business-requirements--functional-requirements)
- [2. Functional Requirements Detail](#2-functional-requirements-detail)
  - [Discovery & Baseline (F1–F3)](#discovery--baseline-f1f3)
  - [Safety & Guardrails (F4–F6)](#safety--guardrails-f4f6)
  - [Removal Execution (F7–F9)](#removal-execution-f7f9)
  - [Documentation & Handoff (F10–F15)](#documentation--handoff-f10f15)
- [3. Use Case Index](#3-use-case-index)
  - [Cleanup Use Cases](#cleanup-use-cases)

---

## 1. Business Requirements → Functional Requirements

| ID | Business Requirement | Functional Requirements | Use Cases |
|----|----------------------|------------------------|-----------|
| B1 | Remove unused Supabase infrastructure from Docker runtime to reduce resource overhead and operational complexity | [F7](#f7), [F8](#f8), [F9](#f9) | CLEANUP-UC1 |
| B2 | Preserve Ronin Memory (PostgreSQL + Neo4j) as the authoritative single-memory system | [F1](#f1), [F3](#f3), [F5](#f5), [F6](#f6), [F10](#f10) | CLEANUP-UC2 |
| B3 | Maintain Mission Control operational continuity throughout cleanup | [F4](#f4), [F5](#f5), [F6](#f6) | CLEANUP-UC2 |
| B4 | Keep Stirling-PDF service available for document processing needs | [F4](#f4), [F5](#f5), [F6](#f6) | CLEANUP-UC2 |
| B5 | Generate auditable evidence of cleanup actions and service health | [F1](#f1), [F2](#f2), [F13](#f13), [F14](#f14) | CLEANUP-UC3 |

---

## 2. Functional Requirements Detail

### Discovery & Baseline (F1–F3)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f1"></a>F1 | Capture complete pre-cleanup Docker inventory: containers, volumes, networks, port mappings | T1: Baseline container + port inventory snapshot · [BLUEPRINT.md](./BLUEPRINT.md) §6 Execution Rules |
| <a name="f2"></a>F2 | Identify all Supabase-related artifacts by name prefix and label | T2: Supabase artifact discovery · [BLUEPRINT.md](./BLUEPRINT.md) §6 Execution Rules |
| <a name="f3"></a>F3 | Generate explicit keep/remove/do-not-touch classification for every discovered resource | T3: Create guardrail matrix · [BLUEPRINT.md](./BLUEPRINT.md) §5 Data Model |

### Safety & Guardrails (F4–F6)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f4"></a>F4 | Create rollback checkpoints with service-specific restart commands for all kept services | T4: Prepare rollback checkpoints · [BLUEPRINT.md](./BLUEPRINT.md) §6 Execution Rules |
| <a name="f5"></a>F5 | Verify pre-cleanup health for all retained services before any removal | T5: Pre-cleanup health verification · [BLUEPRINT.md](./BLUEPRINT.md) §5 Data Model |
| <a name="f6"></a>F6 | Halt cleanup progression if any keep-service fails health check | T5, T6, T7, T10: Health verification at each phase · [RISKS-AND-DECISIONS.md](./RISKS-AND-DECISIONS.md) RK-04 |

### Removal Execution (F7–F9)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f7"></a>F7 | Stop Supabase services cleanly before container removal | T6: Stop Supabase services safely · [SOLUTION-ARCHITECTURE.md](./SOLUTION-ARCHITECTURE.md) §3.3 |
| <a name="f8"></a>F8 | Remove Supabase containers, networks, and scoped volumes without affecting other services | T7: Remove Supabase containers/networks/volumes · [RISKS-AND-DECISIONS.md](./RISKS-AND-DECISIONS.md) AD-02 |
| <a name="f9"></a>F9 | Validate no Supabase references remain in active runtime scripts or commands | T8: Validate runtime no longer references Supabase · [TASKS.md](./TASKS.md) T8 |

### Documentation & Handoff (F10–F15)

| ID | Requirement | Satisfied by |
|----|-------------|--------------|
| <a name="f10"></a>F10 | Detect and document actual live port bindings for Mission Control and Stirling-PDF | T9: Reconcile and document actual ports · [DATA-DICTIONARY.md](./DATA-DICTIONARY.md) Port Mapping Entry |
| <a name="f11"></a>F11 | Reconcile deployment documentation with verified runtime state | T11: Update deployment documentation · [TASKS.md](./TASKS.md) T11 |
| <a name="f12"></a>F12 | Update deployment runbook with final kept architecture and removed services | T11: Update deployment documentation · [BLUEPRINT.md](./BLUEPRINT.md) §8 API Surface |
| <a name="f13"></a>F13 | Create repeatable cleanup runbook section with scoped commands and safety cautions | T12: Add cleanup runbook section · [TASKS.md](./TASKS.md) T12 |
| <a name="f14"></a>F14 | Build evidence index mapping each task to its artifacts and expected outputs | T13: Build evidence index · [DATA-DICTIONARY.md](./DATA-DICTIONARY.md) Evidence File |
| <a name="f15"></a>F15 | Create operator handoff note documenting intentionally retained services and exclusions | T14: Create operator handoff note · [TASKS.md](./TASKS.md) T14 |

---

## 3. Use Case Index

### Cleanup Use Cases

| ID | Name | Design Doc | Requirements |
|----|------|------------|--------------|
| CLEANUP-UC1 | Execute Supabase Removal | [TASKS.md](./TASKS.md) T6-T8 | F7, F8, F9, B1 |
| CLEANUP-UC2 | Preserve Core Services | [TASKS.md](./TASKS.md) T3-T5, T10 | F3, F4, F5, F6, B2, B3, B4 |
| CLEANUP-UC3 | Generate Audit Evidence | [TASKS.md](./TASKS.md) T1-T5, T13 | F1, F2, F13, F14, B5 |

---

## Summary

**Business Requirements Coverage:**
- B1 → F7, F8, F9 (Supabase removal)
- B2 → F1, F3, F5, F6, F10 (Ronin Memory preservation)
- B3 → F4, F5, F6 (Mission Control continuity)
- B4 → F4, F5, F6 (Stirling-PDF availability)
- B5 → F1, F2, F13, F14 (Evidence generation)

**Functional Requirements Implementation:**
- All 15 functional requirements are mapped to specific tasks in [TASKS.md](./TASKS.md)
- Each functional requirement has verification criteria via evidence files
- Traceability maintained through task identifiers T1-T14 and final verification F1-F4
