# Memory Explorer — Redesign Spec

**Status:** Awaiting implementation  
**Source:** FIX-6 from Jobs Review (2026-05-06)  
**Tokens:** `src/styles/brand-tokens.css` + `src/styles/presets/allura.css`  
**Audience:** Developer implementing `/dashboard/memory-explorer`

---

## Problem

The current Memory Explorer at `/dashboard/memory-explorer` is described as:

> A candy-colored force-graph with arrows, always-on labels, a cream canvas, and five stacked widget panels — a sci-fi command center demo, not an Obsidian-style memory inspector.

This spec defines the corrected surface. Every visual value comes from existing CSS token variables. No raw hex values.

---

## 1. Canvas Background

| Property | Token | Source |
|----------|-------|--------|
| Background | `var(--dashboard-surface-alt)` | `brand-tokens.css` :root |
| Feel | Dark, calm, spatial — a deep abyss that recedes behind content | |

The canvas is NOT cream. Cream is reserved for evidence sections inside the detail pane (see §4).

```
/* Canvas container */
.memory-explorer__canvas {
  background: var(--dashboard-surface-alt);
  position: relative;
  overflow: hidden;
  min-height: 100vh;
}
```

---

## 2. Graph Edges

| Property | Value |
|----------|-------|
| Opacity | 0 (invisible) by default; `0.30` on hover/selection |
| Arrowheads | None. Removed entirely. |
| Width | 1px |
| Color | `var(--dashboard-text-muted)` at 30% opacity |
| Transition | `opacity 200ms ease` |

Edges between nodes are secondary information. They should not create visual noise by default. A developer implements this by:

```css
.memory-explorer__edge {
  stroke: var(--dashboard-text-muted);
  stroke-width: 1px;
  opacity: 0;
  transition: opacity 200ms ease;
  /* no marker-end — no arrows */
}

.memory-explorer__node:hover .memory-explorer__edge,
.memory-explorer__node--selected .memory-explorer__edge {
  opacity: 0.30;
}
```

---

## 3. Node Labels

Labels appear **only in tooltips on hover**. No permanently visible text on the graph canvas.

The tooltip uses:

| Property | Token |
|----------|-------|
| Background | `var(--dashboard-surface-muted)` |
| Text | `var(--dashboard-text-primary)` |
| Border | `1px solid var(--dashboard-border)` |
| Border-radius | `var(--allura-r-md)` |
| Padding | `var(--allura-xs) var(--allura-md)` |
| Font | `var(--font-family-brand)`, 0.75rem |
| Shadow | `var(--allura-sh-md)` |

```css
.memory-explorer__node-label {
  display: none;
}

.memory-explorer__node:hover .memory-explorer__node-label {
  display: block;
  position: absolute;
  /* offset above the node */
  transform: translate(-50%, calc(-100% - 8px));
  left: 50%;
  background: var(--dashboard-surface-muted);
  color: var(--dashboard-text-primary);
  border: 1px solid var(--dashboard-border);
  border-radius: var(--allura-r-md);
  padding: var(--allura-xs) var(--allura-md);
  font-family: var(--font-family-brand);
  font-size: 0.75rem;
  box-shadow: var(--allura-sh-md);
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
}
```

---

## 4. Widget Layout — Single Detail Pane

Replace the five stacked widget panels with exactly ONE inspector pane.

| Property | Token | Notes |
|----------|-------|-------|
| Background | `var(--dashboard-surface)` | Raised abyss surface |
| Border | `1px solid var(--dashboard-border)` | Subtle edge separation |
| Border-radius | `var(--allura-r-lg)` | 12px rounded corners |
| Padding | `var(--allura-xxl)` | 32px breathing room |
| Width | 360px (desktop), full-width (mobile) | See §8 responsive |
| Shadow | `var(--allura-sh-md)` | Slight lift from canvas |

### Pane Sections (top to bottom)

Each section uses existing tokens only:

**a. Header bar**
```css
border-bottom: 1px solid var(--dashboard-border);
padding-bottom: var(--allura-lg);
margin-bottom: var(--allura-lg);
```

**b. Evidence section** — This is WHERE cream appears
```css
background: var(--dashboard-evidence-bg);
color: var(--dashboard-evidence-text);
font-family: var(--font-family-mono);
font-size: 0.8125rem;
border-radius: var(--allura-r-md);
padding: var(--allura-lg);
```

The evidence section is the ONLY place `--dashboard-evidence-bg` (cream → `#F5F1E6`) is used. It is never used as a canvas background. It belongs inside the detail pane to highlight raw evidence text, logs, or source documents.

**c. Metadata row**
```css
color: var(--dashboard-text-secondary);
font-size: 0.75rem;
display: flex;
gap: var(--allura-md);
```

**d. Action buttons**
```css
border-top: 1px solid var(--dashboard-border);
padding-top: var(--allura-lg);
margin-top: var(--allura-lg);
```

### Full pane structure

```html
<aside class="memory-explorer__detail-pane">
  <header><!-- node title, type badge --></header>
  <section class="memory-explorer__evidence">
    <!-- cream evidence block; uses --dashboard-evidence-bg -->
  </section>
  <div class="memory-explorer__metadata">
    <!-- source, timestamp, confidence -->
  </div>
  <footer><!-- actions --></footer>
</aside>
```

```css
.memory-explorer__detail-pane {
  background: var(--dashboard-surface);
  border: 1px solid var(--dashboard-border);
  border-radius: var(--allura-r-lg);
  padding: var(--allura-xxl);
  box-shadow: var(--allura-sh-md);
  width: 360px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

.memory-explorer__evidence {
  background: var(--dashboard-evidence-bg);
  color: var(--dashboard-evidence-text);
  font-family: var(--font-family-mono);
  font-size: 0.8125rem;
  border-radius: var(--allura-r-md);
  padding: var(--allura-lg);
  line-height: 1.6;
  margin: var(--allura-lg) 0;
}
```

---

## 5. Evidence Cream — Reserved Usage

`--dashboard-evidence-bg` (cream `#F5F1E6`) is a **document/evidence surface only**. It belongs:

- Inside `.memory-explorer__evidence` blocks within the detail pane
- On evidence cards, evidence panels, and source-document sections
- Nowhere else — not the canvas, not the panel background, not global chrome

The canvas is `--dashboard-surface-alt` (deep abyss). The panel is `--dashboard-surface` (raised abyss). Evidence sections inside the panel use cream. This creates three deliberate layers of depth.

---

## 6. Primary Interaction — Search Bar

The search bar is the natural first move. It sits at the top of the viewport, not buried in a widget.

| Property | Token | Value |
|----------|-------|-------|
| Height | | 48px |
| Width | | 100% (capped at 640px centered) |
| Background | `var(--dashboard-surface)` | Raised from canvas |
| Text | `var(--dashboard-text-primary)` | |
| Placeholder | `var(--dashboard-text-muted)` | "Search memories…" |
| Border | `1px solid var(--dashboard-border-default)` | |
| Border-radius | `var(--allura-r-md)` | 8px |
| Focus ring | `0 0 0 2px var(--ring)` | `--ring` = `var(--allura-blue)` |
| Icon | Magnifying glass, colored `var(--dashboard-text-muted)` | |
| Font | `var(--font-family-brand)` | |

```css
.memory-explorer__search {
  position: absolute;
  top: var(--allura-xl);
  left: 50%;
  transform: translateX(-50%);
  width: min(640px, calc(100% - var(--allura-xxl)));
  height: 48px;
  z-index: 20;
}

.memory-explorer__search input {
  width: 100%;
  height: 100%;
  background: var(--dashboard-surface);
  color: var(--dashboard-text-primary);
  border: 1px solid var(--dashboard-border-default);
  border-radius: var(--allura-r-md);
  padding: 0 var(--allura-lg) 0 44px;
  font-family: var(--font-family-brand);
  font-size: 0.9375rem;
  outline: none;
}

.memory-explorer__search input::placeholder {
  color: var(--dashboard-text-muted);
}

.memory-explorer__search input:focus {
  box-shadow: 0 0 0 2px var(--ring);
}

.memory-explorer__search svg {
  position: absolute;
  left: var(--allura-lg);
  top: 50%;
  transform: translateY(-50%);
  color: var(--dashboard-text-muted);
  pointer-events: none;
}
```

---

## 7. Node Type Color Mapping

Every node type uses **existing token variables only**. No raw hex values in node rendering code.

| Node Type | Fill Token | Stroke Token | Source |
|-----------|-----------|-------------|--------|
| **Memory** | `var(--dashboard-info)` | `var(--allura-blue)` | `allura.css` |
| **Insight** | `var(--dashboard-accent)` | `var(--allura-orange)` | `allura.css` |
| **Evidence** | `var(--dashboard-success)` | `var(--allura-green)` | `allura.css` |
| **Agent** | `var(--allura-gold)` | `var(--allura-gold)` | `brand-tokens.css` |
| **Project** | `var(--allura-charcoal)` | `var(--allura-charcoal)` | `brand-tokens.css` |
| **System** | `var(--dashboard-text-secondary)` | `var(--dashboard-text-muted)` | `brand-tokens.css` |

**Node sizing:**
- Memory: 12px radius
- Insight: 8px radius
- Evidence: 10px radius
- Agent: 8px radius (diamond shape)
- Project: 10px radius (rounded square)
- System: 6px radius

**Hover state:** Scale to 1.15×, add a subtle glow ring using `0 0 8px var(--ring)`.

**Selected state:** Apply a 2px ring using `var(--ring)`, maintain fill color.

```css
.memory-explorer__node--memory { fill: var(--dashboard-info); }
.memory-explorer__node--memory::after { stroke: var(--allura-blue); }

.memory-explorer__node--insight { fill: var(--dashboard-accent); }
.memory-explorer__node--insight::after { stroke: var(--allura-orange); }

.memory-explorer__node--evidence { fill: var(--dashboard-success); }
.memory-explorer__node--evidence::after { stroke: var(--allura-green); }

.memory-explorer__node--agent { fill: var(--allura-gold); }
.memory-explorer__node--agent::after { stroke: var(--allura-gold); }

.memory-explorer__node--project { fill: var(--allura-charcoal); }
.memory-explorer__node--project::after { stroke: var(--allura-charcoal); }

.memory-explorer__node--system { fill: var(--dashboard-text-secondary); }
.memory-explorer__node--system::after { stroke: var(--dashboard-text-muted); }

/* Shared states */
.memory-explorer__node--selected {
  filter: drop-shadow(0 0 6px var(--ring));
}
```

---

## 8. Responsive Behavior

**Desktop (≥1024px):**
- Graph canvas fills viewport as full-background layer
- Search bar centered at top
- Detail pane floats on the right side
- Layout: search fixed → graph canvas → pane overlay on right

**Tablet (768–1023px):**
- Detail pane width reduces to 300px
- Search bar max-width reduces to 480px
- Graph remains visible behind pane

**Mobile (<768px):**
- Graph collapses entirely (not rendered — removes layout cost)
- Search bar becomes full-width input at top
- Detail pane takes `width: 100%`, fills viewport below search
- Selection is via search results list, not graph interaction
- Tapping a result opens the detail pane in full-width mode

```css
@media (max-width: 1023px) {
  .memory-explorer__detail-pane {
    width: 300px;
  }
  .memory-explorer__search {
    width: min(480px, calc(100% - var(--allura-xxl)));
  }
}

@media (max-width: 767px) {
  .memory-explorer__canvas {
    display: none; /* graph collapsed */
  }
  .memory-explorer__detail-pane {
    width: 100%;
    position: static;
    border-radius: 0;
    max-height: none;
  }
  .memory-explorer__search {
    position: static;
    transform: none;
    width: 100%;
    max-width: none;
    padding: var(--allura-md);
    margin: 0;
  }
  .memory-explorer__search input {
    width: 100%;
  }
}
```

---

## 9. Result List (Search-Driven Mode)

When the graph is collapsed (mobile) or when the user types a query, a result list replaces graph interaction:

| Property | Token |
|----------|-------|
| Container background | `var(--dashboard-surface)` |
| Item hover | `var(--dashboard-surface-muted)` |
| Divider | `1px solid var(--dashboard-border)` |
| Item padding | `var(--allura-md) var(--allura-lg)` |
| Item border-radius | `var(--allura-r-sm)` |
| Title text | `var(--dashboard-text-primary)`, `var(--font-family-brand)`, 0.9375rem |
| Snippet text | `var(--dashboard-text-secondary)`, 0.8125rem |
| Type badge | Tone tokens (see below) |

```css
.memory-explorer__result-list {
  background: var(--dashboard-surface);
  border: 1px solid var(--dashboard-border);
  border-radius: var(--allura-r-md);
  max-height: 360px;
  overflow-y: auto;
}

.memory-explorer__result-item {
  padding: var(--allura-md) var(--allura-lg);
  border-bottom: 1px solid var(--dashboard-border);
  cursor: pointer;
}

.memory-explorer__result-item:last-child {
  border-bottom: none;
}

.memory-explorer__result-item:hover {
  background: var(--dashboard-surface-muted);
}

.memory-explorer__result-item:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: -2px;
}
```

---

## 10. Token Reference — Complete List

Every token used in this spec and its source file:

| Token | Defined In |
|-------|-----------|
| `--dashboard-surface-alt` | `brand-tokens.css` :root + `allura.css` `.dark:root[...]` |
| `--dashboard-surface` | `brand-tokens.css` :root + `allura.css` `.dark:root[...]` |
| `--dashboard-surface-muted` | `brand-tokens.css` :root + `allura.css` `.dark:root[...]` |
| `--dashboard-border` | `brand-tokens.css` :root + `allura.css` `.dark:root[...]` |
| `--dashboard-border-default` | `brand-tokens.css` :root + `allura.css` `.dark:root[...]` |
| `--dashboard-text-primary` | `brand-tokens.css` :root + `allura.css` `.dark:root[...]` |
| `--dashboard-text-secondary` | `brand-tokens.css` :root |
| `--dashboard-text-muted` | `brand-tokens.css` :root |
| `--dashboard-evidence-bg` | `brand-tokens.css` :root + `allura.css` `.dark:root[...]` |
| `--dashboard-evidence-text` | `brand-tokens.css` :root + `allura.css` `.dark:root[...]` |
| `--dashboard-info` | `allura.css` `:root[data-theme-preset="allura"]` |
| `--dashboard-accent` | `allura.css` `:root[data-theme-preset="allura"]` |
| `--dashboard-success` | `allura.css` `:root[data-theme-preset="allura"]` |
| `--allura-blue` | `brand-tokens.css` :root + `allura.css` |
| `--allura-orange` | `brand-tokens.css` :root + `allura.css` |
| `--allura-green` | `brand-tokens.css` :root + `allura.css` |
| `--allura-gold` | `brand-tokens.css` :root + `allura.css` |
| `--allura-charcoal` | `brand-tokens.css` :root + `allura.css` |
| `--allura-cream` | `brand-tokens.css` :root + `allura.css` |
| `--allura-r-lg` (12px) | `allura.css` `:root[data-theme-preset="allura"]` |
| `--allura-r-md` (8px) | `allura.css` `:root[data-theme-preset="allura"]` |
| `--allura-r-sm` (4px) | `allura.css` `:root[data-theme-preset="allura"]` |
| `--allura-xxl` (32px) | `allura.css` `:root[data-theme-preset="allura"]` |
| `--allura-xl` (24px) | `allura.css` `:root[data-theme-preset="allura"]` |
| `--allura-lg` (16px) | `allura.css` `:root[data-theme-preset="allura"]` |
| `--allura-md` (12px) | `allura.css` `:root[data-theme-preset="allura"]` |
| `--allura-sm` (8px) | `allura.css` `:root[data-theme-preset="allura"]` |
| `--allura-xs` (4px) | `allura.css` `:root[data-theme-preset="allura"]` |
| `--allura-sh-md` | `allura.css` `:root[data-theme-preset="allura"]` |
| `--ring` | `allura.css` `:root[data-theme-preset="allura"]` |
| `--font-family-mono` (`IBM Plex Mono`) | `allura.css` `:root[data-theme-preset="allura"]` |
| `--font-family-brand` (`IBM Plex Sans`) | `allura.css` `:root[data-theme-preset="allura"]` |

**Zero raw hex values.** Zero invented tokens. Every color, radius, spacing, shadow, and font is an existing CSS custom property.

---

## Implementation Checklist

- [ ] Canvas uses `var(--dashboard-surface-alt)` — dark abyss, not cream
- [ ] Graph edges default to `opacity: 0`, appear at 0.30 on hover/selection
- [ ] No arrowheads (no `marker-end`) on any edge
- [ ] Node labels are tooltip-only (hidden by default, shown on `:hover`)
- [ ] Five stacked panels removed; replaced with ONE `.memory-explorer__detail-pane`
- [ ] Detail pane uses `var(--dashboard-surface)` background, `var(--allura-r-lg)` corners
- [ ] Evidence cream (`var(--dashboard-evidence-bg)`) used ONLY inside `.memory-explorer__evidence` within pane
- [ ] Search bar is the primary interaction surface, centered at top, 48px height
- [ ] All six node types render with the token mapping from §7
- [ ] Graph collapses at <768px; inspector takes full width; result list appears for selection
- [ ] No raw hex values anywhere in the component
