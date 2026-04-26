# OpenCode Task: Allura Dashboard — Brand System + Global Components

## Current State
- Branch: `feature/real-data-dashboard-25`
- Project: `/home/ronin704/Projects/allura memory`
- Dashboard contracts exist and are wired to real Brain APIs (no mock data)
- Brand preset exists at `src/styles/presets/allura.css` (deep navy #1A2B4A, coral #E85A3C, trust green #4CAF50, clarity blue #5B8DB8)
- Components are monolithic in `src/components/dashboard/components.tsx` (~10KB, all hardcoded hex codes)
- IBM Plex Sans is NOT configured (spec requires it; currently Inter/Outfit)

## Goal
Apply the Allura brand system to the dashboard and build/refactor global components.

## Phase 1: Brand System — CRITICAL FIRST

### 1a. Install IBM Plex Sans
```
bun add @fontsource/ibm-plex-sans
```
Add import to `src/app/layout.tsx` or font registry. Make it available as `--font-ibm-plex-sans`.

### 1b. Create `src/styles/brand-tokens.css`
Import this in `src/app/globals.css` AFTER the presets.

Map these CSS custom properties for dashboard components to use:
```css
:root {
  /* Brand primitives */
  --allura-deep-navy: #1A2B4A;
  --allura-coral: #E85A3C;
  --allura-trust-green: #4CAF50;
  --allura-clarity-blue: #5B8DB8;
  --allura-pure-white: #F5F5F5;
  --allura-ink-black: #1A1A1A;
  --allura-warm-gray: #737373;

  /* Dashboard-specific aliases */
  --dashboard-text-primary: var(--allura-ink-black);
  --dashboard-text-secondary: var(--allura-warm-gray);
  --dashboard-surface: #FFFFFF;
  --dashboard-surface-alt: var(--allura-pure-white);
  --dashboard-border: color-mix(in srgb, var(--allura-deep-navy) 14%, white);
  --dashboard-accent: var(--allura-coral);
  --dashboard-accent-secondary: var(--allura-deep-navy);
  --dashboard-success: var(--allura-trust-green);
  --dashboard-info: var(--allura-clarity-blue);
  --dashboard-warning: var(--allura-coral);
  --dashboard-danger: #DC2626;

  /* Tone mappings (replace hardcoded hexes) */
  --tone-blue-bg: color-mix(in srgb, var(--allura-clarity-blue) 10%, white);
  --tone-blue-text: var(--allura-clarity-blue);
  --tone-orange-bg: color-mix(in srgb, var(--allura-coral) 10%, white);
  --tone-orange-text: var(--allura-coral);
  --tone-green-bg: color-mix(in srgb, var(--allura-trust-green) 10%, white);
  --tone-green-text: var(--allura-trust-green);
  --tone-charcoal-bg: color-mix(in srgb, var(--allura-ink-black) 10%, white);
  --tone-charcoal-text: var(--allura-ink-black);
  --tone-gold-bg: color-mix(in srgb, #C89B3C 10%, white);
  --tone-gold-text: #8a651d;
  --tone-red-bg: color-mix(in srgb, #DC2626 10%, white);
  --tone-red-text: #DC2626;
}

.dark {
  --dashboard-text-primary: var(--allura-pure-white);
  --dashboard-text-secondary: #A0A0A0;
  --dashboard-surface: #162035;
  --dashboard-surface-alt: #0F1A2E;
  --dashboard-border: rgb(245 245 245 / 0.10);
}
```

### 1c. Update `src/app/globals.css`
Add `@import "../styles/brand-tokens.css";` after the presets.

## Phase 2: Component Refactor

Split `src/components/dashboard/components.tsx` into:

```
src/components/dashboard/
  index.ts                    (re-export all)
  PageHeader.tsx              (existing, fix brand colors)
  LoadingState.tsx
  ErrorState.tsx
  EmptyState.tsx
  WarningList.tsx
  MetricCard.tsx              (use brand tokens, not hardcoded hexes)
  StatusPill.tsx              (use brand tokens)
  ConfidenceBadge.tsx         (NEW — shows percentage with color scale)
  ActivityPanel.tsx
  InsightCard.tsx
  InsightActions.tsx
  MemoryCard.tsx
  EvidenceCard.tsx
  SystemStatusCard.tsx
  GraphSummary.tsx
```

### Component Rules:
1. NO hardcoded hex colors. Use CSS custom properties from `brand-tokens.css`.
2. NO `#1D4ED8`, `#FF5A2E`, `#157A4A`, `#111827`, `#C89B3C`, `#F5F1E6` in dashboard components.
3. Replace all `text-[#111827]` with `text-[var(--dashboard-text-primary)]`
4. Replace all `bg-[#1D4ED8]/10` with `bg-[var(--tone-blue-bg)]`
5. Use `cn()` utility from `@/lib/utils` for conditional classes.
6. Keep existing component APIs unchanged (same props).

### NEW: ConfidenceBadge Component
```tsx
interface ConfidenceBadgeProps {
  value: number // 0-1
  size?: "sm" | "md" | "lg"
}
```
- ≥0.85: green (trust-green)
- 0.65–0.84: blue (clarity-blue)
- 0.45–0.64: orange (coral)
- <0.45: red
- Display as percentage with % suffix

### NEW: SearchInput Component
```tsx
interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}
```
Brand-aligned search input with coral focus ring.

### NEW: Tabs Component
Simple styled tabs for dashboard sub-navigation (All/Events/Outcomes/Insights, Queue/Approved/Rejected, etc.)

## Phase 3: Screen Polish (Overview + Memories)

### Overview (`src/app/(main)/dashboard/page.tsx`)
- Already uses real data via `loadDashboardOverview()`
- Polish: Use IBM Plex Sans, apply brand tokens to metric cards
- Keep existing data loading logic

### Memories (`src/app/(main)/dashboard/memories/page.tsx`)
- Already uses real data via `loadMemories()`
- Add tabs: All / Events / Outcomes / Insights
- Add agent filter, project filter, search
- Use refactored MemoryCard component

## Constraints
- EVERY memory read must include `group_id=allura-system` — ALREADY DONE in api.ts
- Graph endpoint is READ-ONLY — ALREADY DONE
- No mock data — ALREADY DONE (keep it that way)
- Empty/error/degraded states must be honest — ALREADY DONE

## Verification
After changes, run:
```bash
bun run typecheck
bun run build
```
Fix any type errors. Do NOT leave broken types.

## Files to Modify
- `src/app/layout.tsx` — add IBM Plex Sans font
- `src/app/globals.css` — import brand-tokens.css
- `src/components/dashboard/components.tsx` — DELETE after splitting
- Create `src/styles/brand-tokens.css`
- Create all component files in `src/components/dashboard/`
- Update `src/app/(main)/dashboard/page.tsx` — polish only
- Update `src/app/(main)/dashboard/memories/page.tsx` — add tabs/filters

## Output
When finished, provide a summary of:
1. What brand tokens were applied
2. What components were refactored/created
3. Any type errors fixed
4. Whether `bun run typecheck` and `bun run build` pass
