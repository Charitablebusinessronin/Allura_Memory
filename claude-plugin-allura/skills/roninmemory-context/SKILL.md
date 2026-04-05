---
name: roninmemory-context
description: Session initialization for Allura Agent-OS. Use this skill FIRST when starting any session to ensure correct documentation hierarchy, tenant naming conventions, and architecture understanding.
---

# Skill: Roninmemory Context

## When to Use

**ALWAYS invoke this skill at session start.** This is the first thing an agent should do when working in roninmemory.

Trigger conditions:
- Starting a new session in the roninmemory project
- Before reading any documentation
- Before making any architectural decisions
- Before writing any code

## Purpose

Ensure agents understand:
1. **Documentation Hierarchy** — Where to find truth
2. **Tenant Naming** — The `allura-*` convention
3. **Architecture Model** — 5-layer Allura Agent-OS
4. **BMad Workflow** — How outputs are generated
5. **Memory Bank** — Session context files
6. **Governance Rule** — "Allura governs. Runtimes execute. Curators promote."

## Quick Start

### Required Reading (in order)

1. **Memory Bank** (session context):
   - `memory-bank/activeContext.md` — Current focus and blockers
   - `memory-bank/progress.md` — What's been done
   - `memory-bank/systemPatterns.md` — Architecture patterns
   - `memory-bank/techContext.md` — Tech stack details
   - `memory-bank/productContext.md` — Product vision
   - `memory-bank/projectbrief.md` — Project scope

2. **Documentation Canon**:
   - `_bmad-output/planning-artifacts/source-of-truth.md` — **CRITICAL: Document hierarchy**
   - `_bmad-output/planning-artifacts/architectural-brief.md` — 5-layer architecture
   - `_bmad-output/planning-artifacts/tenant-memory-boundary-spec.md` — Isolation rules

3. **Agent Instructions**:
   - `.opencode/context/navigation.md` — Agent routing guide
   - `.opencode/context/project/bmad-integration.md` — BMad agents

4. **Configuration**:
   - `_bmad/bmm/config.yaml` — BMad workflow config
   - `AGENTS.md` — This project's operating handbook
   - `AI-GUIDELINES.md` — AI documentation standards

## Documentation Hierarchy

**When conflict, follow this precedence:**

| Priority | Source | Scope |
|----------|--------|-------|
| 1 | Notion — Allura Memory Control Center | Product vision |
| 2 | `_bmad-output/planning-artifacts/*` | Implementation canon |
| 3 | `_bmad-output/planning-artifacts/*` | BMad outputs (superseded) |
| 4 | `_bmad-output/implementation-artifacts/*` | Sprint stories |
| 5 | `memory-bank/*` | Session context |

**KEY INSIGHT:** `_bmad-output/planning-artifacts/` is the single source of truth for human-curated documentation. BMad-generated documents in `_bmad-output/planning-artifacts/` are superseded when they conflict.

## Tenant Naming Convention

**STANDARD:** All tenant `group_id` values use the `allura-*` namespace.

| Workspace | `group_id` |
|-----------|------------|
| Faith Meats | `allura-faith-meats` |
| Creative Studio | `allura-creative` |
| Personal Assistant | `allura-personal` |
| Nonprofit | `allura-nonprofit` |
| Bank Audits | `allura-audits` |
| HACCP | `allura-haccp` |

**LEGACY:** `roninclaw-*` naming is deprecated. If you see it in active code or docs, treat as drift needing correction.

## Architecture: 5-Layer Model

```
┌─────────────────────────────────────────────────────┐
│ Layer 5: Paperclip + OpenClaw                       │
│         (Human interfaces)                           │
├─────────────────────────────────────────────────────┤
│ Layer 4: Workflow / DAGs / A2A Bus                │
│         (Orchestration)                             │
├─────────────────────────────────────────────────────┤
│ Layer 3: Agent Runtime (OpenCode)                   │
│         (Agent framework)                           │
├─────────────────────────────────────────────────────┤
│ Layer 2: PostgreSQL 16 + Neo4j 5.26                 │
│         (Data layer)                                │
├─────────────────────────────────────────────────────┤
│ Layer 1: RuVix Kernel                               │
│         (Proof-gated mutation)                      │
└─────────────────────────────────────────────────────┘
```

**PostgreSQL:** Raw append-only traces
**Neo4j:** Curated knowledge with Steel Frame versioning (`SUPERSEDES`)

## Governance Rule

> **Allura governs. Runtimes execute. Curators promote.**

This means:
- **Allura** (Paperclip dashboard) provides the governance layer
- **Runtimes** (OpenCode, OpenClaw, ADAS) execute within governed constraints
- **Curators** propose knowledge promotion; **Auditors** approve via HITL

## BMad Workflow Architecture

```
BMad Workflow Engine
    │
    ├─▶ READ: _bmad-output/planning-artifacts/* (canon context)
    │
    └─▶ WRITE:
           _bmad-output/planning-artifacts/* (PRDs, architecture)
           _bmad-output/implementation-artifacts/* (stories, specs)
```

## Verification

After reading required files, verify understanding:

1. **Name the 5 layers** of Allura architecture
2. **State the tenant naming convention** (`allura-*`)
3. **Identify the source of truth** (`_bmad-output/planning-artifacts/`)
4. **Explain the governance rule** ("Allura governs...")
5. **Describe HITL promotion** (PostgreSQL → Curator → Auditor → Neo4j)

## Critical Blockers

**ARCH-001:** `groupIdEnforcer.ts` is broken. This blocks ALL multi-tenant features.

See `_bmad-output/implementation-artifacts/ARCH-001-rk01-fix.md` for details.

## Drift Detection

If you see any of these in active docs/code, flag as drift:

1. `roninclaw-*` naming → Should be `allura-*`
2. 3-layer architecture references → Should be 5-layer RuVix model
3. Missing `group_id` in schema definitions → Must include tenant key
4. "Memory system" language without Allura context → Should specify Allura Agent-OS
5. Documents not following source-of-truth hierarchy → Defer to `_bmad-output/planning-artifacts/`
