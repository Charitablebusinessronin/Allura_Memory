# Memory Explorer — Mobile & Dark Mode QA

> Generated: 2026-05-07T02:02 UTC
> Viewport: 375×812 (iPhone) / Desktop 1440×900 (dark mode)
> App: `localhost:3100`

---

## Mobile QA (375×812, iPhone viewport)

### 1. Result List Display
- **Status:** ⚠️ Graph does not collapse to list view on mobile
- 85 graph nodes rendered at 375×812 — the D3 force graph is visible but very dense
- No `.memory-explorer__list` or `.memory-explorer__results` container detected
- **Recommendation:** Implement a responsive breakpoint that switches from graph to list view below 768px (or provide a toggle)

### 2. Search Bar
- **Status:** ⚠️ Search bar width reported as 0px with `left: 0, rightPadding: 375`
- This suggests the search element exists in the DOM but has zero computed width or is hidden/conditionally rendered
- The input element found: `351×24px` — below 44px height tap target

### 3. Horizontal Scroll
- **Status:** ✅ No horizontal overflow
- `scrollWidth: 375px` = `clientWidth: 375px`
- `overflow-x: visible`

### 4. Tap Targets (≥44px)
- **Status:** ❌ 1 failure found
  - `<input>` at 351×24px — height (24px) below 44px minimum
  - This is the search input — needs `min-height: 44px` for iOS tap target compliance
- Only 2 interactive elements found (both inputs), suggesting buttons/nav links may be rendered as non-interactive elements or hidden on mobile

---

## Dark Mode Baseline

### Theme Detection
| Property | Value | Status |
|----------|-------|--------|
| `prefers-color-scheme: dark` | true | ✅ Detected |
| Body background | `rgb(255, 255, 255)` | ❌ Still white — dark mode CSS not applied |
| Body text color | `rgb(17, 24, 39)` | ❌ Dark text on white BG |

### Dark Mode Analysis
- Playwright correctly set `colorScheme: 'dark'` (confirmed by `matchMedia`)
- However, the page renders with **light theme** colors:
  - White body background
  - Dark gray text (`#111827`)
  - Search input: transparent background, dark text
  - All graph nodes visible but in light mode
- **Root cause:** The app likely doesn't respond to `prefers-color-scheme` media queries. It may use a manual toggle (localStorage, cookie, or user preference) rather than OS-level dark mode detection.

### Graph Nodes
- **Status:** ✅ 85 nodes visible

### Search Bar Theme
- Background: `rgba(0, 0, 0, 0)` (transparent)
- Text: `rgb(17, 24, 39)` (matches light theme)

---

## WCAG AA Contrast

### Light Mode Contrast (as rendered, since dark mode didn't activate)
- **Body text contrast ratio:** 17.74:1 ✅ (dark text on white — exceeds AAA 7:1)
- **Text elements checked:** 179
- **Contrast failures:** 21
- **Status:** ❌ 21 failures

### Failures Breakdown

**1. Navigation / Badge (3 failures)**
| Element | Ratio | Issue |
|---------|-------|-------|
| `<A>` "Memory ExplorerNew" | 3.11:1 | Orange `rgb(255, 90, 46)` bg with white text — insufficient contrast |
| `<SPAN>` "New" badge | 3.11:1 | Same orange bg — badge text too small (10px) |
| `<SPAN>` "Memory Explorer" | 1.00:1 | Transparent bg with white text on light body — invisible text |

**2. Graph node labels (15 failures)**
- Multiple `<DIV>` and `<SPAN>` elements with `1.02:1` ratio
- `rgb(15, 26, 46)` background with `rgb(17, 24, 39)` text — nearly identical dark blue colors
- Affected: node type labels (memory, insight, evidence, agent, project, system)
- Also: `ARCHITECTURE_DECISION` node text at 1.02:1
- **This is the biggest issue** — node labels are essentially illegible

**3. Zoom controls (3 failures)**
| Button | Ratio |
|--------|-------|
| `+` zoom-in | 2.61:1 |
| `−` zoom-out | 2.61:1 |
| `⟲` reset | 2.61:1 |
- `rgb(22, 32, 53)` background with `rgb(17, 24, 39)` text

---

## Overall QA Results

| Check | Status | Notes |
|-------|--------|-------|
| Mobile responsive list | ❌ | No list view on mobile; graph renders at 375px |
| No horizontal scroll | ✅ | Clean |
| Tap targets ≥44px | ❌ | Search input at 24px height |
| Dark mode applied | ❌ | `prefers-color-scheme: dark` detected but theme didn't change |
| WCAG AA contrast | ❌ | 21 failures — node labels near-invisible, orange nav badge insufficient |

---

## Priority Fixes

1. **🔴 Dark mode:** Wire up `prefers-color-scheme: dark` media query or implement a manual dark theme toggle that persists
2. **🔴 Node label contrast:** Graph node text (`rgb(17, 24, 39)`) is nearly indistinguishable from node backgrounds (`rgb(15, 26, 46)` / `rgb(22, 32, 53)`) — ratio ~1.02:1, needs ≥4.5:1
3. **🟡 Mobile layout:** Add responsive breakpoint to switch from force graph to searchable list below 768px
4. **🟡 Tap targets:** Search input needs `min-height: 44px` for iOS compliance
5. **🟡 Nav badge:** Orange `rgb(255, 90, 46)` + white text = 3.11:1 (needs ≥4.5:1 or larger font)
