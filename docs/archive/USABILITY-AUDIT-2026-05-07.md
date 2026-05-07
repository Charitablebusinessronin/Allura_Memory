# Allura Dashboard — Usability Audit Report

**Date:** 2026-05-07
**Auditor:** Brooks Architect (code-level walkthrough)
**Method:** Full component-tree trace of every user-facing page against Usability Test Brief v1.0
**Server:** localhost:3100/dashboard (live, confirmed listening)

---

## Executive Summary

The dashboard has 13 sidebar links, 21 route folders, two competing design systems, and several dead-end pages. A new user landing on `/dashboard` will see a professional-looking overview — but within two clicks, they hit inconsistent buttons, broken navigation links, confusing jargon, and no way to undo any action.

**Verdict:** Tasks 1 and 2 are passable with friction. Task 3 is completable but confusing. Task 4 (undo) is impossible. Task 5 surfaces problems on every page.

---

## Task-by-Task Findings

### Task 1: "Look around and tell me what you think this product does"

**Result: Partial pass with hesitation**

**What works:**
- The hero tagline "Memory that shows its work" is clear and evocative
- The description text explains the core concept: "Review what the Brain knows, what needs curator attention, and which evidence supports every promoted insight"
- Four metric cards give immediate signal (total memories, pending, approved, graph connections)
- Three CTA buttons ("Review insights", "Open evidence", "Explore graph") provide clear next steps

**What fails:**
- The sidebar has **13 items** under one group ("Allura Brain"). No grouping, no hierarchy. A new user sees: Overview, Memories, Memory Explorer, Memory Feed, Graph, Insights, Evidence, Agents, Projects, Decision Records, Insight Builder, System Health, Settings. That's overwhelming for first contact.
- **"Memories" links to `/memory` with `newTab: true` and an ExternalLink icon** — it opens a completely different app/page outside the dashboard. A user clicking "Memories" expecting to see memories inside the dashboard gets ejected. This is the single most confusing navigation element.
- **"Memory Feed" and "Memories"** are different pages with different UIs doing similar things. "Memory Feed" (`/dashboard/feed`) has search + filter + sort + pagination. "Memories" (`/dashboard/memories`) also has search + tabs. A user won't know which one to use.
- **"Memory Explorer"** has a "New" badge but requires Neo4j data to show anything useful. A new user clicking it will likely see an empty graph.
- The **logo** renders `mark-logo.png` (expanded) / `mark-icon-128.png` (collapsed) from `/public/design/`. These are `<img>` tags, not `<Image>` from Next.js — no optimization, no blur placeholder. If the images are missing or slow to load, the header is blank.
- **The user avatar** is a hardcoded "U" circle with "User" and "admin@allura.ai". No real auth integration visible — looks like a placeholder.

**Hesitation points:**
- "What's the difference between Memories, Memory Feed, and Memory Explorer?"
- "What is a 'curator'?"
- "What does 'Evidence' mean in this context?"

---

### Task 2: "You want to see what the system has remembered. Find it."

**Result: Fail — user will click the wrong thing**

**The trap:** The sidebar has three memory-related links:
1. **"Memories"** → `/memory` (opens new tab, different app)
2. **"Memory Explorer"** → `/dashboard/memory-explorer` (graph visualization)
3. **"Memory Feed"** → `/dashboard/feed` (the correct answer)

A user looking for "what the system remembered" will most likely click **"Memories"** first — it's the most obvious label. But this:
- Opens in a new tab (the ExternalLink icon is tiny, easy to miss)
- Takes them to `/memory` which is a consumer-facing memory management page, not the dashboard's memory browser
- Has completely different styling, different header, different navigation
- User is now lost outside the dashboard context

If they come back and try **"Memory Explorer"**, they get a force-graph visualization that requires Neo4j data. If the graph is empty, they see "No graph data available" — another dead end.

Only **"Memory Feed"** (third in the list) actually shows searchable memories in the dashboard context.

**Additionally:** The overview page's "Needs Review" section shows pending insights, not memories. There's no "View all memories" link on the overview page itself. The three CTA buttons go to Insights, Evidence, and Graph — none go to memories.

---

### Task 3: "Something is waiting for your review. Find it and make a decision."

**Result: Completable but confusing**

**The happy path exists:** Overview → "Needs Review" section shows pending insights → each has a "Review" button → links to `/dashboard/insights?promote=<id>` → Insights page has Approve/Revise/Reject buttons.

**Problems found:**

1. **The "Revise" button does nothing.** In `InsightActions.tsx:24`, the Revise button has no `onClick` handler:
   ```tsx
   <Button size="sm" variant="outline" disabled={busy}>
     Revise
   </Button>
   ```
   It renders, it's not disabled by default, but clicking it does absolutely nothing. No feedback, no error, no indication it's a placeholder. This is a **critical** usability failure — the button lies.

2. **The Approve button uses the `default` variant** (dark/primary shadcn style), not `variant="primary"` (Allura blue). It visually reads as the most important action but doesn't match the blue brand. The Reject button uses `variant="destructive"` which is a soft red — appropriate but inconsistent with the overview page's "Review" button which uses `variant="primary"` (blue).

3. **No confirmation dialog for approve or reject.** Both `approve()` and `reject()` fire immediately on click. No "Are you sure?" for an irreversible action. The test brief specifically asks about undo (Task 4) — there is none.

4. **"Curator" page exists at `/dashboard/curator` but isn't in the sidebar.** It duplicates the Insights page's pending queue with slightly different layout (adds stat cards for Pending count, Data Source, Policy). A user who somehow finds it sees the same data presented differently.

5. **Insight Builder** (`/dashboard/builder`) is in the sidebar but is a compose form — a user looking for "review" might click it thinking it's where you review things. The label "Insight Builder" is ambiguous.

6. **After approval/rejection, the card just disappears** from the list (refresh). No success toast, no "Approved!" confirmation, no animation. The user has to trust that the action worked because the card is gone.

---

### Task 4: "You made a mistake. Try to undo or go back."

**Result: Complete fail — undo is impossible**

- There is **no undo mechanism** anywhere in the dashboard
- `approveProposal()` and `rejectProposal()` are one-way API calls with no rollback
- The Insights page has tabs (Queue / Approved / Rejected / Superseded) so you can SEE what was approved or rejected, but there's no action to reverse it
- No confirmation dialogs prevent accidental clicks
- The evidence detail page has a "Back to Memory Feed" button (line 237) that says "Back to Memory Feed" but actually navigates to `/dashboard/evidence` — **the label is wrong**
- Browser back works but there's no in-app navigation breadcrumb
- The Rejected tab shows rejected insights but offers no "Restore" or "Re-queue" action

---

### Task 5: "Find something you don't understand"

**Result: Every page has at least one confusing element**

**Labels users won't understand:**
| Label | Where | Problem |
|---|---|---|
| "Curator" | Overview, Insights | Domain jargon — what's a curator? |
| "HITL Required" | Curator page | Acronym — Human In The Loop, but not explained |
| "Evidence" | Sidebar, pages | Sounds legal/forensic. It's really "raw data / traces" |
| "Superseded" | Insights tabs, Decisions | Technical versioning term. Users will think "deleted" |
| "Decision Records" | Sidebar | Sounds like a settings page, it's actually ADR history |
| "Insight Builder" | Sidebar | Ambiguous — build what? A review? A new insight? |
| "group_id" / "agent_id" | Various metadata displays | Internal identifiers exposed to users |
| "Trace" | Evidence detail tabs | Developer term, not user term |
| "INSIGHT CANDIDATE" | InsightCard badge | What makes something a "candidate" vs an "insight"? |
| "tone-green-bg" | N/A (CSS only) | Not user-facing, but shows up in class names |

**Buttons that confuse:**
| Button | Where | Problem |
|---|---|---|
| **Revise** | Insights page | Does nothing — no handler, no feedback |
| **Manage Agents** | Agents page | Uses `agency-btn primary` CSS class, not `<Button>` component — may have different hover/focus behavior |
| **View Graph / View Evidence** | Agent cards | Uses `agency-btn secondary` / `agency-btn ghost` CSS classes — no actual navigation `href`, they're `<button>` elements with no `onClick` |
| **"Memories" sidebar link** | Sidebar | Opens new tab to different app without clear indication |
| **Filter pill buttons** | Graph page | `<button>` elements with inline styles, not `<Button>` component — inconsistent interaction patterns |
| **Zoom controls (+, −, ⟲)** | Graph page | Unicode characters as button labels, no ARIA labels |

**Pages that are dead-ends or confusing for new users:**
| Page | Problem |
|---|---|
| `/dashboard/memory-explorer` | Empty without Neo4j data |
| `/dashboard/graph` | Empty without Neo4j data |
| `/dashboard/projects` | Empty without project-type nodes in Neo4j |
| `/dashboard/agents` | Empty without agent-type nodes in Neo4j |
| `/dashboard/skills` | Shows "0" for everything if no skill metrics exist |
| `/dashboard/builder` | Compose form with no guidance on what to compose |
| `/dashboard/traces` | Exists as route but not in sidebar navigation |
| `/dashboard/audit` | Exists as route but not in sidebar navigation |

---

## Top 3 Things Users Could Not Do

1. **Find memories without getting lost.** Three memory-related links, one ejects you from the dashboard, none are clearly labeled as "the place to see what the system remembers."

2. **Undo any action.** No confirmation dialogs, no undo buttons, no restore functionality. Every approve/reject is permanent and immediate.

3. **Understand what buttons do before clicking.** The Revise button does nothing. Agent card buttons do nothing. The Memories link ejects you. Filter pills look like tags, not buttons.

---

## Every Button That Got a Confused or Wrong Click

| # | Button | Location | Expected Behavior | Actual Behavior | Severity |
|---|---|---|---|---|---|
| 1 | **Revise** | Insights page | Opens revision interface | Nothing happens | **Critical** |
| 2 | **Memories** (sidebar) | Sidebar | Opens memories in dashboard | Opens new tab to different app | **Critical** |
| 3 | **View Graph** | Agent card | Navigates to agent's graph view | Nothing — no onClick/href | **Critical** |
| 4 | **View Evidence** | Agent card | Navigates to agent's evidence | Nothing — no onClick/href | **Critical** |
| 5 | **Manage Agents** | Agents page header | Opens agent management | Nothing — no onClick/href | **Medium** |
| 6 | **Approve** | Insights page | Confirms before approving | Immediately approves, no confirmation | **Medium** |
| 7 | **Reject** | Insights page | Confirms before rejecting | Immediately rejects, no confirmation | **Medium** |
| 8 | **"Back to Memory Feed"** | Evidence detail | Goes to memory feed | Goes to `/dashboard/evidence` | **Low** |

---

## Every Label That Was Misunderstood

| # | Label | Where | What Users Think | What It Actually Means |
|---|---|---|---|---|
| 1 | Memories vs Memory Feed | Sidebar | Same thing | Different pages, different apps |
| 2 | Curator | Multiple pages | A person? A role? | Automated scoring pipeline |
| 3 | Evidence | Sidebar + pages | Legal documents | Raw traces and API call logs |
| 4 | HITL Required | Curator page | Unknown acronym | Human-In-The-Loop approval needed |
| 5 | Superseded | Insight/Decision tabs | Deleted/removed | Replaced by newer version |
| 6 | Insight Builder | Sidebar | Review tool | Compose/create new insight proposals |
| 7 | Decision Records | Sidebar | Settings or preferences | Architecture Decision Records (ADRs) |
| 8 | INSIGHT CANDIDATE | InsightCard badge | Not clear distinction | Pending proposal, not yet approved |

---

## Recommended Fixes — Ranked by Severity

### Critical (Must Fix Before Any User Testing)

| # | Fix | What | Files |
|---|---|---|---|
| C1 | **Remove or wire the Revise button** | Either add an onClick handler that opens a revision dialog, or remove the button entirely. A non-functional button in a review flow is the worst possible UX. | `src/components/dashboard/InsightActions.tsx:24` |
| C2 | **Fix "Memories" sidebar link** | Change from `/memory` (external) to `/dashboard/feed` or `/dashboard/memories`. Remove `newTab: true` and `ExternalLink` icon. Users should not leave the dashboard to find memories. | `src/navigation/sidebar/sidebar-items.ts:35` |
| C3 | **Wire agent card buttons** | "View Graph" and "View Evidence" on AgentCards are `<button>` with no handler. Either make them `<Link>` elements to the graph/evidence pages filtered by agent, or remove them. | `src/app/(main)/dashboard/agents/page.tsx:134-135` |
| C4 | **Add confirmation dialogs for approve/reject** | Add an "Are you sure?" dialog before calling `approveProposal()` / `rejectProposal()`. These are irreversible actions. | `src/app/(main)/dashboard/insights/page.tsx`, `InsightActions.tsx` |
| C5 | **Add success feedback after approve/reject** | Show a toast notification ("Insight approved" / "Insight rejected") after successful action. Currently the card silently disappears. | `src/app/(main)/dashboard/insights/page.tsx:26-36` |

### Medium (Fix Before User Testing)

| # | Fix | What | Files |
|---|---|---|---|
| M1 | **Consolidate memory pages** | Remove one of "Memory Feed" / "Memories" from sidebar. Keep one canonical memory browsing page inside the dashboard. | `sidebar-items.ts`, potentially remove `/dashboard/memories/page.tsx` |
| M2 | **Group sidebar items** | Split 13 items into 2-3 groups: "Browse" (Overview, Memories, Graph), "Review" (Insights, Evidence, Curator), "System" (Agents, Projects, Health, Settings). | `sidebar-items.ts` |
| M3 | **Add "Curator" to sidebar** | The Curator page exists but has no sidebar link. Either add it or redirect `/dashboard/curator` to `/dashboard/insights` (they overlap heavily). | `sidebar-items.ts` |
| M4 | **Fix "Back to Memory Feed" label** | Evidence detail back button says "Back to Memory Feed" but navigates to `/dashboard/evidence`. Change label to "Back to Evidence". | `src/app/(main)/dashboard/evidence/[id]/page.tsx:237` |
| M5 | **Replace `agency-btn` with `<Button>`** | Agents page, Skills page, and Decisions page use raw CSS class buttons instead of the `<Button>` component. This causes inconsistent hover/focus/active states. | `agents/page.tsx:134-135`, `agents/page.tsx:164`, `skills/page.tsx:287` |
| M6 | **Remove hidden routes from nav or add them** | `/dashboard/traces`, `/dashboard/audit`, `/dashboard/curator` exist as routes but aren't in sidebar. Either add nav links or remove the routes. | `sidebar-items.ts` + route folders |

### Low (Fix Before Launch)

| # | Fix | What | Files |
|---|---|---|---|
| L1 | **Replace jargon labels** | "Curator" → "Review Queue", "Evidence" → "Raw Data" or "Traces", "HITL" → "Requires Approval", "Superseded" → "Replaced" | Multiple pages |
| L2 | **Use Next.js `<Image>` for logo** | Replace `<img src=...>` with `<Image>` for optimization and blur placeholder. | `app-sidebar.tsx:33-48` |
| L3 | **Add ARIA labels to graph zoom controls** | +, −, ⟲ buttons have `title` but no `aria-label`. | `graph/page.tsx:209-211` |
| L4 | **Add loading/empty guidance to graph-dependent pages** | Graph, Projects, Agents, Memory Explorer all show generic empty states when Neo4j has no data. Add guidance: "Connect your Neo4j database" or "Add some memories first." | Multiple pages |
| L5 | **Standardize hero sections** | Overview uses a 44px hero with tagline. Skills uses a different hero pattern. Other pages use `PageHeader` component. Pick one pattern. | Multiple pages |
| L6 | **Remove hardcoded user avatar** | "U" / "User" / "admin@allura.ai" is a placeholder. Either integrate with auth or remove the avatar entirely. | `app-sidebar.tsx:131-140`, `top-nav-bar.tsx:52-58` |

---

## Design System Inconsistency Summary

Two parallel styling systems are in use:

| System | Used By | Component Style |
|---|---|---|
| **`<Button>` component** (cva variants) | Overview, Insights, Evidence detail, Memory Feed | Consistent hover/focus/active, proper variants |
| **`agency-btn` / `agency-card` CSS classes** | Agents, Skills, Decisions, Overview "Needs Review" | Raw CSS, no component abstraction, missing interaction states |

These need to converge. The `<Button>` component is the canonical system. All `agency-btn` usage should be migrated.

---

## Passing Criteria Assessment

| Criterion | Status |
|---|---|
| User completes Tasks 1-3 without asking for help | **Fail** — Task 2 will send them to wrong page |
| No button click goes without visible feedback | **Fail** — Revise button, agent card buttons, approve/reject all lack feedback |
| User can describe what the product does after Task 1 | **Partial** — the tagline helps, but 13 nav items overwhelm |
| Branding looks consistent and professional throughout | **Fail** — two design systems, inconsistent button styles, placeholder avatar |
