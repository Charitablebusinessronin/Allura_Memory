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

*This document was migrated from WIREFRAMES.md (archived 2026-04-08).*
