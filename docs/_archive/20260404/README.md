# Archive — 2026-04-04

This directory contains documents superseded during the Allura Agent-OS v2 consolidation on 2026-04-04.

**Do not edit these files.** They are historical record only.  
All active canon lives in `_bmad-output/planning-artifacts/` and `_bmad-output/implementation-artifacts/`.

---

## What Is Here and Why

| Folder | Contents | Superseded By |
|--------|----------|---------------|
| `planning/` | Original PRDs (v1, v2), architecture spec, tenant spec, UX specs | `_bmad-output/planning-artifacts/prd-v2.md`, `architectural-brief.md`, `tenant-memory-boundary-spec.md`, `ux-specs/` |
| `implementation/` | BLUEPRINT, DATA-DICTIONARY, SOLUTION-ARCHITECTURE, REQUIREMENTS-MATRIX, RISKS-AND-DECISIONS, PROJECT, PRD-BRIEF, DESIGN | `_bmad-output/implementation-artifacts/data-dictionary.md`, `solution-architecture.md`, `_bmad-output/planning-artifacts/requirements-matrix.md`, `architectural-decisions.md` |
| `operations/` | Quality checklist, SLO, runbook, security policy, old sprint tracker | Active runbooks in `src/`, `_bmad-output/implementation-artifacts/sprint-status.yaml` |
| `epics/` | Old epics file, Epic 7 (OpenAgents), Story 1-1 | `_bmad-output/planning-artifacts/epics.md` |
| `api/` | Auto-generated API reference for 17 modules | Source code — `src/` |
| `evolution/` | Architecture analysis (ANL-001), runtime scenario (SCN-001), MCP adapter spec (SPC-001), integration plan, adapter plan | `_bmad-output/implementation-artifacts/solution-architecture.md` |
| `migration/` | Agent taxonomy week 1 records, two-worlds separation decision | Completed — `_bmad-output/planning-artifacts/architectural-decisions.md` AD-14, AD-15 |
| `validation/` | Phase 2–5 completion reports, MemoryBuilder enhancement report | Completed work — no active replacement needed |
| `progress/` | Design log | `memory-bank/progress.md` |
| `roadmap/` | Letta-inspired memory enhancements (MemFS, sleep-time reflection) | `_bmad-output/planning-artifacts/requirements-matrix.md` F29–F30 (Not Started) |
| `assets/` | Memory architecture diagram | `_bmad-output/implementation-artifacts/solution-architecture.md` |

---

## Key Naming Changes (Archive → Current Canon)

| Old | Current |
|-----|---------|
| `roninclaw-*`, `roninclaw-faithmeats` | `allura-faith-meats` (and all `allura-*` workspaces) |
| `organization_id` + `group_id` (two-tier) | `group_id` only (`allura-*` namespace) |
| `memory-orchestrator`, `memory-scout`, `memory-builder` | `MemoryOrchestrator`, `MemoryArchitect`, `MemoryBuilder`, etc. |
| 3-layer brownfield architecture | 5-layer Allura Agent-OS (L1 RuVix → L5 Paperclip) |
| `docs/planning-artifacts/` | `_bmad-output/planning-artifacts/` |
| `docs/implementation-artifacts/` | `_bmad-output/implementation-artifacts/` |

---

**Archived:** 2026-04-04  
**Reason:** Allura Agent-OS v2 consolidation — naming conventions unified, document hierarchy established, BMad v6 output structure adopted.
