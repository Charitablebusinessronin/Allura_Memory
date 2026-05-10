# How to Make Your Notion Hub + NextJS Dashboard Symphony-Grade

## What Symphony Actually Is

> Symphony turns project work into isolated, autonomous implementation runs, allowing teams to **manage work instead of supervising coding agents**.

In the demo, Symphony monitors a Linear/Kanban board for work items, spawns agents to handle them, agents complete tasks and provide proof-of-work, and when accepted the agents land the PR. Engineers do not supervise Codex; they manage work at a higher level.

**Key insight:** Symphony is not a memory dashboard. It's an **agent-orchestrated Kanban board** where work items flow through states and agents pick them up.

---

## Your Notion Hub — Current State

### What You Have
- A "Ronin Vibe coding Dashboard" linking Projects | Tasks | Recent | GitHub Repos | Prompts | Skills | Plugins | Frameworks | Agent Prompts | Knowledge Hub | BROOKS_ARCHITECT
- A **Projects** mini-view showing: `carlos-ram-openagent` (25%), `SENTINEL HACCP` (25%), `All-Microsoft Mortgage Approval Engine` (25%), `Allura memory` (0%)
- **In Progress** and **Current Tasks** sections (Current Tasks is empty)
- An **Agent Knowledge (Approved)** database — *massive* with 20+ fields (Topic, Category, Complexity Level, Confidence, Content, Core Structure, Created, Input Model, Knowledge Rules, Last Synced, Neo4j ID, PostgreSQL Trace ID, Purpose, Source, Status, Tags, Type, group_id)
- Risk & Decision entries (RK-01 to RK-06, AD-01 to AD-07, ADR-002)
- Architecture/Pattern entries (Brooksian Surgical Team, Dual-Database Memory, etc.)
- Template entries (Brand Guidelines, Content Strategy, etc.)
- GitHub Repos database (appears empty in current view)
- Actions row: New Project | New Skill | New Plugin | New Prompt | New Framework (creation buttons)

### What's Wrong for Agent Kanban
1. **No visible status columns.** Your Projects DB shows "25%" across the board with no state. Agents can't see what's available to pick up.
2. **No queue.** There's no "Ready" or "Backlog" column. Current Tasks is empty.
3. **Everything stuck at 25%.** No one moved a card to "In Review" or "Done" — because there's no board.
4. **No agent assignment on cards.** The Knowledge Hub database has an "Owner" column, but your Projects view doesn't show who's working on what.
5. **No proof-of-work fields.** Agents finish a task but there's nowhere to attach CI status, PR link, walkthrough video, or complexity analysis.
6. **Actions are creation buttons, not workflow actions.** "New Project" is not a card — it's a blank page. No "Start Task", "Submit for Review", or "Accept/Reject" action exists.
7. **Dense as a thicket.** Your Dashboard tries to surface *everything* (Risks, Decisions, Patterns, Architecture docs) on one page. For a Kanban, you want only *work in motion* visible.

---

## Your NextJS Dashboard (localhost:6420) — Current State

### What You Have
- Top nav: Dashboard | Memory | Graph | Logs | Provenance | Extracted | Agents | Approvals | Settings
- Dashboard shows **memory telemetry**:
  - 4 memory layers: Identity(125) → Working(1,108) → Semantic(2,901) → Episodic(8,214)
  - 12,348 total memories, +8.4% captures this month
  - 96.6% extracted, 96.6% recall hit-rate
  - Curator queue: 95 proposals awaiting review
  - Graph density: 0.41 edges/node
  - Recent extractions (Alex Chen preference/identity, Sam Reyes pattern, Q3 Roadmap fact)
- Agents: 4 online (allura-core Capture, allura-curator Curation, allura-graph Connection, allura-recall Activation) with status % and latency ms
- **Approvals** tab exists but isn't the main view

### What's Wrong for Agent Kanban
1. **It's a memory monitor, not a work board.** You can see what agents *remember*, but you can't see what they're *doing*.
2. **No Kanban columns at all.** Memory | Graph | Logs | Provenance | Extracted are data views. There is no visible board with "Backlog → Ready → In Progress → Review → Done".
3. **Agents just show "online" — not what task they're on.** `allura-core Capture · 96.6% · 142ms` tells you health, not work assignment.
4. **"Curator queue: 95 proposals" is the closest thing to a queue, but it's curation, not execution work.** Curators approve memory promotions. That's not where agents pull coding tasks from.
5. **No "Start Task" button** visible from the dashboard for an agent.
6. **No work-item detail view.** No card you can click to see: description, acceptance criteria, assigned agent, proof of work.
7. **Missing the "Proof of Work" panel.** In Symphony, agents attach CI status, PR link, complexity analysis, walkthrough video. You have nothing like that.

---

## The Gap in Plain English

| | Symphony | Your Notion Hub | Your NextJS Dashboard |
|---|---|---|---|
| **What it shows** | Work items flowing through columns | A dense dashboard linking everything | Memory layers and agent health |
| **How agents find work** | Pull from "Ready" column on a Kanban | They can't — no visible queue | They can't — no board at all |
| **How agents report progress** | Move card → attach proof (CI, PR, video) | No card to move. No proof fields. | No card. No proof UI. |
| **How humans know what's happening** | See who's on what card on the board | Check individual pages manually | See agent heartbeat/status % |
| **How work gets completed** | Human reviews "Review" column, accepts/rejects | No review column exists | Approvals tab is separate |
| **Density** | Clean. Only work-in-motion visible. | Too dense — every doc is surfaced | Dense telemetry, zero work flow |

---

## What "Kanban for Agents" Actually Means

A Symphony-style agent Kanban is defined by these properties:

1. **A visual board with columns.** The columns represent stages of the work lifecycle. The simplest form: Backlog | Ready | In Progress | Review | Done.
2. **Cards as work items.** Each card has: title, description, acceptance criteria, difficulty estimate, assigned agent, and a history of actions.
3. **Agents pull from the board.** When an agent is idle, it looks at the "Ready" column and claims a card. It then moves it to "In Progress".
4. **Agents update as they go.** As work progresses, the agent adds to the card: test results, PR link, complexity analysis, walkthrough video, and a summary of changes.
5. **Cards advance automatically or semi-automatically.** Passing tests might move a card to "Review". Failed CI might move it back to "In Progress".
6. **Humans review the "Review" column.** They see the proof-of-work attached, and click "Accept" or "Reject". Accepted cards move to "Done"; rejected goes back to "In Progress" with feedback.
7. **The board is the single view for the whole team.** Engineers, PMs, and agents all look at the same surface. No separate dashboards.

---

## Recommended Changes

### A) Fix Your Notion Hub

#### 1. Add a Kanban View to the "Projects" database

- Change the "Projects" view from list/table to **Kanban**.
- Group by a **Status** property: Backlog | Ready | In Progress | Review/Proof | Done.
- Currently everything shows 25% — that's because Status is "In Progress" for everything. Split the board:
  - **Backlog** → Allura memory (before planning)
  - **Ready** → carlos-ram-openagent, SENTINEL HACCP, Mortgage Engine (these have a spec and are unblocked)
  - **In Progress** → what an agent is currently working on (this should be zero or one per agent)
  - **Review** → agent completed and attached proof; waiting for human review
  - **Done** → accepted and deployed

#### 2. Add Card Properties Agents Can Read and Write

Add these columns to the Projects database:

| Property | Type | Use |
|---|---|---|
| Status | Select (the Kanban columns) | The board grouping |
| Priority | Select (P0/P1/P2) | Determines what goes to Ready first |
| Assignee | Person (or a "Agent" relation) | Which agent is working on it |
| Acceptance Criteria | Text or Rich Text | What done looks like |
| Difficulty Estimate | Select (Trivial/Small/Medium/Large/XL/Codex-only) | Helps agents self-select suitable work |
| Linked PR | URL | Agent fills this when done |
| CI Status | Select (Passing/Failing/Running/Not Started) | Agent updates from tests |
| Complexity Analysis | Text | Agent's own assessment |
| Walkthrough | File or URL | Agent records a Loom/video |
| Proof of Work | Rich Text | Summary of what changed, screenshots |
| Reviewer | Person | Human assigned to review |
| Review Decision | Select (Pending/Approved/Rejected) | Human reviews |
| Rejection Reason | Text | Why it was sent back |

#### 3. Create a Separate "Work Board" Page, Not Everything on the Dashboard

Your current Ronin Vibe coding Dashboard mixes:
- Active work
- Knowledge base
- Architecture docs
- Risk register
- Templates

**Split them.** Create a clean top-level page:
- `Ronin Work Board` — only projects and tasks in Kanban form
- Keep `Ronin Vibe coding Dashboard` as an index if you want, but the Kanban is the new canonical surface.

#### 4. Use Notion's "New" Button for Workflow, Not Just Creation

Your current actions are only creation buttons. Add these:
- In a project's page: buttons/macros for "Claim Task" | "Submit for Review" | "Accept" | "Reject"
- Notion automations can help: when Status changes to "Review", ping the Reviewer.

#### 5. Connect the Knowledge Hub to Cards (Not the Other Way Around)

Right now you have a massive Knowledge database. Instead of surfacing it on the main page, add a **Linked Knowledge** relation to each card. Then on a card's page:
- Show the relevant Risk entries
- Show relevant Architecture decisions
- Show relevant Skills needed
This keeps the board clean but the context accessible.

### B) Fix Your NextJS Dashboard

#### 1. Add a "Work" Tab to the Top Nav (or Make It the Default)

Your current nav: Dashboard | Memory | Graph | Logs | Provenance | Extracted | Agents | Approvals | Settings

**Add: `Work Board`** — and make it the landing page.
The `Work Board` shows a Kanban grid, not telemetry.

#### 2. Build a Kanban Component on the Work Board Page

With your stack (Next.js 16, React 19, shadcn/ui, Tailwind v4, Zustand):

- Use `@dnd-kit` or `@hello-pangea/dnd` for drag-and-drop columns.
- Create a `workItem` model:
  ```ts
  type WorkItem = {
    id: string;
    title: string;
    description: string;
    status: "backlog" | "ready" | "in_progress" | "review" | "done";
    priority: "P0" | "P1" | "P2";
    assignee?: AgentId;  // null means unclaimed
    acceptanceCriteria: string;
    linkedPR?: string;
    ciStatus?: "passing" | "failing" | "running" | "not_started";
    complexityAnalysis?: string;
    walkthroughUrl?: string;
    proofOfWork?: string;
    reviewer?: string;
    reviewDecision?: "pending" | "approved" | "rejected";
    rejectionReason?: string;
    createdAt: Date;
    updatedAt: Date;
  };
  ```
- Display as 5 columns with cards.
- Each card shows: title, assignee avatar, priority badge, CI status badge, and expand for details.

#### 3. Replace the Agents Health List with an "Agent Assignment" View

Current: `allura-core Capture · 96.6% · 142ms`

New: Agent swimlane showing what each agent is CURRENTLY doing:

| Agent | Status | Current Card | Time on Task | Health |
|---|---|---|---|---|
| allura-core | Working | `#42 Fix Docker routing` | 23 min | 96.6% |
| allura-curator | Idle | — | — | 98.1% |
| allura-graph | Working | `#55 Build Neo4j migration` | 12 min | 99.4% |
| allura-recall | Reviewing | Waiting for human on `#38` | 45 min | 94% |

When an agent claims a card, it updates its assignment in real-time (via WebSocket or polling).

#### 4. Add an "Agent Actions" Panel

Agents need to interact with the board. Build actions they (and you) can trigger:

| Action | Triggered By | Effect |
|---|---|---|
| Claim Task | Agent (or user) | Moves card Ready → In Progress, assigns agent |
| Update CI | Agent webhook | Updates CI Status on card |
| Submit Review | Agent | Moves In Progress → Review, attaches PR/proof |
| Accept Work | Human | Moves Review → Done, clears assignee |
| Reject Work | Human | Moves Review → In Progress, writes rejection reason |
| Escalate | Agent or Human | Creates a new Risk entry and pings a human |

These actions can be Notion automation webhooks or direct API calls to your NextJS backend.

#### 5. Keep the Memory Dashboard — But Make It the SECOND Tab

Your current Dashboard is beautiful for monitoring memory. Don't throw it away. Rename it to "Memory" and let users toggle between:
1. **Work Board** (Kanban — default)
2. **Memory** (current memory layers)
3. **Agents** (detailed agent telemetry)

#### 6. Surface the Curator Queue on the Work Board

You have 95 proposals awaiting review. That queue should be VISIBLE on the board:
- A side panel: "Proposals Awaiting Review (95)"
- Each proposal links to a card or a memory entry
- Click to review → approve/reject → updates the graph and notifies the agent

#### 7. Add a "Proof of Work" Detail Pane

When you click on a card in "Review" column, expand a detail view showing:
- The PR link
- CI status badge
- Complexity analysis text
- Walkthrough video embed
- Summary of what changed
- Agent's own notes
This is what Symphony agents produce. Your dashboard needs a place to *receive* it.

---

## Specific Implementation Priority

If I were you, here's what I'd build first:

### Phase 1: Board Foundation (Week 1)
1. Add `Status` property to your Notion Projects database
2. Create Kanban view grouped by Status
3. In NextJS: add `/work-board` route with a simple 5-column layout
4. Seed it with your existing 4 projects — assign statuses manually
5. Connect Notion API to read the Projects database and render on the board

### Phase 2: Agent Claim & Update (Week 2)
1. Add `assignee` and `linkedPR` and `ciStatus` to Notion Projects DB
2. Build "Claim Task" action in NextJS (button on "Ready" cards)
3. Build "Submit for Review" action (moves to Review, requires PR + proof)
4. Sync agent status back to the board (when agent busy, show it)

### Phase 3: Human Review Flow (Week 3)
1. "Review" column with detail pane (PR, CI, analysis, video)
2. Accept/Reject buttons in NextJS
3. Rejection reason textbox that agents can read
4. Automate: when approved, agent lands PR or triggers deployment

### Phase 4: Dashboard Cleanup (Week 4)
1. Make Work Board the default landing page
2. Move current memory telemetry to `/memory` tab
3. Combine Notion as the planning/canonical surface + NextJS as the live agent view
4. Add real-time updates (polling or WebSocket) so the board stays current

---

## Summary

Your Notion hub is a **rich knowledge base** but not a work surface. Your NextJS dashboard is a **memory observatory** but not a work board. Symphony is a **Kanban board where agents pull work, prove completion, and humans review at a glance.**

To get there:
- **Notion:** Add status columns to Projects. Split work from docs. Make cards readable by agents.
- **NextJS:** Build a `/work-board` with 5 Kanban columns. Show agent assignments, not just health. Surface proof-of-work in a detail pane.

Do this and your agents will stop being idle scouts with no mission and start being workers on a board they can see.
