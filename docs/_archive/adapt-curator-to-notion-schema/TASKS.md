# Implementation Tasks: Adapt Curator to Master Knowledge Base Schema

> Status: Ready for development — derived from original implementation plan

---

## Overview

This document tracks implementation tasks for adapting the curator pipeline to work with the Master Knowledge Base Notion database schema. See [BLUEPRINT.md](BLUEPRINT.md) for full system design and [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) for known risks.

---

## Done ✅

| Task | Completed | Notes |
|------|-----------|-------|
| Document migration to framework structure | ✅ | Migrated from standalone markdown to framework artifacts |

---

## Must Have (Critical Path)

### [ ] Task 1: Update Environment Configuration
**Priority:** P0 — Blocking  
**Description:** Update `NOTION_INSIGHTS_DB_ID` to point to Master Knowledge Base

**Files affected:**
- `.env`

**Implementation:**
```diff
- NOTION_INSIGHTS_DB_ID=f1bb3b77-0658-4545-8acf-b2081fbe8690
+ NOTION_INSIGHTS_DB_ID=e5d3db1e-1290-4d33-bd1f-71f93cc36655
```

**Acceptance criteria:**
- [ ] `.env` file updated with Master KB database ID
- [ ] `bun run check_properties.ts` shows Master KB properties (Name, Source, Category, Tags, AI Accessible, Content Type)
- [ ] No references to old Ronin Agents database ID in `.env`

**Related:** [BLUEPRINT.md](BLUEPRINT.md) §10, [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) AD-01, RK-03

---

### [ ] Task 2: Create Property Mapping Module
**Priority:** P0 — Blocking  
**Description:** Create centralized `notion-property-mapper.ts` with all property mappings and payload builder

**Files affected:**
- `src/curator/notion-property-mapper.ts` (new file)

**Implementation outline:**
1. Define `MASTER_KB_PROPERTIES` constant with Notion property names
2. Define `STATUS_TO_CONTENT_TYPE` mapping
3. Define `PROPERTY_MAPPINGS` array with all domain→notion mappings and `exists` flags
4. Implement `getSupportedProperties()` to return Set of existing properties
5. Implement `buildMasterKBPayload(insight, displayTagMap)` to construct Notion payload

**Acceptance criteria:**
- [ ] Module exports `MASTER_KB_PROPERTIES`, `STATUS_TO_CONTENT_TYPE`, `PROPERTY_MAPPINGS`
- [ ] `getSupportedProperties()` returns Set containing: Name, Source, Category, Tags, AI Accessible, Content Type
- [ ] `buildMasterKBPayload()` returns correctly formatted Notion property payload
- [ ] Properties with `exists: false` are not included in payload
- [ ] Transformations (`canonicalToDisplay`, `statusToContentType`) are applied correctly
- [ ] Module has JSDoc documentation

**Related:** [BLUEPRINT.md](BLUEPRINT.md) §5, [DATA-DICTIONARY.md](DATA-DICTIONARY.md), [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) AD-02

---

### [ ] Task 3: Update Promotion Orchestrator
**Priority:** P0 — Blocking  
**Description:** Update `promotion-orchestrator.ts` to use property mapper for payload construction

**Files affected:**
- `src/curator/promotion-orchestrator.ts`

**Implementation outline:**
1. Import `buildMasterKBPayload`, `getSupportedProperties`, `MASTER_KB_PROPERTIES` from mapper
2. Update `buildPromotionPayload()`:
   - Call `buildMasterKBPayload()` with insight data
   - Use returned payload directly
   - Add content via `buildPromotionContent()`
3. Update `buildApprovalUpdatePayload()`:
   - Use `MASTER_KB_PROPERTIES` for property names
   - Set AI Accessible checkbox and Content Type

**Acceptance criteria:**
- [ ] `buildPromotionPayload()` uses `buildMasterKBPayload()`
- [ ] Created pages have Name populated
- [ ] Created pages have Category populated with display tag
- [ ] Created pages have Tags populated
- [ ] Created pages have AI Accessible = false
- [ ] Created pages have Content Type = "Insight"
- [ ] `buildApprovalUpdatePayload()` uses mapped property names

**Related:** [BLUEPRINT.md](BLUEPRINT.md) §3, [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md) F9

---

### [ ] Task 4: Update Direct Notion Client
**Priority:** P0 — Blocking  
**Description:** Update `direct-notion-client.ts` to use mapped property names for reading pages

**Files affected:**
- `src/curator/direct-notion-client.ts`

**Implementation outline:**
1. Import `MASTER_KB_PROPERTIES` from mapper
2. Update `mapInsightRow()`:
   - Use `MASTER_KB_PROPERTIES` constants to extract values
   - Add `extractSelect()` helper for select property types
   - Handle fallback to raw property names for backward compatibility
3. Update `findExistingInsights()`:
   - Use `MASTER_KB_PROPERTIES.CATEGORY` for filter property

**Acceptance criteria:**
- [ ] `mapInsightRow()` uses `MASTER_KB_PROPERTIES` for property extraction
- [ ] `extractSelect()` method implemented for select properties
- [ ] `findExistingInsights()` filters by Category (not Canonical Tag)
- [ ] Backward compatibility maintained (checks both mapped and raw property names)
- [ ] No TypeScript errors

**Related:** [BLUEPRINT.md](BLUEPRINT.md) §3, [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md) F10

---

### [ ] Task 5: Update Config Module
**Priority:** P0 — Blocking  
**Description:** Update default database ID in config to use Master Knowledge Base

**Files affected:**
- `src/curator/config.ts`

**Implementation outline:**
1. Update `INSIGHTS_DATABASE_ID` default value to Master KB ID
2. Keep fallback to environment variable

**Implementation:**
```typescript
// Master Knowledge Base database ID (from env or default)
export const INSIGHTS_DATABASE_ID = process.env.NOTION_INSIGHTS_DB_ID || "e5d3db1e-1290-4d33-bd1f-71f93cc36655";
```

**Acceptance criteria:**
- [ ] Default database ID is Master Knowledge Base ID
- [ ] Environment variable still overrides default
- [ ] No references to old Ronin Agents ID in code

**Related:** [BLUEPRINT.md](BLUEPRINT.md) §3, [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md) F11

---

### [ ] Task 6: Verification and Testing
**Priority:** P0 — Blocking  
**Description:** Run verification steps and ensure all acceptance criteria are met

**Steps:**
1. Run `bun run check_properties.ts` to verify Master KB schema
2. Run curator: `bun run curator:run`
3. Check Notion for created pages with correct properties
4. Run test suite: `bun run test`
5. Run typecheck: `bun run typecheck`

**Acceptance criteria (from original plan):**
- [ ] ✅ `.env` updated with correct Master Knowledge Base ID
- [ ] ✅ Curator creates pages without "property does not exist" errors
- [ ] ✅ Created pages have Name populated
- [ ] ✅ Created pages have Category populated with display tag
- [ ] ✅ Created pages have Tags populated
- [ ] ✅ Created pages have AI Accessible = false
- [ ] ✅ Created pages have Content Type = "Insight"
- [ ] ✅ All existing tests pass: `bun run test`
- [ ] ✅ Type checking passes: `bun run typecheck`

**Related:** [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) RK-01, RK-02

---

## Should Have

### [ ] Task 7: Add Unit Tests for Property Mapper
**Priority:** P1  
**Description:** Add comprehensive unit tests for `notion-property-mapper.ts`

**Test cases:**
- [ ] `getSupportedProperties()` returns correct Set
- [ ] `buildMasterKBPayload()` creates valid Notion payload
- [ ] Status → Content Type mapping works correctly
- [ ] `canonicalToDisplay` transformation works
- [ ] Properties with `exists: false` are excluded from payload
- [ ] All Notion property types formatted correctly (title, rich_text, select, multi_select, checkbox)

**Files affected:**
- `src/curator/notion-property-mapper.test.ts` (new file)

**Related:** [BLUEPRINT.md](BLUEPRINT.md) §9

---

### [ ] Task 8: Update or Deprecate notion-payloads.ts
**Priority:** P1  
**Description:** Handle existing `notion-payloads.ts` that may have old property names

**Options:**
1. Update to use mapped property names
2. Mark as deprecated and route through new mapper
3. Remove if fully superseded

**Files affected:**
- `src/curator/notion-payloads.ts`

**Related:** [BLUEPRINT.md](BLUEPRINT.md) §12 Files Changed

---

## Nice to Have

### [ ] Task 9: Pre-populate Category Select Options
**Priority:** P2  
**Description:** Ensure Master KB Category select has options matching all display tags

**Mitigates:** [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) RK-02

**Steps:**
1. Extract all canonical tags from Neo4j insights
2. Map to display tags via `DISPLAY_TAG_MAP`
3. Add missing options to Notion Master KB Category property
4. Document process for adding new tags

---

### [ ] Task 10: Add Startup Validation
**Priority:** P2  
**Description:** Warn if curator is configured with wrong database ID

**Implementation:**
- Check `NOTION_INSIGHTS_DB_ID` against known bad IDs
- Log warning if old Ronin Agents ID detected
- Suggest correct ID in warning message

**Mitigates:** [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) RK-03

---

## Definition of Done

For each task to be marked ✅:
1. All acceptance criteria met
2. Code reviewed (if applicable)
3. Tests added/updated (if applicable)
4. Docs updated (BLUEPRINT, DATA-DICTIONARY if schema changed)
5. No new TypeScript errors (`bun run typecheck` passes)
6. Manual verification completed (for P0 tasks)

---

## Dependencies

```
Task 1 (Environment Fix)
└── Required by: All other tasks
    └── Must complete first

Task 2 (Property Mapper)
└── Required by: Tasks 3, 4, 5
    └── Core dependency

Task 3 (Promotion Orchestrator)
└── Required by: Task 6 (Verification)

Task 4 (Direct Notion Client)
└── Required by: Task 6 (Verification)

Task 5 (Config Update)
└── Required by: Task 6 (Verification)

Task 6 (Verification)
└── Required by: Marking project complete
```

---

**See also:**
- [BLUEPRINT.md](BLUEPRINT.md) — System design
- [SOLUTION-ARCHITECTURE.md](SOLUTION-ARCHITECTURE.md) — System topology
- [DATA-DICTIONARY.md](DATA-DICTIONARY.md) — Field definitions
- [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md) — Requirement traceability
- [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) — Risks and decisions
