# Dashboard Token Mapping

**Story:** 2.3  
**Status:** Completed  
**Last Updated:** 2026-05-06  
**Owner:** Woz (Builder)

---

## Overview

This document maps all `--dashboard-*` semantic tokens to their canonical `--allura-*` CSS primitive sources.

**Design Decisions:**
- `brand-tokens.css` is the **source of truth** for canonical Allura design tokens
- `presets/allura.css` is a **preset compatibility layer** that syncs to brand-tokens.css
- All dashboard tokens resolve to Allura primitives; orphans are documented with justification

---

## Light Mode Token Mapping

| Token | Value | Maps To | Status |
|-------|-------|---------|--------|
| `--dashboard-text-primary` | `#111827` | `--allura-charcoal` | ✅ Mapped |
| `--dashboard-text-secondary` | `#6B7280` | `--allura-gray-500` | ✅ Mapped |
| `--dashboard-text-muted` | `#9CA3AF` | `--allura-gray-400` | ✅ Mapped |
| `--dashboard-surface` | `#FFFFFF` | `--allura-white` | ✅ Mapped |
| `--dashboard-surface-alt` | `#F5F1E6` | `--allura-cream` | ✅ Mapped |
| `--dashboard-surface-muted` | `#F3F4F6` | `--allura-gray-100` | ✅ Mapped |
| `--dashboard-border` | `#E5E7EB` | `--allura-gray-200` | ✅ Mapped |
| `--dashboard-border-default` | `#D1D5DB` | `--allura-gray-300` | ✅ Mapped |
| `--dashboard-accent` | `#FF5A2E` | `--allura-orange` | ✅ Mapped |
| `--dashboard-accent-secondary` | `#1D4ED8` | `--allura-blue` | ✅ Mapped |
| `--dashboard-success` | `#157A44` | `--allura-green` | ✅ Mapped |
| `--dashboard-info` | `#1D4ED8` | `--allura-blue` | ✅ Mapped |
| `--dashboard-warning` | `#FF5A2E` | `--allura-orange` | ✅ Mapped |
| `--dashboard-danger` | `#DC2626` | *No exact Allura primitive* | ⚠️ **Orphan** |
| `--dashboard-evidence` | `#F5F1E6` | `--allura-cream` | ✅ Mapped |

---

## Dark Mode Token Mapping

| Token | Value | Maps To | Status |
|-------|-------|---------|--------|
| `--dashboard-text-primary` | `#F3F4F6` | `--allura-charcoal` | ✅ Mapped |
| `--dashboard-text-secondary` | `#A0A0A0` | *No exact Allura primitive* | ⚠️ **Orphan** |
| `--dashboard-text-muted` | `#737373` | *No exact Allura primitive* | ⚠️ **Orphan** |
| `--dashboard-surface` | `#162035` | *No exact Allura primitive* | ⚠️ **Orphan** |
| `--dashboard-surface-alt` | `#0F1A2E` | *No exact Allura primitive* | ⚠️ **Orphan** |
| `--dashboard-surface-muted` | `#1E2D47` | *No exact Allura primitive* | ⚠️ **Orphan** |
| `--dashboard-border` | `rgb(255 255 255 / 0.08)` | *No exact Allura primitive* | ⚠️ **Orphan** |
| `--dashboard-border-default` | `rgb(255 255 255 / 0.12)` | *No exact Allura primitive* | ⚠️ **Orphan** |
| `--dashboard-evidence` | `#0F172A` | `--allura-cream` (dark mode inverted) | ✅ Mapped |

---

## Unmapped Orphans (Justification)

### Light Mode
| Token | Value | Rationale |
|-------|-------|-----------|
| `--dashboard-danger` | `#DC2626` | Allura has `--allura-orange` (#FF5A2E) but no dedicated red danger token. This is intentionally a distinct value for error states. Consider creating `--allura-red` or `--allura-danger` in a future expansion. |

### Dark Mode
| Token | Value | Rationale |
|-------|-------|-----------|
| `--dashboard-text-secondary` | `#A0A0A0` | No exact dark-mode gray-500 equivalent in canonical Allura primitives. |
| `--dashboard-text-muted` | `#737373` | No exact dark-mode gray-400 equivalent in canonical Allura primitives. |
| `--dashboard-surface` | `#162035` | Dark mode surface is a dark-blue custom value (brand-specific) with no Allura primitive equivalent. |
| `--dashboard-surface-alt` | `#0F1A2E` | Dark mode alt surface is brand-specific; no Allura primitive equivalent. |
| `--dashboard-surface-muted` | `#1E2D47` | Dark mode muted surface is brand-specific; no Allura primitive equivalent. |
| `--dashboard-border` | `rgb(255 255 255 / 0.08)` | Dark mode borders use alpha-based white values, not Allura primitives. |
| `--dashboard-border-default` | `rgb(255 255 255 / 0.12)` | Dark mode default border uses alpha-based white values, not Allura primitives. |

---

## Resolved Conflict Decisions

### Conflicts Identified
The following tokens had different implementations between `brand-tokens.css` and `presets/allura.css`:
- `--dashboard-text-muted` (direct `#9CA3AF` vs `var(--allura-text-3)`)
- `--dashboard-border` (direct `#E5E7EB` vs `var(--allura-border-1)`)
- `--dashboard-border-default` (direct `#D1D5DB` vs `var(--allura-border-2)`)

### Resolution Decision
**brand-tokens.css is authoritative.** The `presets/allura.css` preset now uses explicit CSS custom property references (`var(--allura-gray-*)`) instead of shadcn-derived tokens (`var(--allura-text-*)`) to ensure consistency with the canonical design system.

**Rationale:**
1. `brand-tokens.css` contains the brand-locked canonical primitives
2. Consistency: All `--allura-*` tokens use the canonical names (gray-400, gray-500, etc.)
3. Presets should be thin aliases, not alternate token systems
4. Reduces cognitive load: developers reference one canonical set of primitives

---

## Token Reference Files

| File | Purpose |
|------|---------|
| `src/styles/brand-tokens.css` | Canonical token definitions (source of truth) |
| `src/styles/presets/allura.css` | Preset compatibility layer (syncs to brand-tokens) |
| `src/lib/brand/allura.ts` | TypeScript exports for token consumption |
| `src/lib/tokens.ts` | Legacy token definitions (deprecated, kept for backward compatibility) |

---

## TypeScript Usage

Import dashboard tokens from `@/lib/brand/allura.ts`:

```typescript
import { ALLURA_TOKENS } from '@/lib/brand/allura';

// Dashboard tokens
const textPrimary = ALLURA_TOKENS.dashboardTextPrimary;  // var(--dashboard-text-primary)
const surface = ALLURA_TOKENS.dashboardSurface;           // var(--dashboard-surface)
const danger = ALLURA_TOKENS.dashboardDanger;             // var(--dashboard-danger)

// Evidence category tokens
const evidenceBg = ALLURA_TOKENS.dashboardEvidenceBg;     // var(--dashboard-evidence-bg)
const evidenceText = ALLURA_TOKENS.dashboardEvidenceText; // var(--dashboard-evidence-text)
```

---

## Validation Steps

Run token compliance validation after changes:

```bash
# Token compliance scan
npm run validate:tokens

# Type check
npm run typecheck

# Lint
npm run lint

# Build verification
npm run build
```

---

## Next Steps

1. ✅ Map all dashboard tokens to Allura primitives
2. ✅ Create DASHBOARD-TOKENS.md reference document
3. ✅ Add TypeScript exports to `src/lib/brand/allura.ts`
4. ⚠️ **Consider:** Add dedicated `--allura-red` or `--allura-danger` primitive for light mode
5. ⚠️ **Consider:** Add dark-mode variants for Allura gray primitives (gray-400-dk, gray-500-dk, etc.)

---

## Maintainer Notes

- **Owner:** Team RAM (Woz / Brooks)
- **Update frequency:** As design system evolves
- **Breaking changes:** None — this is additive documentation
- **Migration path:** Gradual token adoption with warnings first
