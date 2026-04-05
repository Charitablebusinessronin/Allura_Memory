# Memory Log — 2026-04-04

## Session: Documentation Canon Reconciliation

### Summary

Established documentation architecture for Allura Agent-OS, reconciling naming drift between Notion and local repository, and encoded context into agent DNA.

---

## Accomplishments

### 1. Documentation Canon Established

**Created:** `_bmad-output/planning-artifacts/source-of-truth.md`

- Document hierarchy defined (Notion → _bmad-output/planning-artifacts (canon) / _bmad-output/implementation-artifacts)
- Tenant naming convention locked (`allura-*`)
- Architecture model documented (5-layer RuVix kernel)
- Governance rule encoded: "Allura governs. Runtimes execute. Curators promote."

### 2. Naming Drift Fixed

**Fixed:** `_bmad-output/planning-artifacts/tenant-memory-boundary-spec.md`
- Replaced `roninclaw-*` with `allura-*` naming throughout
- Updated tenant list to 6 workspaces
- Fixed examples in code blocks

**Marked Superseded:** `_bmad-output/planning-artifacts/*.md`
- Added supersession headers pointing to canonical versions
- Architecture.md marked as brownfield decision log
- PRD, tenant-spec marked as superseded by _bmad-output/planning-artifacts/

### 3. Memory Bank Created

**Created:** 6 memory-bank files
- `activeContext.md` — Current focus and blockers
- `progress.md` — What's been done
- `systemPatterns.md` — Architecture patterns
- `techContext.md` — Tech stack details
- `productContext.md` — Product vision
- `projectbrief.md` — Project scope

### 4. Skill Created

**Created:** `.opencode/skills/roninmemory-context/SKILL.md`
- Session initialization skill
- Loads all context at session start
- Documents hierarchy, naming, architecture, governance
- Drift detection rules

### 5. Agent Instructions Updated

**Updated:** `AGENTS.md`
- Added roninmemory-context skill requirement
- Added 5-layer architecture model
- Added documentation rules with hierarchy
- Added tenant naming convention

**Updated:** `AI-GUIDELINES.md`
- Added documentation hierarchy section
- Added tenant naming convention section

### 6. Unused Directory Deleted

**Deleted:** `bmad-output/` directory
- Not referenced by BMad config
- Empty directories causing confusion

---

## Architecture Established

### Documentation Hierarchy

```
Priority 1: Notion Allura Memory Control Center (Product vision)
Priority 2: _bmad-output/planning-artifacts/*                      (Human canon)
Priority 3: _bmad-output/planning-artifacts/*          (BMad outputs, superseded)
Priority 4: _bmad-output/implementation-artifacts/*   (Sprint stories)
Priority 5: memory-bank/*                      (Session context)
```

### Tenant Naming Convention

| Workspace | group_id |
|-----------|----------|
| Faith Meats | allura-faith-meats |
| Creative Studio | allura-creative |
| Personal Assistant | allura-personal |
| Nonprofit | allura-nonprofit |
| Bank Audits | allura-audits |
| HACCP | allura-haccp |

**Legacy:** `roninclaw-*` is deprecated.

### Architecture: 5-Layer Model

```
L5: Paperclip + OpenClaw (Human interfaces)
L4: Workflow / DAGs / A2A Bus (Orchestration)
L3: Agent Runtime (OpenCode)
L2: PostgreSQL 16 + Neo4j 5.26 (Data)
L1: RuVix Kernel (Proof-gated mutation)
```

### Governance Rule

> **Allura governs. Runtimes execute. Curators promote.**

### BMad Workflow Pattern

```
BMad reads:  _bmad-output/planning-artifacts/* (canon context)
BMad writes: _bmad-output/planning-artifacts/* (PRDs, architecture)
             _bmad-output/implementation-artifacts/* (stories, specs)
```

---

## Critical Blocker

**ARCH-001:** `groupIdEnforcer.ts` is broken

Status: Ready for dev
Location: `_bmad-output/implementation-artifacts/ARCH-001-rk01-fix.md`
Impact: Blocks ALL multi-tenant features

---

## Key Decisions

1. **Canon Lock** — `_bmad-output/planning-artifacts/` is the single source of truth for human-curated documentation
2. **Naming Standard** — All tenant IDs use `allura-*` namespace
3. **BMad Integration** — BMad reads canon, writes to planning-artifacts
4. **Memory Bank** — Session context tracked in memory-bank/
5. **Skill Encoding** — `roninmemory-context` skill ensures context persistence

---

## Next Steps

1. Fix ARCH-001 (`groupIdEnforcer.ts`)
2. Resume Epic 1: Persistent Knowledge Capture
3. Validate all generated docs use `allura-*` naming

---

## Files Modified

### Created
- `_bmad-output/planning-artifacts/source-of-truth.md`
- `memory-bank/activeContext.md`
- `memory-bank/progress.md`
- `memory-bank/systemPatterns.md`
- `memory-bank/techContext.md`
- `memory-bank/productContext.md`
- `memory-bank/projectbrief.md`
- `.opencode/skills/roninmemory-context/SKILL.md`

### Updated
- `_bmad-output/planning-artifacts/tenant-memory-boundary-spec.md` (naming fix)
- `_bmad-output/planning-artifacts/prd-v2.md` (supersession header)
- `_bmad-output/planning-artifacts/tenant-memory-boundary-spec.md` (supersession header)
- `_bmad-output/planning-artifacts/architecture.md` (supersession header)
- `AGENTS.md` (skill requirement, architecture, rules)
- `AI-GUIDELINES.md` (hierarchy, naming)

### Deleted
- `bmad-output/` directory

---

## Session Metrics

- **Duration:** ~2 hours
- **Files created:** 8
- **Files modified:** 6
- **Directories deleted:** 1
- **Drift fixed:** 3 naming instances
- **Skills created:** 1

---

## Verification

```bash
# Check canon exists
ls -la _bmad-output/planning-artifacts/source-of-truth.md

# Check memory bank
ls -la memory-bank/

# Check skill
ls -la .opencode/skills/roninmemory-context/

# Verify naming
grep -r "roninclaw" _bmad-output/planning-artifacts/  # Should return only legacy mentions
grep -r "allura-" _bmad-output/planning-artifacts/    # Should return many results
```

---

## Notes

- Notion Allura Memory Control Center confirmed as product canon
- All workspaces use `allura-*` naming (P1-P3 priorities)
- BMad config correctly points to `docs/` not `bmad-output/`
- Critical blocker ARCH-001 must be fixed before any multi-tenant work