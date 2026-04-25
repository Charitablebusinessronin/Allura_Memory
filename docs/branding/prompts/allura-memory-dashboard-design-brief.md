# Allura Memory Dashboard — Design Brief

## Overview

Design a high-fidelity, interactive mockup of the **Allura Memory Dashboard** — a clean, governed interface for viewing, searching, and managing AI system memories. The dashboard lives at `/memory` and `/curator` in a Next.js app. Use **Claude Design** capabilities to create polished visual work: realistic prototypes, design explorations, and interactive mockups with fine-grained controls.

## Brand Context

**Allura** is an AI Memory Layer / Knowledge Management product.  
**Tagline:** MEMORY THAT SHOWS ITS WORK  
**Positioning:** Warm + Connected  
**Brand Promise:** To give people the power to hold on to what matters and share it with the people who matter most.

**Archetype:** Caregiver (50%) + Creator (30%) + Explorer (20%)  
**Voice:** Warm, approachable, intelligent. Clear, jargon-free, human. Helpful guide, not know-it-all expert.  
**Reading Level:** 8th–10th grade for body copy, 6th grade for UI labels.

**Must NOT use:** Revolutionary, game-changing, AI-powered as main benefit, Seamless, effortless, Best-in-class, Leverage, Synergy, all caps for emphasis, exclamation points.

## Design System

**Source of Truth:** Figma file `PAQpnxQZENNwbhmk5qxOjR` — Allura Primitives collection.

### Typography
- **Primary:** Inter (Google Fonts)
- **Fallback:** -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- **Body:** 16px / 1.6 line-height / weight 400
- **Headings:** 600–700 weight, sentence case, max 8 words for H1
- **Corner Radius:** 8–12px

### Colors
| Name | Hex | Usage |
|------|-----|-------|
| Deep Navy | #1A2B4A | Primary brand — trust, depth. Buttons, headers, nav. |
| Coral | #E85A3C | Action — warmth, energy. Primary CTAs, active states. |
| Trust Green | #4CAF50 | Success, growth. Approved status, positive signals. |
| Clarity Blue | #5B8DB8 | Information, calm. Links, info badges, graph nodes. |
| Pure White | #F5F5F5 | Backgrounds, card surfaces, breathing room. |
| Ink Black | #1A1A1A | Primary text, headings. |
| Warm Gray | #737373 | Secondary text, captions, meta info. |

### Semantic Tokens
- **Action Primary:** Coral | **Action Secondary:** Deep Navy | **Action Tertiary:** Trust Green
- **Text Primary:** Ink Black | **Text Secondary:** Warm Gray | **Text Inverted:** Pure White
- **Surface Primary:** Pure White | **Surface Inverted:** Deep Navy
- **Status Success:** Trust Green | **Status Info:** Clarity Blue | **Status Warning:** Coral

### Spacing & Iconography
- **Gutter:** 24px | **Card Gap:** 12px | **Section Padding:** 48px | **Card Padding:** 20px
- **Icons:** Line icons, 2px stroke, rounded caps, 24×24px grid

## Screens to Design

### 1. `/memory` — Memory Dashboard

**Layout:**
- Top: Hero section with Allura logo mark + page title "What your system remembers" + "Add Memory" button (coral)
- Full-width search bar: placeholder "Search memories, topics, or agents..."
- Tabs: Memories | Recently Forgotten | Graph
- Main: Scrollable list of memory cards
- Footer: "Load more" button + results count ("Showing 24 of 156 memories")

**Memory Card:**
```
[Status Badge] [Confidence Bar]
Memory text (plain English, max 2 lines)
Created 2 hours ago · by Scout
[View Source] [Forget]
```

- **Status badges:** Active (trust green) | Forgotten (warm gray) | Pending (clarity blue) | Deprecated (coral)
- **Confidence bar:** Horizontal bar 0–100%. Green if >75%, amber if 50–75%, red if <50%. Label: "Strong" / "Good" / "Needs Review"
- **Hover state:** Pure white background, 2px coral left border, slight lift shadow
- **Low confidence (<50%):** Warning icon + amber bar + tooltip "Confidence below 50%"

**Empty States:**
- No memories: "Nothing saved yet. Add the first memory." with coral CTA
- No search results: "No memories match 'query'. Save it manually?"

**Interactions:**
- Search filters cards in real-time with 100ms debounce
- "View Source" opens provenance drawer (right panel)
- "Forget" moves card to "Recently Forgotten" tab (30-day recovery)

### 2. Provenance Drawer (Right Panel)

**Trigger:** Click "View Source" on any memory card  
**Width:** 400px desktop, full-width stacked on mobile  
**Behavior:** Slides in from right, fixed position

**Header:** Memory text (truncated) + close button

**Sections:**
- **Origin:** Agent avatar + name (e.g., "Scout"), timestamp, workflow ID. Badge: "Auto-captured" or "User-added"
- **Evidence:** Collapsible list of raw trace cards. Each trace shows tool call name, timestamp, snippet of LLM output or tool result. "No traces available" if empty.
- **Actions:** "Promote to Insight" (trust green), "Deprecate" (coral), "Edit" (clarity blue)

**States:**
- Loading: Skeleton loader + "Finding source traces..."
- Ready: Full evidence list
- Empty: "Source not available" with info icon

### 3. `/curator` — Approval Queue

**Layout:**
- Left: List of proposed insight cards
- Right: Selected insight detail
- Bottom: Sticky action bar

**Insight Card:**
```
Summary: [plain English, max 12 words]
Confidence: 87%
Source Traces: 3
[Approve] [Edit] [Reject]
```

- **Approve:** Trust green | **Edit:** Clarity blue | **Reject:** Coral
- **Empty state:** "No insights waiting for review. Check back later." with calm illustration

**Right Panel Detail:**
- Full insight text
- Evidence list
- Confidence breakdown (bar + percentage)
- Source traces with expandable cards

### 4. Graph Tab (`/memory?tab=graph`)

**Layout:** Full-width canvas area. Minimal chrome.

**Graph Spec:**
- **Library:** React Flow style (force-directed), 100 nodes max, 20-node demo dataset
- **Node Types:**
  - Person: Clarity blue circle, user icon
  - Topic: Deep navy rounded rect, tag icon
  - Decision: Trust green diamond, check icon
  - Trace: Warm gray small circle, activity icon
- **Edge Types:**
  - Derived from: Dashed, warm gray
  - Approved by: Solid, trust green
  - Supersedes: Solid, coral, arrowhead target

**Interactions:**
- Mouse drag to pan, scroll to zoom
- Fit-to-view button
- Node click opens memory card in right panel (same as provenance drawer)
- Search filter by node name
- "Show neighborhood" button for dense graphs (>50 nodes visible)

**Empty state:** "No connections to show."

## Writing Guidelines

- **6th grade reading level** for all UI labels
- Short sentences (max 20 words)
- Active voice: "View source" not "Source can be viewed"
- No jargon: "Confidence" not "model score"
- Clear labels: "Recently Forgotten" not "Soft-deleted"

**Good examples:**
- "Search what your system remembers."
- "View Source"
- "Recently Forgotten"
- "Nothing saved yet. Add the first memory."

**Bad examples:**
- "Query the semantic memory index."
- "Inspect provenance traces"
- "Soft-deleted"
- "No data found."

## Technical Notes

- **Data:** Reuse existing `useMemoryList` hook for memory list
- **New Hook:** `useProvenanceDrawer(memoryId)` for drawer data
- **Graph:** React Flow (force-directed), 100 nodes max
- **Responsive:** Mobile-first. Drawer stacks below cards on <768px.
- **Performance:** Infinite scroll, 100ms search debounce, <1s load with 100 memories

## Edge Cases

| Case | Behavior |
|------|----------|
| No memories | Empty state: "Nothing saved yet. Add the first memory." |
| No search results | "No memories match 'query'. Save it manually?" |
| Low confidence (<50%) | Warning badge on card, amber confidence bar, tooltip on hover |
| No provenance | "Source not available" in drawer with info icon |
| Graph too big | "Show neighborhood" button to focus on selected node + 2-hop neighbors |
| Curator queue empty | "No insights waiting for review. Check back later." with calm illustration |

## Acceptance Criteria

- [ ] Memory cards show status + confidence + plain English text + meta + actions
- [ ] Provenance drawer opens on click, shows traces with loading/empty states
- [ ] Curator queue has approve/edit/reject workflow
- [ ] Graph tab renders 20-node demo with pan/zoom/node-click
- [ ] All text passes 6th-grade readability test
- [ ] Loads in <1s with 100 memories
- [ ] Passes mobile responsive test

## Deliverable

Create a **single-file interactive prototype** (HTML/CSS/JS or Figma-ready spec) showing all four screens with:
- Realistic sample data (20+ memory cards, 5+ curator insights, 20-node graph)
- Working tab navigation
- Slide-in provenance drawer
- Hover states and transitions
- Mobile responsive layout

Apply the Allura design system automatically — colors, typography, spacing, and voice — so the output is consistent with the brand.
