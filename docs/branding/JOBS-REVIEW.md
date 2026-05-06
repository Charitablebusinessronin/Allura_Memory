# Jobs Review: Allura Memory Design System

**Reviewer:** Steve Jobs — CEO, Team IRIS
**Date:** 2026-05-06
**Subject:** "The Illuminated Ledger" — Design System Ship Readiness
**Verdict:** **FAIL — 71/100**

---

## Scorecard

| Dimension | Score | Threshold | Gap |
|-----------|-------|-----------|-----|
| Strategy Completeness | 82/100 | 85 | -3 |
| Visual Coherence | 78/100 | 85 | -7 |
| Component Clarity | 72/100 | 85 | -13 |
| Implementation Fidelity | 70/100 | 85 | -15 |
| Two-Door Model Integrity | 68/100 | 85 | -17 |
| Ship Readiness | 58/100 | 85 | -27 |
| **Overall** | **71/100** | **85** | **-14** |

This design system is 60% of the way there. The thinking is right. The writing is clear. The execution is broken in three critical places. Fix them and this ships. Ship as-is and the dashboard turns into exactly the sci-fi command center the Captain asked us to avoid.

---

## Part 1: Six-Factor Analysis

### a. What Feels Wrong

There are three structural problems that will cause real damage if they reach production:

**1. The CSS import order destroys the two-door model.**

`allura.css` (loaded first in globals.css) correctly maps `--dashboard-surface: var(--allura-white)` in light mode and `--dashboard-surface: #162035` in dark mode. Then `brand-tokens.css` (loaded second) hard-codes `--dashboard-surface: #162035` in its bare `:root` block — no `.dark` qualifier, no preset guard. The second file wins. Every time. This means the dashboard is permanently dark regardless of the `dark` class. The BRAND-SYSTEM-GUIDE claims dashboard tokens are "always dark" — but this is the CSS implementation cheating, not a design decision. It makes the "two doors" concept impossible to build because one door is nailed shut.

**2. Consumer memory has zero component definitions.**

This is the product's second door. The BRAND-SYSTEM-GUIDE spends 10 sections explaining the two-system model. DESIGN.md names exactly zero consumer-memory components. No card style, no search bar spec, no memory-list item, no provenance badge, no "forget" button states, no empty-state layout. A developer who wants to build the consumer memory view has nothing to work from except the anti-references ("don't expose group_id"). That's a design principle dressed up as a spec. It's not enough.

**3. Evidence panels are described, not tokenized.**

DESIGN.md calls evidence panels "the signature component family." That's the right ambition. But there are no CSS class names, no layout tokens, no tab/accordion patterns, no copy-button spec, no provenance-control placement rules. The DESIGN.md prose is good — "separate raw evidence, outcome, metadata, connections, and history with clear tabs or sections" — but prose is not a component spec. The CSS files have `--dashboard-evidence-bg` but nothing that knows what an evidence panel IS.

Minor but real: `--chart-4` is assigned to `--allura-gold` in the semantic block, then overridden to `var(--dashboard-evidence)` (cream) two lines later. Then dark mode sets it back to `var(--allura-gold)`. This is confusing and looks like a merge conflict that shipped.

### b. What to Remove

- **Hard-coded dark `:root` tokens in `brand-tokens.css`** — Move `--dashboard-surface`, `--dashboard-surface-alt`, `--dashboard-surface-muted`, `--dashboard-text-secondary`, `--dashboard-text-muted`, `--dashboard-border`, `--dashboard-border-default` into a `.dashboard-dark` or `.dark` context. The bare `:root` in brand-tokens.css should only contain brand primitives that make sense in light mode AND dark mode.
- **Orphan `-raw` tokens** — `--dashboard-surface-raw`, `--dashboard-surface-alt-raw`, `--dashboard-text-secondary-raw`, etc. These exist because someone knew the architecture was fragile and added escape hatches. Fix the architecture; delete the hatches.
- **Duplicate `--chart-4` assignment** — Pick one. If chart-4 is evidence, make it `--dashboard-evidence`. If it's gold, the comment that says "Chart-4 uses cream for evidence category data" is lying.
- **Backward-compat aliases in brand-tokens.css that duplicate allura.css** — The `--allura-deep-navy: var(--allura-blue)` aliases already exist in allura.css. Don't define them twice in two places with the same CSS specificity. It invites drift.

### c. What the User Actually Wants

The Captain described the current Memory Explorer as "a candy-colored force-graph with arrows, always-on labels, a cream canvas, and five stacked widget panels." He called it "a sci-fi command center demo, not an Obsidian-style memory inspector."

What the user wants is an Obsidian-style memory inspector. That means:

- A dark surface, but not a black void. Layered tonal planes with purpose.
- Graph edges that appear on hover, not as permanent visual noise.
- Labels that only show on hover or selection.
- Widget panels that collapse into a single focused detail pane — right now there are five stacked, which is five times the cognitive load.
- Cream used as an EVIDENCE surface (like a document), not as a canvas background for the entire view.
- The feeling of inspecting a well-organized archive, not piloting a starship.

The design system has the right vocabulary for this (cream = evidence, abyss panels = depth). But the CSS architecture doesn't enforce the discipline, and no component spec tells a developer "the graph canvas is deep abyss, edges appear on hover at 30% opacity, labels are tooltip-only."

### d. The Simplified Experience

Right now the developer experience is: "Figure out which CSS file wins the cascade, then hard-code around it." The import order in globals.css is the only thing keeping the theme together, and it's fragile.

The simplified experience should be:

1. Add `data-theme-preset="allura" class="dark"` to `<html>`.
2. Every shadcn component renders Allura-themed.
3. Dashboard-specific surfaces (evidence panels, abyss panels, raised cards) have documented class names that Just Work — no cascade debugging.
4. Consumer memory surfaces import a separate, lightweight consumer-memory preset that provides simple, accessible, light-first tokens.

One `<html>` attribute. No import-order anxiety. Two clearly separated CSS surfaces.

### e. Principles to Enforce

The DESIGN.md principles are correct. The CSS doesn't enforce them:

1. **Show the chain of custody** — Evidence panels need real component specs, not prose. Without them, "chain of custody" is a slogan.
2. **Separate the two doors** — Currently the CSS physically prevents this by hard-coding dashboard tokens as dark in `:root`. Move dashboard dark tokens behind a `.dark` qualifier or a separate preset file.
3. **Govern without hiding** — Superseded knowledge, approval gates, and failures need badge/chip states that are defined in the token file, not left to developer interpretation.
4. **Make search the natural first move** — Search has no component spec. No search bar dimensions, no autocomplete panel style, no result-card layout, no "no results" state.
5. **Use warmth to support trust, not to soften precision** — The cream tone is correctly identified as an evidence surface. But no component spec distinguishes "this is evidence cream" from "this is background cream." They're the same token.

### f. The "It Just Works" Vision

A developer opens the codebase Tuesday morning. They add one attribute to `<html>`. They write:

```tsx
<EvidencePanel memory={memory} />
```

And get: a dark abyss panel with layering, an IBM Plex Mono evidence log section, a cream evidence highlight surface, a provenance badge row, status chips with correct colors, and a "Promote" button in ember orange. Every state — loading, error, empty, promoted, superseded, failed — renders correctly from the token system.

Today, that developer would need to:
1. Read 4 files to understand the color system
2. Discover the import-order bug
3. Realize consumer memory has no component spec
4. Invent evidence panel markup from prose descriptions
5. Hope the cascade lands on the right token

That gap is the ship readiness failure.

---

## Part 2: Fix Plan — What Must Change to Hit 85

Each fix is targeted to one scoring dimension. Complete these six items and rescore at 85+.

### FIX-1: Fix the import order architecture (Visual Coherence +15, Two-Door Model +15)

**Root cause:** `brand-tokens.css` hard-codes dark dashboard values in bare `:root`, overriding the allura.css preset regardless of the `dark` class.

**Action:** Restructure `brand-tokens.css`:

```css
:root {
  /* Brand primitives only — SAME values as allura.css light mode */
  --allura-blue:        #1D4ED8;
  --allura-orange:      #FF5A2E;
  --allura-green:       #157A44;
  --allura-gold:        #C89B3C;
  --allura-charcoal:    #111827;
  --allura-cream:       #F5F1E6;
  --allura-white:       #FFFFFF;
  /* Gray scale */
  /* Backward-compat aliases ONLY */
}

/* Dashboard dark tokens — ONLY activate with .dark */
.dark {
  --dashboard-surface:        #162035;
  --dashboard-surface-alt:    #0F1A2E;
  --dashboard-surface-muted:  #1E2D47;
  --dashboard-border:         rgb(255 255 255 / 0.08);
  --dashboard-border-default: rgb(255 255 255 / 0.12);
  --dashboard-text-secondary: #A0A0A0;
  --dashboard-text-muted:     #737373;
  --dashboard-evidence-bg:    #0F172A;
  --dashboard-evidence-text:  #F3F4F6;
}
```

Also: remove the `--dashboard-*` aliases from allura.css's light-mode block entirely. Dashboard tokens should only exist in dark context. This enforces the two-door model at the CSS level — you literally CANNOT render a dashboard without `.dark`.

**Agent:** `talon-code-reviewer` — Audit `brand-tokens.css` and `allura.css` for cascade conflicts, verify the fix.

### FIX-2: Define consumer memory component tokens (Component Clarity +12, Ship Readiness +8)

Add to the design system:
- `.memory-card` — Light surface, warm cream tint, 12px radius, hairline shadow, 20px padding
- `.memory-search` — 48px height, full-width, cream background, charcoal text, 8px radius, focus ring in blue
- `.memory-list-item` — 16px vertical padding, divider border, hover to raised surface
- `.memory-provenance` — Small muted label with source icon, plain English ("Learned from chat on May 3")
- `.memory-empty` — Centered display heading, warm body copy, no grayed-out icon grid
- `.memory-forgotten` — Reduced opacity state with "Undo" affordance, 30-day recovery note

These belong in a new file: `src/styles/presets/allura-consumer.css` or as a section in `allura.css`.

**Agent:** `iris-brand-designer` — Produce the consumer memory component spec with token mapping.

### FIX-3: Tokenize evidence panels (Component Clarity +10, Ship Readiness +10)

Define concrete CSS classes with token assignments:
- `.evidence-panel` — `background: var(--dashboard-surface)`, `border: 1px solid var(--dashboard-border)`, `border-radius: var(--allura-r-lg)`, `padding: var(--allura-xxl)`
- `.evidence-panel__log` — `font-family: var(--font-family-mono)`, `font-size: 0.8125rem`, `background: var(--dashboard-surface-alt)`, `border-radius: var(--allura-r-md)`, `padding: var(--allura-lg)`, max-height with scroll
- `.evidence-panel__metadata` — Flex row, `gap: var(--allura-md)`, muted text, timestamp in human-readable format
- `.evidence-panel__status` — Chip component using tone tokens (`--tone-green-bg`, etc.)
- `.evidence-panel__actions` — Ghost button row, right-aligned, with copy/promote/dismiss
- `.evidence-panel--superseded` — Reduced opacity, strikethrough or deprecated indicator
- `.evidence-panel--pending` — Amber/gold accent border on left (not side stripe — full left edge 4px indicator)

**Agent:** `iris-brand-designer` — Produce the evidence panel component spec with all states.

### FIX-4: Fix chart-4 double assignment (Implementation Fidelity +5)

Pick one assignment for `--chart-4` and enforce it consistently in both light and dark mode. If chart-4 represents evidence category data, use `--dashboard-evidence` in both modes. Add a comment explaining the choice.

**Agent:** `talon-code-reviewer` — Audit and fix token assignments across both CSS files.

### FIX-5: Add search component spec (Component Clarity +5, Ship Readiness +5)

Search is the "natural first move" per design principle #4 but has no component definition. Add:
- Search bar dimensions (48px height, full width in dashboard, contained width 640px in consumer)
- Search input tokens (background, text, placeholder, border, focus ring)
- Autocomplete/result dropdown (max-height 320px, scroll, 8px radius, editorial medium shadow)
- Result item layout (icon + title row + provenance snippet, 12px padding, hover highlight)
- No-results state ("No memories match your search" with suggested filters)
- Loading state (skeleton text, not a spinner)

**Agent:** `iris-brand-designer` — Produce the search component spec.

### FIX-6: Document the consumer memory view against the current Memory Explorer problem (Strategy +3)

The Captain wants the Memory Explorer redesigned from "candy-colored force-graph with arrows" to "Obsidian-style memory inspector." The current design system has the right color vocabulary but no application guidance for this specific surface.

Add to DESIGN.md or a new `docs/design/MEMORY-EXPLORER-SPEC.md`:
- Canvas background: deep abyss (#0F1A2E), not cream
- Graph edges: 30% opacity, appear on hover/selection only
- Node labels: tooltip-only (hover), not permanent labels
- Widget panels: one focused detail pane (not five stacked), using raised abyss (#1E2D47) surface
- Evidence cream (#F5F1E6) reserved for document/evidence sections within the detail pane
- Primary action: search bar at top, not a graph as the primary interaction

**Agent:** `iris-ux-researcher` — Validate the Memory Explorer spec against user needs for dense memory inspection.

---

## Part 3: Dispatch Plan

All fixes are independent and can run in parallel. Estimated total: 3 agent-hours.

| Order | Fix | Agent | Priority |
|-------|-----|-------|----------|
| 1 | FIX-1: CSS architecture (import order) | `talon-code-reviewer` | 🔴 Critical |
| 2 | FIX-2: Consumer memory components | `iris-brand-designer` | 🔴 Critical |
| 3 | FIX-3: Evidence panel tokenization | `iris-brand-designer` | 🔴 Critical |
| 4 | FIX-4: chart-4 dedup | `talon-code-reviewer` | 🟡 High |
| 5 | FIX-5: Search component spec | `iris-brand-designer` | 🟡 High |
| 6 | FIX-6: Memory Explorer spec | `iris-ux-researcher` | 🟢 Medium |

**After all fixes land, re-score.** Expected outcome: 87-92/100 → APPROVED.

---

## Part 4: What's Already Right

Credit where it's due. This system has strong bones:

- **The product vision is clear.** "Memory that shows its work" is a five-word sentence that tells you everything: what it does, how it feels, and what it refuses to be. That's good branding.
- **The anti-references are specific and useful.** "Not a cold enterprise console, not a generic SaaS dashboard, not a hacker terminal, not an academic knowledge graph." These aren't vague aspirations — they're guardrails a developer can check against.
- **The color palette is well-chosen.** The mapping from warm Brand Kit colors to brighter, higher-contrast Dashboard colors is thoughtful and necessary. Cobalt Blue at #1D4ED8 is a legitimate improvement over Deep Navy at #1A2B4A for interactive UI.
- **The BRAND-SYSTEM-GUIDE is comprehensive.** It's a genuine teaching document. Any developer who reads it once will understand the two-system model. The "5 Common Mistakes" section is particularly useful.
- **WCAG compliance is taken seriously.** The `-text` variant tokens, the explicit documentation of failing pairs, and the conditional-pass guidance show real attention to accessibility.
- **The typography hierarchy is well-reasoned.** IBM Plex Sans for dense UI, IBM Plex Mono for evidence, Montserrat 900 for display — each font has a clear job.

These are the parts that score 80+. The failure is in execution — specifically, in the gap between the prose spec and the CSS implementation. Close that gap and this system ships.

---

**Bottom line:** The thinking is 90th percentile. The execution is 60th percentile. Fix the execution. Don't touch the thinking.

— Steve