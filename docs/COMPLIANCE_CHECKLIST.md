# Documentation Compliance Checklist

> **Enterprise Documentation Standards**  
> **Version:** 1.0  
> **Last Updated:** 2026-04-06  
> **Owner:** Allura Platform Team

---

## ✅ Pre-Publication Checklist

Use this checklist before merging any documentation PR.

### Required Headers

- [ ] **AI Disclosure Notice** (if AI-assisted)
  ```markdown
  > [!NOTE]
  > **AI-Assisted Documentation**
  > Portions of this document were drafted with the assistance of an AI language model.
  > Content has not yet been fully reviewed — this is a working design reference, not a final specification.
  > When in doubt, defer to the source code, JSON schemas, and team consensus.
  ```

- [ ] **Document Type** — One of:
  - [ ] Architecture Design
  - [ ] Implementation Plan
  - [ ] Reference Guide
  - [ ] Operations Guide
  - [ ] Project Document (Master)
  - [ ] API Documentation
  - [ ] Other: _______

- [ ] **Status** — One of:
  - [ ] Draft
  - [ ] Proposed — Awaiting Approval
  - [ ] Approved — In Progress
  - [ ] Active — Maintained
  - [ ] Archived

- [ ] **Last Updated Date** — Format: `YYYY-MM-DD`

- [ ] **Owner/Author** — Individual or team name

### Content Requirements

- [ ] **Cross-references** — Links to source of truth documents
- [ ] **Traceability** — Requirements IDs (B#, F#) linked to implementation
- [ ] **Decision IDs** — AD-## references for architectural decisions
- [ ] **Risk IDs** — RK-## references for known risks
- [ ] **No Secrets** — No credentials, API keys, or PII
- [ ] **Accurate Schemas** — JSON schemas match code
- [ ] **Valid Mermaid** — All diagrams render correctly

### Naming Conventions

- [ ] **Tenant Names** — Use `allura-*` namespace (not `roninclaw-*`)
- [ ] **File Names** — `kebab-case.md`
- [ ] **Headers** — Consistent hierarchy (#, ##, ###)

---

## 📊 Compliance Grades

| Grade | Criteria |
|-------|----------|
| **A** | All required headers present, all content requirements met |
| **B** | Minor gaps (missing optional fields, formatting issues) |
| **C** | Significant gaps (missing required headers, outdated info) |
| **F** | Critical issues (no AI disclosure, security violations, broken links) |

---

## 🔍 Audit Commands

### Check for Missing AI Disclosures
```bash
grep -L "AI-Assisted Documentation" docs/**/*.md
```

### Check for Legacy Naming
```bash
grep -r "roninclaw-" docs/ --include="*.md"
```

### Check for TODO/FIXME
```bash
grep -r "TODO\|FIXME" docs/ --include="*.md"
```

### Validate Mermaid Diagrams
```bash
# Requires mermaid-cli
find docs -name "*.md" -exec grep -l "mermaid" {} \; | xargs -I {} mmdc -i {} -o /dev/null
```

---

## 📋 Document Inventory

### project-planning/ (Source of Truth)

| Document | AI Disclosure | Status | Owner | Grade |
|----------|-------------|--------|-------|-------|
| PROJECT.md | ✅ | Active | MemoryOrchestrator | A |
| BLUEPRINT.md | ✅ | Active | MemoryOrchestrator | A |
| PRD-BRIEF.md | ✅ | Active | MemoryOrchestrator | A |
| data-dictionary.md | ✅ | Active | MemoryOrchestrator | A |
| solution-architecture.md | ✅ | Active | MemoryOrchestrator | A |
| RISKS-AND-DECISIONS.md | ✅ | Active | MemoryOrchestrator | A |

### Root Level

| Document | AI Disclosure | Status | Owner | Grade |
|----------|-------------|--------|-------|-------|
| TOOL_REGISTRY.md | ✅ | Active | MemoryOrchestrator | A |
| dashboard-cleanup-plan.md | ✅ | Draft | MemoryOrchestrator | A |
| neo4j-schema.cypher | ⚠️ N/A | Active | MemoryOrchestrator | B |

### Subfolders

| Folder | Documents | Compliance | Action |
|--------|-----------|------------|--------|
| architecture/ | 1 | ✅ 100% | None |
| plans/ | 2 | ✅ 100% | None |
| running/ | 1 | ⚠️ Review | Add headers |
| testing/ | 3 | ⚠️ Review | Add headers |
| party-mode/ | 1 | ⚠️ Review | Add headers |
| superpowers/ | 1 | ⚠️ Review | Add headers |

---

## 🚨 Critical Items

### Blockers (Must Fix Before Enterprise Release)

1. **RK-04 / RK-10:** `groupIdEnforcer.ts` broken
   - **Location:** `project-planning/RISKS-AND-DECISIONS.md`
   - **Impact:** Multi-tenant features blocked
   - **Fix:** Implement ARCH-001 spec

2. **Archive Drift:** Legacy docs may have outdated naming
   - **Location:** `docs/_archive/`
   - **Risk:** Developers may reference deprecated patterns
   - **Fix:** Add `_archive/README.md` warnings (✅ Done)

### Warnings (Should Fix)

3. **Missing Headers:** Several subfolder docs need standardization
   - **Files:** `running/`, `testing/`, `party-mode/`, `superpowers/`
   - **Action:** Add AI disclosure + document headers

---

## 📝 Sign-Off

**Documentation Lead:** _________________ Date: _______

**Technical Review:** _________________ Date: _______

**Compliance Approval:** _________________ Date: _______

---

*"A specification that cannot be audited is not a specification — it is a suggestion wearing a specification's clothing."*  
— Allura Documentation Policy
