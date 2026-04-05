---
source: notion
url: https://www.notion.so/3381d9be65b381d5af24cc1694201dec
date: 2026-04-04
---

# UX Spec — Paperclip Dashboard

> **Type:** Multi-tenant agent governance dashboard
> **Users:** Workspace owners, lead architects, auditors
> **Pattern:** Sidebar nav + sticky header + main content area (single scroll region)
> **Palette:** Nexus (Snow surfaces, Night text, Gold accent for alerts/budgets)
> **Fonts:** Satoshi (body/UI) + tabular-nums for all data values

---

## Design Principles

- **One primary action per view** — the approval queue is always the entry point
- **Data density over decoration** — no gradient blobs, no icon circles
- **Role-based views** — Owner sees all workspaces; Auditor sees Changes queue only
- **Every state designed** — loading skeletons, empty states, error states
- **Undo over confirmation dialogs** — destructive actions show inline undo toast

---

## Layout Shell

```javascript
┌─────────────────────────────────────────────────────────┐
│  HEADER: Logo | Workspace Switcher | Search | User Menu  │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│   SIDEBAR    │            MAIN CONTENT                  │
│   (240px)    │            (single scroll)               │
│              │                                          │
│  Navigation  │  KPIs → Charts → Tables → Details        │
│  Workspaces  │                                          │
│  Quick links │                                          │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```

**Sidebar collapses** to icon-only at < 1024px. Hidden behind hamburger at < 768px.
**No nested scroll regions** — one scroll axis only (the main content column).

---

## Page Map

| Route | Page | Primary Action |
|-------|------|----------------|
| `/` | Overview (all workspaces) | Jump to pending approvals |
| `/approvals` | Changes Queue (HITL) | Approve / Reject insight |
| `/agents` | Agent Roster | View contract / pause agent |
| `/workspaces/:id` | Workspace Detail | Edit budget / add agent |
| `/budgets` | Token Budget Monitor | Set limits / view burn rate |
| `/audit` | Audit Log | Filter + export events |
| `/settings` | Org Settings | Manage members, API keys |

---

## Sidebar Navigation

```javascript
🏗️ Paperclip
──────────────
📊 Overview
✅ Approvals      [3]   ← badge: pending count
🤖 Agents
🏢 Workspaces
💰 Budgets
📋 Audit Log
──────────────
WORKSPACES
  🥩 Faith Meats
  🎨 Creative
  👤 Personal
  🏛️ Nonprofit
  🏦 Audits
  🌡️ HACCP
──────────────
⚙️ Settings
```

Active item: left border `4px solid var(--color-primary)` + `--color-surface-accent` background.
Badge: `--color-notification` pill, `--text-xs` tabular-nums.

---

## Page: Overview

### KPI Row (top)

```javascript
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Active Agents│ │Pending Approv│ │ Token Burn   │ │ Insights     │
│     14       │ │      3       │ │  $24.80/day  │ │    1,204     │
│ ↑ 2 this wk  │ │ ⚠ Needs attn│ │ 84% of limit │ │ +12 today    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

KPI cards: `--color-surface`, `--shadow-sm`, `--radius-lg`.
Numbers: `--text-xl`, `font-weight: 700`, `tabular-nums`.
Delta labels: `--text-xs`, `--color-text-muted`.
Warning state: `--color-warning` left border on card.

### Workspace Status Table

```javascript
┌─────────────────┬────────────┬────────────┬──────────┬──────────┐
│ Workspace       │ group_id   │ Agents     │ Budget   │ Status   │
├─────────────────┼────────────┼────────────┼──────────┼──────────┤
│ 🥩 Faith Meats  │ allura-... │ 3 active   │ $50/mo   │ 🟡 Build │
│ 🏦 Audits       │ allura-... │ 2 active   │ $30/mo   │ 🔴 Hold  │
│ 🏛️ Nonprofit    │ allura-... │ 2 active   │ $20/mo   │ 🔴 Build │
└─────────────────┴────────────┴────────────┴──────────┴──────────┘
```

Row hover: `--color-surface-offset`. Inline actions appear on hover (right-aligned).

---

## Page: Approvals (HITL Queue)

> This is the most critical page. All Neo4j promotions require human sign-off here.

### Layout

```javascript
[ Filters: Workspace ▼ ] [ Type ▼ ] [ Date range ] [ Search... ]        [Export]

┌──────────────────────────────────────────────────────────────────────┐
│ PENDING (3)                                                          │
├──────────────────────────────────────────────────────────────────────┤
│ Insight: "Payload schema drift detected on products collection"       │
│ Proposed by: Curator Agent  │  Workspace: Faith Meats  │  2h ago     │
│ Confidence: 0.94            │  Type: Schema Warning                  │
│ [View Full AER]                              [Approve]  [Reject]     │
├──────────────────────────────────────────────────────────────────────┤
│ ...                                                                  │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ RECENTLY APPROVED (last 7 days)                                      │
├──────────────────────────────────────────────────────────────────────┤
│ [Collapsed table with timestamp, approver, workspace, insight title] │
└──────────────────────────────────────────────────────────────────────┘
```

**Approve action:** inline confirmation — row turns `--color-success-highlight`, 2s, then collapses.
**Reject action:** opens inline text field for rejection reason before submitting.
**View Full AER:** expands inline panel showing `intent`, `observation`, `inference`, `evidence_chain`.

---

## Page: Agent Roster

```javascript
[ Filter by workspace ▼ ] [ Filter by status ▼ ] [ Search agent... ]

┌────────────────┬───────────────┬───────────┬──────────┬────────────┐
│ Agent          │ Workspace     │ Latency   │ Status   │ Actions    │
├────────────────┼───────────────┼───────────┼──────────┼────────────┤
│ faithmeats-    │ Faith Meats   │ DT        │ 🟢 Live  │ [Contract] │
│ coder          │               │           │          │ [Pause]    │
│ SENTINEL       │ HACCP         │ HRT       │ 🟡 Build │ [Contract] │
│ Curator        │ Core          │ DT        │ 🟢 Live  │ [Contract] │
└────────────────┴───────────────┴───────────┴──────────┴────────────┘
```

**Contract drawer:** clicking [Contract] opens a right-side panel showing the full `AgentContract` fields: `capabilities[]`, `budgets`, `latency_class`, `security`.

---

## Page: Token Budget Monitor

```javascript
┌────────────────────────────────────────────────────────┐
│ MONTHLY BUDGET OVERVIEW          April 2026            │
├────────────────────────────────────────────────────────┤
│  Faith Meats   ████████░░░░  $42 / $50   84%  ⚠       │
│  Audits        ██░░░░░░░░░░  $8 / $30    27%  ✅       │
│  Nonprofit     █░░░░░░░░░░░  $4 / $20    20%  ✅       │
│  Creative      ████░░░░░░░░  $18 / $40   45%  ✅       │
└────────────────────────────────────────────────────────┘
```

Progress bars: `--color-success` < 70%, `--color-warning` 70–90%, `--color-error` > 90%.
Edit budget: inline number input on row click, saves on blur.

---

## Component Map

| Component | Variants | Notes |
|-----------|----------|-------|
| `KPICard` | default, warning, error | Animated number on load |
| `ApprovalCard` | pending, approved, rejected | Expandable AER panel |
| `AgentRow` | live, building, paused | Contract drawer on click |
| `WorkspaceBadge` | per workspace color | Pill with group_id |
| `BudgetBar` | normal, warning, critical | Inline edit on click |
| `AERViewer` | expanded panel | Shows intent/observation/inference |
| `StatusDot` | green/yellow/red | 8px circle, no text |
| `ChangesBadge` | count pill | `--color-notification` |

---

## Empty & Error States

| State | Message | Action |
|-------|---------|--------|
| No pending approvals | "All caught up. No insights awaiting review." | — |
| No agents | "No agents registered for this workspace." | [Add Agent] |
| Budget over limit | "⚠ Faith Meats has exceeded its monthly budget." | [Adjust Limit] |
| groupIdEnforcer error | "Cross-tenant access blocked. RK-01 violation logged." | [View Audit Log] |

---

## Accessibility & Keyboard

- `Tab` through approval cards; `Enter` to expand AER; `A` to approve; `R` to reject
- All status badges have `aria-label` (not color-only)
- Focus ring: `2px solid var(--color-primary)` on all interactive elements
- Screen reader: approval count announced via `aria-live`
