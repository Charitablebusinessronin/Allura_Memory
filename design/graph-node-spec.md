# Graph View — Node Rendering Specification

**Deliverable:** 4 — Graph Node Spec  
**Status:** ✅ CONFIRMED by Design (Team Durham)  
**Date:** 2026-04-26  
**Blocked on:** N/A — Ready for Engineering  

---

## 1. Node Type → Color Mapping

All node fills use the semantic tokens from `tokens.json`.

| Node Type | Semantic Token | Hex Value | Usage |
|---|---|---|---|
| **Agent** | `color.graph.agent` | `#1D4ED8` | AI agents, assistants, actors |
| **Project** | `color.graph.project` | `#C89B3C` | Top-level projects, initiatives |
| **Outcome** | `color.graph.outcome` | `#157A4A` | Results, conclusions, finalized states |
| **Event** | `color.graph.event` | `#0F1115` | Timeline events, occurrences |
| **Insight** | `color.graph.insight` | `#FF5A2E` | Discovered insights, learnings |
| **Memory** | `color.graph.memory` | `#9CA3AF` | Default / generic memory nodes |

> ⚠️ **Design decision log:** The PRD marked Insight node color as "TBC by design". Team Durham confirms Orange (`color.secondary.default`) for Insight nodes to visually tie them to the Insight Review screen's CTA color and create a cohesive brand signal across the product.

---

## 2. Node Size Hierarchy

Nodes are rendered as circles. Radius defines visual weight in the hierarchy.

| Tier | Node Types | Radius (`r`) | Diameter | Stroke |
|---|---|---|---|---|
| **Primary** | Agent, Project | `10px` | `20px` | `1.5px` |
| **Secondary** | Outcome, Event, Insight | `7px` | `14px` | `1px` |
| **Default** | Memory | `5px` | `10px` | `1px` |

### Fill & Border
- **Fill:** 100% opacity solid color (see mapping above)
- **Border:** `1px solid` using `color.surface.default` (`#FFFFFF`) to create a crisp edge against dark backgrounds or overlapping nodes

---

## 3. Edge Styling

| State | Property | Token / Value |
|---|---|---|
| **Default** | stroke | `color.graph.edge` → `#9CA3AF` |
| | strokeWidth | `1px` |
| | opacity | `0.6` |
| **Hover** | stroke | `color.graph.edgeHover` → `#1D4ED8` |
| | strokeWidth | `2px` |
| | opacity | `1.0` |

- Edges are straight lines connecting node centers.
- No arrowheads by default (undirected graph).
- Optional: dashed stroke (`strokeDasharray: 4 2`) for inferred / weak connections.

---

## 4. Interaction States

### 4.1 Selected State
- **Ring:** `2px` solid `color.accent.gold` (`#C89B3C`)
- **Gap:** `2px` transparent padding between node fill and ring
- **Total visual expansion:** `4px` beyond node radius
- **Z-index:** Bring to front (`z-index: 10`)

### 4.2 Hover State
- **Scale:** `1.3x` (transform: `scale(1.3)`)
- **Z-index:** Bring to front above all non-selected nodes
- **Cursor:** `pointer`
- **Transition:** `transform 150ms ease-out, stroke-width 150ms ease-out`
- **Label:** Opacity from `0.6` → `1.0`, color shifts to `color.text.primary`

### 4.3 Disabled / Dimmed State
- **Opacity:** `0.3`
- **Pointer events:** `none`
- Used when filters hide a subset of the graph.

---

## 5. Label Typography

| Property | Token / Value |
|---|---|
| **Font** | `typography.fontFamily.sans` — IBM Plex Sans |
| **Size** | `typography.fontSize.xs` — `12px` |
| **Weight** | `typography.fontWeight.medium` — `500` |
| **Color** | `color.text.secondary` — `#6B7280` |
| **Position** | Centered below node, `spacing.sm` (`8px`) offset |
| **Max width** | `120px` with `text-overflow: ellipsis` |
| **Line clamp** | `1` line (truncate with `…`) |

---

## 6. Detail Sidebar Anatomy

| Property | Spec |
|---|---|
| **Width** | `300px` fixed |
| **Position** | Right edge, full height below top toolbar |
| **Background** | `color.surface.default` (`#FFFFFF`) |
| **Border** | `1px solid color.border.subtle` (`#E5E7EB`) left edge |
| **Shadow** | `shadow.md` on left edge (inset feeling) |
| **Scroll** | `overflow-y: auto` with custom scrollbar (`color.border.subtle` thumb) |

### Sidebar Sections (top to bottom)

```
┌─────────────────────────────┐
│ [Close] Node Type Badge     │  ← Header: node type color badge + close button
│ Title (typography.2xl bold) │
│ ─────────────────────────── │
│ PROPERTIES                  │  ← Section: key/value pairs
│   Key        Value          │
│   Key        Value          │
│ ─────────────────────────── │
│ CONNECTIONS (n)              │  ← Section: linked nodes list
│   → Agent "Broker-A"        │
│   → Project "Alpha"         │
│   → Memory "2026-04-26..."  │
│ ─────────────────────────── │
│ TAGS                        │  ← Section: tag chips
│   [tag-1] [tag-2]           │
│ ─────────────────────────── │
│ ACTIONS                     │  ← Section: CTA buttons
│   [View Evidence] [Delete]  │
└─────────────────────────────┘
```

- **Section padding:** `spacing.lg` (`16px`) horizontal, `spacing.md` (`12px`) vertical
- **Section divider:** `1px solid color.border.subtle`
- **Header height:** `64px`
- **Close button:** `24px × 24px` icon, `color.text.muted` → `color.text.primary` on hover

---

## 7. Filter Bar & Toolbar

### 7.1 Filter Bar (top of canvas)
| Property | Spec |
|---|---|
| **Height** | `48px` |
| **Background** | `color.surface.subtle` (`#F6F4EF`) |
| **Border bottom** | `1px solid color.border.subtle` |
| **Padding** | `spacing.md` (`12px`) horizontal |

**Content (left to right):**
1. **Search input** — `240px` width, `borderRadius.md`, placeholder "Search nodes…"
2. **Type filter chips** — toggle buttons for each node type (Agent, Project, Outcome, Event, Insight, Memory). Active state uses the node's color token with white text.
3. **Date range picker** — compact, `borderRadius.md`
4. **Clear filters** — ghost button, right-aligned

### 7.2 Toolbar (bottom-left of canvas, floating)
| Property | Spec |
|---|---|
| **Position** | Absolute, `spacing.lg` from bottom-left of canvas |
| **Background** | `color.surface.default` with `shadow.md` |
| **Border radius** | `borderRadius.md` (`8px`) |
| **Padding** | `spacing.sm` (`8px`) |

**Buttons (icon-only, `24px`):**
- Zoom In (`+`)
- Zoom Out (`−`)
- Fit to View (⟲)
- Layout Switch (force-directed ↔ hierarchical)
- Export PNG

---

## 8. Canvas Spec

| Property | Spec |
|---|---|
| **Background** | `color.surface.subtle` (`#F6F4EF`) |
| **Grid** | Optional subtle dot grid at `20px` intervals, `color.border.subtle` at `0.3` opacity |
| **Min zoom** | `0.25x` |
| **Max zoom** | `4x` |
| **Panning** | Click-drag on empty canvas |
| **Node drag** | Click-drag on node (repositions node, auto-saves layout) |

---

## 9. Responsive Behavior

| Breakpoint | Sidebar | Toolbar | Filter Bar |
|---|---|---|---|
| **Desktop (≥1024px)** | Fixed `300px` right | Bottom-left floating | Top sticky |
| **Tablet (768–1023px)** | Slide-over overlay, `280px` | Bottom-center | Collapsible to icon row |
| **Mobile (<768px)** | Full-screen modal | Hidden (pinch zoom) | Bottom sheet trigger |

---

## 10. Engineering Checklist

- [ ] Node rendering: circle SVG with dynamic `r`, fill, stroke
- [ ] Edge rendering: `<line>` or `<path>` with stroke/strokeWidth
- [ ] D3 / Cytoscape / force-graph layout integration
- [ ] Selected state: ring via `::after` pseudo-element or extra SVG `<circle>`
- [ ] Hover state: CSS `transform: scale(1.3)` with `transform-origin: center`
- [ ] Z-index management: selected > hovered > default
- [ ] Sidebar: fixed `300px` width, scrollable, collapsible on mobile
- [ ] Filter bar: sticky top, type chips with active/inactive states
- [ ] Toolbar: floating action group, keyboard shortcuts (`+`, `-`, `0`)
- [ ] Responsive: sidebar overlay on tablet/mobile, touch gestures for zoom/pan
