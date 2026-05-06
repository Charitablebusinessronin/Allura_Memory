---
name: Allura Memory
description: Memory that shows its work: warm, governed, inspectable AI memory for teams.
colors:
  cobalt-blue: "#1D4ED8"
  ember-orange: "#FF5A2E"
  pine-green: "#157A44"
  harvest-gold: "#C89B3C"
  midnight-charcoal: "#111827"
  warm-cream: "#F5F1E6"
  pure-white: "#FFFFFF"
  abyss-panel: "#162035"
  deep-abyss: "#0F1A2E"
  raised-abyss: "#1E2D47"
  border-gray: "#D1D5DB"
  muted-gray: "#6B7280"
typography:
  display:
    fontFamily: "Montserrat, IBM Plex Sans, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(2.75rem, 5vw, 3.5rem)"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.05em"
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  xxxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.cobalt-blue}"
    textColor: "{colors.pure-white}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-accent:
    backgroundColor: "{colors.ember-orange}"
    textColor: "{colors.pure-white}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.cobalt-blue}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  card-dashboard:
    backgroundColor: "{colors.pure-white}"
    textColor: "{colors.midnight-charcoal}"
    rounded: "{rounded.lg}"
    padding: "24px"
  badge-outcome:
    backgroundColor: "#E8F4EC"
    textColor: "{colors.pine-green}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
---

# Design System: Allura Memory

## 1. Overview

**Creative North Star: "The Illuminated Ledger"**

Allura Memory is a governed archive with a human pulse. The interface must make every memory feel traceable, every promotion accountable, and every operational state legible without turning the product into a cold compliance console. The system combines Team Durham's warm and connected brand foundation with the product's harder truth: operators are inspecting evidence, failures, graph relationships, and approval queues.

The design has two doors. Brand and public-facing surfaces are light-first, generous, and emotionally inviting. Product and dashboard surfaces are tool-first: dense, high-contrast, and built for sustained review of evidence trails. The distinction is intentional. A warm landing page sells the promise; a precise dashboard proves it.

Allura rejects generic SaaS gloss, hacker-terminal theater, academic graph-demo complexity, and decorative AI tropes. It should feel like a carefully kept ledger illuminated for human judgment: exact enough for curators, warm enough to reduce anxiety, and direct enough that the next action is never hidden.

**Key Characteristics:**
- Evidence-first hierarchy, with provenance and status always discoverable.
- Warm brand primitives applied with operational restraint.
- Dark-first dashboard depth for dense inspection work.
- Light-first marketing warmth for public storytelling.
- Plain, confident UI copy: learned, used, forget, evidence, promote, approve.

## 2. Colors

Allura's product palette is a brighter, higher-contrast operational translation of Team Durham's warm brand kit.

### Primary
- **Cobalt Memory Blue**: Primary action, focus, links, chart one, selected navigation, and confidence cues. Use it to signal trust and system direction, not decoration.
- **Abyss Panel Navy**: Dashboard panel field for dark-first product work. Use it where operators inspect dense evidence for long stretches.

### Secondary
- **Ember Action Orange**: Accent and CTA color for review, insight, warning, and action moments. Use sparingly; it should feel like human intervention entering the machine.
- **Pine Trust Green**: Success, approved state, outcome badges, positive reinforcement, and health states.

### Tertiary
- **Harvest Evidence Gold**: Evidence, premium, medium severity, and annotation moments. Never use raw gold for small text on white; use a WCAG-safe text variant.

### Neutral
- **Midnight Charcoal**: Primary product text and the serious voice of the interface.
- **Warm Cream**: Light dashboard background and evidence surface, used to keep the product from becoming sterile.
- **Pure White**: Cards and raised surfaces in light product contexts.
- **Deep Abyss**: Deepest dashboard background and sidebar field.
- **Raised Abyss**: Raised dark dashboard surface for cards and grouped evidence.
- **Muted Gray**: Secondary labels and low-priority metadata only.

### Named Rules
**The Two-System Rule.** Marketing surfaces use the warm Brand Kit language: light-first, spacious, Inter-forward. Product surfaces use the Dashboard language: IBM Plex Sans, stronger contrast, denser structure, and operational colors.

**The Evidence Contrast Rule.** Status and evidence colors must pass WCAG AA in their actual context. Gold and orange are never used as normal body text on white.

**The No Decorative AI Rule.** No neon gradients, frosted glass, cyber glow, or generic AI purple. If color appears, it must carry status, navigation, evidence, or action.

## 3. Typography

**Display Font:** Montserrat for rare brand or dashboard display moments.  
**Body Font:** IBM Plex Sans for product UI, dashboard text, forms, tables, panels, and navigation.  
**Label/Mono Font:** IBM Plex Mono for logs, evidence excerpts, raw traces, IDs when unavoidable, and command-like snippets.

**Character:** The pairing is technical without being brittle. Montserrat gives brand moments weight; IBM Plex Sans carries dense operational UI; IBM Plex Mono marks evidence as machine-originated without making the whole product feel like a terminal.

### Hierarchy
- **Display** (900, clamp(2.75rem, 5vw, 3.5rem), 1.1): Use only for brand moments, major product landmarks, or highly intentional empty states.
- **Headline** (700, 2.25rem, 1.1): Dashboard page titles and metric values.
- **Title** (600, 1.125rem, 1.35): Panel headings, card titles, queue item titles.
- **Body** (400, 1rem, 1.5): Explanatory copy, memory descriptions, settings descriptions. Cap long prose at 65-75ch.
- **Label** (600, 0.75rem, 0.05em): Overlines, tiny metadata, status group labels. Use uppercase only for compact system labels.
- **Mono** (400, 0.8125rem, 1.45): Evidence logs, trace snippets, and machine output.

### Named Rules
**The Human First Label Rule.** In consumer memory surfaces, never lead with `group_id`, `user_id`, raw event IDs, or ISO timestamps. Translate to human provenance first; reveal machine detail only on demand.

**The One Reading Voice Rule.** Dense dashboard pages still need one dominant reading path: page title, status/action row, evidence list, detail. Do not flatten all labels to the same weight.

## 4. Elevation

Allura uses tonal layering first and shadow second. The dashboard should feel assembled from crisp planes, not floating glass. Light product cards use thin borders and small shadows; dark dashboard panels use surface depth and subtle borders. Shadows may respond to hover or focus, but they should never become the main visual effect.

### Shadow Vocabulary
- **Hairline Lift** (`box-shadow: 0 1px 2px rgba(15,17,21,0.05)`): Buttons, selected tabs, small raised controls.
- **Card Rest** (`box-shadow: 0 1px 2px 0 rgba(15, 17, 21, 0.04)`): Dashboard cards and section panels.
- **Card Hover** (`box-shadow: 0 4px 16px -10px rgba(15, 17, 21, 0.10)`): Metric card hover only.
- **Editorial Medium** (`box-shadow: 0 4px 6px -1px rgba(15,17,21,.10), 0 2px 4px -2px rgba(15,17,21,.10)`): Menus, popovers, and active raised elements.
- **Modal Lift** (`box-shadow: 0 18px 40px rgba(15,17,21,.14)`): Dialogs and high-priority overlays.

### Named Rules
**The Flat At Rest Rule.** Surfaces are mostly flat at rest. Borders and tonal contrast do the structural work; shadows appear only when interaction or hierarchy requires lift.

**The No Glass Rule.** Backdrop blur is allowed for sticky mobile headers only when it improves readability. Decorative glassmorphism is prohibited.

## 5. Components

Components should feel precise, quiet, and accountable. Every component must make state visible without shouting.

### Buttons
- **Shape:** Gently squared controls with an 8px radius for standard actions, 4px for compact controls.
- **Primary:** Cobalt Memory Blue background with white text, 40px height, 16px horizontal padding, 2px focus ring in blue.
- **Accent:** Ember Action Orange for review and intervention moments, not as the default button on every screen.
- **Ghost:** Transparent background, blue text, token border, muted hover fill. Use for secondary navigation and low-risk actions.
- **Danger:** White or quiet surface with orange/red text and border before destructive confirmation. Destruction should feel deliberate, not theatrical.
- **Hover / Focus:** Use color shifts and focus rings. Active buttons may scale to 0.98. Do not animate layout properties.

### Chips
- **Style:** Small pill badges with 999px radius, 4px by 10px padding, 12px text, and tokenized tone fills.
- **State:** Outcome uses green, insight uses orange, event uses charcoal, high severity uses danger red, medium uses gold, low uses blue.
- **Rule:** Color must be paired with text. Never use color alone to identify severity or category.

### Cards / Containers
- **Corner Style:** Dashboard cards use restrained 12px radius. Generic shadcn cards may use rounded-xl, but nested card grids are discouraged.
- **Background:** Light dashboard cards use white on cream. Dark dashboard panels use abyss, deep abyss, and raised abyss layers.
- **Shadow Strategy:** Thin border first, small shadow second. Metric hover may lift slightly.
- **Border:** Use token borders, never colored side stripes.
- **Internal Padding:** Section cards use 20px 24px; metric cards use 24px.

### Inputs / Fields
- **Style:** 9px-high rhythm through 36px default height, transparent or surface background, token border, 8px radius.
- **Focus:** Border shifts to ring color with a soft 3px ring. Focus must be visible in both light and dark contexts.
- **Error / Disabled:** Error uses destructive token and ring; disabled reduces opacity and pointer events.

### Navigation
- **Style:** Navigation is compact, left-aligned, and status-aware. Active states use surface fills, borders, and clear text contrast.
- **Desktop:** Sidebar and top bar support operator workflows, search, filters, and project context.
- **Mobile:** Keep one primary action visible, use minimum 48px touch targets, and collapse navigation without hiding search.

### Evidence Panels
Evidence panels are the signature component family. They must separate raw evidence, outcome, metadata, connections, and history with clear tabs or sections. Raw logs use IBM Plex Mono. Copy buttons and provenance controls should be available without overwhelming the primary evidence reading path.

## 6. Do's and Don'ts

### Do:
- **Do** preserve the two-door model: consumer memory stays simple and personal; enterprise administration stays dense and operational.
- **Do** show chain of custody for promoted knowledge: source, evidence, status, confidence, approval path, and graph relationship.
- **Do** use `src/styles/brand-tokens.css` and `src/styles/presets/allura.css` as the product token source of truth.
- **Do** use IBM Plex Sans for product UI and IBM Plex Mono for logs, evidence, and trace excerpts.
- **Do** keep dashboard color meaningful: blue for trust/action, orange for intervention, green for approved/healthy, gold for evidence/medium, red only for true danger.
- **Do** distinguish zero state, empty state, loading state, and error state with different copy and affordances.
- **Do** respect reduced motion and keep transitions to color, border, shadow, and opacity.

### Don't:
- **Don't** make Allura feel like a cold enterprise admin console.
- **Don't** make Allura feel like a generic SaaS analytics dashboard.
- **Don't** make Allura feel like a hacker terminal.
- **Don't** make Allura feel like an academic knowledge graph demo.
- **Don't** expose `group_id`, `user_id`, raw event IDs, or ISO timestamps as primary consumer content.
- **Don't** use decorative AI tropes, neon cyber aesthetics, frosted glass panels, generic gradient hero treatments, or repeated icon-card grids.
- **Don't** use side-stripe borders as accents. Use full borders, tone fills, icons, or text hierarchy instead.
- **Don't** use gradient text. Emphasis comes from weight, scale, contrast, and placement.
- **Don't** use modals as the first solution. Prefer inline review, expandable provenance, drawers, and progressive disclosure.
- **Don't** put raw gold or orange body text on white. Use WCAG-safe text variants.
