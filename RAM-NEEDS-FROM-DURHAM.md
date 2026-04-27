# Team RAM Needs from Team Durham

**Date:** 2026-04-26
**From:** Team RAM (Engineering Lead)
**Re:** UX Remediation PRD — Blockers & Self-Service Assessment

---

## Can Execute Without Durham (Self-Service)

These items have sufficient spec or are purely engineering tasks. RAM will proceed in parallel.

1. **CR-1: Tokenize Everything** — `tokens.ts` exists and `tokens.json` is comprehensive. RAM will replace all 80+ raw hex instances across 12 files with token imports / Tailwind classes mapped to CSS variables. The mechanical refactoring does not require design input.

2. **CR-5: Graph Toolbar Placeholder Buttons** — RAM will either wire ForceGraph2D zoom (1.2x / 0.8x / fit-to-view) or remove the buttons if the API is not clean. No design decision needed.

3. **CR-4: Evidence Detail Tabs & Actions** — `screen-frames.md` §5 contains a detailed written spec for Raw Log / Metadata / Trace tabs, monospace styling, key-value table layout, vertical timeline, and Copy/Export button placement. RAM can implement from this written spec. *(If Durham has Penpot frames, we can refine afterward; the written spec is actionable now.)*

4. **WR-1: Dropdown Keyboard Navigation** — Pure accessibility engineering. Arrow keys, Enter, Escape, Tab handling per standard a11y patterns.

5. **WR-2–WR-8: All Tokenization Warnings** — Mechanical replacements:
   - WR-2 SearchBar tokenization
   - WR-3 Pagination tokenization
   - WR-4 Avatar tokenization + tooltip on group hover
   - WR-5 NotificationBadge tokenization + scale-pulse animation fix
   - WR-6 MetricCard `color-mix` → token-derived classes
   - WR-7 Overview screen tokenization
   - WR-8 Memory Feed tokenization

6. **WR-9: Font Applied via Inline Style** — Move `style={{ fontFamily: "var(--font-ibm-plex-sans)" }}` from every page to a single `font-sans` class on the dashboard layout. Engineering-only.

7. **CR-4 (continued): Back button, breadcrumb, empty states** — These are behavioral/logic additions with clear placement in the written spec.

---

## Blocked — Needs Design Decision

### Blocker 1: Canonical Orange Accent Color
**Question:** Which orange accent is canonical? `#FF5A2E` (from `design/tokens.json`) or `#E85A3C` (from `src/styles/brand-tokens.css` / `src/styles/allura.css`)?

**Why blocked:** Two source files define different hex values for the same semantic "accent orange." If RAM converges everything to `#FF5A2E` and Durham intended `#E85A3C`, every button, notification badge, insight marker, and graph node needs to be re-done. If RAM picks `#E85A3C`, we violate `tokens.json` which is explicitly referenced as the token authority in `component-library.md` and `screen-frames.md`.

**Recommended answer:** `#FF5A2E` from `design/tokens.json` should be canonical. Rationale:
- `tokens.json` is the newer, comprehensive semantic token system
- Both `component-library.md` and `screen-frames.md` reference `tokens.json` as the source of truth
- `brand-tokens.css` uses an older `--dashboard-*` naming convention and is likely legacy
- The current code already uses `#FF5A2E` in most places (notification badge, insight markers, graph nodes)

**Deliverable needed:** Durham declares one source of truth and marks the other file deprecated in a `TOKEN-AUTHORITY.md`.

**Urgency:** P0 — Blocks CR-2 and all tokenization of secondary colors.

---

### Blocker 2: Active Tab Indicator Color
**Question:** Should active tab underlines be Blue or Gold?
- Option A: All active indicators = Blue (`color.primary.default`)
- Option B: Nav items = Blue, Tab bars = Gold
- Option C: All active indicators = Gold

**Why blocked:** There is a perceived spec conflict in the PRD. `component-library.md` §7.1 says sidebar nav active indicator is `color.primary.default` (blue). The PRD claims `screen-frames.md` §4 says gold (`#C89B3C`) for active tab underlines — but on careful re-reading of `screen-frames.md`, §4 (Insight Review tabs) and §5 (Evidence Detail tabs) both specify `color.primary.default` (blue) for active tabs, not gold. The gold color (`#C89B3C`) is used in `screen-frames.md` for graph node selection rings and project markers, not tabs.

However, the PRD explicitly flags this as an open question and Steve's audit calls out the current blue tab underline as a brand misalignment ("Spec says gold"). Without Durham confirming the intended tab color, RAM risks implementing blue tabs only to be told they should be gold.

**Recommended answer:** Option A — All active indicators should be Blue (`color.primary.default`). Rationale:
- Both `component-library.md` §7.1 and `screen-frames.md` §4/§5 currently specify `color.primary.default` for active states
- Gold (`#C89B3C`) is already assigned to graph node selection rings and project markers; using it for tabs would dilute its semantic meaning as an "accent/selection" color
- Blue active indicators create visual consistency between navigation and tabs
- If Durham wants gold tabs, `screen-frames.md` needs to be updated to use `color.accent.gold`

**Deliverable needed:** Durham confirms the intended color and updates whichever spec is wrong so they are consistent.

**Urgency:** P0 — Blocks CR-3 (Insight Review tab fix).

---

## Nice-to-Have (Not Blocking)

1. **Penpot frames for Evidence Detail** — `screen-frames.md` §5 already provides a detailed written spec that RAM can implement from. If Durham has Penpot frames, exporting them would help us verify exact pixel spacing and responsiveness, but they are not required to start.

2. **`TOKEN-AUTHORITY.md` documentation** — A short doc declaring the canonical token source would be helpful for future maintenance, but RAM can proceed once Durham simply answers DD-1 verbally.

3. **`prefers-reduced-motion` support** — Graph hover scale and notification pulse animations should respect user preferences. This is an accessibility nice-to-have, not merge-blocking.

4. **Avatar fallback color hash spec** — `component-library.md` §5.1 says "colored background + initials based on name hash." RAM can implement a reasonable deterministic hash algorithm, but a specific spec from Durham would be ideal.

5. **Edge hover color clarification** — Graph edges currently use `rgba(156,163,175,0.6)`. `tokens.json` defines `graph.edgeHover` as `color.primary.default` (#1D4ED8). RAM will implement per tokens.json unless Durham objects.

---

## Summary

| Item | Status | Blocker |
|---|---|---|
| CR-1 Tokenize everything | ✅ Can execute | None |
| CR-2 Unify orange | ⛔ Blocked | **DD-1** |
| CR-3 Tab indicator color | ⛔ Blocked | **DD-2** |
| CR-4 Evidence Detail tabs | ✅ Can execute | `screen-frames.md` §5 is sufficient |
| CR-5 Graph toolbar | ✅ Can execute | None |
| WR-1–WR-9 All warnings | ✅ Can execute | None |

**Critical path:** Durham answers DD-1 and DD-2 → RAM converges colors and tabs → Steve re-audits → Merge.
