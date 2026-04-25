# Allura Design Tokens

**Client:** allura-memory  
**Source:** [Figma Brand Kit](https://www.figma.com/design/PAQpnxQZENNwbhmk5qxOjR/Untitled)  
**Generated:** April 22, 2026  
**Agent:** Glaser (Visual Director)

---

## Overview

This directory contains the complete design token system extracted from the 8-page Allura Brand Kit in Figma. The tokens follow a semantic architecture that maps brand primitives to usage-driven semantic tokens.

### Brand Archetype Distribution
- **Caregiver (50%):** Empathy, warmth, human-first design
- **Creator (30%):** Purposeful building, intelligent solutions
- **Explorer (20%):** Curiosity, new ideas, evolution

### Tagline
> "Memory that shows its work"

---

## Files

| File | Description |
|------|-------------|
| `design-tokens.css` | CSS custom properties with full token system |
| `design-tokens.json` | Structured JSON for design system integration |
| `tailwind.config.js` | Tailwind CSS configuration snippet |
| `README.md` | This documentation file |

---

## Color Palette

### Primitive Colors (Brand DNA)

Source: Figma Allura Primitives collection (PAQpnxQZENNwbhmk5qxOjR)

| Color | Hex | RGB | Usage |
|-------|-----|-----|-------|
| **Deep Navy** | `#1A2B4A` | `rgb(26, 43, 74)` | Primary brand color — trust, depth, intelligence |
| **Coral** | `#E85A3C` | `rgb(232, 90, 60)` | Action color — warmth, energy, human touch |
| **Trust Green** | `#4CAF50` | `rgb(76, 175, 80)` | Success, growth, positive reinforcement |
| **Clarity Blue** | `#5B8DB8` | `rgb(91, 141, 184)` | Information, calm, clarity |
| **Pure White** | `#F5F5F5` | `rgb(245, 245, 245)` | Clean backgrounds, breathing room |
| **Ink Black** | `#1A1A1A` | `rgb(26, 26, 26)` | Primary text |
| **Warm Gray** | `#737373` | `rgb(115, 115, 115)` | Secondary text, subtle elements |

### Semantic Color Mapping

```
Action Colors:
├── Primary: Coral (CTAs, highlights)
├── Secondary: Deep Navy (brand, trust moments)
└── Tertiary: Trust Green (success, community)

Text Colors:
├── Primary: Ink Black (headlines, body)
├── Secondary: Warm Gray (captions, secondary)
├── Brand: Deep Navy (brand text)
└── Inverted: Pure White (on dark backgrounds)

Surface Colors:
├── Primary: Pure White (main backgrounds)
├── Secondary: Clarity Blue (information surfaces)
└── Inverted: Deep Navy (dark sections)
```

---

## Typography System

### Font Family
- **Primary:** Inter (with system font fallbacks)
- **Display:** Inter
- **Mono:** SF Mono

### Type Scale (Major Third - 1.25 ratio)

| Token | Size | Usage |
|-------|------|-------|
| `--font-size-hero` | 64px | Hero headlines |
| `--font-size-display` | 48px | Display text |
| `--font-size-h1` | 40px | Page titles |
| `--font-size-h2` | 32px | Section headings |
| `--font-size-h3` | 24px | Subsection headings |
| `--font-size-h4` | 20px | Card titles |
| `--font-size-body` | 16px | Body text |
| `--font-size-body-sm` | 14px | Small body |
| `--font-size-caption` | 12px | Captions |
| `--font-size-overline` | 11px | Overlines |

### Font Weights
- Light: 300
- Regular: 400
- Medium: 500
- Semibold: 600
- Bold: 700
- Black: 900

### Line Heights
- Tight: 1.1 (headlines)
- Snug: 1.25 (headings)
- Normal: 1.5 (body)
- Relaxed: 1.625 (comfortable reading)

---

## Spacing System

Based on 8px grid:

| Token | Value | Pixels |
|-------|-------|--------|
| `--space-1` | 0.25rem | 4px |
| `--space-2` | 0.5rem | 8px |
| `--space-4` | 1rem | 16px |
| `--space-6` | 1.5rem | 24px |
| `--space-8` | 2rem | 32px |
| `--space-12` | 3rem | 48px |
| `--space-16` | 4rem | 64px |
| `--space-24` | 6rem | 96px |
| `--space-32` | 8rem | 128px |

### Semantic Spacing
- **Stack (vertical):** xs (8px), sm (16px), md (24px), lg (32px), xl (48px), 2xl (64px)
- **Inline (horizontal):** xs (4px), sm (8px), md (12px), lg (16px), xl (24px)

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Small elements |
| `--radius-md` | 8px | Buttons, inputs |
| `--radius-lg` | 12px | Cards |
| `--radius-xl` | 16px | Large cards |
| `--radius-2xl` | 24px | Modals |
| `--radius-3xl` | 32px | Feature cards |
| `--radius-full` | 9999px | Pills, avatars |

---

## Shadow System

Layered depth with ambient + directional shadows:

### Elevation Levels
- **Elevation 1:** Subtle cards
- **Elevation 2:** Standard cards
- **Elevation 3:** Elevated cards
- **Elevation 4:** Modals
- **Elevation 5:** Overlays

### Focus Rings
- Default: `0 0 0 3px rgba(232, 90, 60, 0.3)`
- Error: `0 0 0 3px rgba(231, 76, 60, 0.3)`

---

## Usage Examples

### CSS Variables

```css
/* Using primitive colors */
.button-primary {
  background-color: var(--color-brand-warm-yellow);
  color: var(--color-brand-dark-gray);
}

/* Using semantic tokens */
.card {
  background-color: var(--color-surface-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--space-6);
}

/* Typography */
.headline {
  font-family: var(--font-family-display);
  font-size: var(--font-size-h1);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-snug);
}
```

### Tailwind CSS

```jsx
// Colors
<div className="bg-action-primary text-text-primary">
  Primary action with text
</div>

// Typography
<h1 className="text-h1 font-bold text-text-primary">
  Page Title
</h1>

// Spacing + Radius + Shadow
<div className="p-6 rounded-lg shadow-md bg-surface-primary">
  Card content
</div>

// Dark mode support
<div className="bg-surface-primary dark:bg-surface-inverted">
  Theme-aware surface
</div>
```

---

## Integration Guide

### Option 1: CSS Variables (Recommended for vanilla CSS)

```html
<link rel="stylesheet" href="design-tokens.css" />
```

### Option 2: Tailwind CSS

Merge the `tailwind.config.js` snippet with your existing config:

```javascript
// tailwind.config.js
const alluraTokens = require('./design-tokens/tailwind.config.js');

module.exports = {
  // ... your existing config
  theme: {
    extend: {
      ...alluraTokens.theme.extend,
      // ... your custom extensions
    },
  },
};
```

### Option 3: JSON Import (for JS/TS projects)

```javascript
import tokens from './design-tokens.json';

// Access colors
const primaryColor = tokens.primitives.colors.deepNavy.hex;

// Access typography
const fontSize = tokens.typography.sizes.h1.value;
```

---

## Dark Mode

The token system includes dark mode overrides. Enable via:

### CSS (prefers-color-scheme)
```css
@media (prefers-color-scheme: dark) {
  /* Automatic via design-tokens.css */
}
```

### Tailwind (class-based)
```html
<html class="dark">
  <!-- Content -->
</html>
```

---

## Brand Kit Pages Reference

| Page | Content |
|------|---------|
| 01 | Cover - "Allura Brand Kit" |
| 02 | Brand Overview - Purpose, Values |
| 03 | Brand Essence - Warm + Connected |
| 04 | Brand Personality - Caregiver/Creator/Explorer |
| 05 | Allura in Action - Product Mockup |
| 06 | Social Media & Newsletter |
| 07 | Brand Assets - Logo, Icons, Patterns |
| 08 | Instagram Post Example |

---

## Token Count Summary

| Category | Count |
|----------|-------|
| Primitive Colors | 7 |
| Semantic Colors | 15+ |
| Typography Sizes | 11 |
| Font Weights | 6 |
| Line Heights | 5 |
| Spacing Values | 18 |
| Border Radius | 7 |
| Shadows | 15+ |
| Z-Index Levels | 9 |

---

## Validation

- ✅ All Figma variables extracted
- ✅ Semantic token architecture applied
- ✅ Dark mode support included
- ✅ Tailwind config provided
- ✅ CSS custom properties generated
- ✅ JSON structure for programmatic access

---

## Changelog

### v2.0.0 (2026-04-24)
- Synced to Figma Allura Primitives collection (PAQpnxQZENNwbhmk5qxOjR)
- Palette corrected: Deep Navy/Coral/Trust Green replaces v1 yellow palette
- Primitive colors expanded from 5 to 7 tokens
- Semantic tokens updated to match Figma Allura Semantic collection
- Focus ring updated to Coral RGBA

### v1.0.0 (2026-04-22)
- Initial extraction from Figma Brand Kit
- Created semantic token architecture
- Generated CSS, JSON, and Tailwind configs
- Added dark mode support

---

*Generated by Team Durham - Visual Director (Glaser)*
