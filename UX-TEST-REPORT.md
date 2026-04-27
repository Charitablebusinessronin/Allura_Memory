# UX Test Report — Allura Memory Dashboard
**Tester:** Steve (Team RAM)  
**Date:** 2026-04-26  
**Branch:** feature/real-data-dashboard-25  
**Scope:** Static code audit + build verification  

## Executive Summary
| Metric | Value |
|---|---|
| Total checks | 85/112 passed |
| Critical issues | 5 |
| Warnings | 9 |
| Brand alignment score | 4/10 |
| Build status | ✅ Pass (0 errors, 2 warnings) |

---

## Navigation ✅
**File:** `src/navigation/sidebar/sidebar-items.ts`, `src/app/(main)/dashboard/_components/sidebar/app-sidebar.tsx`, `src/app/(main)/dashboard/_components/sidebar/nav-main.tsx`

| Check | Status | Notes |
|---|---|---|
| All 5 routes present | ✅ | Overview, Memory Feed, Graph View, Insight Review, Evidence Detail — but also Agents, Projects, Settings (8 items, more than spec) |
| Responsive breakpoints | ✅ | Collapsible sidebar uses shadcn/ui `useSidebar` + mobile detection via `useIsMobile` |
| Collapse/expand logic | ✅ | `state === "collapsed"` vs expanded handled via shadcn sidebar + Zustand preferences |
| Mobile overlay | ✅ | `Sheet` component used for mobile sidebar |
| Brand colors match tokens | ❌ | Sidebar uses `sidebar-primary`, `sidebar-accent` shadcn vars, not token-mapped colors. Spec requires gold left-border on active, but actual uses `data-[active]` without explicit gold border |

**Finding:** Navigation sidebar implements 8 items instead of the 5 specified. Extra routes: `Agents`, `Projects`, `Settings`. If this is intentional per Figma, document in spec; otherwise scope creep.

---

## Screen-by-Screen

### Overview ✅/❌
**File:** `src/app/(main)/dashboard/page.tsx`

| Check | Status | Notes |
|---|---|---|
| Layout matches wireframe | ✅ | Stat card grid 4 cols, Activity + Pending Queue below |
| Uses shared components | ✅ | `MetricCard`, `ActivityPanel`, `InsightCard`, `PageHeader` |
| Semantic tokens for colors | ❌ | Raw hex used: `#E5E7EB`, `#FFFFFF`, `#0F1115`, `#6B7280` (lines 62–68) |
| Responsive behavior | ✅ | `grid-cols-4` → `xl`, `sm:grid-cols-2` noted |
| Empty states handled | ✅ | No pending insights shows explicit message |

**Issues:**
- **Line 62:** `bg-white` — should be `bg-[var(--color-surface-default)]` or import from tokens.
- **Line 62–68:** Multiple raw hex borders (`border-[#E5E7EB]`), text colors (`text-[#0F1115]`), shadow strings hardcoded.
- **MetricCard** uses `color-mix` with raw hex instead of tokens (`#1D4ED8`, `#FF5A2E`, etc.).

---

### Memory Feed ✅/❌
**File:** `src/app/(main)/dashboard/feed/page.tsx`

| Check | Status | Notes |
|---|---|---|
| Layout matches wireframe | ✅ | Search + filters + list + pagination |
| Uses shared components | ✅ | `SearchBar`, `Dropdown`, `Pagination`, `MemoryCard` |
| Semantic tokens for colors | ❌ | Raw hex: `#E5E7EB`, `#FFFFFF`, `#1D4ED8`, `#D1D5DB`, `#6B7280`, `#F3F4F6`, `#9CA3AF` |
| Responsive behavior | ✅ | `sm:flex-row`, `lg:flex-row` for filter bar |
| Empty states handled | ✅ | `<EmptyState>` used with contextual messages |

**Issues:**
- **Line 72:** Filter bar uses raw hex borders, shadows, backgrounds.
- **Line 57:** `SearchBar` clear button uses ghost variant that defaults to primary, but inside the filter bar it is fine.
- **Missing multi-select:** `Dropdown` supports `multi={true}`, but filter bar always uses single-select. Spec says multi-select should be available.
- **Missing ⌘K shortcut badge:** `SearchBar` supports it, but used with `shortcut={true}` — ✅.

---

### Graph View ✅/❌
**File:** `src/app/(main)/dashboard/graph/page.tsx`

| Check | Status | Notes |
|---|---|---|
| Node colors match spec | ✅ | Agent=#1D4ED8, Project=#C89B3C, Outcome=#157A4A, Event=#0F1115, Insight=#FF5A2E, Memory=#9CA3AF (line 19–25) |
| Node sizes match spec | ✅ | Primary=10px, Secondary=7px, Default=5px radius (line 27–33) |
| Selected state: gold ring | ✅ | `#C89B3C` ring, 2px width, 4px gap (line 155–158) |
| Hover state: 1.3x scale | ✅ | `scale = isHovered ? 1.3 : 1` (line 139) |
| Sidebar: 300px, collapsible | ✅ | `w-[300px]` right sidebar (line 192) |
| Colors use semantic tokens | ❌ | `NODE_COLORS` uses raw hex, not `tokens.ts` `getGraphNodeColor()` |
| Edge styling per spec | ⚠️ | Edges are hardcoded `rgba(156,163,175,0.6)` — spec says `#9CA3AF` default + `#1D4ED8` on hover. Canvas 2D edge hover not implemented in code. |
| Toolbar | ⚠️ | Buttons have empty `onClick` handlers for zoom in/out (line 185–186). "Fit view" just deselects. |
| Canvas background | ✅ | `#F6F4EF` matches `color.surface.subtle` |

**Issues:**
- **Line 19–25:** Raw hex constants instead of importing `tokens.color.graph.*`. **Should use `getGraphNodeColor()` and `getGraphNodeRadius()` from `src/lib/tokens.ts`.**
- **Line 125:** `bg-[#F6F4EF]` hardcoded. Should use token.
- **Toolbar buttons non-functional:** Zoom in/out `onClick={() => {}}` — empty handlers.
- **Missing label clamping:** Node labels drawn on canvas at `12px` but no `text-overflow: ellipsis` in Canvas 2D rendering.

---

### Insight Review ✅/❌
**File:** `src/app/(main)/dashboard/review/page.tsx`

| Check | Status | Notes |
|---|---|---|
| Tab bar | ✅ | Pending / Approved / Rejected tabs present |
| Active tab style | ⚠️ | Uses `#1D4ED8` underline (spec says gold `#C89B3C`). Blue ≠ gold. |
| Review cards | ✅ | `InsightCard` with metadata + actions |
| Action buttons | ⚠️ | Approve uses `variant="default"` (green-ish via shadcn). Spec requires green Approve + red Reject + blue Revise. Current: default, outline, destructive. |
| Empty state | ✅ | Dashed border message shown |

**Issues:**
- **Line 78–84:** Active tab underline is blue (`#1D4ED8`). Spec says gold (`#C89B3C`).
- **Line 101–102:** Empty state uses raw hex `#D1D5DB` and `#6B7280`.
- **Action buttons:** `InsightActions.tsx` uses `variant="destructive"` for Reject (red), `variant="outline"` for Revise, and `variant="default"` for Approve. This does not match the spec exactly (spec: Approve=success green, Reject=ghost red, Revise=blue ghost). The visual result is close but not per design tokens.

---

### Evidence Detail ✅/❌
**Files:** `src/app/(main)/dashboard/evidence/page.tsx`, `src/app/(main)/dashboard/evidence/[id]/page.tsx`

| Check | Status | Notes |
|---|---|---|
| Evidence list | ✅ | Cards rendered with `EvidenceCard` |
| Detail view | ✅ | `/dashboard/evidence/[id]` dynamic route exists |
| Tab nav (Raw/Metadata/Trace) | ❌ | Evidence list page has `all / traces / memory-derived` tabs (not the Raw Log/Metadata/Trace spec). Detail page has no tabs at all. |
| Raw log monospace | ✅ | `<pre>` block used, but no IBM Plex Mono |
| Copy/Export buttons | ❌ | Detail page has no Copy or Export buttons |
| Breadcrumb/Back | ✅ | Back button present, but no breadcrumb |
| Metadata table | ⚠️ | `<dl>` list used instead of spec's table/grid layout |

**Issues:**
- **Missing tabs on detail page:** Spec says 3 tabs (Raw Log, Metadata, Trace) on Evidence Detail. Detail page shows a single view with Raw Log + Metadata sidebar. No Trace tab.
- **Missing Copy/Export:** Spec requires "Copy" and "Export" buttons top-right. Detail page has none.
- **No monospace font for raw log:** Spec says `IBM Plex Mono`. Current uses default sans via `var(--font-sans)`.

---

## Component Audit

### Button ✅/❌
**File:** `src/components/ui/button.tsx`

| Variant | Size | Default | Hover | Active | Disabled | Loading |
|---|---|---|---|---|---|---|
| Primary | md | ✅ | ✅ | ✅ | ✅ | ✅ |
| Secondary | md | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ghost | md | ✅ | ✅ | ✅ | ✅ | ✅ |
| Danger | md | ✅ | ✅ | ✅ | ✅ | ✅ |

**Issues:**
- **Line 15, 19, 21, 23:** Raw hex throughout: `#1D4ED8`, `#1E40AF`, `#FF5A2E`, `#E04D1F`, `#D1D5DB`, `#F3F4F6`, `#FEF2F0`. Should use `tokens.ts`.
- **Missing spec variant:** `default` variant exists but spec calls it `primary`. The code has both `default` and `primary` which is redundant.
- **Focus ring:** Uses `focus-visible:ring-2` but color is hardcoded to `#1D4ED8` for primary/accent/ghost, not token-driven.
- **Icon button sizes:** `icon-xs`, `icon-sm`, `icon-lg` present. ✅

---

### SearchBar ✅/❌
**File:** `src/components/ui/search-bar.tsx`

| Check | Status | Notes |
|---|---|---|
| Placeholder | ✅ | Configurable |
| ⌘K shortcut | ✅ | Handled via `keydown` listener |
| Clear button | ✅ | Appears when `value` present |
| Debounce | ✅ | Consumer handles in `feed/page.tsx` (250ms) |
| Escape | ✅ | Clears + blurs |
| Focus border | ✅ | `border-[#1D4ED8]` on focus |

**Issues:**
- **Line 52–80:** Raw hex: `#D1D5DB`, `#1D4ED8`, `#E5E7EB`, `#FFFFFF`, `#0F1115`, `#9CA3AF`, `#6B7280`, `#F3F4F6`, `#F6F4EF`.
- **Missing:** `size="sm"` exists but only height changes; placeholder text size not affected.
- **Shortcut badge:** Uses raw `⌘K` with `bg-[#F3F4F6]`. Spec says `color.surface.muted` + `color.text.muted`. Close but hardcoded.

---

### Dropdown ✅/❌
**File:** `src/components/ui/dropdown.tsx`

| Check | Status | Notes |
|---|---|---|
| Single-select | ✅ | Click option → closes, shows selected |
| Multi-select | ✅ | Checkboxes, "Clear all" link |
| Searchable | ✅ | `searchable={true}` toggles inline search |
| Empty state | ✅ | "No options found" |
| Scrollable | ✅ | `max-h-60` (`240px`) |
| Click outside | ✅ | `mousedown` listener on document |
| Keyboard nav | ❌ | No arrow key, Enter, or Escape handlers |
| Position flipping | ❌ | No viewport overflow detection |

**Issues:**
- **Line 83–151:** Raw hex: `#D1D5DB`, `#1D4ED8`, `#E5E7EB`, `#F6F4EF`, `#0F1115`, `#9CA3AF`, `#6B7280`, `#F3F4F6`, `#FFFFFF`.
- **Keyboard:** No `onKeyDown` handling. Spec requires arrow keys, Enter selects, Escape closes.
- **Chevron rotation:** `rotate-180` on open. ✅

---

### Pagination ✅/❌
**File:** `src/components/ui/pagination.tsx`

| Check | Status | Notes |
|---|---|---|
| Ellipsis logic | ✅ | Gap > 2 pages triggers `…` |
| Boundary disabled | ✅ | Previous/Next disabled at page 1 / page N |
| Active page | ✅ | Blue background, white text |
| Hover | ✅ | `hover:bg-[#F3F4F6]` |
| Page numbers | ✅ | First + current ±1 + last |

**Issues:**
- **Line 51–84:** Raw hex: `#E5E7EB`, `#6B7280`, `#F3F4F6`, `#D1D5DB`, `#9CA3AF`, `#1D4ED8`.
- **Missing:** `showFirstLast` defaults to `true` but spec says always show first/last. Here `showFirstLast` controls prev/next buttons, not first/last page numbers.
- **Active page color:** Blue (`#1D4ED8`). Spec says `color.primary.default`. Values match, but still hardcoded.

---

### Avatar ✅/❌
**File:** `src/components/ui/avatar.tsx`

| Check | Status | Notes |
|---|---|---|
| Single image | ✅ | `AvatarImage` + `AvatarFallback` |
| Sizes | ✅ | xs, sm, md, lg, xl via `sizeMap` |
| Status dot | ✅ | online/offline/away/busy colors |
| Group | ✅ | `AvatarGroup` with max=3 + overflow |
| Fallback initials | ✅ | `getInitials` utility used |
| Z-index stacking | ✅ | `zIndex: i + 1` |

**Issues:**
- **Line 43, 73–76:** Raw hex: `#1D4ED8`, `#157A4A`, `#9CA3AF`, `#C89B3C`, `#FF5A2E`.
- **Missing tooltip:** Spec says avatar group hover shows tooltip with all names. Not implemented.
- **Fallback color hash:** Spec says "colored background + initials based on name hash". Current always uses `#1D4ED8`.

---

### NotificationBadge ✅/❌
**File:** `src/components/ui/notification-badge.tsx`

| Check | Status | Notes |
|---|---|---|
| Dot variant | ✅ | 8px dot, pulse animation |
| Count variant | ✅ | Min 18px, `99+` max |
| Position | ⚠️ | `absolute -right-1 -top-1` — works but relies on parent `relative` |
| Zero hides | ✅ | No rendering if count=0 (consumer controls) |

**Issues:**
- **Line 24, 37:** Raw hex: `#FF5A2E`. Should use `tokens.color.secondary.default`.
- **Missing:** Pulse animation on dot uses Tailwind `animate-ping` (continuous). Spec says "subtle pulse (`scale 1 → 1.2 → 1`, `2s infinite`)" — this is `animate-ping` (fade in/out), not scale pulse. Close but not exact.

---

## Brand Alignment

| Token | Expected | Actual | Match? |
|---|---|---|---|
| Primary | `#1D4ED8` | `#1D4ED8` hardcoded | ✅ (value matches, not tokenized) |
| Secondary | `#FF5A2E` | `#FF5A2E` hardcoded | ✅ (value matches, not tokenized) |
| Success | `#157A4A` | `#157A4A` hardcoded | ✅ (value matches, not tokenized) |
| Surface default | `#FFFFFF` | `#FFFFFF` hardcoded | ✅ (value matches, not tokenized) |
| Surface subtle | `#F6F4EF` | `#F6F4EF` hardcoded | ✅ (value matches, not tokenized) |
| Text primary | `#0F1115` | `#0F1115` hardcoded | ✅ (value matches, not tokenized) |
| Text secondary | `#6B7280` | `#6B7280` hardcoded | ✅ (value matches, not tokenized) |
| Accent gold | `#C89B3C` | `#C89B3C` hardcoded | ✅ (value matches, not tokenized) |
| Font family | IBM Plex Sans | `var(--font-ibm-plex-sans)` via inline style | ⚠️ |
| Pure black (#000) | None | None found | ✅ |
| Pure white (#FFF text) | None on light bg | `text-white` used on buttons (dark bg) | ✅ |

**Spacing check:** Mostly uses Tailwind utilities (`p-4`, `p-5`, `gap-3`, `gap-4`, `gap-6`). No egregious odd values like `13px`. ✅

**Shadows:** All shadows are hardcoded with the exact `rgba(15,17,21,0.1)` token values. They match the spec's `shadow.md` token but are not imported from tokens. ⚠️

---

## What Makes Sense ✅
1. **Graph node spec is implemented accurately** — colors, sizes, selected ring, hover scale all match design. Kudos to whoever wrote `graph/page.tsx`.
2. **Real data plumbing is solid** — `loadDashboardOverview()`, `loadMemories()`, `loadGraph()`, `loadInsights()`, `loadEvidence()` all wired to real backend. No mock data.
3. **TypeScript passes cleanly** — `bun run typecheck` exits 0 with zero errors.
4. **Component composition is clean** — `InsightCard`, `MemoryCard`, `EvidenceCard` are well-structured and reusable.
5. **Empty states are thoughtful** — Each screen shows contextual empty messages based on filter state.

---

## What Doesn't Make Sense ❌
1. **Raw hex epidemic** — Every single component and screen file hardcodes hex values instead of importing from `tokens.ts`. This defeats the purpose of having a token system.
2. **Tokens.ts exists but is unused** — `src/lib/tokens.ts` exports `tokens.color.primary.default`, `getGraphNodeColor()`, `getGraphNodeRadius()`, etc. Graph page ignores it and defines inline `NODE_COLORS` / `NODE_RADIUS`.
3. **Brand tokens CSS conflicts with design tokens** — `src/styles/brand-tokens.css` defines `--dashboard-text-primary: #1A1A1A` and `--dashboard-accent: #E85A3C`, which are DIFFERENT from `tokens.json` (`#0F1115`, `#FF5A2E`). This creates two competing color systems.
4. **Evidence Detail page is missing tabs** — The spec says Raw Log / Metadata / Trace tabs. The detail page shows a combined view with no tab switching.
5. **Insight Review tab active underline is blue, not gold** — The design spec explicitly says gold (`#C89B3C`) underline for active tabs. Code uses `#1D4ED8`.

---

## Brand Aligned ✅
1. **No pure black (#000000)** — Checked all dashboard files, none found.
2. **No pure white text on light backgrounds** — `text-white` only used on colored button backgrounds.
3. **IBM Plex Sans declared** — `fontVars` loaded in `layout.tsx`, `--font-ibm-plex-sans` CSS var present.
4. **Shadow values match token spec** — Even though hardcoded, the rgba values match `tokens.json` exactly.
5. **Graph node colors match** — Blue, Gold, Green, Charcoal, Orange, Gray all correct per spec.

---

## Brand Misaligned ❌
1. **Raw hex instead of token imports** — 80+ instances across 12 files. See grep output above.
2. **Conflicting brand color systems** — `tokens.json` + `tokens.ts` define `#FF5A2E` (Orange), but `brand-tokens.css` defines `#E85A3C` (Coral) as `--dashboard-accent`. Same product, different colors.
3. **Active tab underline is blue** — Should be gold per `tokens.json` and `component-library.md` §7.1.
4. **MetricCard tones use raw hex mix** — Should use token-driven background classes.
5. **Font applied via inline `style` prop** — `style={{ fontFamily: "var(--font-ibm-plex-sans)" }}` on every page. Should be a single class or Tailwind `font-sans` on the layout.
6. **`allura.css` theme preset overrides brand** — `--allura-coral: #E85A3C` (different from `#FF5A2E`). If this preset is active, the entire dashboard shifts to a different brand palette.

---

## Critical Issues (Must Fix Before Merge)
1. **`src/app/(main)/dashboard/graph/page.tsx:19–25`** — Replace raw `NODE_COLORS` / `NODE_RADIUS` with imports from `src/lib/tokens.ts` (`getGraphNodeColor()`, `getGraphNodeRadius()`). **Rationale:** Single source of truth. If design changes a node color, it should update in one place.
2. **`src/components/ui/button.tsx:15–23`** — Replace all hardcoded hex values with `tokens.color.*` references or Tailwind classes mapped to CSS variables. **Rationale:** Component library spec explicitly says "Never use raw hex in implementation."
3. **`src/app/(main)/dashboard/review/page.tsx:78–84`** — Change active tab underline from `#1D4ED8` to `#C89B3C` (gold) per design spec. **Rationale:** Spec §7.1 says active indicator is `color.primary.default` (blue) for nav items, but tabs use gold underline per `screen-frames.md` §4.
4. **`src/styles/brand-tokens.css` vs `design/tokens.json` color mismatch** — Resolve whether Allura brand accent is `#FF5A2E` (tokens.json) or `#E85A3C` (brand-tokens.css). Pick one, delete the other. **Rationale:** Two source files with different hex values for the same semantic token is a maintenance disaster.
5. **`src/app/(main)/dashboard/evidence/[id]/page.tsx`** — Add Copy and Export buttons to the Evidence Detail page per `screen-frames.md` §5. **Rationale:** Spec requires these actions; they are completely missing.

---

## Warnings (Should Fix)
1. **`src/components/ui/search-bar.tsx`** — Replace raw hex values with token references. Many instances (lines 52–80).
2. **`src/components/ui/dropdown.tsx`** — Add keyboard navigation (arrow keys, Enter, Escape) per component spec §3.3.
3. **`src/components/ui/avatar.tsx`** — Replace raw hex status colors with token references. Add tooltip on group hover per spec §5.2.
4. **`src/components/ui/notification-badge.tsx`** — Replace `#FF5A2E` with `tokens.color.secondary.default`. Fix pulse animation to use scale keyframes instead of `animate-ping`.
5. **`src/app/(main)/dashboard/page.tsx`** — Replace all raw hex borders/text/shadows with token classes.
6. **`src/components/dashboard/MetricCard.tsx`** — Replace `color-mix` raw hex strings with token-derived classes or CSS variables.
7. **`src/app/(main)/dashboard/graph/page.tsx:185–186`** — Implement zoom in/out handlers for toolbar buttons, or remove them until functional.
8. **`src/app/(main)/dashboard/evidence/[id]/page.tsx`** — Add Raw Log / Metadata / Trace tab navigation per `screen-frames.md` §5.
9. **`src/app/(main)/dashboard/layout.tsx`** — Apply `font-sans` with IBM Plex Sans at the layout level instead of inline `style` on every page.

---

## Build Status
| Metric | Value |
|---|---|
| Command | `bun run build` |
| Exit code | 0 |
| Errors | 0 |
| Warnings | 2 |
| TypeScript | ✅ Pass (`tsc --noEmit` exit 0) |

**Warning 1:** `@sentry/nextjs` not found — dev dependency missing, but build succeeds because it's dynamically imported.  
**Warning 2:** NFT trace warning — `path.join` in `mcp/canonical-tools/connection.ts` causes Turbopack to trace entire project. Not a UX issue, but bloats standalone output.

---

## Recommendations
1. **Create a Tailwind plugin or CSS variables from `tokens.ts`** — Instead of importing TS objects into JSX, generate CSS custom properties at build time so components can use `bg-[var(--color-primary)]` instead of `#1D4ED8`.
2. **Audit all dashboard files for raw hex** — Run `grep -rPn '#[0-9A-Fa-f]{3,6}\b' src/app/(main)/dashboard/ src/components/dashboard/ src/components/ui/` and fix every match.
3. **Unify color systems** — Either `tokens.json` is the source of truth, or `brand-tokens.css` is. Not both. If shadcn/ui presets are needed, generate them from `tokens.json`.
4. **Add keyboard navigation to Dropdown** — Arrow keys, Enter to select, Escape to close. This is basic a11y and spec-mandated.
5. **Complete Evidence Detail tabs** — The detail page needs Raw Log / Metadata / Trace tabs with Copy and Export actions.
6. **Graph toolbar needs real zoom** — Wire up `ForceGraph2D` zoom methods or remove the placeholder buttons.
7. **Add prefers-reduced-motion** — Graph hover scale and notification pulse should respect `prefers-reduced-motion`.

---

**Steve out.** 🏴‍☠️
