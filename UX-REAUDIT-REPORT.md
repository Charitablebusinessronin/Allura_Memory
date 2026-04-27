# UX Re-Audit Report — Allura Memory Dashboard

**Tester:** Steve (Team RAM)  
**Date:** 2026-04-26  
**Commit:** 11e98d28  

## Previous Score: 4/10
## Current Score: 9/10

---

## Build Status

| Metric | Value |
|---|---|
| `bun run build` | exit 0 ✅ |
| `bun run typecheck` | exit 0 ✅ |
| Raw hex grep (`src/components/ui/` + `src/app/(main)/dashboard/`) | **0 matches** ✅ |

Build produces the same 2 non-UX warnings as before (missing `@sentry/nextjs` dev dep, NFT trace bloat in `mcp/canonical-tools/connection.ts`). Neither affects brand alignment.

---

## Critical Issues — Status

### CR-1: Tokenize Everything
**Previous:** 80+ raw hex instances across 12 files  
**Current:** 0 raw hex instances in `src/components/ui/` and `src/app/(main)/dashboard/`  
**Status:** ✅ FIXED

Every component and screen file in scope now imports from `src/lib/tokens.ts`. No `#RRGGBB` literals remain in the audited directories. Remaining hex values are confined to:
- `src/styles/brand-tokens.css` and `src/styles/presets/allura.css` (token definition files)
- `src/styles/presets/durham.css` (separate theme preset, out of Allura scope)
- `src/app/(main)/dashboard-legacy/` (deprecated, not in scope)
- Canvas 2D `rgba(...)` strings in `graph/page.tsx` (runtime rendering, not CSS classes)

### CR-2: Unify Color Systems
**Previous:** `#FF5A2E` vs `#E85A3C` conflict between `tokens.json` and `brand-tokens.css`  
**Current:**
- `brand-tokens.css`: `--allura-coral: #FF5A2E`, `--dashboard-accent: var(--allura-coral)` ✅
- `presets/allura.css`: `--allura-coral: #FF5A2E`, `--accent: #FF5A2E`, `--destructive: #FF5A2E`, `--sidebar-accent: #FF5A2E` ✅
- `grep -rn '#E85A3C' src/components/ src/app/ src/lib/` → **0 matches** ✅
- `design/TOKEN-AUTHORITY.md` exists and documents DD-1 decision clearly ✅
**Status:** ✅ FIXED

### CR-3: Tab Colors
**Previous:** Active tab underline was blue (`#1D4ED8`)  
**Current:**
- `review/page.tsx` active underline: `bg-[${tokens.color.accent.gold}]` (Gold `#C89B3C`) ✅
- `evidence/[id]/page.tsx` active underline: `bg-[${tokens.color.accent.gold}]` (Gold `#C89B3C`) ✅
**Status:** ✅ FIXED

### CR-4: Evidence Detail Tabs
**Previous:** No tabs, no Copy/Export buttons  
**Current:**
- Evidence Detail has **Raw Log / Metadata / Trace** tabs ✅
- **Copy** (Ghost) and **Export** (Primary) buttons present in Raw Log tab ✅
- IBM Plex Mono used for raw log block ✅
- JSON syntax highlighting implemented ✅
- Per-row copy buttons in Metadata tab ✅
**Status:** ✅ FIXED

### CR-5: Graph Toolbar
**Previous:** Empty `onClick={() => {}}` handlers for zoom in/out  
**Current:**
- `zoomIn`: calls `graphRef.current.zoom(... * 1.2, 400)` ✅
- `zoomOut`: calls `graphRef.current.zoom(... * 0.8, 400)` ✅
- `fitView`: calls `graphRef.current.zoom(1.0, 400)` + `centerAt(0, 0, 400)` ✅
**Status:** ✅ FIXED

---

## Warnings — Status

### WR-1: Dropdown Keyboard Nav
**Status:** ✅ FIXED
- ArrowUp/ArrowDown cycle highlight ✅
- Enter selects highlighted option ✅
- Escape closes dropdown ✅
- Tab closes dropdown ✅
- `highlightedIndex` state tracks focus ✅

### WR-2: SearchBar Raw Hex
**Status:** ✅ FIXED
- All borders, text, shadows, and backgrounds now use `tokens.color.*` and `tokens.shadow.*` ✅

### WR-3: Avatar Raw Hex + Tooltip
**Status:** ✅ FIXED
- Status colors: `tokens.color.success.default`, `tokens.color.text.muted`, `tokens.color.accent.gold`, `tokens.color.secondary.default` ✅
- `AvatarGroup` now wraps in `TooltipProvider` + `Tooltip` showing all names on hover ✅
- `getNameColor` deterministically hashes names to a token color array ✅

### WR-4: Notification Badge Pulse
**Status:** ✅ FIXED
- Replaces `animate-ping` with `animate-pulse` ✅
- Color now uses `tokens.color.secondary.default` ✅

### WR-5: Overview Page Raw Hex
**Status:** ✅ FIXED
- `page.tsx` uses `tokens.color.border.subtle`, `tokens.color.text.primary`, `tokens.color.text.secondary`, `tokens.shadow.md`, `bg-white` (token-equivalent surface default) ✅

### WR-6: MetricCard color-mix
**Status:** ✅ FIXED
- `color-mix` strings now interpolate `tokens.color.primary.default`, `tokens.color.secondary.default`, `tokens.color.success.default`, `tokens.color.text.primary`, `tokens.color.accent.gold`, `tokens.color.secondary.hover` ✅

### WR-7: Graph Toolbar Empty Handlers
**Status:** ✅ FIXED (see CR-5)

### WR-8: Evidence Detail Tabs
**Status:** ✅ FIXED (see CR-4)

### WR-9: Font Inline Style
**Status:** ✅ FIXED
- Root `layout.tsx` applies `${fontVars}` to `<body>` via className ✅
- No per-page inline `style={{ fontFamily: "var(--font-ibm-plex-sans)" }}` pollution remains
- Evidence Detail uses `style={{ fontFamily: "'IBM Plex Mono', monospace" }}` specifically for the raw log `<pre>` block — this is spec-compliant, not a violation

---

## Brand Alignment Re-Check

| Token | Expected | Should Now Be | Match? |
|---|---|---|---|
| Primary | #1D4ED8 | `tokens.color.primary.default` | ✅ |
| Secondary | #FF5A2E | `tokens.color.secondary.default` | ✅ |
| Success | #157A4A | `tokens.color.success.default` | ✅ |
| Surface default | #FFFFFF | `tokens.color.surface.default` / `bg-white` | ✅ |
| Surface subtle | #F6F4EF | `tokens.color.surface.subtle` | ✅ |
| Text primary | #0F1115 | `tokens.color.text.primary` | ✅ |
| Text secondary | #6B7280 | `tokens.color.text.secondary` | ✅ |
| Accent gold | #C89B3C | `tokens.color.accent.gold` | ✅ |

**Alignment score: 8/8 tokens fully tokenized = 100%**

---

## What Was Fixed ✅

1. **Raw hex epidemic eliminated** — zero `#RRGGBB` literals in UI components and dashboard screens
2. **Color system unified** — `brand-tokens.css`, `allura.css`, and `tokens.ts` all converge on `#FF5A2E`
3. **Tab underlines gold** — both Review and Evidence Detail use `tokens.color.accent.gold`
4. **Evidence Detail completed** — tabs (Raw/Metadata/Trace), Copy/Export buttons, JSON syntax highlight, IBM Plex Mono
5. **Graph toolbar wired** — zoom in/out/fitView all functional via `ForceGraph2D` ref methods
6. **Dropdown a11y** — full keyboard navigation (arrows, Enter, Escape, Tab)
7. **Avatar tooltips** — group hover reveals full name list
8. **Notification badge** — scale pulse (`animate-pulse`) instead of ping
9. **MetricCard tones** — all `color-mix` values driven by token imports
10. **Root-level font** — `fontVars` applied once in root layout, no per-page inline styles
11. **TOKEN-AUTHORITY.md** — formal decision log exists documenting DD-1 (orange), DD-2 (gold tabs), DD-3 (evidence detail spec)

---

## What Still Needs Work ⚠️

1. **Canvas edge hover not implemented** (`graph/page.tsx:172`) — `linkColor` is hardcoded `rgba(156,163,175,0.6)` with no hover state. `tokens.ts` defines `edgeHover: "#1D4ED8"` but it isn't wired. Minor; canvas 2D requires explicit state handling.
2. **NodeDetailPanel uses CSS vars instead of tokens.ts** (`NodeDetailPanel.tsx`) — uses `var(--dashboard-surface)`, `var(--tone-blue-bg)`, etc. These map correctly to the brand system, but don't import from `tokens.ts`. Minor consistency gap.
3. **Shared `Tabs.tsx` component uses shadcn vars** (`src/components/dashboard/Tabs.tsx`) — `bg-muted`, `text-muted-foreground`, `var(--dashboard-accent-secondary)` instead of `tokens.color.*`. This affects the Insights Queue page. Not critical but should be aligned.
4. **`bg-white` / `text-white` utilities** — used for card backgrounds and text-on-color contrast. Functionally equivalent to `tokens.color.surface.default` / `tokens.color.text.inverse`, but not explicit token references. Acceptable per design system (pure white is allowed for contrast on dark/colored backgrounds).
5. **Shadow rgba strings in `button.tsx` cva** — `rgba(15,17,21,0.05)` is hardcoded in template literals because Tailwind + cva require literal strings at build time. The value matches `tokens.shadow.sm` exactly. This is a build-tool limitation, not a brand violation.
6. **`prefers-reduced-motion`** — still not implemented for graph hover scale or notification pulse. Was a recommendation in previous audit, remains unaddressed.

---

## New Issues Discovered

None. All changes from commit `11e98d28` landed cleanly within the remediation scope.

---

## Recommendation

**MERGE** ✅

The remediation successfully addresses all 5 critical issues and all 9 warnings from the previous audit. Build passes, TypeScript passes, zero raw hex in scope, color systems are unified, tabs are gold, evidence detail is complete, graph toolbar is functional, and keyboard navigation works. The remaining items are minor polish (canvas edge hover, shared Tabs component tokenization, reduced-motion) that can be addressed in follow-up PRs without blocking merge.

**Steve out.** 🏴‍☠️
