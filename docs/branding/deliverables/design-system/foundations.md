# Allura Design Foundations
> Tokens, scales, and base values for the design system

---

## Spacing Scale

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `space-0` | 0 | 0px | Reset |
| `space-px` | 1px | 1px | Hairline borders |
| `space-1` | 0.25rem | 4px | Tight gaps, icon padding |
| `space-2` | 0.5rem | 8px | Compact spacing |
| `space-3` | 0.75rem | 12px | Button padding, small gaps |
| `space-4` | 1rem | 16px | Base unit, card padding |
| `space-5` | 1.25rem | 20px | Medium gaps |
| `space-6` | 1.5rem | 24px | Section padding |
| `space-8` | 2rem | 32px | Large gaps, page sections |
| `space-10` | 2.5rem | 40px | Major sections |
| `space-12` | 3rem | 48px | Page padding |
| `space-16` | 4rem | 64px | Hero spacing |
| `space-20` | 5rem | 80px | Major divisions |
| `space-24` | 6rem | 96px | Section breaks |

**Usage Rules:**
- Use `space-4` (16px) as the base unit
- Component internal padding: `space-4` or `space-5`
- Between components: `space-4` or `space-6`
- Page sections: `space-8` or `space-12`
- Never use arbitrary values

---

## Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `radius-none` | 0 | Sharp corners (rare) |
| `radius-sm` | 4px | Small elements, tags |
| `radius-md` | 8px | Buttons, inputs, cards |
| `radius-lg` | 12px | Large cards, modals |
| `radius-xl` | 16px | Drawers, large surfaces |
| `radius-2xl` | 24px | Hero cards, feature blocks |
| `radius-full` | 9999px | Pills, avatars, circles |

**Usage Rules:**
- Buttons: `radius-md` (8px)
- Cards: `radius-lg` (12px)
- Modals/Drawers: `radius-xl` (16px) on top corners only
- Avatars: `radius-full`
- Tags/Chips: `radius-full` (pill shape)

---

## Typography Scale

### Font Families

| Token | Value | Usage |
|-------|-------|-------|
| `font-sans` | Inter, system-ui, sans-serif | Body, UI, everything |
| `font-mono` | JetBrains Mono, monospace | Code, timestamps |

### Type Scale

| Token | Size | Line Height | Weight | Letter Spacing | Usage |
|-------|------|-------------|--------|----------------|-------|
| `text-xs` | 12px | 16px | 400-500 | 0.01em | Captions, timestamps |
| `text-sm` | 14px | 20px | 400-500 | 0 | Body small, labels |
| `text-base` | 16px | 24px | 400 | 0 | Body text |
| `text-lg` | 18px | 28px | 400-500 | -0.01em | Lead paragraphs |
| `text-xl` | 20px | 28px | 500-600 | -0.01em | Small headings |
| `text-2xl` | 24px | 32px | 600 | -0.02em | Section headings |
| `text-3xl` | 30px | 36px | 600 | -0.02em | Page titles |
| `text-4xl` | 36px | 40px | 700 | -0.02em | Hero text |
| `text-5xl` | 48px | 48px | 700 | -0.03em | Display text |

### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `font-normal` | 400 | Body text |
| `font-medium` | 500 | Labels, emphasis |
| `font-semibold` | 600 | Headings, buttons |
| `font-bold` | 700 | Hero text, stats |

### Typography Patterns

**Page Title:**
- Size: `text-3xl` (30px)
- Weight: `font-semibold` (600)
- Line Height: 1.2
- Letter Spacing: -0.02em

**Section Heading:**
- Size: `text-2xl` (24px)
- Weight: `font-semibold` (600)
- Line Height: 1.3

**Card Title:**
- Size: `text-lg` (18px)
- Weight: `font-semibold` (600)
- Line Height: 1.4

**Body Text:**
- Size: `text-base` (16px)
- Weight: `font-normal` (400)
- Line Height: 1.6
- Max Width: 65ch for readability

**Label:**
- Size: `text-sm` (14px)
- Weight: `font-medium` (500)
- Color: Secondary text

**Caption/Meta:**
- Size: `text-xs` (12px)
- Weight: `font-medium` (500)
- Color: Tertiary text
- Uppercase optional with `tracking-wide`

---

## Color System

### Neutral Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `gray-50` | #F9FAFB | Hover backgrounds |
| `gray-100` | #F3F4F6 | Subtle backgrounds |
| `gray-200` | #E5E7EB | Borders, dividers |
| `gray-300` | #D1D5DB | Disabled borders |
| `gray-400` | #9CA3AF | Placeholder text |
| `gray-500` | #6B7280 | Secondary text |
| `gray-600` | #4B5563 | Body text |
| `gray-700` | #374151 | Strong text |
| `gray-800` | #1F2937 | Headings |
| `gray-900` | #111827 | Primary text |

### Brand Colors

> Source: Figma variable collection "Allura Primitives" — PAQpnxQZENNwbhmk5qxOjR

| Token | Hex | RGB | Figma Variable | Usage |
|-------|-----|-----|----------------|-------|
| `deep-navy` | #1A2B4A | 26, 43, 74 | `color/brand/deep-navy` | Primary brand — trust, depth |
| `coral` | #E85A3C | 232, 90, 60 | `color/brand/coral` | Action — warmth, energy |
| `trust-green` | #4CAF50 | 76, 175, 80 | `color/brand/trust-green` | Success, growth |
| `clarity-blue` | #5B8DB8 | 91, 141, 184 | `color/brand/clarity-blue` | Information, calm |
| `pure-white` | #F5F5F5 | 245, 245, 245 | `color/brand/pure-white` | Backgrounds |
| `ink-black` | #1A1A1A | 26, 26, 26 | `color/brand/ink-black` | Primary text |
| `warm-gray` | #737373 | 115, 115, 115 | `color/brand/warm-gray` | Secondary text |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` | #111827 | Primary text on light |
| `text-secondary` | #6B7280 | Secondary/muted text |
| `text-tertiary` | #9CA3AF | Placeholders, hints |
| `text-inverted` | #FFFFFF | Text on dark backgrounds |
| `bg-primary` | #FFFFFF | Primary backgrounds |
| `bg-secondary` | #F9FAFB | Subtle backgrounds |
| `bg-tertiary` | #F3F4F6 | Hover, active states |
| `border-primary` | #E5E7EB | Primary borders |
| `border-secondary` | #D1D5DB | Input borders |

### Status Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `status-success` | #1A7A4A | Success states |
| `status-success-light` | #D1FAE5 | Success backgrounds |
| `status-warning` | #D97706 | Warnings |
| `status-warning-light` | #FEF3C7 | Warning backgrounds |
| `status-error` | #DC2626 | Errors |
| `status-error-light` | #FEE2E2 | Error backgrounds |
| `status-info` | #1E5BDB | Information |
| `status-info-light` | #DBEAFE | Info backgrounds |

---

## Shadow System

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-none` | none | Flat elements |
| `shadow-sm` | 0 1px 2px rgba(0,0,0,0.05) | Subtle elevation |
| `shadow-md` | 0 4px 6px -1px rgba(0,0,0,0.1) | Cards, dropdowns |
| `shadow-lg` | 0 10px 15px -3px rgba(0,0,0,0.1) | Modals, drawers |
| `shadow-xl` | 0 20px 25px -5px rgba(0,0,0,0.1) | Overlays |
| `shadow-inner` | inset 0 2px 4px rgba(0,0,0,0.05) | Inset depth |

**Usage Rules:**
- Cards: `shadow-sm` or `shadow-md`
- Dropdowns: `shadow-lg`
- Modals/Drawers: `shadow-xl`
- Never combine shadows (use one level)

---

## Icon System

### Icon Sizes

| Token | Size | Usage |
|-------|------|-------|
| `icon-xs` | 12px | Inline with text |
| `icon-sm` | 16px | Buttons, compact |
| `icon-md` | 20px | Navigation, inputs |
| `icon-lg` | 24px | Standalone, features |
| `icon-xl` | 32px | Empty states, hero |

### Icon Library

**Primary:** Lucide React
- Consistent stroke width (2px)
- Rounded caps and joins
- Scalable without distortion

**Usage:**
- Navigation: `icon-md` (20px)
- Buttons: `icon-sm` (16px)
- Feature icons: `icon-lg` (24px)
- Empty states: `icon-xl` (32px)

---

## Layout Grid

### Desktop Grid

- **Container:** Max-width 1440px, centered
- **Columns:** 12-column grid
- **Gutter:** 24px (space-6)
- **Margin:** 32px (space-8)
- **Breakpoints:**
  - `sm`: 640px
  - `md`: 768px
  - `lg`: 1024px
  - `xl`: 1280px
  - `2xl`: 1440px

### Sidebar Layout

- **Sidebar:** Fixed 240px width
- **Content:** Fluid, min-width 0 (for truncation)
- **Right Drawer:** Fixed 400px, overlay

### Mobile Layout

- **Container:** Full width, 16px horizontal padding
- **Stack:** Single column, vertical spacing
- **Safe Areas:** Respect notch, home indicator

---

## Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `z-base` | 0 | Default layer |
| `z-dropdown` | 100 | Dropdowns, popovers |
| `z-sticky` | 200 | Sticky headers |
| `z-fixed` | 300 | Fixed navigation |
| `z-modal-backdrop` | 400 | Modal overlay |
| `z-modal` | 500 | Modal content |
| `z-popover` | 600 | Popovers, tooltips |
| `z-tooltip` | 700 | Tooltips |
| `z-toast` | 800 | Toast notifications |

---

## Animation & Transitions

### Durations

| Token | Value | Usage |
|-------|-------|-------|
| `duration-fast` | 150ms | Micro-interactions |
| `duration-base` | 250ms | Standard transitions |
| `duration-slow` | 350ms | Complex animations |
| `duration-slower` | 500ms | Page transitions |

### Easing Functions

| Token | Value | Usage |
|-------|-------|-------|
| `ease-linear` | linear | Continuous animations |
| `ease-in` | cubic-bezier(0.4, 0, 1, 1) | Exit animations |
| `ease-out` | cubic-bezier(0, 0, 0.2, 1) | Enter animations |
| `ease-in-out` | cubic-bezier(0.4, 0, 0.2, 1) | Standard |
| `ease-bounce` | cubic-bezier(0.68, -0.55, 0.265, 1.55) | Playful |

### Common Transitions

**Button Hover:**
```css
transition: all 150ms ease-in-out;
```

**Card Hover:**
```css
transition: box-shadow 250ms ease-in-out, transform 150ms ease;
```

**Drawer Slide:**
```css
transition: transform 300ms ease-out;
```

**Modal Fade:**
```css
transition: opacity 250ms ease-in-out;
```

**Skeleton Pulse:**
```css
animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
```

---

## Breakpoints

| Token | Width | Description |
|-------|-------|-------------|
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1440px | Large screens |

**Responsive Patterns:**

- **Mobile First:** Base styles for mobile, scale up
- **Sidebar:** Collapses at `lg` (1024px)
- **Grid:** 1 col mobile → 2 col tablet → 3-4 col desktop
- **Drawer:** Full screen mobile → fixed width desktop

---

## Accessibility

### Focus States

- **Ring:** 2px solid brand-blue
- **Ring Offset:** 2px
- **Outline:** None (use ring instead)

### Minimum Touch Targets

- **Buttons:** 40px × 40px minimum
- **Navigation:** 44px × 44px minimum
- **Spacing:** 8px between touch targets

### Color Contrast

- **Text on Light:** Minimum 4.5:1 (AA)
- **Text on Dark:** Minimum 4.5:1 (AA)
- **Large Text:** Minimum 3:1 (AA)
- **UI Components:** Minimum 3:1 (AA)

### Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
