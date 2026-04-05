# 🎨 UX Spec — Allura Control Center Web Dashboard

> **Type:** Web dashboard — replaces Notion as the primary operator interface  
> **Users:** You — the operator / lead architect  
> **Pattern:** Full-viewport bento dashboard. Data-dense. Single scroll region.  
> **Palette:** Nexus (Snow/Night/Gold) — matches Faith Meats brand adjacency  
> **Fonts:** Satoshi (body/UI) + Crimson Pro (page title only — brand continuity)  
> **Tech:** Next.js + Payload CMS + Tailwind CSS — Docker

---

## Design Principles

- **Mirrors Notion structure — replaces it.** Everything in the Allura Memory Control Center Notion page becomes a live data view here.
- **KPIs at top, trends middle, details bottom** — the dashboard information hierarchy.
- **No modal-heavy flows.** Approvals, agent status, and budget edits all happen inline.
- **Dark mode first** — operator tool, likely used in low-light environments.
- **Cmd+K command palette** for power navigation.

---

## Layout Shell

```javascript
┌──────────────────────────────────────────────────────────────┐
│  TOPBAR: 🏗️ Allura  | Workspace: [All] ▼ | 🔍 Cmd+K | 👤  │
├──────────────────────────────────────────────────────────────┤
│ SIDEBAR (240px)   │  MAIN CONTENT (fluid)                    │
│                   │                                          │
│  Overview         │  ┌──────────────┐ ┌──────────────┐           │
│  Approvals   [3]  │  │  KPI Card    │ │  KPI Card    │           │
│  Agents           │  └──────────────┘ └──────────────┘           │
│  Workspaces       │                                          │
│  Budgets          │  ┌───────────────────────────────┐           │
│  Audit Log        │  │  Pending Approvals (HITL)            │           │
│                   │  └───────────────────────────────┘           │
│  WORKSPACES       │                                          │
│  🥩 Faith Meats  │  ┌──────────────┐ ┌──────────────┐           │
│  🎨 Creative     │  │ Agent Roster │ │ Build Check  │           │
│  👤 Personal     │  └──────────────┘ └──────────────┘           │
│  🏛️ Nonprofit   │                                          │
│  🏦 Audits       │  ┌───────────────────────────────┐           │
│  🌡️ HACCP        │  │ Token Budget Monitor                │           │
│                   │  └───────────────────────────────┘           │
└───────────────────┴──────────────────────────────────────────┘
```

---

## Page Map

| Route | Page | Data Source |
|-------|------|-------------|
| `/` | Overview | PostgreSQL events + Neo4j insights |
| `/approvals` | HITL Changes Queue | Notion Changes DB (sync) |
| `/agents` | Agent Roster | Notion Agents DB (sync) |
| `/workspaces` | All Workspaces | Notion + runtime state |
| `/workspaces/:id` | Workspace Detail | Scoped by group_id |
| `/budgets` | Token Budget Monitor | PostgreSQL metadata |
| `/audit` | Audit Log | PostgreSQL events |
| `/docs` | Spec Docs | Payload CMS |
| `/settings` | Settings | Payload CMS config |

---

## Overview Page — Bento Grid

### Row 1: KPI Strip (4 cards)

```javascript
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Active Agents│ │ Pending HITL │ │ Token Burn   │ │ Neo4j Insigh │
│     14       │ │      3       │ │  $24.80/day  │ │    1,204     │
│ +2 this week │ │ Needs action │ │  84% of limit│ │  +12 today   │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### Row 2: Approvals + Build Checklist (2-col)

```javascript
┌─────────────────────────────┐ ┌─────────────────────────────┐
│ PENDING APPROVALS              │ │ CRITICAL PATH                 │
│                                │ │                               │
│ ■ Schema drift on products     │ │ ❌ groupIdEnforcer.ts RK-01    │
│   Faith Meats │ 2h ago         │ │ ❌ WorkflowState types          │
│   [Approve]  [Reject]          │ │ ❌ BehaviorSpec.yaml x6         │
│                                │ │ ❌ DATA-DICTIONARY.md           │
│ ■ Token pattern: batch queries  │ │ ❌ Payload CMS schema           │
│   Audits │ 5h ago             │ │ ✔ Architectural Brief          │
│   [Approve]  [Reject]          │ │ ✔ PRD v2                       │
└─────────────────────────────┘ └─────────────────────────────┘
```

### Row 3: Workspace Status + Budget Monitor (2-col)

```javascript
┌─────────────────────────────┐ ┌─────────────────────────────┐
│ WORKSPACES                     │ │ TOKEN BUDGETS   April 2026    │
│                                │ │                               │
│ 🥩 Faith Meats   3 agents  🟡 │ │ Faith Meats  |||||||  84%  ⚠ │
│ 🎨 Creative      2 agents  🔴 │ │ Creative     ||||       45%    │
│ 👤 Personal      1 agent   🔴 │ │ Audits       ||         27%    │
│ 🏛️ Nonprofit    2 agents  🔴 │ │ Nonprofit    |          20%    │
│ 🏦 Audits        2 agents  🔴 │ │                               │
└─────────────────────────────┘ └─────────────────────────────┘
```

### Row 4: Agent Roster (full width)

```javascript
AGENT ROSTER
┌────────────────┬──────────────┬────────┬──────────┬─────────────┐
│ Agent          │ Workspace    │ Class  │ Status   │ Actions     │
├────────────────┼──────────────┼────────┼──────────┼─────────────┤
│ faithmeats-coder│ Faith Meats  │ DT     │ 🟡 Build │ [Contract]  │
│ SENTINEL       │ HACCP        │ HRT    │ 🟡 Build │ [Contract]  │
│ Curator        │ Core         │ DT     │ 🟢 Live  │ [Contract]  │
│ Auditor (HITL) │ Core         │ DT     │ 🟢 Live  │ [Contract]  │
└────────────────┴──────────────┴────────┴──────────┴─────────────┘
```

---

## Workspace Detail Page

```javascript
[Back to All]  🥩 Faith Meats   group_id: allura-faith-meats   🟡 Building
───────────────────────────────────────────────────────────────────────────

[ Agents (3) ]  [ Insights ]  [ Events ]  [ Budget ]  [ Docs ]

Tabs — content loads below without page navigation

AGENTS TAB:
  faithmeats-coder   DT   🟡 Build   [View Contract]
  faithmeats-agent   DT   🟡 Build   [View Contract]
  SENTINEL           HRT  🟡 Build   [View Contract]

INSIGHTS TAB:
  Latest 10 Neo4j insights scoped to allura-faith-meats
  Filterable by status: Active | Degraded | Expired | Superseded

EVENTS TAB:
  Live PostgreSQL event tail scoped to group_id=allura-faith-meats
  Columns: timestamp | event_type | agent_id | status

BUDGET TAB:
  Monthly limit: $50   Used: $42 (84%)   Remaining: $8
  [Edit Limit]
  Sparkline: daily burn rate for current month

DOCS TAB:
  Links to Payload CMS docs scoped to Faith Meats:
  PRD, Brand Guidelines, HACCP Spec, Payload Schema
```

---

## Cmd+K Command Palette

```javascript
┌───────────────────────────────────────────┐
│  Search commands, pages, agents...       │
│  ────────────────────────────────────────   │
│  RECENT                                  │
│  ▶ Go to Approvals                        │
│  ▶ Go to Faith Meats workspace            │
│  ▶ View Architectural Brief               │
│  ACTIONS                                 │
│  + New Agent Contract                    │
│  + New Workspace                         │
│  🔍 Search Neo4j Insights                │
│  📊 Export Audit Log                      │
└───────────────────────────────────────────┘
```

---

## Component Map

| Component | Variants | Data Source |
|-----------|----------|-------------|
| `KPICard` | default, warning, critical | PostgreSQL / Neo4j |
| `ApprovalCard` | pending, approved, rejected | Notion Changes DB |
| `WorkspaceRow` | building, live, hold | Runtime state |
| `AgentRow` | HRT, SRT, DT × live/build/paused | Notion Agents DB |
| `BudgetBar` | normal, warning, critical | PostgreSQL metadata |
| `BuildChecklist` | checked/unchecked | Static config |
| `InsightCard` | active, degraded, superseded | Neo4j |
| `EventLogRow` | ok, warn, error | PostgreSQL events |
| `WorkspaceTabs` | agents, insights, events, budget, docs | Mixed sources |
| `CommandPalette` | — | All routes + actions |

---

## Data Flow

```javascript
PostgreSQL (events)  ───┐
                         ├──►  Next.js API Routes  ►  Dashboard UI
Neo4j (insights)     ───┤
                         │
Notion Databases     ───┘
  (Agents, Skills,           ↑
   Changes, Commands)    Payload CMS
                          (Docs, Config,
                           Faith Meats content)
```

All data fetched server-side in Next.js. No direct DB access from browser.

All queries scoped by `group_id` — enforced at API route level.

---

## Accessibility & Performance

- Semantic HTML: `<nav>`, `<main>`, `<section>`, `<table>` with proper headers
- All KPI numbers: `tabular-nums lining-nums`
- Status indicators: text label + color (never color-only)
- Skip-to-content link as first focusable element
- `content-visibility: auto` on off-screen bento cells
- LCP target: < 1.5s (dashboard rule)
- Skeleton loaders on all data-fetching cells

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Cmd+K` | Open command palette |
| `A` (on approval card) | Approve |
| `R` (on approval card) | Reject |
| `?` | Show all shortcuts |
| `G then O` | Go to Overview |
| `G then A` | Go to Approvals |
| `G then W` | Go to Workspaces |
