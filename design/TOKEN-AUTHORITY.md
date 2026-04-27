# Token Authority Document

**Authority:** Team Durham (Design Crew: Kotler, Aaker, Glaser)  
**Date:** 2026-04-26  
**Status:** ✅ Enforced — All implementation must converge to this document  
**Scope:** Allura Memory Dashboard color system and semantic tokens

---

## 1. Primary Source of Truth

The **canonical source of truth for all design tokens** is:

```
design/tokens.json
```

No other file may override a value in `tokens.json` without an explicit exception documented in Section 5 of this file.

---

## 2. Decision Log

### DD-1: Canonical Orange Accent Color

**Question:** Which is the correct Allura accent orange?  
**Options:**
- A) `#FF5A2E` (Orange, from tokens.json)
- B) `#E85A3C` (Coral, from brand-tokens.css / allura.css)

**Decision:** **A) `#FF5A2E`**

**Rationale:**
1. `tokens.json` is the semantic design token system — it is the single source of truth for all brand colors.
2. `#FF5A2E` is a brighter, more energetic orange that better serves the "Insight markers, highlights, secondary CTAs" use case.
3. `#E85A3C` is slightly desaturated toward coral-red; it is being retired as an accent.
4. Converging two implementation files to one design system file is lower-risk than the reverse.

**Files updated to match:**
- `src/styles/brand-tokens.css` — `--allura-coral` and `--dashboard-accent` updated to `#FF5A2E`
- `src/styles/presets/allura.css` — `--allura-coral` and all dependent accent tokens updated to `#FF5A2E`

---

### DD-2: Active Tab Indicator Color

**Question:** Should active tab underlines be Blue or Gold?  
**Options:**
- Option A: All active indicators = Blue (`color.primary.default`)
- Option B: Nav items = Blue, Tabs = Gold
- Option C: All active indicators = Gold

**Decision:** **Option B — Nav items = Blue, Tabs = Gold**

**Rationale:**
1. **Visual hierarchy:** Primary navigation (sidebar) uses the primary brand color (Blue `#1D4ED8`). Secondary/content navigation (tab bars) uses the accent gold (`#C89B3C`).
2. This creates clear differentiation between "where you are in the app" (sidebar) and "what you're viewing within a screen" (tabs).
3. Gold is already defined in the token system as `color.accent.gold` — it should be used for selection rings, project markers, and now tab indicators.
4. Both colors remain visible and accessible; no single component is overloaded.

**Application:**
- Sidebar nav active item → Blue left-border indicator (`color.primary.default`)
- Tab bar active tab → Gold bottom-border underline (`color.accent.gold`)
- Pagination active page → Blue (`color.primary.default`) — pagination is a control, not a tab

**Files updated:**
- `design/component-library.md` §7.1 — clarified as "nav items only"
- `design/screen-frames.md` §4 — updated tab bar spec to Gold

---

### DD-3: Evidence Detail Tab Design

**Question:** Do you have Penpot frames for Evidence Detail tabs?  
**Answer:** No Penpot frames exist for the Evidence Detail tab design. Written spec provided in `screen-frames.md` §5 (updated below).

**Key decisions:**
- **Tab switcher:** Horizontal pill-style tabs, Gold active underline
- **Raw Log:** IBM Plex Mono, line numbers, **YES** to basic JSON syntax highlight
- **Metadata:** Key-value table, copy-per-row button
- **Trace:** Vertical timeline (not tree), event colors mapped to token system
- **Actions:** Copy (Ghost) + Export (Primary) top-right of tab content area

See `design/screen-frames.md` §5 for full written specification.

---

## 3. Deprecated Tokens & Migration Path

### Deprecated

| Token / File | Old Value | New Value | Status |
|---|---|---|---|
| `--allura-coral` (brand-tokens.css) | `#E85A3C` | `#FF5A2E` | 🔄 Migrated |
| `--allura-coral` (allura.css preset) | `#E85A3C` | `#FF5A2E` | 🔄 Migrated |
| `--dashboard-accent` (brand-tokens.css) | `var(--allura-coral)` → `#E85A3C` | `#FF5A2E` | 🔄 Migrated |
| `--accent` (allura.css) | `#E85A3C` | `#FF5A2E` | 🔄 Migrated |
| `--destructive` (allura.css) | `#E85A3C` | `#FF5A2E` | 🔄 Migrated |
| `--sidebar-accent` (allura.css) | `#E85A3C` | `#FF5A2E` | 🔄 Migrated |
| `--chart-4` (allura.css) | `#E85A3C` | `#FF5A2E` | 🔄 Migrated |
| `--allura-coral-10` / `--allura-coral-20` | derived from `#E85A3C` | derived from `#FF5A2E` | 🔄 Migrated |

### Migration Instructions for Team RAM

1. Replace all raw `#E85A3C` instances with `tokens.color.secondary.default` (or equivalent CSS var)
2. Replace all raw `#FF5A2E` instances with `tokens.color.secondary.default`
3. Use `tokens.color.accent.gold` for all tab active indicators
4. Use `tokens.color.primary.default` for all sidebar nav active indicators
5. Run `grep -rPn '#E85A3C\b' src/` — should return zero matches before merge

---

## 4. Token-to-Implementation Mapping

| Design Token | Hex Value | Usage |
|---|---|---|
| `color.primary.default` | `#1D4ED8` | Sidebar active nav, primary buttons, links, pagination active |
| `color.primary.hover` | `#1E40AF` | Primary button hover, link hover |
| `color.secondary.default` | `#FF5A2E` | Insight badges, notification dots, accent highlights, secondary CTAs |
| `color.secondary.hover` | `#E04D1F` | Secondary button hover |
| `color.accent.gold` | `#C89B3C` | Tab active underline, project nodes, selection rings, premium markers |
| `color.accent.goldHover` | `#A87D2B` | Gold hover state |
| `color.success.default` | `#157A4A` | Approve buttons, positive toasts, high confidence |
| `color.surface.default` | `#FFFFFF` | Card backgrounds, panels, inputs |
| `color.surface.subtle` | `#F6F4EF` | Page background, subtle elevation |
| `color.text.primary` | `#0F1115` | Headings, primary content |
| `color.text.secondary` | `#6B7280` | Subheadings, secondary text |
| `color.border.subtle` | `#E5E7EB` | Dividers, card outlines |
| `color.border.default` | `#D1D5DB` | Inputs, table cells |

---

## 5. Exceptions

None at this time. All colors must flow from `tokens.json`.

---

**Signed:** Team Durham (Design Crew)  
**Date:** 2026-04-26
