# Goal: Allura Memory Dashboard v2.0 Design System

## Goal

Implement the complete allura Memory Dashboard v2.0 design system as specified by the brand design prompt — from token integration through all 7 phases — delivering a brand-compliant, WCAG AA, mobile-first consumer experience.

## Outcome

A fully redesigned `/memory` consumer route with the allura brand identity: deep navy navbar, card-based memory list with status badges and confidence bars, right-side provenance drawer, two-column curator queue, and a React Flow knowledge graph tab. The allura theme is available as an additive preset alongside existing themes. All copy matches the brand voice. All components are reusable primitives in `src/components/allura/`. Zero typecheck errors. Zero test regressions.

## Requirements

### R1: Design Token Integration (Phase 1)
- Create `src/styles/presets/allura.css` with all brand primitive CSS custom properties (`--allura-deep-navy` #1A2B4A, `--allura-coral` #E85A3C, `--allura-trust-green` #4CAF50, `--allura-clarity-blue` #5B8DB8, `--allura-pure-white` #F5F5F5, `--allura-ink-black` #1A1A1A, `--allura-warm-gray` #737373) and map them to shadcn/ui variables under `[data-theme-preset="allura"]`
- Add semantic tokens: `--allura-page-bg`, `--allura-card-bg`, `--allura-primary`, `--allura-accent`, `--allura-text-primary`, `--allura-text-muted`, `--allura-border`
- Add status tokens: `--allura-status-active`, `--allura-status-proposed`, `--allura-status-forgotten`, `--allura-status-warning`
- Add shadow tokens: `--allura-shadow-card`, `--allura-shadow-hover`, `--allura-shadow-modal`
- Set radius: card 16px, badge 6px, button 8px, input 10px
- Add `.font-display` utility class using `var(--font-outfit)` (Outfit 700 for hero/section headings)
- Import preset in `src/app/globals.css`
- Add "allura" to theme switcher in `src/app/(main)/dashboard/_components/sidebar/theme-switcher.tsx`
- WCAG constraint enforced: coral (#E85A3C) NEVER on pure_white (#F5F5F5) — 1.3:1 ratio fail

### R2: Shared Brand Components (Phase 2)
- **StatusBadge** (`src/components/allura/status-badge.tsx`): 4 variants — active (#4CAF50 bg), proposed (#5B8DB8 bg), forgotten (#9B9B9B bg), low_confidence (#E85A3C bg). White text, 6px radius, Inter 600/12px uppercase labels
- **ConfidenceBar** (`src/components/allura/confidence-bar.tsx`): value 0–100, width 120px, deep_navy fill, #E2E6EA track, 4px radius
- **TraceCard** (`src/components/allura/trace-card.tsx`): bg #F5F5F5, 8px radius, tool call name + input snippet + timestamp (Inter 400/12px warm_gray). Reused in ProvenanceDrawer and CuratorQueue
- **EmptyState** (`src/components/allura/empty-state.tsx`): text + optional CTA. No error icons. Warm_gray centered text
- **PanelDrawer** (`src/components/allura/panel-drawer.tsx`): 420px desktop / 100% mobile, right-sliding, radius 16px 0 0 16px, modal shadow. Lazy-loads on open. Focus trap + Escape to close. Sections: Origin (coral overline, agent name, trace count), Evidence (coral overline, TraceCard list), Actions (Promote/Edit/Deprecate). Loading: "Finding source traces…" pulse animation. Empty: "Source not available"
- **MemoryCard** (`src/components/allura/memory-card.tsx`): Composes StatusBadge + ConfidenceBar. bg #FFFFFF, 16px radius, card shadow → hover shadow. Memory text Inter 400/16px/#1A1A1A max 3 lines. Caption Inter 500/12px/#737373. Actions: "View Source" deep_navy link left, "Forget" coral ghost right. Mobile: swipe-left reveals coral Forget button

### R3: Memory List Page (Phase 3)
- Create `src/app/memory/layout.tsx` — branded navbar: deep_navy (#1A2B4A) bg, allura wordmark (Wordmark.png) left, user avatar right, "+ Add Memory" coral CTA button (Inter 600, 8px radius). No sidebar. Full-width. Mobile-first. Page bg #F5F5F5
- Redesign `src/app/memory/page.tsx`:
  - Hero: "What does your system know?" Inter 700/40px/#1A1A1A
  - Search: full width, "Search what your system remembers…", 10px radius, #E2E6EA border, #9B9B9B placeholder, Inter 400/16px
  - Tabs: "Memories" / "Recently Forgotten" / "Graph" — active: deep_navy underline 2px
  - Memory cards from R2 MemoryCard component
  - Empty state: "Nothing saved yet. Add the first memory." with coral CTA
  - Search empty: "No memories match '[query]'. Save it manually?" deep_navy link
  - Wire up existing `useMemoryList` hook

### R4: Provenance Drawer (Phase 4)
- "View Source" on MemoryCard opens PanelDrawer (R2)
- Origin section: coral uppercase overline, agent name + trace count (Inter 500/14px)
- Evidence section: coral uppercase overline, TraceCard list (reuse R2 TraceCard)
- Actions: Promote (deep_navy filled), Edit (deep_navy outlined), Deprecate (ghost)
- Loading: pulse animation + "Finding source traces…"
- Empty: "Source not available" warm_gray, no error icon

### R5: Curator Queue Redesign (Phase 5)
- Restructure `src/app/(main)/dashboard/curator/page.tsx` to two-column layout
- Left panel: 300px fixed, compact cards (summary 2 lines, confidence %, trace count, StatusBadge)
- Right panel: flex-1, expanded detail (summary Inter 400/16px, confidence bar, evidence TraceCards, actions row)
- Actions: Approve ✓ (deep_navy filled), Edit ✎ (outlined charcoal), Reject ✕ (ghost, coral on hover)
- Empty state: "All caught up. No insights waiting for review." (reuse EmptyState)
- Reuse existing curator API endpoints

### R6: Graph Tab (Phase 6)
- Install `@xyflow/react` via `bun add @xyflow/react`
- Create `src/components/allura/graph-tab.tsx` with React Flow force-directed layout
- Node types: people (#F5F5F5/#1A2B4A), topics (#FFFFFF/#4CAF50), decisions (#FFFFFF/#1A1A1A), traces (#F8F8F8/#9B9B9B)
- Edge types: derived_from (deep_navy dashed), approved_by (trust_green solid), supersedes (ink_black arrowhead)
- 100 node cap; neighborhood mode at 80+ nodes with toggle button
- Search overlay top-left, zoom controls bottom-right
- Node click → opens PanelDrawer (reuse R2)
- Overflow toast: "Showing neighborhood only. Zoom out to see more."
- Add "Graph" as third tab in `/memory` page

### R7: Polish & QA (Phase 7)
- Zero coral-on-white WCAG AA violations
- All copy matches brand voice (see copy rules below)
- No error icons on empty states
- Keyboard navigation + focus rings on all interactive elements
- `bun run typecheck` passes with 0 errors
- `bun test` passes with 0 failures
- Existing themes (durham, brutalist, soft-pop, tangerine) unaffected

## Success Criteria

1. ✅ Allura theme is selectable in theme switcher and applies correct brand tokens
2. ✅ `/memory` route renders brand-compliant UI — deep navy navbar, hero, search, tabbed cards, no sidebar
3. ✅ MemoryCard shows StatusBadge + ConfidenceBar + "View Source" + "Forget" actions
4. ✅ PanelDrawer slides from right on "View Source" click with Origin/Evidence/Actions sections
5. ✅ Curator queue is two-column: 300px left list + flex-1 right detail
6. ✅ Graph tab renders React Flow with correct node/edge styling, 100-node cap, neighborhood mode
7. ✅ All copy matches design prompt (no admin jargon like "Query the index" or "Null")
8. ✅ Zero WCAG AA failures (especially no coral-on-white)
9. ✅ `bun run typecheck` — 0 errors
10. ✅ `bun test` — 0 failures
11. ✅ Existing themes and pages unaffected by allura preset addition

## Definition of Done

- [x] `src/styles/presets/allura.css` created and imported in globals.css
- [x] Theme switcher includes "allura" option
- [x] All 6 brand components exist in `src/components/allura/` with correct props and styling
- [x] `src/app/memory/layout.tsx` created with branded navbar (deep_navy, no sidebar)
- [x] `src/app/memory/page.tsx` rewritten with hero, search, tabs, MemoryCard grid
- [x] PanelDrawer opens on "View Source" with provenance sections
- [x] Curator page restructured to two-column layout
- [x] `@xyflow/react` installed, GraphTab renders with node types and edge types
- [x] Graph tab added as third tab in Memory page
- [x] Copy audit: zero forbidden phrases in any user-facing string
- [x] WCAG audit: zero AA contrast failures
- [x] `bun run typecheck` — exit code 0
- [x] `bun test` — exit code 0, zero failures
- [x] No regressions in existing theme presets

## Copy Rules — DO

- "What does your system know?"
- "Search what your system remembers…"
- "View Source"
- "Forget"
- "Nothing saved yet."
- "No memories match '[query]'. Save it manually?"
- "Source not available"
- "Moved to Recently Forgotten. You have 30 days to restore it."
- "All caught up. No insights waiting for review."
- "Showing neighborhood only. Zoom out to see more."

## Copy Rules — DON'T

- ❌ "Query the index"
- ❌ "Inspect provenance"
- ❌ "Record deleted"
- ❌ "Null"
- ❌ "Model score"
- ❌ "Zero results"
- ❌ "Node limit exceeded"

## Design Spec References

| Resource | Path |
|----------|------|
| Brand truth (canonical) | `docs/branding/deliverables/06_allura-memory_brand-truth.json` |
| Design tokens (Tailwind) | `docs/branding/deliverables/design-tokens/tailwind.config.js` |
| Component specs | `docs/branding/deliverables/design-system/component-specs.md` |
| Developer handoff | `docs/branding/deliverables/design-system/developer-handoff.md` |
| Logo (wordmark) | `docs/branding/assets/logos/allura-logo/Wordmark.png` |

## Architecture Constraints

1. **Tailwind v4** — theme config in `globals.css` via `@theme inline`, NO `tailwind.config.ts`
2. **shadcn/ui** — components in `src/components/ui/`, theming via CSS custom properties
3. **Inter + Outfit** — already loaded via `next/font/google` in `src/lib/fonts/registry.ts`
4. **allura preset is ADDITIVE** — never modify existing theme presets
5. **bun only** — never npm/npx
6. **Postgres append-only** — never UPDATE/DELETE on events table
7. **group_id required** on every DB operation — pattern `allura-*`
8. **"allura" always lowercase** in copy — never "Allura" or "ALLURA"
9. **No spinner icons** — use pulse animations
10. **No error icons** on empty states
11. **No all-caps in body copy** — labels and overlines only
12. **Max 75 characters per line** for body text
13. **PanelDrawer is NOT a Vaul drawer** — it's a right-side panel component

## File Map

| File | Action |
|------|--------|
| `src/styles/presets/allura.css` | CREATE |
| `src/app/globals.css` | MODIFY (add import + font-display utility) |
| `src/app/(main)/dashboard/_components/sidebar/theme-switcher.tsx` | MODIFY (add allura) |
| `src/components/allura/status-badge.tsx` | CREATE |
| `src/components/allura/confidence-bar.tsx` | CREATE |
| `src/components/allura/trace-card.tsx` | CREATE |
| `src/components/allura/empty-state.tsx` | CREATE |
| `src/components/allura/panel-drawer.tsx` | CREATE |
| `src/components/allura/memory-card.tsx` | CREATE |
| `src/app/memory/layout.tsx` | CREATE |
| `src/app/memory/page.tsx` | REWRITE |
| `src/app/(main)/dashboard/curator/page.tsx` | REWRITE |
| `src/components/allura/graph-tab.tsx` | CREATE |

## New Dependency

```bash
bun add @xyflow/react   # Phase 6 only
```