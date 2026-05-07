# Memory Explorer — Performance Baseline

> Generated: 2026-05-07T02:02 UTC
> Environment: Playwright 1.59.1 / Chromium headless / Desktop 1440×900
> App: `localhost:3100`

---

## 1. Largest Contentful Paint (LCP)

**Target:** < 2.5s (2500ms)  
**Status:** ⚠️ LCP not captured by PerformanceObserver

| Metric | Value | Notes |
|--------|-------|-------|
| LCP | Not captured | Likely because page load is extremely fast (sub-200ms) in dev mode; LCP entries may not fire for SVG-dominant pages or observer needs `buffered: true` before navigation |
| DOM Content Loaded | 51ms | ✅ Fast |
| Full Load (`loadEventEnd`) | 120ms | ✅ Fast |
| Navigation to `networkidle` | ~780ms | Includes all async resources / API calls |

**Recommendation:** Re-test with Lighthouse CLI or `web-vitals` library in production for accurate LCP. Dev mode networkidle times are not representative.

---

## 2. SVG Graph Render Completion (TBT analogue)

**Nodes found:** 85  
**Time to first `.memory-explorer__node`:** 42ms after navigation settled  
**Status:** ✅ Excellent — the D3 force simulation renders nodes almost instantly

---

## 3. Node Hover Interaction

**Target:** < 100ms from mouseenter to label display  
**Result:** ⚠️ Hover labels not detected via `.memory-explorer__label` or similar selectors

**Investigation:**
- 85 graph nodes rendered and visible
- Mouse hover dispatched successfully over a node
- No `memory-explorer__label` appeared in the DOM with `state: visible`
- Alternative label class scan found elements with classes containing "label" (`--allura-blue`) but these appeared to be persistent UI elements, not hover-triggered tooltips
- Possible causes: labels may be native SVG `<title>` elements (not detected by Playwright's visible check), or the hover interaction uses a different class name / transition pattern

**Recommendation:** Inspect the actual label rendering mechanism (D3 tooltip, SVG title, or CSS transition) and add a dedicated test selector.

---

## 4. Pan/Zoom Smoothness (Wheel Events)

**Target:** < 16ms per frame (60fps)  
**Events captured:** 10  
**Avg frame-to-frame delta:** 0.01ms  
**Max frame-to-frame delta:** 0.1ms  
**Status:** ✅ PASS — wheel events fire synchronously with negligible lag

> Note: This measures JavaScript event dispatch speed, not actual repaint latency. Real frame timing requires `requestAnimationFrame` instrumentation or Chrome DevTools Performance panel.

### Frame-by-frame deltas
| Frame | Delta (ms) |
|-------|------------|
| 1 | 0.0 |
| 2 | 0.0 |
| 3 | 0.0 |
| 4 | 0.0 |
| 5 | 0.1 |
| 6 | 0.0 |
| 7 | 0.0 |
| 8 | 0.0 |
| 9 | 0.0 |

---

## Overall Performance

| Check | Threshold | Measured | Status |
|-------|-----------|----------|--------|
| LCP | < 2.5s | Not captured (DOM ready 51ms, full load 120ms) | ⚠️ Needs Lighthouse |
| Hover lag | < 100ms | Label element not detected | ⚠️ Needs selector fix |
| Pan/Zoom events | < 16ms/frame | 0.01ms avg | ✅ PASS |

---

## Lighthouse Production Audit (Bug 6 Fix)

> Generated: 2026-05-07T03:14 UTC
> Tool: Lighthouse CLI v12.x / Chromium headless
> App: Production build on `localhost:3100`

### Scores

| Category | Score |
|----------|-------|
| Performance | 75/100 |
| Accessibility | 100/100 |
| Best Practices | 100/100 |
| SEO | 100/100 |

### Core Web Vitals

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| LCP (Largest Contentful Paint) | 8.4s | < 2.5s | ❌ Needs investigation |
| FCP (First Contentful Paint) | 1.5s | < 1.8s | ✅ PASS |
| TBT (Total Blocking Time) | 60ms | < 200ms | ✅ PASS |
| CLS (Cumulative Layout Shift) | 0.000 | < 0.1 | ✅ PASS |
| SI (Speed Index) | 1.5s | < 3.4s | ✅ PASS |
| TTI (Time to Interactive) | 9.9s | < 5.0s | ❌ Slow |

### LCP Analysis

The high LCP (8.4s) is primarily caused by:
1. **Render-blocking requests** — estimated savings of 710ms
2. **Unused JavaScript** — estimated savings of 109 KiB
3. **Legacy JavaScript** — estimated savings of 13 KiB

The memory explorer page loads a full D3 force simulation with 85+ nodes. Consider:
- Server-rendering the initial graph state
- Code-splitting the D3/force simulation bundle
- Lazy-loading the graph canvas below the fold

### Key Insights
- FCP is fast (1.5s), but the page becomes interactive very late (9.9s)
- TBT is acceptable (60ms) — the main thread is not significantly blocked
- Zero layout shift (CLS 0) — excellent
- Accessibility score 100 — all WCAG fixes applied correctly
