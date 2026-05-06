# Allura Brand System Guide

> **For developers, designers, and anyone touching Allura's visual identity.**
> This is a *teaching document*, not a reference shelf. Read it once, understand the system, then come back for the quick reference card.

---

## 🚀 Quick Reference Card

### Color Variables — Which One Do I Use?

| I need... | Light mode | Dark mode | Notes |
|-----------|-----------|-----------|-------|
| Primary brand / trust | `--allura-blue` (#1D4ED8) | `--allura-blue` (#60A5FA) | Auto-shifts in dark mode |
| CTAs / action / accent | `--allura-orange` (#FF5A2E) | `--allura-orange` (#FB923C) | Brand Kit calls this "Coral" |
| Success / positive | `--allura-green` (#157A44) | `--allura-green` (#34D399) | |
| Gold / premium / evidence | `--allura-gold` (#C89B3C) | `--allura-gold` (#FBBF24) | ⚠️ Never use raw gold on white — use `--allura-gold-text` |
| Body text | `--foreground` | `--foreground` | Mapped via shadcn |
| Muted / secondary text | `--muted-foreground` | `--muted-foreground` | |
| Page background | `--background` | `--background` | |
| Card surface | `--card` | `--card` | |
| Dashboard surface (dark) | `--dashboard-surface` (#162035) | same | Hard-coded dark navy |
| Dashboard surface alt (dark) | `--dashboard-surface-alt` (#0F1A2E) | same | Deeper variant |
| Evidence highlight bg | `--dashboard-evidence-bg` | same | Cream in light, cream in dark |

### Typography — Which Font Variable?

| Context | Variable | Font | Weight |
|---------|----------|------|--------|
| All UI text | `--font-sans` | IBM Plex Sans | 400–700 |
| Display headings (hero) | `.font-display` | Montserrat 900 | 900 |
| Code / evidence / logs | `--font-family-mono` | IBM Plex Mono | 400 |
| Marketing pages | `--font-family-primary` | Inter | 400–700 |

### How to Apply the Allura Theme

```css
/* On <html> or <body> */
<html data-theme-preset="allura" class="dark">
<!-- That's it. Both selectors cascade. -->
```

The `data-theme-preset="allura"` attribute activates the Allura preset in `allura.css`. The `dark` class flips shadcn semantic tokens. Dashboard-specific tokens are always dark-first.

### Dark Mode in 10 Seconds

1. **Marketing / landing pages** — Use `@media (prefers-color-scheme: dark)` tokens from `tokens.css`. Light-first design.
2. **Dashboard** — Always dark. Set `class="dark"` + `data-theme-preset="allura"`. Dashboard tokens (`--dashboard-surface`, `--dashboard-surface-alt`) are hard-coded dark values that don't shift.
3. **Never mix** — A component is either in the "marketing system" or the "dashboard system." Pick one.

---

## 1. Why Two Systems?

Allura has **two distinct brand systems** and that's *by design*, not by accident.

### System 1: Brand Kit (Marketing)

**Where:** Landing pages, marketing site, social media, pitch decks, brand guidelines PDF.

**Source of truth:** `docs/branding/deliverables/04_brand-kit-builder_brand-kit.md` + Figma `PAQpnxQZENNwbhmk5qxOjR`

| Token | Hex | Purpose |
|-------|-----|---------|
| Deep Navy | #1A2B4A | Primary brand — trust, depth |
| Coral | #E85A3C | Action — warmth, CTAs |
| Trust Green | #4CAF50 | Success, growth |
| Clarity Blue | #5B8DB8 | Info, calm |
| Pure White | #F5F5F5 | Backgrounds |
| Ink Black | #1A1A1A | Body text |
| Warm Gray | #737373 | Secondary text |

**Typography:** Inter (primary), Georgia/Times (secondary serif fallback). Hero at 64px, H1 at 48px. Warm, human, approachable.

**Design philosophy:** Caregiver 50% / Creator 30% / Explorer 20%. Warm + Connected. This is a *brand for humans*, not for data.

### System 2: Dashboard (Product UI)

**Where:** The Allura Memory app, memory panels, evidence displays, admin dashboards.

**Source of truth:** `src/styles/brand-tokens.css` + `src/styles/presets/allura.css`

| Token | Hex (light) | Hex (dark) | Purpose |
|-------|-------------|-------------|---------|
| Blue | #1D4ED8 | #60A5FA | Primary brand, links, focus rings |
| Orange | #FF5A2E | #FB923C | Accent, CTAs, evidence highlights |
| Green | #157A44 | #34D399 | Success states |
| Gold | #C89B3C | #FBBF24 | Premium, evidence category |
| Charcoal | #111827 | #F3F4F6 | Text |
| Cream | #F5F1E6 | #0F172A | Backgrounds / surfaces |
| Dashboard Surface | #162035 | #162035 | Dark panel backgrounds (always dark) |

**Typography:** IBM Plex Sans (primary), IBM Plex Mono (code/evidence), Montserrat 900 (display headings). Crisp, technical, data-dense.

**Design philosophy:** Dark-mode-first data interface. WCAG AA+ compliance is non-negotiable. Clarity > warmth when you're staring at evidence trails.

### Why They're Different

| Aspect | Brand Kit | Dashboard |
|--------|-----------|-----------|
| **Audience** | Prospects, investors, public | Power users, daily drivers |
| **Mode** | Light-first | Dark-first |
| **Mood** | Warm, inviting, human | Technical, precise, trustworthy |
| **Density** | Generous whitespace | Data-dense, compact |
| **Colors** | Softer, warmer (Coral, Navy) | More saturated, higher contrast (Orange, Blue) |
| **Fonts** | Inter (humanist) | IBM Plex Sans (neo-grotesque, more readable at small sizes) |
| **Contrast** | 4.5:1 minimum | 4.5:1+ enforced via dark-mode text variants |

**The Brand Kit is a first impression. The Dashboard is a daily tool.** They serve different purposes and should feel different. A warm, spacious landing page sells you on the idea. A tight, high-contrast dashboard helps you do the work.

---

## 2. Color Mapping Between Systems

### Primary Colors

| Brand Kit Name | Brand Kit Hex | Dashboard Name | Dashboard Hex | Notes |
|---------------|---------------|----------------|---------------|-------|
| Deep Navy | #1A2B4A | Blue | #1D4ED8 | Dashboard blue is brighter for UI legibility |
| Coral | #E85A3C | Orange | #FF5A2E | Slightly more saturated for dark mode pop |
| Trust Green | #4CAF50 | Green | #157A44 | Dashboard green is darker for AA contrast |
| Clarity Blue | #5B8DB8 | → Blue | #1D4ED8 | Consolidated into primary blue in dashboard |
| Pure White | #F5F5F5 | White | #FFFFFF | Dashboard uses true white |
| Ink Black | #1A1A1A | Charcoal | #111827 | Dashboard charcoal is slightly bluer |
| Warm Gray | #737373 | Gray-500 | #6B7280 | Tailwind gray scale in dashboard |

**Key difference:** The Brand Kit has 7 named primitives. The Dashboard has 7 brand primitives *plus* a full neutral scale (gray-100 through gray-800) plus WCAG-compliant text variants. The Dashboard is a superset.

### Backward Compatibility Aliases

The codebase already has aliases that map old Brand Kit names to Dashboard primitives:

```css
/* In brand-tokens.css — DO NOT USE THESE IN NEW CODE */
--allura-deep-navy:   var(--allura-blue);      /* → use --allura-blue */
--allura-coral:       var(--allura-orange);     /* → use --allura-orange */
--allura-trust-green: var(--allura-green);      /* → use --allura-green */
--allura-clarity-blue:var(--allura-blue);      /* → use --allura-blue */
--allura-pure-white:  var(--allura-white);      /* → use --allura-white */
--allura-ink-black:   var(--allura-charcoal);   /* → use --allura-charcoal */
--allura-warm-gray:   var(--allura-gray-500);   /* → use --allura-gray-500 */
```

These exist so old Brand Kit CSS doesn't break. **New code should use the canonical Dashboard names** (`--allura-blue`, `--allura-orange`, etc.).

---

## 3. When to Use Which System

### Decision Framework

```
Is this a MARKETING or PUBLIC-FACING surface?
├── YES → Brand Kit system (Inter, Coral, Deep Navy, warm whitespace)
│         Import: tokens.css / components.css
│         Theme: light mode, editorial shadows, generous spacing
│
└── NO → Is this the PRODUCT / DASHBOARD?
          ├── YES → Dashboard system (IBM Plex Sans, Orange, Blue, dark surfaces)
          │         Import: brand-tokens.css + presets/allura.css
          │         Theme: data-theme-preset="allura" class="dark"
          │
          └── UNSURE → It's probably Dashboard. When in doubt, dark mode.
```

### Specific Guidance

| Surface | System | Why |
|---------|--------|-----|
| allura.io landing page | Brand Kit | First impression, marketing |
| Blog / case studies | Brand Kit | Content marketing, SEO |
| Social media assets | Brand Kit | Brand consistency |
| Pitch deck / investor PDF | Brand Kit | Emotional storytelling |
| Login / signup page | Dashboard | Transition point into product |
| Main dashboard | Dashboard | Daily use, data-dense |
| Memory detail panel | Dashboard | Evidence trails, dense info |
| Settings / profile | Dashboard | Product UI |
| Error states (in-product) | Dashboard | Consistent with product UI |
| Error pages (404/500) | Brand Kit | Public-facing |
| Email templates | Brand Kit | Marketing touchpoint |
| Notification toasts (in-product) | Dashboard | Product UI |
| Chrome extension popup | Dashboard | Product UI |

---

## 4. Dark Mode Deep Dive

### How Dark Mode Works in the Dashboard

The dashboard uses **two layers of dark mode:**

1. **shadcn semantic layer** — Activated by `class="dark"` on `<html>`. Maps shadcn tokens (`--background`, `--foreground`, `--card`, etc.) to dark values.
2. **Dashboard-specific layer** — Hard-coded dark values for surfaces that don't have a light-mode counterpart (`--dashboard-surface: #162035`).

### Dashboard Surface Tokens (Always Dark)

These tokens exist *because* the dashboard is fundamentally a dark interface. They don't shift between light and dark — they're always dark:

```css
--dashboard-surface:        #162035;   /* Main panel background */
--dashboard-surface-alt:    #0F1A2E;   /* Deeper panel, sidebar */
--dashboard-surface-muted:  #1E2D47;   /* Raised surfaces, cards */
--dashboard-border:         rgb(255 255 255 / 0.08);   /* Subtle dividers */
--dashboard-border-default: rgb(255 255 255 / 0.12);   /* Default borders */
```

**Why not just use shadcn dark mode?** Because the dashboard has *three levels* of dark surfaces (surface → surface-alt → surface-muted) that don't map cleanly to shadcn's two-surface system (background vs card). The dashboard is a data-rich environment that needs more surface depth than a standard app.

### Brand Primitive Light → Dark Shifts

When `class="dark"` is active, the brand primitives *remap themselves:*

| Primitive | Light | Dark | Why the shift |
|-----------|-------|------|---------------|
| `--allura-blue` | #1D4ED8 | #60A5FA | Lighter blue for dark backgrounds |
| `--allura-orange` | #FF5A2E | #FB923C | Lighter orange for visibility |
| `--allura-green` | #157A44 | #34D399 | Lighter green for contrast |
| `--allura-gold` | #C89B3C | #FBBF24 | Lighter gold for dark bg readability |
| `--allura-charcoal` | #111827 | #F3F4F6 | **Reverses!** Becomes light text |
| `--allura-cream` | #F5F1E6 | #0F172A | **Reverses!** Becomes dark surface |
| `--allura-white` | #FFFFFF | #1E293B | **Reverses!** Becomes dark surface |

**This is intentional.** In dark mode, "white" surfaces become dark and "charcoal" text becomes light. The semantic meaning stays the same (foreground/background), but the hex values invert.

---

## 5. WCAG Compliance Notes

### ✅ Passing Pairs (Both Systems)

| Foreground | Background | Ratio | System |
|-----------|-----------|-------|--------|
| Ink Black (#1A1A1A) | Pure White (#F5F5F5) | 18.1:1 | Brand Kit |
| Pure White (#F5F5F5) | Deep Navy (#1A2B4A) | 9.3:1 | Brand Kit |
| Charcoal (#111827) | White (#FFFFFF) | 17.4:1 | Dashboard light |
| White (#FFFFFF) | Blue (#1D4ED8) | 6.1:1 | Dashboard light |
| White (#FFF) | Dashboard Surface (#162035) | 13.5:1 | Dashboard dark |
| Dark blue text (#60A5FA) | Dashboard Surface (#162035) | ~5.5:1 | Dashboard dark |

### ⚠️ Conditional Pairs (Use With Care)

| Foreground | Background | Ratio | Condition |
|-----------|-----------|-------|-----------|
| Coral (#E85A3C) on Pure White (#F5F5F5) | 3.2:1 | ❌ **Fails for normal text.** Only use for large text (≥18px bold / ≥24px regular) |
| Gold (#C89B3C) on White (#FFFFFF) | 2.56:1 | ❌ **Fails.** Use `--allura-gold-text` (#8a651d) for text on white backgrounds (4.5:1 ✅) |
| Gold (#FBBF24) on dark surface (#162035) | ~7.5:1 | ✅ **Passes in dark mode.** Gold light variant is fine on dark backgrounds |
| Gray-400 (#9CA3AF) on White (#FFFFFF) | 2.54:1 | ❌ **Fails.** Use gray-500 (#6B7280) for text on white (4.6:1 ✅) |
| Gray-400 (#9CA3AF) on dark bg | ~4.7:1 | ✅ **Passes in dark mode.** Use `--allura-gray-400-text` variable which auto-adjusts |

### Dark Mode Text Variants

The dashboard provides **automatic dark-mode text variants** that solve WCAG compliance:

```css
/* In brand-tokens.css */
--allura-gold-text:       #8a651d;   /* light mode: dark enough for white bg */
                              /* dark mode: switches to #FBBF24, bright enough for dark bg */
--allura-gray-400-text:    #6B7280;   /* light mode: passes on white */
                              /* dark mode: switches to #9CA3AF, passes on dark */
--allura-orange-on-text:   #7C2D12;   /* light mode: dark text on orange bg */
                              /* dark mode: switches to #FFCDB2, light text on dark+orange */
```

**Rule of thumb:** If you're putting text on a colored background, use the `-text` variant, not the raw color.

---

## 6. Using Tokens in React Components

### Import Paths

| What you're building | Import from | Theme activation |
|---------------------|------------|-----------------|
| Marketing page | `tokens.css` + `components.css` (branding design system) | No data attribute needed |
| Dashboard component | `brand-tokens.css` + `presets/allura.css` | `data-theme-preset="allura"` + `class="dark"` |
| shadcn/ui component | Automatic via `globals.css` → `allura.css` preset | `data-theme-preset="allura"` |
| Tailwind utility class | Use Tailwind color classes (`bg-primary`, `text-foreground`, etc.) | Set via `globals.css` `@theme` block |

### React Component Examples

#### Dashboard Button (Correct)

```tsx
// ✅ GOOD — Uses shadcn semantic tokens, works in both light/dark
<button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2">
  Save Memory
</button>
```

```tsx
// ✅ GOOD — Uses Allura brand tokens for brand-specific color
<button className="bg-[var(--allura-orange)] text-white rounded-full px-6 py-2">
  Get Started
</button>
```

```tsx
// ❌ BAD — Raw hex, bypasses the token system
<button className="bg-[#FF5A2E] text-white rounded-full px-6 py-2">
  Get Started
</button>
```

#### Evidence Highlight (Dashboard)

```tsx
// ✅ GOOD — Uses dashboard semantic tokens
<div className="bg-[var(--dashboard-evidence-bg)] text-[var(--dashboard-evidence-text)]">
  {evidenceContent}
</div>
```

```tsx
// ✅ GOOD — Uses cream via Allura token
<div className="bg-[var(--allura-cream)] text-[var(--allura-charcoal)]">
  {evidenceContent}
</div>
```

#### Gold Text (WCAG-safe)

```tsx
// ✅ GOOD — Auto-adjusts for light/dark mode
<span className="text-[var(--allura-gold-text)]">Premium Feature</span>

// ❌ BAD — Raw gold fails WCAG on white backgrounds (2.56:1)
<span className="text-[var(--allura-gold)]">Premium Feature</span>
```

#### Dashboard Panel (Always Dark)

```tsx
// ✅ GOOD — Dashboard surface tokens are always dark, no mode switching
<div className="bg-[var(--dashboard-surface)] text-[var(--dashboard-text-primary)]">
  <div className="border-[var(--dashboard-border)] rounded-lg p-4">
    Memory Content
  </div>
</div>
```

#### Marketing Page (Brand Kit System)

```tsx
// ✅ GOOD — Brand Kit CSS with semantic tokens
<link rel="stylesheet" href="/tokens.css" />
<link rel="stylesheet" href="/components.css" />

<section className="allura-hero">
  <h1 className="allura-heading-hero">Memory That Shows Its Work</h1>
  <p className="allura-body-large">Technology that brings people together.</p>
</section>
```

### Tailwind Integration

The Allura theme maps brand tokens to Tailwind's semantic system via `globals.css`:

```css
/* globals.css @theme block maps these */
--color-primary: var(--primary);        /* → --allura-blue via preset */
--color-foreground: var(--foreground);  /* → --allura-charcoal via preset */
--color-card: var(--card);              /* → --allura-white via preset */
/* etc. */
```

**Use Tailwind semantic classes by default. Only reach for brand-specific tokens when you need a specific Allura color that doesn't have a Tailwind semantic mapping.**

---

## 7. Typography Systems

### Brand Kit Typography (Marketing)

| Level | Size | Weight | Line Height | Use |
|-------|------|--------|-------------|-----|
| Hero | 64px | 700 | 1.1 | Landing page hero |
| H1 | 48px | 700 | 1.1 | Section openers |
| H2 | 36px | 600 | 1.1 | Section titles |
| H3 | 28px | 600 | 1.5 | Sub-sections |
| H4 | 24px | 600 | 1.5 | Card titles |
| Body Large | 18px | 400 | 1.75 | Lead paragraphs |
| Body | 16px | 400 | 1.5 | Default text |
| Caption | 14px | 400 | 1.5 | Secondary text |
| Overline | 12px | 600 | 1.5 | Labels, tags |

**Font:** Inter (primary), Georgia/Times (secondary serif fallback)
**CSS:** `.allura-heading-hero`, `.allura-heading-1`, `.allura-body`, etc.

### Dashboard Typography (Product)

| Level | Class | Font | Use |
|-------|-------|------|-----|
| Display heading | `.font-display` | Montserrat 900 | Hero numbers, big stats |
| Body text | `font-sans` | IBM Plex Sans | Everything else |
| Code / evidence | `font-mono` | IBM Plex Mono | Memory logs, evidence trails |
| Fallback | system-ui | System font | Never-visible safety net |

**The dashboard doesn't use Inter.** IBM Plex Sans was chosen because it's more legible at small sizes (11-13px) in data-dense interfaces. Montserrat 900 is reserved exclusively for big display numbers that need visual punch.

### Font Loading

```tsx
// In layout.tsx or equivalent
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&family=Montserrat:wght@900&display=swap" rel="stylesheet" />
```

For marketing pages, also load Inter:
```tsx
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

---

## 8. Shadow System

### Brand Kit: Editorial 3-Layer Shadow

```css
/* Layer 1: Ambient — base depth */
.shadow-ambient { box-shadow: 0 4px 20px -4px rgba(20, 35, 41, 0.08); }

/* Layer 2: Directional — simulates light source */
.shadow-directional { box-shadow: 0 8px 16px -4px rgba(20, 35, 41, 0.12); }

/* Layer 3: Contact — anchors to surface */
.shadow-contact { box-shadow: 0 2px 4px 0 rgba(20, 35, 41, 0.16); }

/* Card: Ambient + Directional */
.allura-card { box-shadow: 0 4px 20px -4px rgba(20, 35, 41, 0.08),
                               0 8px 16px -4px rgba(20, 35, 41, 0.12); }
```

### Dashboard: 8-Level Shadow Scale

```css
/* In dark mode, shadows are much more aggressive (0.20–0.55 opacity) */
--shadow-2xs: 0px 1px 2px 0px rgb(0 0 0 / 0.20);
--shadow-xs:  0px 1px 2px 0px rgb(0 0 0 / 0.22);
--shadow-sm:  0px 4px 16px -10px rgb(0 0 0 / 0.30);
--shadow:     0px 10px 30px -18px rgb(0 0 0 / 0.35);
--shadow-md:  0px 14px 36px -18px rgb(0 0 0 / 0.40);
--shadow-lg:  0px 22px 48px -24px rgb(0 0 0 / 0.45);
--shadow-xl:  0px 28px 60px -28px rgb(0 0 0 / 0.50);
--shadow-2xl: 0px 36px 80px -32px rgb(0 0 0 / 0.55);
```

**Why so many levels?** The dashboard uses elevation as a primary interaction signal. Hover, active, modal, overlay — each needs a distinct shadow to communicate depth. In light mode, 3 levels suffice because borders + background color shifts add visual hierarchy. In dark mode, shadows do more heavy lifting.

---

## 9. The 5 Common Mistakes

### Mistake 1: Using Brand Kit colors in the Dashboard (or vice versa)

```tsx
// ❌ WRONG — Brand Kit "Deep Navy" doesn't exist in dashboard tokens
<div style={{ backgroundColor: '#1A2B4A' }}>

// ✅ CORRECT — Use dashboard token
<div style={{ backgroundColor: 'var(--allura-blue)' }}>
```

**Why it matters:** The Dashboard blue (#1D4ED8) is intentionally brighter than Brand Kit navy (#1A2B4A) for UI legibility. They look similar but serve different contrast ratios.

### Mistake 2: Using raw Gold (#C89B3C) for text

```tsx
// ❌ WRONG — Gold on white = 2.56:1 contrast (fails WCAG AA)
<span className="text-[#C89B3C]">Premium</span>

// ✅ CORRECT — Use the WCAG-safe text variant
<span className="text-[var(--allura-gold-text)]">Premium</span>
```

The `--allura-gold-text` variable automatically switches between dark gold (#8a651d) in light mode and bright gold (#FBBF24) in dark mode. **Always use the `-text` variant for text.**

### Mistake 3: Forgetting the theme preset attribute

```tsx
// ❌ WRONG — Allura preset won't activate
<html class="dark">

// ✅ CORRECT — Both selectors needed
<html data-theme-preset="allura" class="dark">
```

Without `data-theme-preset="allura"`, the `allura.css` preset won't activate, and you'll get the default shadcn theme instead of Allura's brand colors.

### Mistake 4: Mixing Inter and IBM Plex Sans in the Dashboard

```tsx
// ❌ WRONG — Inter is the marketing font, not the product font
<h1 style={{ fontFamily: "'Inter', sans-serif" }}>Memory Dashboard</h1>

// ✅ CORRECT — IBM Plex Sans is the dashboard primary
<h1 className="font-sans">Memory Dashboard</h1>

// ✅ ALSO CORRECT — Montserrat 900 for big display numbers
<h1 className="font-display">2,847</h1>
```

**Font rule:** Inter = marketing. IBM Plex Sans = dashboard. Montserrat 900 = display numbers only.

### Mistake 5: Using dashboard surface tokens in light mode

```tsx
// ❌ WRONG — Dashboard surface is always dark, even in light mode
<div className="bg-[var(--dashboard-surface)]">

// If you need a light-mode surface, use shadcn semantic tokens:
<div className="bg-card">  {/* → white in light, dark in dark mode */}
```

`--dashboard-surface` (#162035) is *always dark*. It represents the navy panel background that defines the dashboard's dark-mode identity. It doesn't change between light and dark. If you need a responsive surface, use `--card`, `--background`, or `--muted`.

---

## 10. Drift Items — Needs Captain's Decision

These are places where the two systems have diverged and need reconciliation. Each is flagged with a recommendation.

### 🔴 DRIFT-1: Brand Kit "Deep Navy" vs Dashboard "Blue"

| | Brand Kit | Dashboard |
|--|-----------|-----------|
| Name | Deep Navy | Blue |
| Hex | #1A2B4A | #1D4ED8 |
| Hue | 213° (blue-black) | 224° (royal blue) |

**Impact:** Marketing materials and the product dashboard use noticeably different blues. The Brand Kit navy is nearly black; the Dashboard blue is vivid and unmistakably blue.

**Recommendation:** Keep both. They serve different purposes — Deep Navy for brand authority in marketing, vivid Blue for interactive UI elements. Document the mapping clearly. Add a "marketing-navy" alias to the dashboard tokens for cases where the darker navy is needed in-product.

**Decision needed:** Should the product ever use #1A2B4A for anything? Or should marketing converge to #1D4ED8?

### 🔴 DRIFT-2: Brand Kit "Coral" vs Dashboard "Orange"

| | Brand Kit | Dashboard |
|--|-----------|-----------|
| Name | Coral | Orange |
| Hex | #E85A3C | #FF5A2E |
| Hue | 10° (warm red-orange) | 18° (vivid orange) |

**Impact:** The dashboard orange is more saturated and vivid than the brand kit's coral. Side by side, they feel like different brands.

**Recommendation:** Converge to a single accent color. The Dashboard's #FF5A2E has better contrast and visibility in dark mode. Suggest updating the Brand Kit to use #FF5A2E or a close variant, keeping the name "Coral" for brand storytelling but using the brighter hex.

**Decision needed:** Which hex wins? Or do we accept the drift and document it?

### 🟡 DRIFT-3: Brand Kit "Inter" vs Dashboard "IBM Plex Sans"

| | Brand Kit | Dashboard |
|--|-----------|-----------|
| Primary font | Inter | IBM Plex Sans |
| Secondary | Georgia/Times | IBM Plex Mono |
| Display | (none) | Montserrat 900 |

**Impact:** Two different primary typefaces. Inter and IBM Plex Sans are both humanist sans-serifs but have different x-heights, letter spacing, and personality.

**Recommendation:** Keep both. Inter is optimized for marketing readability at 16-64px. IBM Plex Sans is optimized for UI density at 11-14px. Document clearly which to use where.

**Decision needed:** Should marketing pages in the product (like onboarding, settings) use IBM Plex Sans or Inter?

### 🟡 DRIFT-4: Brand Kit "Clarity Blue" eliminated from Dashboard

| | Brand Kit | Dashboard |
|--|-----------|-----------|
| Clarity Blue | #5B8DB8 | Merged into Blue (#1D4ED8) |

**Impact:** The Brand Kit has an explicit "info/calm" blue that's softer than the primary. The Dashboard consolidates both info and brand into a single blue.

**Recommendation:** Add `--allura-info-blue` (#5B8DB8 or similar) to the dashboard tokens for info/success states that need to be visually distinct from primary actions. This prevents "everything is blue" syndrome.

**Decision needed:** Should the dashboard have a secondary blue for info states, or is primary blue sufficient?

### 🟢 DRIFT-5: Shadow systems are completely different

| | Brand Kit | Dashboard |
|--|-----------|-----------|
| Approach | 3 editorial layers (ambient + directional + contact) | 8-level utility scale |
| Opacity | Low (8-16%) | High (20-55%) |
| Use | Cards, hover states | Full elevation system |

**Impact:** None — this is correct by design. Marketing uses subtle, warm shadows. Dashboard uses aggressive, high-contrast shadows for dark-mode depth.

**Recommendation:** No action needed. Document as intentional divergence.

### 🟡 DRIFT-6: No explicit "Cream" equivalent in Brand Kit

| | Brand Kit | Dashboard |
|--|-----------|-----------|
| Warm background | Pure White #F5F5F5 | Cream #F5F1E6 |

**Impact:** The Dashboard has a warmer, yellower "white" (#F5F1E6) compared to the Brand Kit's cooler white (#F5F5F5). This subtle warmth is a key differentiator in the dashboard's feel.

**Recommendation:** Add "Warm White" or "Cream" as an explicit Brand Kit token. The dashboard's cream tone reinforces warmth without being obvious.

**Decision needed:** Should the Brand Kit adopt #F5F1E6 as its background, or keep the cooler #F5F5F5?

### 🟡 DRIFT-7: Dark mode exists only in Dashboard

The Brand Kit CSS (`tokens.css`, `components.css`) has a `@media (prefers-color-scheme: dark)` block, but it only flips 5 semantic tokens (text-primary, text-secondary, surface-primary, surface-inverted, shadows). The Dashboard has a full dark-mode palette with 30+ tokens.

**Recommendation:** The Brand Kit's dark mode is a starting point, not production-ready. If the marketing site ever goes dark, it should adopt the Dashboard's dark-mode approach (explicit token remapping) rather than the current light-touch override.

**Decision needed:** Should we invest in a full Brand Kit dark mode, or leave marketing as light-only?

---

## 11. File Reference

| File | System | Purpose |
|------|--------|---------|
| `docs/branding/deliverables/04_brand-kit-builder_brand-kit.md` | Brand Kit | Master brand specification |
| `docs/branding/06_allura-memory_brand-truth.json` | Brand Kit | Brand truth, values, Figma sync metadata |
| `docs/branding/design-system/tokens.css` | Brand Kit | CSS custom properties for marketing |
| `docs/branding/design-system/components.css` | Brand Kit | Component styles for marketing |
| `src/styles/brand-tokens.css` | Dashboard | Product UI token definitions |
| `src/styles/presets/allura.css` | Dashboard | Theme preset (light + dark) |
| `src/app/globals.css` | Dashboard | Tailwind integration, shadcn mappings |

### Import Order in `globals.css`

```css
@import "tailwindcss/index.css";
@import "../styles/vendor/tw-animate.css";
@import "../styles/presets/brutalist.css";    /* Other presets */
@import "../styles/presets/durham.css";
@import "../styles/presets/soft-pop.css";
@import "../styles/presets/tangerine.css";
@import "../styles/presets/allura.css";         /* ← Allura preset */
@import "../styles/brand-tokens.css";           /* ← Brand tokens (comes after) */
@import "../styles/agency-dashboard.css";        /* ← Dashboard overrides */
```

**Note:** `brand-tokens.css` comes *after* `allura.css` because it adds backward-compatible aliases and dashboard-specific tokens that depend on the preset being active.

---

## 12. Token Naming Convention

### Brand Kit (Marketing)

```
color/brand/{name}          → --color-brand-{name}
color/{semantic}/{role}     → --color-{semantic}-{role}
font/size/{level}           → --font-size-{level}
space/{value}               → --space-{value}
```

### Dashboard (Product)

```
--allura-{color}           → Brand primitive (e.g., --allura-blue)
--allura-{color}-hover     → Hover variant
--allura-{color}-{opacity} → Generated fill (e.g., --allura-blue-8)
--allura-gray-{scale}      → Neutral scale (100-800)
--dashboard-{element}       → Dashboard-specific token
--{shadcn-token}            → Semantic shadcn token (mapped via preset)
```

**Rule:** Brand Kit uses `--color-brand-*` and `--color-{semantic}-*`. Dashboard uses `--allura-*` and `--dashboard-*`. If you see `--color-brand-*` in dashboard code, it's from the Brand Kit CSS and shouldn't be used in React components.

---

*Last updated: 2026-05-06*
*Maintained by: Team IRIS (Brand Specialist)*
*Source of truth: Figma `PAQpnxQZENNwbhmk5qxOjR` for Brand Kit; `src/styles/brand-tokens.css` for Dashboard*