# Design Specification: Allura Memory UI

> **Design principle (Sarah's Law):** If an 18-year-old intern has questions after two minutes, it's not done.
> iPhone clean means one thing on screen. You do it. You learn. No reading required.

---

## Design Decisions (Debate Outcomes)

| Decision | Source | Rationale |
|---|---|---|
| No sidebar — memory is the only screen | Jobs + Sarah | Navigation for one thing is noise |
| Search dominant, full width | Jobs + Brooks | The action that matters most owns the most space |
| Swipe to delete — no visible trash icon | Sarah | Trash icon sitting there makes you feel like you should be deleting things |
| Memory provenance on expand | Sarah | "How did it learn this?" is a real question. Answer it on demand, not by default |
| Undo / recently deleted | Sarah | Fat-finger on mobile is real. Append-only Postgres makes this free |
| Zero search results state | Sarah | Empty ≠ wrong. Two different states, two different messages |
| Memory usage indicator | Sarah | "Is my AI actually using this?" — show it |
| First-run onboarding by doing | Sarah | iPhone teaches by doing. Not by reading |
| Enterprise admin view separate | User | Two personas. Two doors. Same machine |
| Mental model: Postgres = truth, Neo4j = speed | Wozniak | Stop saying "dual-database" like it's a feature |
| "Forget" on delete button | Jobs (Brooks dissents) | The machine forgets. Use that word |
| "Your AI's notebook" framing | Sarah (13-16-18 review) | Consumer mental model: personal, curated, intimate — not database |
| No technical inputs in consumer view | Sarah (13-16-18 review) | `group_id` and `user_id` are developer concepts. Hide them. |
| "Add a thought" not "Add manually" | Maya (16) | Manual sounds like work. Thought sounds like contribution. |
| Youth culture validation required | Steve | 13-16-18 framework: if they don't get it, it's not ready |

---

## Visual Identity

Brand source of truth: `docs/branding/deliverables/06_allura-memory_brand-truth.json` · Figma: `PAQpnxQZENNwbhmk5qxOjR`

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Deep Navy | `#1A2B4A` | Primary brand, headings, nav |
| Coral | `#E85A3C` | CTA, action, accents |
| Trust Green | `#4CAF50` | Success states |
| Clarity Blue | `#5B8DB8` | Info, secondary actions |
| Pure White | `#F5F5F5` | Backgrounds (primary) |
| Ink Black | `#1A1A1A` | Body text |
| Warm Gray | `#737373` | Secondary text, captions |

**Usage ratio:** 55% Pure White · 20% Ink Black · 15% Deep Navy · 7% Coral · 3% status colors

**Forbidden pairings (WCAG fail):** Coral on White (1.3:1) · White on Coral (1.3:1)

### Typography

| Role | Typeface | Weight | Size |
|------|----------|--------|------|
| Display / Hero | Outfit | 700 | 96px (never below 20px) |
| Section headings | Outfit | 700 | 56px |
| Headings H1–H4 | Inter | 600–700 | 48px → 24px |
| Body | Inter | 400 | 16–18px |
| Caption / Overline | Inter | 400–600 | 12–14px |

Fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

**Rules:** Left-aligned headings · Never justified · Never all-caps · Max 75 chars/line · 1.5× line-height

### Shadow System (3-layer editorial)

| Level | Value |
|-------|-------|
| Card | `0 4px 20px -4px rgba(20,35,41,0.08), 0 8px 16px -4px rgba(20,35,41,0.12)` |
| Hover | `0 6px 24px -4px rgba(20,35,41,0.12), 0 12px 20px -4px rgba(20,35,41,0.16)` |
| Modal | Card + `0 2px 4px 0 rgba(20,35,41,0.16)` |

### Spacing & Radius

Scale: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128px`  
Default card radius: `16px` · Min touch target: `48px`

### Iconography

Rounded soft style · 2px stroke weight · 24px default / 20px dense UI  
10 brand SVG icons: `docs/branding/assets/icons/`

---

## Consumer View

### 1. Memory List — Default (`/memory`)

No sidebar. Search owns the top. Memories fill the rest.
Swipe left on mobile to reveal delete. No trash icon in resting state.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⬡ Allura                                               [Sabir ▾]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  🔍  Search your memories...                                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                    Add manually ＋   │
│─────────────────────────────────────────────────────────────────────│
│                                                                       │
│  Sabir prefers dark mode                                             │
│  2 hours ago · from conversation                                     │
│                                                                       │
│  Allura is a mem0 competitor focused on sovereign AI memory          │
│  1 day ago · added manually                                          │
│                                                                       │
│  Sabir uses Bun, not npm                                             │
│  3 days ago · from conversation                                      │
│                                                                       │
│  Project stack: Next.js, PostgreSQL, Neo4j                           │
│  3 days ago · from conversation                                      │
│                                                                       │
│  Sabir works in TypeScript, strict mode                              │
│  5 days ago · from conversation                                      │
│                                                                       │
│─────────────────────────────────────────────────────────────────────│
│  24 memories                                              Load more  │
└─────────────────────────────────────────────────────────────────────┘
```

**Notes:**
- Source ("from conversation" / "added manually") is always visible — answers Sarah's "how did it learn this?"
- No badge, no icon, no type label. Memory text is the headline.
- Swipe left → reveals [Forget] button (mobile). Hover → reveals [Forget] link (desktop).

---

### 2. Memory Expanded — Provenance

Tap/click a memory to see where it came from. One tap. No new page.

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Sabir prefers dark mode                                    │    │
│  │  2 hours ago · from conversation                            │    │
│  │                                                             │    │
│  │  ────────────────────────────────────────────────────────  │    │
│  │  Your AI learned this during a conversation about IDE       │    │
│  │  settings on Apr 7, 2026 at 6:30am.                        │    │
│  │                                                             │    │
│  │  Used 3 times this week                                     │    │
│  │                                                [Forget]     │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  Allura is a mem0 competitor...                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Notes:**
- "Used 3 times this week" answers Sarah's "is my AI actually using this?"
- [Forget] only appears expanded — not in the resting list
- Plain English provenance — no event IDs, no timestamps in ISO format

---

### 3. Search — Results (`/memory?q=dark+mode`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⬡ Allura                                               [Sabir ▾]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  🔍  dark mode                                           ✕  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                    Add manually ＋   │
│─────────────────────────────────────────────────────────────────────│
│  3 memories                                                          │
│                                                                       │
│  Sabir prefers dark mode                                             │
│  2 hours ago · from conversation                                     │
│                                                                       │
│  IDE theme set to dark (VS Code)                                     │
│  2 weeks ago · from conversation                                     │
│                                                                       │
│  Terminal uses dark Catppuccin theme                                 │
│  1 month ago · from conversation                                     │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4. Search — No Results

Two cases. Two different messages. Not the same empty state.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  🔍  quarterly reports                                   ✕  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│─────────────────────────────────────────────────────────────────────│
│                                                                       │
│              Your AI hasn't learned anything about                   │
│              "quarterly reports" yet.                                │
│                                                                       │
│              Try: "reports", "finance", or "work"                   │
│                                                                       │
│                        [Add this manually]                           │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

*Case 2 — no memories at all yet (new user searched before AI learned anything):*
```
│              Your AI is still learning.                              │
│              Start a conversation and it will                        │
│              remember things for next time.                          │
```

---

### 5. Delete — Swipe / Hover Reveal

Desktop hover state on a memory row:

```
│  Sabir prefers dark mode                              [Forget]      │
│  2 hours ago · from conversation                                     │
```

Mobile swipe-left reveals:

```
┌──────────────────────────────────────┬─────────────┐
│  Sabir prefers dark mode             │   Forget    │
│  2 hours ago · from conversation     │  (red bg)   │
└──────────────────────────────────────┴─────────────┘
```

Tap [Forget] → inline confirmation:

```
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Your AI will forget: "Sabir prefers dark mode"          │      │
│  │                                                          │      │
│  │                          [Cancel]  [Forget]              │      │
│  └──────────────────────────────────────────────────────────┘      │
```

---

### 6. Recently Forgotten (`/memory?view=forgotten`)

Accessible from Settings. Answers "I deleted something by accident."

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back                                                              │
│  Recently forgotten                                                  │
│─────────────────────────────────────────────────────────────────────│
│                                                                       │
│  Sabir prefers dark mode                                             │
│  Forgotten 5 minutes ago                              [Restore]     │
│                                                                       │
│  IDE theme set to dark                                               │
│  Forgotten 2 days ago                                 [Restore]     │
│                                                                       │
│─────────────────────────────────────────────────────────────────────│
│  Forgotten memories are removed after 30 days.                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 7. Add Manually

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back                                                              │
│                                                                       │
│  What should your AI remember?                                       │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                                                             │    │
│  │  I prefer responses under 200 words                        │    │
│  │                                                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│                                              [Cancel]  [Save]       │
│                                                                       │
│  Your AI will start using this immediately.                          │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 8. First Run — Empty State

No text instructions. One button. It teaches by doing.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⬡ Allura                                               [Sabir ▾]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  🔍  Search your memories...                                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│                                                                       │
│                         🧠                                           │
│                                                                       │
│              Your AI is ready to learn.                              │
│                                                                       │
│              Just talk to it. It will remember                       │
│              things about you automatically.                         │
│                                                                       │
│                    [See how it works →]                              │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 9. Mobile

```
┌─────────────────────────┐
│  ⬡ Allura    [Sabir ▾]  │
├─────────────────────────┤
│  🔍 Search...           │
├─────────────────────────┤
│                         │
│  Sabir prefers          │
│  dark mode              │
│  2h · from conversation │
│                         │
│  Allura is a mem0       │
│  competitor             │
│  1d · added manually    │
│                         │
│  Sabir uses Bun         │
│  3d · from conversation │
│                         │
│─────────────────────────│
│  24 memories            │
└─────────────────────────┘
```

← swipe any row to forget

---

## Enterprise Admin View

### 10. Tenant Overview (`/admin`)

Operator sees all users, all memories, all decisions.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⬡ Allura Admin                              [allura-myproject ▾]  │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                        │
│  Overview    │  Memories       Audit Log      Pending      Users     │
│  Audit Log   │──────────────────────────────────────────────────────│
│  Pending     │                                                        │
│  Users       │  247 memories across 12 users                        │
│  Settings    │  3 pending review (SOC2 mode)                        │
│              │  Last activity: 2 hours ago                           │
│              │                                                        │
│              │  ┌────────────────────────────────────────────────┐  │
│              │  │ User          Memories   Last active           │  │
│              │  │────────────────────────────────────────────── │  │
│              │  │ sabir@...         24     2 hours ago           │  │
│              │  │ roger@...         18     1 day ago             │  │
│              │  │ team@...          12     3 days ago            │  │
│              │  └────────────────────────────────────────────────┘  │
│              │                                                        │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

### 11. Pending Approval Queue (`/admin/pending`)

SOC2 mode. Human reviews before memory is promoted.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Overview                                                          │
│  3 memories waiting for review                                       │
│─────────────────────────────────────────────────────────────────────│
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  sabir@... · 2 hours ago · confidence: high                 │    │
│  │                                                             │    │
│  │  "Sabir prefers responses under 200 words"                  │    │
│  │  Learned during: conversation about documentation style     │    │
│  │                                                             │    │
│  │                              [Dismiss]  [Approve →]         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  roger@... · 1 day ago · confidence: medium                 │    │
│  │                                                             │    │
│  │  "Roger prefers PRs under 400 lines"                       │    │
│  │  Learned during: code review session                        │    │
│  │                                                             │    │
│  │                              [Dismiss]  [Approve →]         │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 12. Audit Log (`/admin/audit`)

Every write. Every approval. Every deletion. Exportable.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Overview                  🔍 Filter...              [Export CSV] │
│  Audit Log                                                           │
│─────────────────────────────────────────────────────────────────────│
│                                                                       │
│  Apr 7, 2026                                                         │
│  ───────────────────────────────────────────────────────────────    │
│  6:30am  sabir@...  Memory learned   "prefers dark mode"            │
│  6:31am  sabir@...  Memory approved  "prefers dark mode"   [admin]  │
│  8:15am  roger@...  Memory learned   "prefers short PRs"            │
│  8:15am  system     Pending review   "prefers short PRs"            │
│  2:00pm  sabir@...  Memory forgotten "quarterly reports"            │
│                                                                       │
│  Apr 6, 2026                                                         │
│  ───────────────────────────────────────────────────────────────    │
│  9:00am  sabir@...  Memory learned   "uses Bun not npm"             │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Updated Design Rules

| Rule | Who | Rationale |
|------|-----|-----------|
| No sidebar on consumer view | Jobs + Sarah | Navigation for one screen is noise |
| Search full width, always visible | Jobs + Brooks | The dominant action owns the space |
| Trash icon hidden until hover/swipe | Sarah | Resting state should not feel destructive |
| Memory provenance always shown ("from conversation") | Sarah | Answers "how did it learn this?" without asking |
| "Used N times this week" on expand | Sarah | Answers "is my AI using this?" |
| Zero search results: two distinct states | Sarah | Empty ≠ wrong. Different message for each |
| Undo via Recently Forgotten | Sarah | Append-only Postgres makes this free |
| First-run teaches by doing, not reading | Sarah | iPhone principle |
| [Forget] not [Delete] / [Remove] | Jobs | The machine forgets. Use that word |
| Enterprise admin is a separate view | User | Two personas, two doors, same machine |
| Audit log is plain English, exportable | Enterprise | Compliance needs a paper trail in human language |
| Mental model: "your AI remembers" not "Neo4j node" | All | The machine is always invisible |

---

## Canonical Memory API Contracts (merged)

This section is the canonical interface contract for the 5 memory operations. It replaces the standalone `INTERFACE-CONTRACTS.md` artifact.

### Operations

| Operation | Route | Contract Summary |
|---|---|---|
| `memory_add` | `POST /api/memory` | Requires `group_id`, `user_id`, `content`; writes append-only PostgreSQL event; optionally promotes based on mode + threshold |
| `memory_list` | `GET /api/memory` | Lists memories scoped by tenant and optional user filter; supports pagination |
| `memory_search` | `GET /api/memory/search` | Federated search with tenant/user scoping and relevance ordering |
| `memory_get` | `GET /api/memory/[id]` | Fetches one memory by id with tenant scope; may include version history |
| `memory_delete` | `DELETE /api/memory/[id]` | Soft-delete behavior only; append event + semantic deprecation |

### Required request invariants

1. `group_id` is required and must match `^allura-`
2. PostgreSQL traces are append-only (no UPDATE/DELETE mutations)
3. Memory identifiers are UUID values
4. Score range is constrained to `0.0..1.0`
5. Default promotion threshold is `0.85` unless explicitly overridden

### Mode-specific behavior

| Mode | Behavior |
|---|---|
| `auto` | Score >= threshold promotes immediately to Neo4j (after dedup); response can return `stored: 'both'` |
| `soc2` | Score >= threshold creates proposal and waits for human approval; response remains episodic with pending review |

### Error contract

| Status | Condition |
|---|---|
| 400 | Missing/invalid `group_id`, missing required payload fields |
| 404 | Memory id not found in tenant scope |
| 500 | Unexpected server failure |

### Governance contract

- Any interface change must update: contract tables, implementation routes, and validation artifacts in the same PR.
- No standalone ADR file is created in `docs/allura/`; decision records are captured in `RISKS-AND-DECISIONS.md`.

---

*This document was migrated from WIREFRAMES.md (archived 2026-04-08).*
