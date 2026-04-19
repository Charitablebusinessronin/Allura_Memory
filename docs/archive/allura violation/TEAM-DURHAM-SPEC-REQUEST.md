# Allura Memory — Design Specification Request

**To:** Team Durham
**From:** Team RAM (Brooks, Woz, Pike, Scout, Fowler)
**Project:** Allura Memory — AI Memory Engine
**Date:** 2026-04-17
**Priority:** P1 — blocks two features and three refinement items
**Requested response format:** **Docker PNGs + Markdown + Notion updates** (preferred over Figma-first delivery)
**Deadline:** 2026-04-25 (1 week)
**Notion Project:** [Allura Memory Control Center](https://www.notion.so/Allura-memory-33b1d9be65b38045b6b0fa8c48dbc17b)
**Durham-side doc:** `06_team-durham-ui-checklist.md` + `08_team-ram_design-spec-request.md`

---

## Design Review Method — Docker + PNG + Markdown

We do not use Figma. Design review happens through:

1. **Live preview** — `docker compose up && bun run dev` → browser at `http://localhost:3100/memory`
2. **Playwright screenshots** — automated visual captures of each screen state
3. **PR review** — every UI change includes a Playwright screenshot diff in the PR description

For each blocker below, Team Durham can:

- Review the live app at `localhost:3100`
- Annotate the Playwright screenshots in `docs/screenshots/`
- Provide PNG captures or Docker-served screenshots of preferred alternatives
- Respond in Markdown, Notion, or directly on the checklist

---

Team RAM has completed the core memory engine, brand retrofit, and security hardening through Sprints 1–3. The system is functionally complete and tenant-safe. We are now blocked on five UI decisions that require Durham design direction before we can ship the remaining Phase 3 features and finalize the experience layer.

This document describes what is built, what is blocked, and the minimum input we need to proceed.

---

## Current State — What Is Built

### Brand System

We have implemented the Durham direction from the Round 4 assets:

| Asset           | Implementation                                                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color palette   | `durham.css` — 42 CSS custom properties covering graphite, navy, steel blue, warm slate, amber ochre, soft amber, mist, warm mist + status + border + surface tokens |
| Typography      | `Public Sans` (existing registration), editorial scale via Durham heading hierarchy                                                                                  |
| Shape language  | `--radius: 0.875rem`, rounded panels (`28px` containers, `24px` cards), softer shadow system                                                                         |
| Dark mode       | Full `durham.css` dark section with amber primary on graphite ground                                                                                                 |
| Theme switching | Durham is registered as a selectable preset in preferences alongside Default, Brutalist, Soft Pop, Tangerine                                                         |

### Screens Shipped

| Route               | Purpose                                     | Current State                                                                                            |
| ------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/memory`           | Consumer memory viewer — primary front door | Search-dominant, memory text as headline, "Add a thought" CTA, plain-English source, Durham-branded      |
| `/memory/[id]`      | Memory inspection — trust view              | Provenance in plain English, confidence muted, version history timeline, "Forget" action, Durham-branded |
| `/dashboard/audit`  | Audit log — permanent proof                 | Day-grouped, plain-English summaries, CSV + JSON export, date/type/agent filters, Durham-branded         |
| `/dashboard/traces` | Redirected to `/dashboard/audit` per AD-18  | Merged — single event viewer                                                                             |

### Security & Infrastructure

- Auth guard on `/api/audit/events` — `requireRole("viewer")`
- DB CHECK constraints — strict `^allura-[a-z0-9-]+$` on 18 tenant-scoped tables
- Curator pipeline — scoring, proposals, HITL approval, Notion sync, DLQ, watchdog
- `witness_hash` — SHA-256 on every approve/reject decision
- All P0/P1 items closed — only P2 remains

---

## Blocked Items — What We Need From Durham

### BLOCKER 1: Capture Notification Banner

**Impact:** This is the single most important trust signal. When an AI stores a memory, the user must see proof that it happened. Without it, the system feels invisible.

**What we built:** Toast notification ("Saved to memory") fires on every write path via Sonner. This is functional but not branded.

**What we need:**

| Decision Point       | Options                                                            | Current Default                      | Decision Needed                                         |
| -------------------- | ------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------- |
| **Visual design**    | Inline banner / toast / slide-in panel / full-width notification   | Bottom-center toast (Sonner default) | Which style? Annotate Playwright screenshot or describe |
| **Copy — headline**  | "Memory saved" / "Your AI remembered this" / "Learned" / Custom    | "Memory saved"                       | Approved headline text                                  |
| **Copy — body**      | Show memory snippet / show source / show nothing / Custom          | None — just headline                 | Approved body text or "none"                            |
| **Color direction**  | Amber accent / Navy / Brand neutral / Custom                       | Sonner default                       | Color + mood per Durham palette                         |
| **Dismiss behavior** | X button / swipe / auto-dismiss (5s) / persistent until action     | Auto-dismiss (Sonner)                | Pick one or combo                                       |
| **Return behavior**  | Never return / return after 7 days / return after session / Custom | Never (toast gone)                   | After dismiss, does it come back?                       |
| **Responsive**       | Same on all / different mobile / Custom                            | Same                                 | Desktop vs mobile spec                                  |

**Reference:** Brand-pack direction says warm, trustworthy, inspectable. A cold toast does not match.

---

### BLOCKER 2: Empty State Illustration and Copy

**Impact:** First-run experience. If the 18-year-old intern doesn't know what to do in two minutes, we failed.

**What we built:** `BrainCircuit` icon + "Nothing has been saved here yet" + "Add the first memory" button. Functionally correct. Not branded.

**What we need:**

| Decision Point         | Options                                                                                        | Current Default                                                                                  | Decision Needed                           |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| **Illustration**       | Keep `BrainCircuit` icon / Custom Durham illustration / Photography / None                     | `BrainCircuit` (Lucide)                                                                          | Visual direction — screenshot or describe |
| **Copy — headline**    | Per wireframe §8: "Your AI is ready to learn" / Custom                                         | "Nothing has been saved here yet"                                                                | Approved headline                         |
| **Copy — body**        | Per wireframe §8: "Just talk to it. It will remember things about you automatically." / Custom | "Once conversations or manual notes are stored, they will show up here in a calmer review list." | Approved body                             |
| **CTA text**           | Per wireframe §8: "See how it works →" / "Add the first memory" / Custom                       | "Add the first memory"                                                                           | Approved CTA                              |
| **Search empty state** | Per wireframe §4: "Your AI hasn't learned anything about [query] yet" with suggestion / Custom | "No memories matched [query]"                                                                    | Approved search-empty copy                |

---

### BLOCKER 3: Memory Card Resting State

**Impact:** This is what users see most. The wireframe says memory text is the headline, source is visible, nothing else. Our current cards are close but not signed off.

**What we built (after Sprint 2 retrofit):**

- Memory text as dominant headline
- Relative time ("2 hours ago")
- Source label ("from conversation" / "added by you")
- Tags hidden until expand
- "Add a thought" CTA
- Technical scope controls in Settings Sheet only

**What we need:**

| Decision Point         | Options                                                                     | Current Default                     | Decision Needed                     |
| ---------------------- | --------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------- |
| **Card layout**        | Single-line row (wireframe §1) / padded card / Custom                       | Padded card with rounded corners    | Approve current or specify revision |
| **Tag treatment**      | Hidden until expand (current) / Visible as pills / Visible as text / Custom | Hidden until expand                 | Approve or revise                   |
| **Hover/swipe action** | Per wireframe §5: hover reveals [Forget] / swipe-left on mobile             | Hover reveals link                  | Approve or revise                   |
| **Source badge**       | Plain text "from conversation" / Icon + text / Colored chip / Custom        | Plain text                          | Approve or revise                   |
| **Mobile card**        | Compact single-line (wireframe §9) / Same as desktop / Custom               | Responsive — stacked text on mobile | Approve or revise                   |

---

### BLOCKER 4: Audit Page Layout Confirmation

**Impact:** We built a hybrid audit page (day-grouped, plain English). The checklist item 4 asks for layout confirmation. We need sign-off so we don't rebuild later.

**What we built:**

- Day-grouped timeline ("Today", "Yesterday", "Friday, April 11")
- Plain-English summaries per event
- Expandable raw JSON on click
- CSV + JSON export
- Date range / event type / agent ID filters
- Durham-branded with warm panels

**What we need:**

| Decision Point    | Options                                                       | Current Build               | Decision Needed    |
| ----------------- | ------------------------------------------------------------- | --------------------------- | ------------------ |
| **Layout**        | Table / Timeline / Card list / Hybrid                         | Hybrid (day groups + cards) | Approve or specify |
| **Row content**   | Per wireframe §12: time, actor, action, memory snippet        | Same as wireframe           | Approve or specify |
| **Route**         | `/dashboard/audit` (current) / `/admin/audit` (wireframe §12) | `/dashboard/audit`          | Confirm or change  |
| **Search/filter** | Current: date + type + agent / Add search / Reduce            | Date + type + agent         | Approve or revise  |

---

### BLOCKER 5: Version History Display

**Impact:** We added a minimal version timeline on `/memory/[id]`. Needs design sign-off.

**What we built:**

- Original version: "This is the original version. It hasn't been edited yet."
- Edited version: amber dot → blue dot timeline with dates
- Superseded: link to newer version
- Durham-branded tokens throughout

**What we need:**

| Decision Point      | Options                                                        | Current Build                   | Decision Needed          |
| ------------------- | -------------------------------------------------------------- | ------------------------------- | ------------------------ |
| **Display**         | Inline list / Timeline / Expandable section / Separate tab     | Timeline (two dots + connector) | Approve or specify       |
| **Detail level**    | Date only / Date + content diff / Date + full previous content | Date only                       | How much history to show |
| **Superseded link** | Navigate to new version / Modal showing both / None            | Navigate to new version         | Approve or specify       |

---

## Minimum Viable Input — Fastest Path

If Team Durham has limited availability, we need only these three items to unblock the two most impactful features:

1. **Capture banner design** — Review the live toast at `localhost:3100/memory`, then annotate a screenshot or describe the replacement. Include copy and dismiss behavior.
2. **Empty state copy** — Approved headline, body, and CTA text for the zero-memories state.
3. **Memory card layout** — Review the live card list at `localhost:3100/memory`, then annotate or describe changes.

Items 4 and 5 can follow later. Items 1–3 unblock shipping.

---

## Reference Materials

| Asset                           | Location                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Brand overview                  | `06_team-durham-ui-images/01-brand-overview-v2.png`                                                  |
| Logo chooser                    | `06_team-durham-ui-images/02-logo-chooser-v2.png`                                                    |
| Color system                    | `06_team-durham-ui-images/03-color-system-v2.png`                                                    |
| Typography                      | `06_team-durham-ui-images/04-typography-v2.png`                                                      |
| Applications                    | `06_team-durham-ui-images/05-applications-v2.png`                                                    |
| Homepage variants (×3)          | `06_team-durham-ui-images/homepage-*.png`                                                            |
| R4 app/website hero             | `06_team-durham-ui-images/r4-app-website-hero.png`                                                   |
| R4 logo primary                 | `06_team-durham-ui-images/r4-logo-primary.png`                                                       |
| R4 system patterns              | `06_team-durham-ui-images/r4-system-patterns.png`                                                    |
| Durham UI checklist             | `06_team-durham-ui-checklist.md`                                                                     |
| Wireframe spec                  | `docs/allura/DESIGN-ALLURA.md`                                                                       |
| This request doc                | `08_team-ram_design-spec-request.md` (Durham-side copy)                                              |
| Durham UI checklist             | `06_team-durham-ui-checklist.md`                                                                     |
| Notion project page             | [Allura Memory Control Center](https://www.notion.so/Allura-memory-33b1d9be65b38045b6b0fa8c48dbc17b) |
| Live app                        | `http://localhost:3100/memory` (run `bun run dev`)                                                   |
| **Screenshots (current state)** | `docs/screenshots/01-memory-page-desktop.png`                                                        |
|                                 | `docs/screenshots/02-memory-page-mobile.png`                                                         |
|                                 | `docs/screenshots/03-audit-page-desktop.png`                                                         |

---

## Constraints

- All implemented UI uses the Durham brand token system (`var(--durham-*)`) — no hardcoded hex values
- Copy must match the wireframe voice: warm, plain-English, trustworthy
- "Forget" not "Delete" — per wireframe §5 design rule
- The machine is always invisible — no `Neo4j`, no `PostgreSQL`, no system internals visible to the consumer
- Consumer and enterprise views are separate — per wireframe §10

---

## Response Format

For each blocker, Team Durham can respond with:

- ✅ **Approved** — current implementation ships as-is
- 🔄 **Revised** — provide **PNG screenshot / Docker capture** + approved copy in Markdown or Notion
- ❌ **Rejected** — provide **PNG screenshot / Docker capture** + approved copy in Markdown or Notion
- ⏳ **Deferred** — keep current implementation and revisit later

Preferred delivery channels:

- **Markdown** inside the project workspace
- **PNG screenshots / Docker-served captures** for layout direction
- **Notion updates** on the Allura Memory project page for sign-off / visibility

---

**Submitted by:** Brooks (System Architect), on behalf of Team RAM
**Review requested by:** 2026-04-25
**Questions:** Reach us on the Notion project page or reply inline above
