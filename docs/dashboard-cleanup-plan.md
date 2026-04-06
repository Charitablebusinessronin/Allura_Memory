# Vibe Coding Dashboard — Schema & Cleanup Plan

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

> **Document Type:** Implementation Plan  
> **Status:** Draft  
> **Last Updated:** 2026-04-06  
> **Owner:** MemoryOrchestrator  

## Current State Analysis

### What's Broken
| # | Issue | Location | Current | Expected |
|---|-------|----------|---------|----------|
| 1 | **Traces link broken** | 🧠 Memory section | Links to Allura project page | Should link to actual traces database or be removed |
| 2 | **Quick Action button** | Top left | `<unknown>` placeholder | Functional button or removed |
| 3 | **4 Quick Buttons** | Right column | All `<unknown>` | Functional buttons or removed |
| 4 | **Home Dashboard link** | Nav bar | YouTube channel | Actual dashboard page |
| 5 | **Floating content** | Bottom | Orphaned Projects + Insights | Integrated or removed |
| 6 | **Redundant toggle** | Bottom | "Hidden (kept, not deleted)" | Remove — duplicates Tools section |
| 7 | **Nested database** | ⚙️ Operations | `inline="false"` | Properly configured or removed |

### Missing Databases
- **Traces Database**: Referenced but doesn't exist in Notion (PostgreSQL traces exist, but no Notion view)

---

## Proposed Schema

### Section 1: Navigation Bar (Top)
```
[Home] → Links to actual dashboard (not YouTube)
[Projects] → Projects page
[Tasks] → Tasks database
[Recent] → Recent activity view
```

### Section 2: Quick Actions (Left Column)
```
⚡ Quick Actions
├── [+ New Task] → Opens task creation
├── [+ New Project] → Opens project creation
└── [View Approval Queue] → Opens approvals
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
└── [REMOVE: Traces] — No Notion database exists
    OR: Create Traces view in Notion
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
├── Youtube Videos → /e9d1d9be65b3820b96a581dd59a1a786
└── [REMOVE: Databases nested link] — Broken
```

### Section 8: Help Center (Left Column)
```
❓ Help Center
├── Watch Tutorials → YouTube
└── Ask a Question → Form
```

### Section 9: Main Content (Right Column)
```
🏗️ Allura Platform | Operations
├── In Progress → Database view
├── Epic 7 Current Tasks → Database view
├── Pending Approvals → Database view
└── Quick Actions (4 buttons)
    ├── [View Calendar]
    ├── [View Board]
    ├── [View Table]
    └── [Open GitHub]
```

### Section 10: Footer
```
[REMOVE: Hidden toggle] — Redundant
[REMOVE: Floating Projects link] — Duplicate
[REMOVE: Floating Insights database] — Duplicate
```

---

## Action Items

### Phase 1: Remove Broken Elements
- [ ] Remove `<unknown>` Quick Action button
- [ ] Remove 4 `<unknown>` Quick Buttons
- [ ] Remove "Hidden (kept, not deleted)" toggle
- [ ] Remove floating Projects link
- [ ] Remove floating Insights database
- [ ] Fix or remove nested Databases link in Operations

### Phase 2: Fix Links
- [ ] Fix Home Dashboard link (YouTube → actual dashboard)
- [ ] Fix Traces link (remove or create actual Traces database)

### Phase 3: Add Functionality
- [ ] Create 4 functional Quick Buttons:
  - View Calendar
  - View Board  
  - View Table
  - Open GitHub
- [ ] Add proper Quick Action button (New Task)

### Phase 4: Optional Enhancements
- [ ] Create Traces database view in Notion (linked to PostgreSQL)
- [ ] Add status indicators to sections
- [ ] Add "Last updated" timestamps

---

## Decision Needed

**Traces Database:**
- Option A: Remove the Traces link from Memory section (PostgreSQL traces exist but aren't in Notion)
- Option B: Create a Notion database that mirrors/query PostgreSQL traces
- Option C: Link to a traces viewer page instead

**Recommendation:** Option A for now. PostgreSQL traces are infrastructure, not user-facing content. The dashboard should show curated Insights, not raw traces.

---

## Success Criteria

- [ ] No `<unknown>` elements remain
- [ ] All links resolve to actual pages/databases
- [ ] No orphaned content at bottom
- [ ] Navigation makes sense to new user (Sarah test)
- [ ] Quick buttons actually do something
