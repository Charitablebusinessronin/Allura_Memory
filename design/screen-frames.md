# Screen Frame Specifications

**Deliverable:** 3 — Screen Frames  
**Status:** ✅ Complete  
**Date:** 2026-04-26  
**Breakpoints:** Desktop `1440px`, Tablet `768px`, Mobile `375px`  
**Base unit:** `4px`  

---

## Global Layout Foundation

All screens share a common layout shell:

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar (240px) │  Main Content Area (flex: 1)        │
│                   │  ┌───────────────────────────────┐  │
│                   │  │ Top Bar (64px)                │  │
│                   │  ├───────────────────────────────┤  │
│                   │  │                               │  │
│                   │  │   Screen-specific content     │  │
│                   │  │                               │  │
│                   │  │                               │  │
│                   │  └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

| Element | Spec |
|---|---|
| **Sidebar width** | `240px` desktop / `64px` collapsed / `280px` mobile overlay |
| **Top bar height** | `64px` |
| **Top bar background** | `color.surface.default` |
| **Top bar border** | `1px solid color.border.subtle` bottom |
| **Top bar padding** | `spacing.lg` (`16px`) horizontal |
| **Page padding** | `spacing.2xl` (`32px`) all sides |
| **Content max-width** | None (full fluid); internal grids max `1200px` centered |
| **Background** | `color.surface.subtle` (`#F6F4EF`) |
| **Gap between sections** | `spacing.xl` (`24px`) |

---

## Screen 1: Overview

### Desktop (`1440px`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Sidebar] │  Overview                                          [🔔]│
│           │  ┌────────────────────────────────────────────────────┐  │
│           │  │ Page Title: "Overview"                               │  │
│           │  │ Subtitle: "Activity dashboard for your memory graph" │  │
│           │  └────────────────────────────────────────────────────┘  │
│           │                                                          │
│           │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│           │  │  Total   │ │  Pending │ │  Approved│ │ Rejected │   │
│           │  │  1,247   │ │   23     │ │  1,102   │ │   122    │   │
│           │  │ Memories │ │  Queue   │ │ Memories │ │ Memories │   │
│           │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│           │                                                          │
│           │  ┌────────────────────────────┐ ┌─────────────────────┐  │
│           │  │      Activity Feed         │ │   Pending Queue     │  │
│           │  │  ┌──────────────────────┐  │ │  ┌─────────────┐    │  │
│           │  │  │ [icon] Action … 2m   │  │ │  │ Insight #1  │    │  │
│           │  │  │ [icon] Action … 5m   │  │ │  │ Insight #2  │    │  │
│           │  │  │ … (max 8 items)      │  │ │  │ …           │    │  │
│           │  │  └──────────────────────┘  │ │  └─────────────┘    │  │
│           │  └────────────────────────────┘ └─────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

#### Stat Card Grid

| Property | Spec |
|---|---|
| **Layout** | CSS Grid, `4` columns, `gap: spacing.lg` (`16px`) |
| **Card height** | `120px` |
| **Card padding** | `spacing.lg` (`16px`) |
| **Card background** | `color.surface.default` |
| **Card border radius** | `borderRadius.md` (`8px`) |
| **Card shadow** | `shadow.md` |
| **Number** | `typography.5xl` (`48px`), `typography.fontWeight.bold`, `color.primary.default` |
| **Label** | `typography.fontSize.sm` (`14px`), `color.text.secondary`, margin-top `spacing.sm` |

#### Activity Feed

| Property | Spec |
|---|---|
| **Width** | `65%` of content area |
| **Title** | `typography.fontSize.lg` (`18px`), `typography.fontWeight.semibold` |
| **List** | Vertical stack, `gap: spacing.sm` (`8px`) |
| **Item height** | `48px` |
| **Item padding** | `spacing.md` (`12px`) |
| **Item background** | `color.surface.default` |
| **Item border** | `1px solid color.border.subtle` |
| **Item border radius** | `borderRadius.md` |
| **Icon** | `32px × 32px` circle, `color.surface.muted` background, icon `color.primary.default` |
| **Text** | `typography.fontSize.sm`, `color.text.primary` |
| **Timestamp** | `typography.fontSize.xs`, `color.text.muted`, right-aligned |
| **Max items** | `8` with scroll if more |

#### Pending Queue

| Property | Spec |
|---|---|
| **Width** | `35%` of content area |
| **Background** | `color.surface.default` |
| **Border radius** | `borderRadius.md` |
| **Padding** | `spacing.lg` |
| **Item** | Compact row, `spacing.sm` vertical padding |
| **Badge** | `color.secondary.default` background, `typography.fontSize.xs`, `color.text.inverse` |
| **Title** | `typography.fontSize.sm`, `color.text.primary` |
| **Meta** | `typography.fontSize.xs`, `color.text.muted` |

### Tablet (`768px`)

- Stat cards: `2 × 2` grid
- Activity Feed + Pending Queue: stacked vertically (Feed full width, Queue below)
- Sidebar: collapsed `64px` icon-only

### Mobile (`375px`)

- Stat cards: single column stack
- Activity Feed: full width, `4` items max
- Pending Queue: full width below feed
- Sidebar: hidden, hamburger trigger in top bar

---

## Screen 2: Memory Feed

### Desktop (`1440px`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Sidebar] │  Memory Feed                                       [🔔]│
│           │  ┌────────────────────────────────────────────────────┐  │
│           │  │ Title + [SearchBar ───────────] [Filter ▼] [Sort ▼]│  │
│           │  └────────────────────────────────────────────────────┘  │
│           │                                                          │
│           │  ┌────────────────────────────────────────────────────┐  │
│           │  │ [Type] Content snippet…          [tag] [tag] 2h  ⋮ │  │
│           │  │ [Type] Content snippet…          [tag]        5h  ⋮ │  │
│           │  │ …                                                  │  │
│           │  └────────────────────────────────────────────────────┘  │
│           │                                                          │
│           │  ┌────────────────────────────────────────────────────┐  │
│           │  │              <  1  2  3  …  9  10  >              │  │
│           │  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

#### Filter Bar

| Property | Spec |
|---|---|
| **Height** | `56px` |
| **Background** | `color.surface.default` |
| **Border bottom** | `1px solid color.border.subtle` |
| **Padding** | `spacing.md` (`12px`) horizontal |
| **Layout** | Flex row, `gap: spacing.md`, `justify-content: space-between` |
| **Left group** | SearchBar (`320px`) + Filter dropdown + Sort dropdown |
| **Right group** | View toggle (list / grid icons) |

#### Memory Row

| Property | Spec |
|---|---|
| **Height** | `72px` |
| **Padding** | `spacing.md` (`12px`) horizontal, `spacing.sm` (`8px`) vertical |
| **Background** | `color.surface.default` |
| **Border bottom** | `1px solid color.border.subtle` |
| **Layout** | Flex row, `align-items: center`, `gap: spacing.md` |
| **Type badge** | `color.primary.default` background, `typography.fontSize.xs`, `color.text.inverse`, `borderRadius.sm`, `padding: spacing.xs spacing.sm` |
| **Content snippet** | `typography.fontSize.sm`, `color.text.primary`, max `2` lines, `text-overflow: ellipsis` |
| **Tags** | Flex row, `gap: spacing.xs`. Each tag: `color.surface.muted` bg, `color.text.secondary`, `borderRadius.sm`, `padding: 2px spacing.sm` |
| **Timestamp** | `typography.fontSize.xs`, `color.text.muted`, `min-width: 48px`, right-aligned |
| **Actions menu** | `⋮` icon, `24px`, `color.text.muted` → `color.text.primary` on hover |
| **Hover** | `background: color.surface.muted` |

#### Pagination

- Same as Component Library spec
- Positioned centered below list, `margin-top: spacing.xl` (`24px`)

### Tablet (`768px`)

- Filter bar: SearchBar full width, filters wrap below
- Memory rows: same structure, slightly tighter padding
- Pagination: same

### Mobile (`375px`)

- Filter bar: SearchBar full width, filters in bottom sheet trigger
- Memory rows: stack vertically with card appearance (`shadow.sm`, `borderRadius.md`)
- Type badge moves above content
- Actions menu bottom-right

---

## Screen 3: Graph View

### Desktop (`1440px`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Sidebar] │  Graph View                                        [🔔]│
│           │  ┌────────────────────────────────────────────────────┐  │
│           │  │ [Search…] [Agent ▼] [Project ▼] [Insight ▼] [Clear] │  │
│           │  ├────────────────────────────────────────────────────┤  │
│           │  │                                                    │  │
│           │  │              GRAPH CANVAS                          │  │
│           │  │         (full remaining height)                    │  │
│           │  │                                                    │  │
│           │  │  ┌────┐                                            │  │
│           │  │  │ +  │  ┌─────────────────────────────┐          │  │
│           │  │  │ −  │  │  Detail Sidebar (300px)     │          │  │
│           │  │  │ ⟲  │  │  ─────────────────────────  │          │  │
│           │  │  └────┘  │  Properties                 │          │  │
│           │  │          │  Connections                │          │  │
│           │  │          │  Tags                       │          │  │
│           │  │          │  Actions                    │          │  │
│           │  │          └─────────────────────────────┘          │  │
│           │  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

#### Filter Bar

| Property | Spec |
|---|---|
| **Height** | `48px` |
| **Background** | `color.surface.subtle` |
| **Border bottom** | `1px solid color.border.subtle` |
| **Layout** | Flex row, `gap: spacing.md`, `align-items: center` |
| **Search input** | `240px` width |
| **Type chips** | Toggle buttons per node type (see graph-node-spec.md) |
| **Clear button** | Ghost style, right-aligned |

#### Graph Canvas

| Property | Spec |
|---|---|
| **Position** | Relative, fills all remaining viewport height below filter bar |
| **Background** | `color.surface.subtle` |
| **Grid** | Optional dot grid (see graph-node-spec.md §8) |
| **Z-index layers** | Edges `z: 1`, Nodes `z: 2`, Labels `z: 3`, Toolbar `z: 10`, Sidebar `z: 20` |

#### Toolbar

| Property | Spec |
|---|---|
| **Position** | Absolute, `spacing.lg` from bottom-left of canvas |
| **Background** | `color.surface.default`, `shadow.md`, `borderRadius.md` |
| **Padding** | `spacing.sm` |
| **Buttons** | Icon-only, `24px`, `color.text.secondary`, hover `color.text.primary` |

#### Detail Sidebar

| Property | Spec |
|---|---|
| **Width** | `300px` fixed |
| **Position** | Right edge, below filter bar, full remaining height |
| **Background** | `color.surface.default` |
| **Border left** | `1px solid color.border.subtle` |
| **Shadow** | `shadow.md` on left edge |
| **Scroll** | `overflow-y: auto` |

Full anatomy in `graph-node-spec.md` §6.

### Tablet (`768px`)

- Sidebar: `280px` slide-over overlay, triggered by node selection
- Toolbar: bottom-center
- Filter bar: collapsible to icon row, expands on tap

### Mobile (`375px`)

- Sidebar: full-screen modal, `100vw × 80vh`, slides up from bottom
- Toolbar: hidden (pinch-zoom for scale, pan for drag)
- Filter bar: bottom sheet trigger button

---

## Screen 4: Insight Review

### Desktop (`1440px`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Sidebar] │  Insight Review                                    [🔔]│
│           │  ┌────────────────────────────────────────────────────┐  │
│           │  │ Title                                              │  │
│           │  │ [Pending] [Approved] [Rejected]         [Bulk ▼] │  │
│           │  └────────────────────────────────────────────────────┘  │
│           │                                                          │
│           │  ┌────────────────────────────────────────────────────┐  │
│           │  │ Insight Title                      [Approve] [×]│  │
│           │  │ Description snippet that may wrap to two lines…   │  │
│           │  │ [Agent] [Project]              Confidence: 87% 2h │  │
│           │  ├────────────────────────────────────────────────────┤  │
│           │  │ Insight Title                      [Approve] [×]│  │
│           │  │ …                                                  │  │
│           │  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

#### Tab Bar

| Property | Spec |
|---|---|
| **Height** | `48px` |
| **Layout** | Flex row, `gap: 0`, border-bottom `1px solid color.border.subtle` |
| **Tab padding** | `spacing.md` (`12px`) horizontal, `spacing.sm` vertical |
| **Tab font** | `typography.fontSize.sm`, `typography.fontWeight.medium` |
| **Default** | `color.text.secondary`, transparent bottom border |
| **Hover** | `color.text.primary`, `color.surface.muted` background |
| **Active** | `color.primary.default`, `2px solid color.primary.default` bottom border |
| **Count badge** | `typography.fontSize.xs`, `color.text.inverse`, `color.primary.default` bg, `borderRadius.full`, `padding: 0 spacing.xs` |

#### Review Card

| Property | Spec |
|---|---|
| **Background** | `color.surface.default` |
| **Border** | `1px solid color.border.subtle` |
| **Border radius** | `borderRadius.md` (`8px`) |
| **Padding** | `spacing.lg` (`16px`) |
| **Margin bottom** | `spacing.md` (`12px`) |
| **Shadow** | `shadow.sm` |

**Card Layout:**

| Row | Content |
|---|---|
| **Header** | Title (`typography.fontSize.lg`, `color.text.primary`, `fontWeight.semibold`) + action buttons right-aligned |
| **Body** | Description (`typography.fontSize.sm`, `color.text.secondary`, max `2` lines) |
| **Footer** | Metadata chips left + confidence score + timestamp right |

**Action Buttons:**
- **Approve:** Button `size=sm`, `variant=success` — green checkmark icon + "Approve"
- **Reject:** Button `size=sm`, `variant=ghost` — `×` icon + "Reject"
- **View:** Button `size=sm`, `variant=ghost` — "View Details" link style

**Metadata Chips:**
- Source Agent, Project — `color.surface.muted` background, `color.text.secondary`, `typography.fontSize.xs`
- Confidence score — `color.primary.default` text, `typography.fontWeight.bold`

### Tablet (`768px`)

- Review cards: full width, same internal layout
- Tab bar: scrollable if needed
- Action buttons: icon-only on very narrow tablet widths

### Mobile (`375px`)

- Tab bar: full width, equal tabs
- Review cards: stacked, action buttons become bottom row (Approve / Reject full width)
- Description: `3` lines max

---

## Screen 5: Evidence Detail

### Desktop (`1440px`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Sidebar] │  Evidence #E-1247                                  [🔔]│
│           │  ┌────────────────────────────────────────────────────┐  │
│           │  │ [Raw Log] [Metadata] [Trace]     [📋 Copy] [⬇ Export]│  │
│           │  ├────────────────────────────────────────────────────┤  │
│           │  │                                                    │  │
│           │  │  TAB CONTENT AREA                                  │  │
│           │  │                                                    │  │
│           │  │  Raw Log: monospace block                            │  │
│           │  │  Metadata: key/value table                           │  │
│           │  │  Trace: timeline visualization                       │  │
│           │  │                                                    │  │
│           │  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

#### Tab Navigation

| Property | Spec |
|---|---|
| **Height** | `48px` |
| **Background** | `color.surface.default` |
| **Border bottom** | `1px solid color.border.subtle` |
| **Tab style** | Same as Insight Review tabs |
| **Active tab** | `color.primary.default`, bottom border `2px` |

#### Raw Log Tab

| Property | Spec |
|---|---|
| **Background** | `color.surface.subtle` (`#F6F4EF`) |
| **Font** | `IBM Plex Mono` (fallback to `monospace`), `typography.fontSize.sm` (`14px`) |
| **Padding** | `spacing.lg` (`16px`) |
| **Line height** | `typography.lineHeight.relaxed` (`1.625`) |
| **Overflow** | `auto` horizontal scroll |
| **Wrap** | `white-space: pre` |

#### Metadata Tab

| Property | Spec |
|---|---|
| **Layout** | Table or key/value grid |
| **Table header** | `background: color.surface.muted`, `typography.fontSize.xs`, `color.text.secondary`, `text-transform: uppercase`, `letter-spacing: 0.05em` |
| **Table row** | `border-bottom: 1px solid color.border.subtle` |
| **Key column** | `30%` width, `typography.fontSize.sm`, `color.text.secondary`, `fontWeight.medium` |
| **Value column** | `70%` width, `typography.fontSize.sm`, `color.text.primary` |
| **Row padding** | `spacing.md` vertical |
| **Hover** | `background: color.surface.muted` |

#### Trace Tab

| Property | Spec |
|---|---|
| **Layout** | Vertical timeline |
| **Timeline line** | `2px` solid `color.border.subtle`, centered |
| **Node** | `12px` circle, `color.primary.default` fill, `2px solid color.surface.default` border |
| **Event card** | Left or right of timeline, `background: color.surface.default`, `borderRadius.md`, `padding: spacing.md`, `shadow.sm` |
| **Timestamp** | `typography.fontSize.xs`, `color.text.muted`, above event card |
| **Title** | `typography.fontSize.sm`, `color.text.primary`, `fontWeight.semibold` |
| **Description** | `typography.fontSize.sm`, `color.text.secondary` |

#### Action Buttons (top-right)

| Button | Spec |
|---|---|
| **Copy** | Ghost button, `📋` icon + "Copy", copies content to clipboard, shows `color.success.default` toast |
| **Export** | Primary button, `⬇` icon + "Export", triggers file download |

### Tablet (`768px`)

- Tab nav: full width
- Raw Log: horizontal scroll preserved
- Metadata table: same layout, slightly narrower value column
- Trace: timeline centered, cards alternate

### Mobile (`375px`)

- Tab nav: scrollable if needed
- Action buttons: move below tabs, full width stacked
- Raw Log: smaller font (`12px`), horizontal scroll
- Metadata: stacked layout (key above value) instead of table
- Trace: single column, all cards on right of timeline line

---

## Responsive Breakpoint Summary

| Breakpoint | Width | Sidebar | Page Padding | Grid Columns | Notes |
|---|---|---|---|---|---|
| **Desktop** | `≥1024px` | Expanded `240px` | `spacing.2xl` (`32px`) | 4 / 3 / 2 depending on screen | Full layout |
| **Tablet** | `768–1023px` | Collapsed `64px` | `spacing.lg` (`16px`) | 2 / 1 | Sidebar icon-only + tooltip |
| **Mobile** | `<768px` | Hidden overlay | `spacing.md` (`12px`) | 1 | Hamburger trigger, bottom sheets |

---

## Token Cross-Reference

All screen specs reference tokens from `tokens.json`:

| Token Category | Used In |
|---|---|
| `color.primary.*` | Active tabs, stat numbers, type badges, links |
| `color.secondary.*` | Insight badges, notification dots, pending markers |
| `color.success.*` | Approve buttons, positive toasts, confidence high |
| `color.surface.*` | Backgrounds, cards, panels, inputs |
| `color.border.*` | Dividers, card borders, table rows, input outlines |
| `color.text.*` | All typography hierarchy |
| `color.accent.*` | Selection rings, project markers, gold highlights |
| `spacing.*` | All gaps, padding, margins |
| `borderRadius.*` | Cards, buttons, badges, inputs |
| `shadow.*` | Cards, dropdowns, modals, floating toolbars |
| `typography.*` | All text sizing, weight, and font family |
