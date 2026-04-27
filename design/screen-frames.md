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
| **Active** | `color.accent.gold`, `2px solid color.accent.gold` bottom border |
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
| **Tab style** | Horizontal flex row, `gap: 0` |
| **Tab padding** | `spacing.md` (`12px`) horizontal, `spacing.sm` vertical |
| **Tab font** | `typography.fontSize.sm`, `typography.fontWeight.medium` |
| **Default** | `color.text.secondary`, transparent bottom border |
| **Hover** | `color.text.primary`, `color.surface.muted` background |
| **Active** | `color.accent.gold`, `2px solid color.accent.gold` bottom border |
| **Count badge** | `typography.fontSize.xs`, `color.text.inverse`, `color.primary.default` bg, `borderRadius.full`, `padding: 0 spacing.xs` |

> **Note:** Tab active indicator uses Gold (`color.accent.gold`) per TOKEN-AUTHORITY.md DD-2. This differs from sidebar nav items which use Blue (`color.primary.default`).

### 5.1 Raw Log Tab

#### Purpose
Displays the raw, unprocessed evidence content exactly as captured. This is the default active tab when opening an Evidence Detail page.

#### Layout
```
┌──────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────────┐      │
│  │  1  │ {                                      ···········  │      │
│  │  2  │   "agent": "memory-bot",                 ···········  │      │
│  │  3  │   "event": "insight-generated",          ···········  │      │
│  │  4  │   "payload": {                           ···········  │      │
│  │  5  │     "confidence": 0.87,                  ···········  │      │
│  │ ... │   }                                      ···········  │      │
│  └────────────────────────────────────────────────────────────┘      │
│         ▲── gutter (36px)     ▲── content area (flex: 1)            │
└──────────────────────────────────────────────────────────────────────┘
```

| Property | Spec |
|---|---|
| **Background** | `color.surface.subtle` (`#F6F4EF`) |
| **Font family** | `IBM Plex Mono` (fallback `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`) |
| **Font size** | `typography.fontSize.sm` (`14px`) desktop, `typography.fontSize.xs` (`12px`) mobile |
| **Line height** | `typography.lineHeight.relaxed` (`1.625`) |
| **Padding** | `spacing.lg` (`16px`) all around |
| **Overflow** | `auto` horizontal and vertical scroll |
| **White-space** | `pre` (preserve formatting) |
| **Border radius** | `borderRadius.md` (`8px`) |
| **Min height** | `320px` |
| **Max height** | `calc(100vh - 280px)` (scrolls if taller) |

#### Line Numbers
- **Gutter width:** `36px` fixed
- **Gutter background:** `color.surface.muted` (slightly different from content background)
- **Gutter text:** `color.text.muted`, `typography.fontSize.xs`, right-aligned, `padding-right: spacing.sm`
- **Line number:** Incremental, `1`-based
- **Content area:** `padding-left: spacing.md`

#### Syntax Highlighting
**Decision: YES — basic JSON syntax highlighting only.** (No full Prism.js dependency. Use a lightweight inline approach.)

| Token Type | Color Token | Hex |
|---|---|---|
| Strings | `color.success.default` | `#157A4A` |
| Numbers / Booleans | `color.primary.default` | `#1D4ED8` |
| Keys (object properties) | `color.text.primary` | `#0F1115` |
| Null | `color.text.muted` | `#9CA3AF` |
| Punctuation (braces, brackets, commas) | `color.text.secondary` | `#6B7280` |

> Implementation note: If the raw log is not valid JSON, render as plain text with no syntax highlighting. Do not attempt to highlight non-JSON formats.

#### Copy Behavior
- Clicking the **Copy** button (top-right of screen) copies the entire raw log content to clipboard.
- Toast: `color.success.default` background, `color.text.inverse` text, "Copied to clipboard!" — auto-dismiss `2000ms`.

---

### 5.2 Metadata Tab

#### Purpose
Structured display of all evidence metadata fields. Supports per-row copy for quick sharing of specific values.

#### Layout
```
┌──────────────────────────────────────────────────────────────────────┐
│  KEY                            │ VALUE                    │ [📋]    │
│  ─────────────────────────────────────────────────────────────────  │
│  Source                         │ memory-bot               │ [📋]    │
│  Agent                          │ insight-agent-v2         │ [📋]    │
│  Project                        │ allura-dashboard         │ [📋]    │
│  Timestamp                      │ 2026-04-26T14:32:00Z     │ [📋]    │
│  Confidence                     │ 0.87                     │ [📋]    │
│  Tags                           │ [memory] [insight] [p0]  │ [📋]    │
│  ─────────────────────────────────────────────────────────────────  │
│  Extended Metadata                                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  parent_id        │ mem_abc123                               │  │
│  │  trace_id         │ trace_xyz789                             │  │
│  │  ...              │ ...                                      │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

#### Table Spec

| Property | Spec |
|---|---|
| **Layout** | CSS Grid — `grid-template-columns: 30% 1fr 40px` |
| **Background** | `color.surface.default` |
| **Border** | `1px solid color.border.subtle` around table, `border-bottom: 1px solid color.border.subtle` per row |
| **Border radius** | `borderRadius.md` (`8px`) |
| **Overflow** | Hidden (clips to border radius) |

#### Table Header
| Property | Spec |
|---|---|
| **Background** | `color.surface.muted` |
| **Text** | `typography.fontSize.xs`, `color.text.secondary`, `text-transform: uppercase`, `letter-spacing: 0.05em`, `fontWeight.semibold` |
| **Padding** | `spacing.md` vertical, `spacing.lg` horizontal |
| **Columns** | "KEY" / "VALUE" / "" (copy column, no label) |

#### Table Row
| Property | Spec |
|---|---|
| **Key column** | `30%` width, `typography.fontSize.sm`, `color.text.secondary`, `fontWeight.medium` |
| **Value column** | `flex: 1`, `typography.fontSize.sm`, `color.text.primary` |
| **Copy button column** | `40px` fixed, centered |
| **Row padding** | `spacing.md` vertical, `spacing.lg` horizontal |
| **Row hover** | `background: color.surface.muted` |
| **Row transition** | `background-color 150ms ease` |

#### Copy-Per-Row Button
| Property | Spec |
|---|---|
| **Icon** | `📋` (Clipboard), `16px` |
| **Style** | Ghost button, `color.text.muted` default |
| **Hover** | `color.primary.default`, `background: color.surface.muted` |
| **Active** | `transform: scale(0.95)` |
| **Tooltip** | "Copy value" on hover, `delay: 300ms` |
| **Behavior** | Copies only the value cell content to clipboard |
| **Feedback** | Icon momentarily swaps to `✓` (Check), `color.success.default`, `300ms`, then reverts |

#### Extended Metadata Section
- Appears below the primary metadata table if `metadata` object has additional keys beyond the standard fields.
- Uses a nested table with the same styling but `background: color.surface.subtle`.
- Header: "Extended Metadata" — `typography.fontSize.sm`, `color.text.secondary`, `fontWeight.semibold`, `margin-bottom: spacing.md`.

#### Empty State
- If no metadata: centered message — `typography.fontSize.sm`, `color.text.muted` — "No metadata available for this evidence."

---

### 5.3 Trace Tab

#### Purpose
Visual timeline of all events that led to the creation or mutation of this evidence. Provides operational context for debugging and auditing.

#### Layout Decision: Vertical Timeline (NOT tree view)

**Rationale:**
1. Evidence traces are typically linear sequences of agent operations.
2. Tree views add cognitive load for a primarily linear data structure.
3. Vertical timeline is more scannable on both desktop and mobile.
4. If branching is needed in future, we can add "Related Traces" links rather than nesting.

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  14:32:00Z    ┬── Event: insight-generated                           │
│               │   Agent: memory-bot                                   │
│               │   Confidence: 0.87                                    │
│               │   Status: success                                     │
│               │                                                       │
│  14:31:45Z    ┼── Event: memory-retrieved                            │
│               │   Agent: memory-bot                                   │
│               │   Source: vector-db                                   │
│               │   Status: success                                     │
│               │                                                       │
│  14:31:30Z    ┼── Event: query-received                               │
│               │   Agent: api-gateway                                  │
│               │   Query: "find insights about..."                      │
│               │   Status: success                                     │
│               │                                                       │
│  14:31:00Z    ┴── Event: session-initiated                           │
│                   Agent: api-gateway                                  │
│                   User: anon_7f3a                                     │
│                   Status: success                                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

#### Timeline Spec

| Property | Spec |
|---|---|
| **Container** | `padding: spacing.lg`, `background: color.surface.default` |
| **Timeline line** | `2px` solid `color.border.subtle`, vertically centered, spans full height of event list |
| **Line position** | `left: 120px` desktop / `left: 0` mobile (line on left edge on mobile) |

#### Event Node (Dot)
| Property | Spec |
|---|---|
| **Shape** | `12px` circle, `borderRadius.full` |
| **Fill** | Determined by event type (see Event Colors below) |
| **Border** | `2px solid color.surface.default` |
| **Position** | Centered on the timeline line |

#### Event Card
| Property | Spec |
|---|---|
| **Background** | `color.surface.default` |
| **Border** | `1px solid color.border.subtle` |
| **Border radius** | `borderRadius.md` (`8px`) |
| **Padding** | `spacing.md` |
| **Shadow** | `shadow.sm` |
| **Max width** | `calc(100% - 160px)` desktop / `calc(100% - 40px)` mobile |
| **Position** | To the right of the timeline line, `spacing.lg` gap |

#### Event Card Content
| Element | Spec |
|---|---|
| **Timestamp** | `typography.fontSize.xs`, `color.text.muted`, top of card |
| **Event type label** | `typography.fontSize.sm`, `color.text.primary`, `fontWeight.semibold` |
| **Agent name** | `typography.fontSize.sm`, `color.text.secondary` |
| **Details** | `typography.fontSize.sm`, `color.text.secondary`, max `3` lines |
| **Status badge** | `borderRadius.sm`, `padding: 2px spacing.sm`, `typography.fontSize.xs` |

#### Event Colors
| Event Type | Color Token | Usage |
|---|---|---|
| `success` | `color.success.default` (`#157A4A`) | Event completed successfully |
| `error` | `color.secondary.default` (`#FF5A2E`) | Event failed or errored |
| `warning` | `color.accent.gold` (`#C89B3C`) | Event completed with warnings |
| `info` / default | `color.primary.default` (`#1D4ED8`) | Informational / neutral events |
| `pending` | `color.text.muted` (`#9CA3AF`) | Event in progress |

#### Empty State
- If no trace events: centered message — `typography.fontSize.sm`, `color.text.muted` — "No trace data available for this evidence."

---

### 5.4 Action Buttons (Copy / Export)

#### Placement
- **Desktop (`≥1024px`):** Top-right of the tab bar area, inline with tabs, `gap: spacing.md`
- **Tablet (`768–1023px`):** Top-right of tab bar, icon + text on primary, icon-only ghost for copy if space constrained
- **Mobile (`<768px`):** Below the tab bar, full-width stacked, `margin-top: spacing.md`

#### Copy Button
| Property | Spec |
|---|---|
| **Variant** | Ghost (`variant="ghost"`) |
| **Size** | `sm` |
| **Icon** | `📋` (Clipboard), `16px`, left of label |
| **Label** | "Copy" |
| **Hover** | `color.primary.default` text, `background: color.surface.muted` |
| **Behavior** | Copies the **currently active tab's content** to clipboard |
| **Toast feedback** | `color.success.default` background, `color.text.inverse` text, "Copied to clipboard!", auto-dismiss `2000ms` |

#### Export Button
| Property | Spec |
|---|---|
| **Variant** | Primary (`variant="primary"`) |
| **Size** | `sm` |
| **Icon** | `⬇` (Download), `16px`, left of label |
| **Label** | "Export" |
| **Behavior** | Downloads the **currently active tab's content** as a file |
| **Filename format** | `evidence-{id}-{tab}-{timestamp}.{ext}` |
| **File extensions** | Raw Log → `.json` (or `.txt` if not JSON) / Metadata → `.json` / Trace → `.json` |
| **Content format** | Pretty-printed JSON where applicable |

#### Action Bar Layout
```
Desktop:
┌──────────────────────────────────────────────────────────────────────┐
│ [Raw Log] [Metadata] [Trace]                    [📋 Copy] [⬇ Export]│
└──────────────────────────────────────────────────────────────────────┘

Mobile:
┌────────────────────────────────────────┐
│ [Raw Log] [Metadata] [Trace]         │
├────────────────────────────────────────┤
│ [         📋 Copy          ]          │
│ [         ⬇ Export          ]          │
└────────────────────────────────────────┘
```

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
