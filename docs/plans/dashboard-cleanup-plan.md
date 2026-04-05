# Vibe Coding Dashboard Cleanup Plan

> **Created:** 2026-04-05
> **Status:** Draft — Pending Approval
> **Scope:** Fix broken elements, remove redundancy, establish clean schema

---

## Current State Audit

### Critical Issues Found

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | **Traces link broken** | High | 🧠 Memory section |
| 2 | **Quick Action button broken** | High | Top left column |
| 3 | **4 Quick Buttons broken** | High | Right column |
| 4 | **Home Dashboard → YouTube** | Medium | Nav bar |
| 5 | **Floating orphaned content** | Medium | Bottom of page |
| 6 | **Redundant "Hidden" toggle** | Low | Bottom of page |
| 7 | **Nested database broken** | Medium | ⚙️ Operations |

### Root Cause Analysis

**Traces Link:**
- Current: Links to `3371d9be65b381a9b3bec24275444b68` (Allura Memory Control Center project)
- Problem: No actual Traces database exists in Notion
- PostgreSQL traces exist in infrastructure, but no user-facing view

**Broken Buttons:**
- All use `<unknown>` placeholder syntax
- Created by template but never configured with actual URLs/actions

**Home Dashboard:**
- Links to `https://www.youtube.com/channel/UCmT3Hj0S7QUplIPHMYWuHPw`
- Should link to an actual dashboard page

---

## Proposed Clean Schema

### Section 1: Navigation Bar
```
[Home] → /60c1d9be65b382c4af33012890cc9163 (self)
[Projects] → /a011d9be65b382cb89cf016a4fc06bc3
[Tasks] → /c331d9be65b38312a1ea81281746f717
[Recent] → /b9a1d9be65b3835a8fff01c94f4c4067
```

### Section 2: Quick Actions (Left Column)
```
⚡ Quick Actions
├── [+ New Task] → Opens task creation modal
├── [+ New Project] → Opens project creation modal
└── [View Approval Queue] → /4f0adf8e8b4b432cbc3adabfe06c7331
```

### Section 3: Work (Left Column)
```
📋 Work
├── Projects → /a011d9be65b382cb89cf016a4fc06bc3
├── Tasks → /c331d9be65b38312a1ea81281746f717
└── Approval Queue → /4f0adf8e8b4b432cbc3adabfe06c7331
```

### Section 4: Memory (Left Column)
```
🧠 Memory
├── Knowledge Hub → /083f40a9210445eaae513557bb1ae1ca
├── Insights → /a6e04b3f20e049a6bc00ffcde31d5467
└── [REMOVED: Traces] — No database exists
    Note: PostgreSQL traces exist in infrastructure only
```

### Section 5: Tools (Left Column)
```
🛠️ Tools
├── Skills → /0521d9be65b3830ab334012d132d2ada
├── Plugins → /b131d9be65b3838fb5f901ee33eb6b52
├── Frameworks → /7e21d9be65b383ffa65a0155d3ec6ba0
└── Prompt Database → /2a11d9be65b38055909bfc277d4f47ed
```

### Section 6: Agents (Left Column)
```
🤖 Agents & Orchestration
├── Agent Registry → /3371d9be65b3800b8f25d5db82ef6785
├── Agent Memory → /3371d9be65b38041bc59fd5cf966ff98
└── Agent Performance → /3321d9be65b381c492c3d5c4727caa1f
```

### Section 7: Operations (Left Column)
```
⚙️ Operations
├── Github Repos → /5bf1d9be65b3837d943c81b85af5fad7
├── Documentation → /3371d9be65b381ab8c59f52eab54602d
└── Youtube Videos → /e9d1d9be65b3820b96a581dd59a1a786
    [REMOVED: Databases nested link] — Broken/unnecessary
```

### Section 8: Help Center (Left Column)
```
❓ Help Center
├── Watch Tutorials → https://www.youtube.com/channel/UCmT3Hj0S7QUplIPHMYWuHPw
└── Ask a Question → https://formsnotion.fillout.com/notion-quick-fix
```

### Section 9: Main Content (Right Column)
```
🏗️ Allura Platform | Operations
├── In Progress → Database view (filtered to active)
├── Epic 7 Current Tasks → Database view (filtered to Epic 7)
├── Pending Approvals → Approval Queue database
└── Quick Actions (4 functional buttons)
    ├── [📅 View Calendar] → Calendar view
    ├── [📊 View Board] → Board by Status view
    ├── [📋 View Table] → All Projects table view
    └── [🔗 Open GitHub] → https://github.com/Charitablebusinessronin/Allura_Memory
```

### Section 10: Footer
```
[REMOVED: Hidden toggle] — Redundant with Tools section
[REMOVED: Floating Projects link] — Duplicate
[REMOVED: Floating Insights database] — Duplicate
```

---

## Implementation Plan

### Phase 1: Remove Broken Elements
**Goal:** Eliminate all non-functional placeholders

- [ ] Remove `<unknown>` Quick Action button (top left)
- [ ] Remove 4 `<unknown>` Quick Buttons (right column)
- [ ] Remove "Hidden (kept, not deleted)" toggle
- [ ] Remove floating Projects link at bottom
- [ ] Remove floating Insights database at bottom
- [ ] Remove nested Databases link in Operations section

### Phase 2: Fix Links
**Goal:** All links resolve to actual pages

- [ ] Fix Home Dashboard link (YouTube → self or actual dashboard)
- [ ] Remove or replace Traces link (pending decision)

### Phase 3: Add Functionality
**Goal:** Create working Quick Actions

- [ ] Create "+ New Task" button → Links to task creation
- [ ] Create "+ New Project" button → Links to project creation
- [ ] Create 4 functional Quick Buttons:
  - View Calendar → /5331d9be65b382e3b0c001e77ab6f258?v=dce1d9be65b38398920b083fdbe21b5c
  - View Board → /5331d9be65b382e3b0c001e77ab6f258?v=56dde804-83aa-470f-84dc-efa6c2b717e8
  - View Table → /5331d9be65b382e3b0c001e77ab6f258?v=9339c7d1-c497-4507-9a9b-f84934d63549
  - Open GitHub → https://github.com/Charitablebusinessronin/Allura_Memory

### Phase 4: Optional Enhancements
**Goal:** Improve usability beyond fixes

- [ ] Add status badges to sections (e.g., "3 tasks pending")
- [ ] Add "Last updated" timestamps to databases
- [ ] Create Traces database view (if Option B chosen)

---

## Decision Required

### Traces Database — Choose One:

**Option A: Remove Link (Recommended)**
- Action: Delete Traces link from Memory section
- Rationale: PostgreSQL traces are infrastructure, not user-facing
- Pros: Clean, no maintenance burden
- Cons: No visibility into raw traces

**Option B: Create Notion Database**
- Action: Create new database "Traces" that queries PostgreSQL
- Rationale: Users can browse execution history
- Pros: Full visibility
- Cons: Requires sync mechanism, may overwhelm users with data

**Option C: Link to Viewer**
- Action: Create traces viewer page with filters
- Rationale: Proper tool for viewing logs
- Pros: Purpose-built interface
- Cons: Requires building viewer component

**Recommendation:** Option A. The dashboard should show curated Insights, not raw execution traces. Traces belong in infrastructure monitoring, not project management.

---

## Success Criteria

- [ ] Zero `<unknown>` elements remain
- [ ] All hyperlinks resolve to valid pages/databases
- [ ] No orphaned content at page bottom
- [ ] Navigation passes "Sarah test" (new user understands structure)
- [ ] Quick buttons perform actual actions
- [ ] Page loads without console errors

---

## Rollback Plan

All changes are additive or removal-only. No data deletion.

**If issues arise:**
1. Revert to previous version using Notion page history
2. Re-add removed elements individually to identify issue
3. Document any edge cases discovered

---

## Approval

**Approved by:** _________________
**Date:** _________________
**Traces decision:** ☐ Option A  ☐ Option B  ☐ Option C
**Execute Phase:** ☐ 1 only  ☐ 1-2  ☐ 1-3  ☐ All phases
