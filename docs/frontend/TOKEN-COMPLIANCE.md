# Token Compliance Validation — Frontend Style Guide

**Story:** 2.7  
**Status:** Active  
**Last Updated:** 2026-05-06

---

## Overview

Token compliance validation ensures all frontend component code uses the Allura Design System's CSS custom properties (tokens) instead of hardcoded hex color values.

This validation:
- Scans `src/app/(main)/dashboard`, `src/components/dashboard`, and `src/components/memory-explorer`
- Fails on unauthorized raw hex colors (e.g., `#FF5733`)
- Fails on deprecated token usage (`--allura-gold`, `#C89B3C`)
- Documents violations with file locations and line numbers

---

## What It Checks

### 1. Unauthorized Hex Colors

Any hardcoded `#RRGGBB` or `#RRGGBBAA` value not defined in the design token files.

**Allowed patterns:**
```css
/* Using CSS custom property */
color: var(--allura-blue);

/* Using theme-aware function */
background: color-mix(in srgb, var(--allura-gold) 10%, white);
```

**Forbidden patterns:**
```css
/* Hardcoded hex */
color: #C89B3C;

/* Hardcoded hex in template literals */
className={`text-${colorCode}`} // where colorCode = "#FF5733"
```

### 2. Deprecated Token References

Direct usage of tokens that have been migrated to the canonical token structure.

**Deprecated tokens:**
- `--allura-gold` (deprecated, use `var(--allura-gold)` from `src/lib/brand/allura.ts`)
- `#C89B3C` (hardcoded gold, use `var(--allura-gold)`)

**Migration example:**
```diff
- color: var(--allura-gold);  // ❌ Deprecated usage
+ color: var(--allura-gold);  // ✅ Proper token reference
```

### 3. Excluded Files

The following token definition files are excluded from scanning (they contain the canonical token values):

- `src/lib/brand/allura.ts`
- `src/lib/brand/durham.ts`
- `src/lib/tokens.ts`
- `src/lib/theme/brand.ts`
- `src/styles/brand-tokens.css`
- `src/styles/presets/allura.css`
- `src/styles/presets/durham.css`
- `src/styles/agency-dashboard.css`
- `src/app/globals.css`
- `src/lib/preferences/theme.ts`

---

## How to Run

### Local Development

```bash
# Using npm/yarn
npm run validate:tokens
# or
yarn validate:tokens

# Direct execution
bash scripts/token-compliance.sh
```

### Continuous Integration

The token compliance scan is part of the frontend validation path:

```bash
# Full frontend validation
npm run test:unit      # Includes token compliance checks
npm run lint           # ESLint + type checking
npm run build          # Production build

# Token-specific validation
npm run validate:tokens
```

### VV Command Integration

The `validate:tokens` script is available as a validation gateway:

```bash
# Check token compliance before committing
npm run validate:tokens && git commit -m "feat: ..."
```

---

## Configuration

### Target Directories

The scan is configured to check:
- `src/app/(main)/dashboard` — Main dashboard views
- `src/components/dashboard` — Dashboard-specific components
- `src/components/memory-explorer` — Memory explorer components

### Exclusion Rules

Token definition files are automatically excluded. Custom exclusions can be added to the `EXCLUDE_PATTERNS` array in `scripts/token-compliance.sh`.

---

## Troubleshooting

### "Found X hardcoded hex color violation(s)"

**Cause:** A component uses a hex color not defined in the token system.

**Fix:**
1. Add the color to the canonical token files (`src/styles/brand-tokens.css`)
2. Reference the token via `var(--allura-[color-name])` in components
3. For temporary fixes, use `color-mix(in srgb, var(--allura-[base]) [amount]%, white)` for color variations

### "Found X deprecated token references"

**Cause:** Components use legacy token references that have been reorganized.

**Fix:**
1. Update to the canonical token names in `src/lib/brand/allura.ts`
2. Run `npm run validate:tokens` to verify the fix

### Permission denied on script execution

```bash
chmod +x scripts/token-compliance.sh
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | ✅ No violations found |
| 1 | ❌ Violations detected |

---

## Integration with Frontend Workflow

### Pre-commit Hook

```bash
# .git/hooks/pre-commit
#!/bin/bash
npm run validate:tokens || exit 1
echo "Token compliance check passed"
```

### GitHub Actions Integration

```yaml
# .github/workflows/frontend-validation.yml
name: Frontend Validation

on: [pull_request]

jobs:
  token-compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run validate:tokens
```

---

## Related Stories

- Story 2.2: Frontend style guide & design tokens
- Story 2.6: Brand compliance audit (`scripts/brand-audit.sh`)
- Story 2.8: UI component consistency metrics

---

## Maintainer Notes

- **Owner:** Team RAM (Woz / Brooks)
- **Update frequency:** As design system evolves
- **Breaking changes:** None — this is additive validation
- **Migration path:** Gradual token adoption with warnings first
