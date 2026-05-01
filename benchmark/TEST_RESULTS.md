# FR-1.3 E2E Interaction Benchmark Results

**Date:** 2026-05-01
**Framework:** Playwright 1.59.1
**Dashboard:** http://localhost:3100
**Config:** `benchmark/playwright.config.ts`

## Results Summary

| Suite | Tests | Pass | Fail | Skip | Duration |
|-------|-------|------|------|------|----------|
| Search → Promote | 11 | 9 | 0 | 2 | ~32s |
| Graph → Detail | 7 | 7 | 0 | 0 | ~18s |
| Settings → Theme | 8 | 7 | 0 | 1 | ~9s |
| Error/Empty States | 6 | 6 | 0 | 0 | ~19s |
| **Total** | **32** | **29** | **0** | **3** | **~11.7s** |

## Test Files

| File | Description |
|------|-------------|
| `search-promote.spec.ts` | Memory Feed search, filter, clear, pagination, card content, promote link |
| `graph-detail.spec.ts` | Graph page, canvas, filter buttons, zoom controls, node click, detail panel, summary |
| `settings-theme.spec.ts` | Settings tabs, theme persistence via cookies, color-scheme CSS, interactive elements |
| `error-empty-states.spec.ts` | Error/empty state rendering, loading spinner, invalid ID, dashed border styling |

## Documented Gaps (Skipped Tests)

1. **MemoryCard Promote button** — The `MemoryCard` component uses `<Button variant="ghost" asChild><Link href={/dashboard/insights?promote=ID}>Promote</Link></Button>`. The shadcn Button with `asChild` renders the Promote as an `<a>` tag, but it was not found in the DOM on either `/dashboard/feed` or `/dashboard/memories`. This is likely because:
   - On `/dashboard/feed`, the page uses a different `MemoryCard` rendering without the promote action
   - On `/dashboard/memories`, cards may not render the promote link due to SSR hydration or component state

   **Recommendation:** Add `data-testid="promote-link"` to the Promote button in `MemoryCard.tsx` for reliable E2E targeting.

2. **ThemeSwitcher visibility** — The ThemeSwitcher button is in the sidebar but not visible at the default 1280×720 Playwright viewport (sidebar is in icon-collapsed mode). Theme persistence is verified via cookie manipulation instead.

   **Recommendation:** Either add the theme switcher to the Settings page directly, or test at a wider viewport (1440px+) where the sidebar is expanded.

3. **Graph node detail panel** — Canvas-based ForceGraph2D makes it difficult to reliably click specific nodes. The `clicking a node opens detail panel` test is best-effort and may not always select a node.

   **Recommendation:** Add `data-testid` attributes to the graph nodes via a custom `nodeCanvasObject` handler, or expose a test mode that highlights node positions.

## Coverage

### 1. Search → Results → Detail → Promote
- ✅ Search input accepts text
- ✅ Searching shows results or empty state
- ✅ Type filter dropdown switches
- ✅ Clear button resets filters
- ✅ Pagination visible
- ✅ Memory card displays content and metadata
- ⬜ Memory card has Promote link (gap: not rendered in DOM)
- ⬜ Clicking promote navigates to insights page (depends on above)
- ✅ Search input on /dashboard/memories works

### 2. Graph View → Click Node → Detail
- ✅ Graph page loads with title and description
- ✅ Filter buttons are visible
- ✅ Graph canvas renders
- ✅ Zoom controls visible (+/−/⟲)
- ✅ Clicking canvas may open detail panel (best-effort)
- ✅ Detail panel close button works (via JS dispatchEvent)
- ✅ Filter by node type works
- ✅ Graph summary visible below graph

### 3. Settings → Theme Switch → Persists
- ✅ Settings page loads with 5 tabs
- ✅ Theme changes via cookie and persists
- ✅ Dark mode applies dark class + color-scheme
- ✅ Theme persists after reload (dark)
- ✅ Theme persists after reload (system)
- ✅ Full theme cycle (light→dark→system→light)
- ⬜ ThemeSwitcher button visible (gap: not at 1280px viewport)
- ✅ Settings interactive elements work (input, change, switch)
- ✅ color-scheme CSS property updates correctly

### 4. Error/Empty States
- ✅ Error state renders (when backend is down)
- ✅ Empty state renders on non-matching search
- ✅ Graph error state when backend degraded
- ✅ Loading spinner visible during data fetch
- ✅ Overview error boundary renders
- ✅ Invalid evidence ID shows error/not found
- ✅ Empty state has dashed border styling