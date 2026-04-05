# Allura Documentation — Planning Canon

**Source:** [Allura Memory Control Center](https://www.notion.so/Allura-Memory-Control-Center-3371d9be65b381a9b3bec24275444b68)  
**Synced:** 2026-04-04  
**Status:** ✅ Active

> This directory is the P2 implementation canon for product vision, governance, and architecture decisions.
> For technical implementation specs, see [`_bmad-output/implementation-artifacts/`](../implementation-artifacts/).

---

## Planning Documents

| Document | File | Status | Purpose |
|----------|------|--------|---------|
| Source of Truth | [`source-of-truth.md`](./source-of-truth.md) | ✅ Canon | Document hierarchy and governance rules |
| PRD v2 | [`prd-v2.md`](./prd-v2.md) | ✅ Canon | Product requirements, workspaces, 12 primitives |
| Architectural Brief | [`architectural-brief.md`](./architectural-brief.md) | ✅ Canon | 5-layer architecture, RuVix kernel, Steel Frame versioning |
| Architectural Decisions | [`architectural-decisions.md`](./architectural-decisions.md) | 📝 Stub | ADR registry |
| Epics | [`epics.md`](./epics.md) | ✅ Canon | Epic and story definitions |
| Tenant & Memory Boundary Spec | [`tenant-memory-boundary-spec.md`](./tenant-memory-boundary-spec.md) | ✅ Canon | group_id enforcement, promotion workflow, audit queries |

---

## Workspace Status

| Workspace | group_id | Status | Priority |
|-----------|----------|--------|----------|
| 🥩 Faith Meats | `allura-faith-meats` | 🔴 Building | P1 |
| 🎨 Creative Studio | `allura-creative` | 🔴 Building | P2 |
| 👤 Personal Assistant | `allura-personal` | 🔴 Building | P2 |
| 🏛️ Nonprofit | `allura-nonprofit` | 🔴 Building | P3 |
| 🏦 Bank Audits | `allura-audits` | 🔴 Building | P3 |
| 🌡️ HACCP | `allura-haccp` | 🔴 Building | P3 |

---

## Critical Path

- [ ] `groupIdEnforcer.ts` — **RK-01 CRITICAL** — blocks all other work
- [ ] `WorkflowState` type system
- [ ] `BehaviorSpec.yaml` × 6 workspaces
- [ ] `DATA-DICTIONARY.md` — canonical field reference
- [ ] 12 Agent Primitives
