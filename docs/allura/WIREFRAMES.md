# Allura — UI Wireframes

> **Design principle:** Hide the machine. The user sees memories, not databases.
> No mention of PostgreSQL, Neo4j, SUPERSEDES, group_id, or MCP in any UI surface.

---

## 1. Memory List (`/memory`)

The default view. Everything the AI knows about the user, in plain language.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⬡ Allura                                          [Sabir ▾]  [⚙]  │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                        │
│  Memory      │  🔍 Search memories...                    [+ Add]     │
│  Search      │                                                        │
│  Settings    │──────────────────────────────────────────────────────│
│              │                                                        │
│              │  ● Sabir prefers dark mode                            │
│              │    Learned 2 hours ago                          [🗑]  │
│              │                                                        │
│              │  ● Allura is a mem0 competitor focused on             │
│              │    sovereign AI memory                                 │
│              │    Learned 1 day ago                            [🗑]  │
│              │                                                        │
│              │  ● Sabir uses Bun, not npm                            │
│              │    Learned 3 days ago                           [🗑]  │
│              │                                                        │
│              │  ● Project stack: Next.js, PostgreSQL, Neo4j          │
│              │    Learned 3 days ago                           [🗑]  │
│              │                                                        │
│              │  ● Sabir works in TypeScript, strict mode             │
│              │    Learned 5 days ago                           [🗑]  │
│              │                                                        │
│              │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│              │  Showing 5 of 24 memories                             │
│              │                                [Load more]            │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

## 2. Memory Search (`/memory?view=search`)

Triggered by typing in the search bar or clicking Search in the sidebar.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⬡ Allura                                          [Sabir ▾]  [⚙]  │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                        │
│  Memory      │  🔍 dark mode                          ✕    [Search] │
│  Search  ←   │                                                        │
│  Settings    │  3 results                                            │
│              │──────────────────────────────────────────────────────│
│              │                                                        │
│              │  ● Sabir prefers dark mode                            │
│              │    Learned 2 hours ago                          [🗑]  │
│              │                                                        │
│              │  ● IDE theme set to dark (VS Code)                    │
│              │    Learned 2 weeks ago                          [🗑]  │
│              │                                                        │
│              │  ● Terminal uses dark Catppuccin theme                │
│              │    Learned 1 month ago                          [🗑]  │
│              │                                                        │
│              │                                                        │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

## 3. Delete Confirmation

Inline — no modal, no page navigation. Confirms destructively in context.

```
┌─────────────────────────────────────────────────────────────────────┐
│              │                                                        │
│              │  ● Sabir prefers dark mode                            │
│              │    Learned 2 hours ago                          [🗑]  │
│              │                                                        │
│              │  ┌─────────────────────────────────────────────────┐ │
│              │  │  Remove this memory?                            │ │
│              │  │  Your AI will no longer know: "Sabir prefers   │ │
│              │  │  dark mode"                                     │ │
│              │  │                                                 │ │
│              │  │              [Cancel]  [Remove memory]          │ │
│              │  └─────────────────────────────────────────────────┘ │
│              │                                                        │
│              │  ● Allura is a mem0 competitor...                     │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

## 4. Add Memory (`+ Add` button)

Simple inline form. One field. No jargon.

```
┌─────────────────────────────────────────────────────────────────────┐
│              │                                                        │
│              │  🔍 Search memories...                    [+ Add]     │
│              │                                                        │
│              │  ┌─────────────────────────────────────────────────┐ │
│              │  │  What should your AI remember?                  │ │
│              │  │                                                 │ │
│              │  │  ┌───────────────────────────────────────────┐ │ │
│              │  │  │ I prefer responses under 200 words        │ │ │
│              │  │  └───────────────────────────────────────────┘ │ │
│              │  │                                                 │ │
│              │  │                    [Cancel]  [Save memory]     │ │
│              │  └─────────────────────────────────────────────────┘ │
│              │                                                        │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

## 5. Empty State (New User)

First-time experience. No jargon. One clear next action.

```
┌─────────────────────────────────────────────────────────────────────┐
│              │                                                        │
│              │  🔍 Search memories...                    [+ Add]     │
│              │                                                        │
│              │                                                        │
│              │              ┌─────────────────────┐                  │
│              │              │                     │                  │
│              │              │       🧠            │                  │
│              │              │                     │                  │
│              │              │  No memories yet    │                  │
│              │              │                     │                  │
│              │              │  Your AI will learn │                  │
│              │              │  as you work with   │                  │
│              │              │  it.                │                  │
│              │              │                     │                  │
│              │              │  [Add first memory] │                  │
│              │              │                     │                  │
│              │              └─────────────────────┘                  │
│              │                                                        │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

## 6. Mobile (`/memory` — narrow viewport)

Sidebar collapses. Memory list goes full width.

```
┌─────────────────────────────┐
│  ☰  ⬡ Allura      [Sabir]  │
├─────────────────────────────┤
│  🔍 Search...       [+ Add] │
├─────────────────────────────┤
│                             │
│  ● Sabir prefers dark mode  │
│    2 hours ago         [🗑] │
│                             │
│  ● Allura is a mem0         │
│    competitor               │
│    1 day ago           [🗑] │
│                             │
│  ● Sabir uses Bun, not npm  │
│    3 days ago          [🗑] │
│                             │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  Showing 3 of 24            │
│           [Load more]       │
└─────────────────────────────┘
```

---

## Design Rules (Implementation Contract)

| Rule | Rationale |
|------|-----------|
| Memory content is the headline — no badges, no labels | Jobs: show the experience, not the machine |
| Timestamp is the only metadata shown | "2 hours ago" is human. "created_at: 2026-04-07T06:30Z" is not |
| One action per memory: delete | Anything else is complexity without purpose |
| Delete confirms inline, not in a new page | Reduces friction; keeps context |
| Search is instant — no "Search" button required | Filters as you type |
| No mention of Postgres, Neo4j, MCP, group_id, SUPERSEDES | The machine is invisible |
| Empty state uses plain English with one CTA | No technical onboarding required |
