# PRD: UX Audit Remediation — Allura Memory Dashboard
**Prepared by:** Gilliam (Architect)  
**Based on:** UX-TEST-REPORT.md by Steve (Team RAM QA)  
**Date:** 2026-04-26  
**Priority:** P0 — Blocks merge to main  
**Status:** 🔴 CRITICAL — Awaiting execution  

---

## 1. Executive Summary

Steve completed a full UX audit. Build passes, TypeScript is clean, Graph View matches spec. **But brand alignment score is 4/10.** The dashboard works but it's not maintainable — raw hex values everywhere, two competing color systems, and missing UI elements.

**85/112 checks passed. 5 critical issues, 9 warnings.**

This PRD breaks down exactly what needs fixing, who does what, and the order of operations.

---

## 2. Critical Issues (Must Fix Before Merge)

### CR-1: Raw Hex Epidemic → Tokenize Everything
**Severity:** 🔴  
**Assignee:** Team RAM  
**Files:** All 6 UI components + all 5 screen files (12 files total)  
**Issue:** Every component hardcodes hex values. `src/lib/tokens.ts` exists but is essentially unused. 80+ raw hex instances across the codebase.

**Acceptance Criteria:**
- [ ] Zero raw hex values in `src/components/ui/*.tsx`
- [ ] Zero raw hex values in `src/app/(main)/dashboard/**/*.tsx`
- [ ] All colors imported from `src/lib/tokens.ts` or referenced via Tailwind classes mapped to CSS variables
- [ ] `grep -rPn '#[0-9A-Fa-f]{3,6}\b' src/components/ui/ src/app/(main)/dashboard/` returns zero matches
- [ ] Tokens file exports `getGraphNodeColor()`, `getGraphNodeRadius()` — Graph page must use them instead of inline `NODE_COLORS` / `NODE_RADIUS`

**Implementation Approach:**
```typescript
// BEFORE (current):
className="bg-[#1D4ED8] text-[#FFFFFF] border-[#E5E7EB]"

// AFTER (target):
import { tokens } from '@/lib/tokens';
className={`bg-[${tokens.color.primary.default}] text-[${tokens.color.text.inverse}] border-[${tokens.color.border.subtle}]`}
// OR even better — use Tailwind classes mapped to CSS variables:
className="bg-primary text-inverse border-subtle"
```

### CR-2: Unify Competing Color Systems
**Severity:** 🔴  
**Assignee:** Team Durham (decision) → Team RAM (implementation)  
**Files:** `design/tokens.json`, `src/styles/brand-tokens.css`, `src/styles/allura.css`  
**Issue:** Two different orange accent colors:
- `design/tokens.json` → `#FF5A2E` (Orange)
- `src/styles/brand-tokens.css` → `#E85A3C` (Coral, labeled `--dashboard-accent`)
- `src/styles/allura.css` → `--allura-coral: #E85A3C`

Same product. Three different oranges. This is a maintenance disaster.

**Acceptance Criteria:**
- [ ] Team Durham picks ONE source of truth
- [ ] All other files updated to match
- [ ] Delete conflicting files or mark deprecated with comments
- [ ] Document the decision in `design/TOKEN-DECISIONS.md`

**Open Question for Team Durham:**
> Which is the correct Allura accent orange?
> - A) `#FF5A2E` (from `design/tokens.json` and PRD)
> - B) `#E85A3C` (from `brand-tokens.css` and `allura.css`)
> 
> Please confirm and we will converge everything to that value.

### CR-3: Insight Review Tab Color → Gold, Not Blue
**Severity:** 🔴  
**Assignee:** Team Durham (clarify) → Team RAM (fix)  
**File:** `src/app/(main)/dashboard/review/page.tsx:78–84`  
**Issue:** Active tab underline is `#1D4ED8` (blue). Spec says gold (`#C89B3C`).

**But there's a spec conflict:**
- `component-library.md` §7.1 says active indicator is `color.primary.default` (blue) for nav items
- `screen-frames.md` §4 says active tab underline is gold (`#C89B3C`)

**Open Question for Team Durham:**
> Active tabs: Blue or Gold?
> - Navigation active item → Blue (per component-library.md)?
> - Tab bar active indicator → Gold (per screen-frames.md)?
> - Or both Gold? Or both Blue?
>
> Please clarify so Team RAM can implement consistently.

### CR-4: Evidence Detail Missing Tabs & Actions
**Severity:** 🔴  
**Assignee:** Team RAM  
**File:** `src/app/(main)/dashboard/evidence/[id]/page.tsx`  
**Issue:** Spec requires 3 tabs (Raw Log, Metadata, Trace) + Copy/Export buttons. Current page has no tabs and no action buttons.

**Acceptance Criteria:**
- [ ] Tab navigation: Raw Log | Metadata | Trace
- [ ] Raw Log tab: monospace font (`IBM Plex Mono`), syntax highlight (if possible), line numbers
- [ ] Metadata tab: key-value table with copy-per-row
- [ ] Trace tab: timeline/tree view of trace events
- [ ] Copy button: copies current tab content to clipboard, shows "Copied!" toast
- [ ] Export button: downloads content as `.txt` or `.json`
- [ ] Back button returns to Memory Feed
- [ ] Breadcrumb: Dashboard > Memory Feed > Evidence Detail

### CR-5: Graph Toolbar Placeholder Buttons
**Severity:** 🔴  
**Assignee:** Team RAM  
**File:** `src/app/(main)/dashboard/graph/page.tsx:185–186`  
**Issue:** Zoom In/Out buttons have empty `onClick={() => {}}` handlers. "Fit View" just deselects but doesn't re-center.

**Acceptance Criteria:**
- [ ] Zoom In button zooms graph by 1.2x
- [ ] Zoom Out button zooms graph by 0.8x
- [ ] Fit View button re-centers and resets zoom to 1.0x
- [ ] Or remove buttons entirely if ForceGraph2D doesn't expose zoom API cleanly

---

## 3. Warnings (Should Fix)

### WR-1: Dropdown Missing Keyboard Navigation
**Severity:** 🟡  
**Assignee:** Team RAM  
**File:** `src/components/ui/dropdown.tsx`  
**Issue:** No arrow key, Enter, or Escape handlers. Basic a11y missing.

**Acceptance Criteria:**
- [ ] Arrow Up/Down navigates options
- [ ] Enter selects highlighted option
- [ ] Escape closes dropdown
- [ ] Tab shifts focus to next element after dropdown

### WR-2: Search Bar Tokenization
**Severity:** 🟡  
**Assignee:** Team RAM  
**File:** `src/components/ui/search-bar.tsx`  
**Issue:** 9 raw hex values (lines 52–80). Should use token imports.

### WR-3: Pagination Tokenization
**Severity:** 🟡  
**Assignee:** Team RAM  
**File:** `src/components/ui/pagination.tsx`  
**Issue:** 6 raw hex values. Should use token imports.

### WR-4: Avatar Missing Tooltip + Tokenization
**Severity:** 🟡  
**Assignee:** Team RAM  
**File:** `src/components/ui/avatar.tsx`  
**Issue:**
- Raw hex status colors (line 43, 73–76)
- Missing tooltip on group hover (spec §5.2)
- Fallback color always `#1D4ED8` instead of name-hash-based color

### WR-5: Notification Badge Tokenization + Animation
**Severity:** 🟡  
**Assignee:** Team RAM  
**File:** `src/components/ui/notification-badge.tsx`  
**Issue:**
- Raw hex `#FF5A2E` → should use `tokens.color.secondary.default`
- Pulse uses `animate-ping` (fade in/out) instead of scale pulse (`scale 1 → 1.2 → 1`)

### WR-6: Metric Card Tokenization
**Severity:** 🟡  
**Assignee:** Team RAM  
**File:** `src/components/dashboard/MetricCard.tsx`  
**Issue:** Uses `color-mix` with raw hex strings. Should use token-derived classes.

### WR-7: Overview Screen Tokenization
**Severity:** 🟡  
**Assignee:** Team RAM  
**File:** `src/app/(main)/dashboard/page.tsx`  
**Issue:** Multiple raw hex borders, text colors, shadow strings.

### WR-8: Memory Feed Tokenization
**Severity:** 🟡  
**Assignee:** Team RAM  
**File:** `src/app/(main)/dashboard/feed/page.tsx`  
**Issue:** Multiple raw hex values in filter bar and cards.

### WR-9: Font Applied via Inline Style
**Severity:** 🟡  
**Assignee:** Team RAM  
**File:** All 5 screen files  
**Issue:** `style={{ fontFamily: "var(--font-ibm-plex-sans)" }}` on every page. Should be a single class on the layout.

---

## 4. Team Durham Deliverables Needed

Before Team RAM can complete CR-2 and CR-3, Team Durham must resolve:

### DD-1: Color System Source of Truth
**Question:** Which orange accent is canonical?
- `#FF5A2E` (Orange, from tokens.json)
- `#E85A3C` (Coral, from brand-tokens.css)

**Deliverable:** A single `TOKEN-AUTHORITY.md` file that declares:
- Primary source of truth for all colors
- Which files are deprecated
- Migration path for conflicting values

### DD-2: Active Tab Indicator Color
**Question:** Should active tab underlines be Blue or Gold?
- Option A: All active indicators = Blue (`color.primary.default`)
- Option B: Nav items = Blue, Tabs = Gold
- Option C: All active indicators = Gold

**Deliverable:** Update `component-library.md` §7.1 and `screen-frames.md` §4 to be consistent. Mark the other as deprecated if they conflict.

### DD-3: Evidence Detail Tab Design
**Question:** Do you have Penpot frames for the Evidence Detail tabs (Raw Log / Metadata / Trace)?

**Deliverable:** If yes, export them. If no, provide written spec for:
- Tab switcher anatomy
- Raw Log block styling (monospace, line numbers, syntax highlight)
- Metadata table layout
- Trace timeline/tree view design
- Copy/Export button placement and styling

---

## 5. Execution Order

```
Phase 1: Team Durham Resolves Open Questions
├── DD-1: Pick canonical orange → TOKEN-AUTHORITY.md
├── DD-2: Pick tab indicator color → Update specs
└── DD-3: Evidence Detail tabs → Provide frames or written spec

Phase 2: Team RAM Implements Fixes (blocked until Phase 1 done)
├── CR-1: Tokenize everything (all components + screens)
├── CR-2: Apply canonical color from DD-1
├── CR-3: Apply correct tab color from DD-2
├── CR-4: Build Evidence Detail tabs per DD-3
├── CR-5: Graph toolbar real zoom or remove
└── WR-1 through WR-9: Fix warnings

Phase 3: Steve Re-Audits
├── Re-run UX-TEST-CHECKLIST.md
├── Brand alignment score target: ≥8/10
└── All critical issues resolved
```

---

## 6. Acceptance Criteria (Final)

- [ ] `bun run build` passes with zero errors
- [ ] `bun run typecheck` passes with zero errors
- [ ] `grep` for raw hex in dashboard + components returns zero matches
- [ ] Brand alignment score ≥8/10 on re-audit
- [ ] All 5 critical issues resolved
- [ ] Steve signs off on the report

---

## 7. Files

- **PRD:** `allura memory/UX-REMEDIATION-PRD.md` (this file)
- **Audit Report:** `allura memory/UX-TEST-REPORT.md`
- **Checklist:** `Brand maker/clients/allura memory/UX-TEST-CHECKLIST.md`
- **Design Specs:** `allura memory/design/` (tokens.json, component-library.md, screen-frames.md, graph-node-spec.md)
- **Implementation:** `allura memory/src/` (components/ui/, app/(main)/dashboard/)

---

**Navigation systems online. Steve found the icebergs. Now we chart the course around them.**
