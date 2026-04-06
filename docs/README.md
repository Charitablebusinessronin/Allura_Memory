# Allura Memory Documentation

> **Enterprise Documentation Hub**  
> **Version:** 2.0  
> **Last Updated:** 2026-04-06  
> **Owner:** Allura Platform Team  
> **Status:** Active — Maintained

---

## 📋 Documentation Standards

This repository follows the [AI-GUIDELINES.md](../AI-GUIDELINES.md) for all documentation. Every document must include:

- ✅ AI disclosure notice (if AI-assisted)
- ✅ Document type classification
- ✅ Status field (Draft/Proposed/Approved/Archived)
- ✅ Last updated date
- ✅ Owner attribution
- ✅ Cross-references to source of truth

---

## 📁 Folder Structure

```
docs/
├── README.md                          ← You are here
├── AI-GUIDELINES.md                   ← Documentation standards (root)
├── TOOL_REGISTRY.md                   ← MCP tool quick reference
├── dashboard-cleanup-plan.md          ← Dashboard implementation plan
├── neo4j-schema.cypher               ← Neo4j initialization schema
│
├── project-planning/                  ← 🏛️ SOURCE OF TRUTH
│   ├── PROJECT.md                     ← Master project document
│   ├── BLUEPRINT.md                   ← Core concepts & scope
│   ├── PRD-BRIEF.md                   ← Product requirements
│   ├── data-dictionary.md             ← PostgreSQL & Neo4j schemas
│   ├── solution-architecture.md       ← System topology
│   └── RISKS-AND-DECISIONS.md         ← AD-## & RK-## registry
│
├── architecture/                      ← Technical architecture
│   └── tracemiddleware-integration.md ← TraceMiddleware contract
│
├── plans/                             ← Implementation plans
│   ├── session-persistence-plan.md    ← P1: Session persistence
│   └── dashboard-cleanup-plan.md      ← Dashboard schema plan
│
├── running/                           ← Operations guides
│   └── OPENCLAW_PAPERCLIP_GUIDE.md  ← Runtime guide
│
├── testing/                           ← Testing documentation
│   ├── MCP_TESTING_ARCHITECTURE.md
│   ├── group-id-integration-tests.md
│   └── CSS_FIX.md
│
├── party-mode/                        ← BMAD collaboration
│   └── BMAD_PARTY_MODE_ROUNDTABLE.md
│
├── superpowers/                       ← Agent capabilities
│   └── specs/
│       └── 2026-04-05-ralphloop-design.md
│
└── _archive/                          ← Historical documents
    └── 20260404/                      ← April 2024 migration
        └── implementation/
            └── (legacy docs - do not edit)
```

---

## 🎯 Quick Navigation

| I need to... | Go to... |
|--------------|----------|
| Understand the system | `project-planning/PROJECT.md` |
| Check requirements | `project-planning/PRD-BRIEF.md` |
| See database schemas | `project-planning/data-dictionary.md` |
| Review architecture | `project-planning/solution-architecture.md` |
| Understand risks | `project-planning/RISKS-AND-DECISIONS.md` |
| Use MCP tools | `TOOL_REGISTRY.md` |
| Deploy/operate | `running/OPENCLAW_PAPERCLIP_GUIDE.md` |

---

## 📊 Compliance Status

| Folder | Documents | AI Disclosure | Status Field | Owner | Grade |
|--------|-----------|---------------|--------------|-------|-------|
| project-planning/ | 6 | ✅ 100% | ✅ 100% | ✅ | A |
| architecture/ | 1 | ✅ 100% | ✅ 100% | ✅ | A |
| plans/ | 2 | ✅ 100% | ✅ 100% | ✅ | A |
| TOOL_REGISTRY.md | 1 | ✅ 100% | ✅ 100% | ✅ | A |
| running/ | 1 | ⚠️ Review needed | ⚠️ Review needed | ⚠️ | C |
| testing/ | 3 | ⚠️ Review needed | ⚠️ Review needed | ⚠️ | C |
| party-mode/ | 1 | ⚠️ Review needed | ⚠️ Review needed | ⚠️ | C |
| superpowers/ | 1 | ⚠️ Review needed | ⚠️ Review needed | ⚠️ | C |

**Overall Grade: B+** (Enterprise-ready with minor gaps)

---

## 🚨 Critical Open Items

1. **RK-04 / RK-10:** `groupIdEnforcer.ts` broken (ARCH-001)
   - **Impact:** Blocks multi-tenant feature work
   - **Fix:** `_bmad-output/implementation-artifacts/ARCH-001-rk01-fix.md`
   - **Status:** 🔴 **URGENT**

2. **Archive Drift:** `docs/_archive/` contains legacy docs
   - **Risk:** May have outdated `roninclaw-*` naming
   - **Action:** Audit required

---

## 📝 Document Templates

Create new documents using:
- [PROJECT.template.md](../templates/PROJECT.template.md) — Master document
- [AI-GUIDELINES.md](../AI-GUIDELINES.md) — Standards reference

---

## 🔗 External References

- **Notion:** Allura Memory Control Center (product vision)
- **Code:** `src/` — Source of truth for implementation
- **Schemas:** `json-schema/` — JSON schema definitions
- **Memory Bank:** `memory-bank/` — Session context

---

*"Conceptual integrity is the most important consideration in system design."*  
— Frederick P. Brooks Jr.

**Questions?** Contact the MemoryOrchestrator or consult `project-planning/PROJECT.md`.
