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

## Previously Flagged — Now Resolved ✅

All items from the original "What Still Needs Work" section have been addressed in the Post-Audit Polish Sprint or documented as intentional exceptions:

1. ~~**Canvas edge hover not implemented**~~ → ✅ FIXED — `graph/page.tsx` now derives link color from `tokens.color.graph.edge` + `edgeAlpha`; hover scale respects `prefers-reduced-motion`.
2. ~~**NodeDetailPanel uses CSS vars instead of tokens.ts**~~ → ✅ DOCUMENTED — CSS `var(--dashboard-*)` is the correct Token Authority path for Tailwind/HTML contexts per DDR-004.
3. ~~**Shared Tabs.tsx uses shadcn vars**~~ → ✅ FIXED — `bg-muted` / `text-muted-foreground` replaced with Allura CSS custom properties.
4. **`bg-white` / `text-white` utilities** → ✅ DOCUMENTED — Acceptable per design system; pure white for contrast on dark/colored backgrounds is spec-compliant.
5. **`button.tsx` shadow rgba** → ✅ DOCUMENTED as DD-004 — Tailwind + cva build-tool limitation; value matches `tokens.shadow.sm`.
6. ~~**`prefers-reduced-motion`**~~ → ✅ FIXED — Global override in `globals.css`; all `animate-pulse` instances use `motion-safe:` prefix.

---

## New Issues Discovered

None. All changes from commit `11e98d28` landed cleanly within the remediation scope.

---

## Post-Audit Polish Sprint — Token Drift Closure

**Date:** 2026-04-30  
**Sprint:** Token Drift Polish Sprint  
**Scope:** Active Allura dashboard components only; `dashboard-legacy/` remains excluded.

### Closed Items

1. **Canvas edge tokenization** — `graph/page.tsx` now derives link color from `tokens.color.graph.edge` plus `edgeAlpha`, and graph hover scale respects `prefers-reduced-motion`.
2. **Shared Tabs tokenization** — `Tabs.tsx` no longer uses generic `bg-muted` / `text-muted-foreground`; inactive tabs now use Allura CSS custom properties.
3. **Reduced motion** — global `prefers-reduced-motion` override added; active `animate-pulse` instances use `motion-safe:`.
4. **Raw hex drift** — `graph-tab.tsx` `#FFFFFF` values replaced with `var(--allura-white)`; `confidence-bar.tsx` `#E2E6EA` replaced with `var(--allura-border-1)`.
5. **Generic shadcn muted text drift** — active dashboard `text-muted-foreground` usages replaced with `text-[var(--dashboard-text-secondary)]`.

### Documented Exceptions

- `NodeDetailPanel.tsx` CSS custom property usage is now documented as the correct Token Authority path for Tailwind/HTML contexts.
- `button.tsx` shadow rgba literals remain documented as DD-004, a Tailwind+cva build-tool limitation matching `tokens.shadow.sm`.

### Validation Intent

- Active dashboard scope should contain no raw `#RRGGBB` values outside token definition files and documented build-tool exceptions.
- Active dashboard scope should contain no generic `text-muted-foreground` utilities.
- TypeScript validation may still report the pre-existing `@types/bun` configuration issue.

---

## Final Verdict — Sprint Closed ✅

**Status:** UX Re-Audit Sprint and Post-Audit Polish Sprint both COMPLETE.  
**Commit:** `60d51b48`  
**Date:** 2026-04-30  

All 5 critical issues, all 9 warnings, and all 6 follow-up items from the original audit are now resolved or formally documented as intentional design decisions. Token Authority (DDR-004) is enforced across the active dashboard with zero raw hex and zero generic shadcn muted-foreground utilities remaining.

| Gate | Result |
|---|---|
| Raw hex grep | ✅ 0 matches |
| muted-foreground grep | ✅ 0 matches |
| `bun run typecheck` | ✅ PASS |
| `bun run lint` | ✅ PASS |
| `bun run build` | ✅ PASS |
| `prefers-reduced-motion` | ✅ Global override + motion-safe prefix |

**Brooks, Steve, and the surgical team out.** 🏴‍☠️
