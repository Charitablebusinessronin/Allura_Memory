# Copy Pack v2 — Allura Memory Dashboard

**Voice:** "Memory that shows its work" — precise, warm, product-led, confident but not arrogant. Agency-grade clarity. No fluff, no jargon.
**Author:** David Ogilvy, Copywriter for Team Durham
**Date:** 2026-04-27
**Status:** Production-ready. No placeholders.

---

## 1. Page Titles + Subtitles

Format: `Title | Subtitle`

| Screen | Title | Subtitle |
|---|---|---|
| Overview | Overview | Activity dashboard for your memory graph |
| Memory Feed | Memory Feed | Everything the Brain has recorded, in order |
| Graph View | Graph View | Browse memory as a network of connected ideas |
| Insight Review | Insight Review | Curate what the Brain proposes before it commits |
| Evidence Detail | Evidence | Inspect the raw record, metadata, and trace |
| Agents | Agents | Manage who writes to your memory and how |
| Projects | Projects | Organize memory by scope and access rules |
| Settings | Settings | Configure the Brain, exports, and your account |

> **Note:** "Brain" is always capitalized when referring to the Allura Brain system. Never lowercase.

---

## 2. Empty State Messages

Each empty state follows a three-part structure: **acknowledge the void, explain why, suggest action.**

### Overview
**Title:** Nothing to show yet.
**Body:** This dashboard fills in once the Brain starts recording activity. Add an agent, send a query, or import a memory to get started.
**CTA:** Go to Agents

### Memory Feed
**Title:** No memories found.
**Body:** Either nothing has been recorded yet, or your filters are too tight. Try broadening the date range or clearing filters.
**CTA:** Clear Filters

### Graph View
**Title:** Empty canvas.
**Body:** The graph needs at least one memory node to render. Once agents begin recording, connections will appear here automatically.
**CTA:** Go to Memory Feed

### Insight Review
**Title:** Nothing pending.
**Body:** All proposed insights have been handled — approved, rejected, or superseded. New ones will appear here as agents generate them.
**CTA:** View Approved

### Evidence Detail — Raw Log Tab (no log content)
**Title:** No log data.
**Body:** This evidence entry was created without a raw payload. Check the Metadata tab for structured fields.
**CTA:** View Metadata

### Evidence Detail — Metadata Tab (no metadata)
**Title:** No metadata.
**Body:** This evidence carries no structured fields beyond its ID. It may be a placeholder or an incomplete write.
**CTA:** View Raw Log

### Evidence Detail — Trace Tab (no trace events)
**Title:** No trace.
**Body:** The Brain did not capture a step-by-step trace for this evidence. Tracing depends on the agent configuration at write time.
**CTA:** —

### Agents
**Title:** No agents configured.
**Body:** Agents are the writers of your memory graph. Add the first one to start recording events, insights, and evidence.
**CTA:** Add Agent

### Projects
**Title:** No projects yet.
**Body:** Projects group memory into scopes with their own rules and access controls. Create one to keep the Brain organized.
**CTA:** Create Project

### Settings — API Keys Tab (no keys)
**Title:** No API keys.
**Body:** Generate a key to let external systems write to the Brain. Keys can be scoped to projects and rotated at any time.
**CTA:** Generate Key

---

## 3. Error State Messages

Specific, never generic "Something went wrong." Explain what failed, what the user can do, and who to tell if it persists.

### Generic Network Error
**Title:** Connection lost.
**Body:** The dashboard cannot reach the Brain right now. Check your network, or wait a moment and retry.
**Action:** Retry

### Permission Denied
**Title:** Access denied.
**Body:** Your account does not have permission to view this. If you need access, ask the project owner to adjust your role.
**Action:** Go to Overview

### Neo4j Unavailable
**Title:** Graph database offline.
**Body:** The Neo4j instance that powers the memory graph is not responding. Graph views and relationship queries will fail until it recovers.
**Action:** Retry / Contact Admin

### PostgreSQL Timeout
**Title:** Database is slow.
**Body:** The PostgreSQL query timed out. This usually means heavy load or a large dataset. Try again in a few seconds.
**Action:** Retry

### Evidence Not Found (404-style)
**Title:** Evidence not found.
**Body:** The Brain has no record with this ID. It may have been deleted, or the URL might be incorrect.
**Action:** Go to Memory Feed

### Graph Render Failure
**Title:** Graph failed to render.
**Body:** The canvas encountered an error while laying out nodes. This can happen with very large datasets or malformed relationships.
**Action:** Reset View / Retry

### Export Failed
**Title:** Export failed.
**Body:** The file could not be generated. If the dataset is large, try exporting a filtered subset.
**Action:** Retry

---

## 4. Loading States

Human, not robotic. No "Loading…" or "Please wait." Sound like a person checking the mail.

| Context | Copy |
|---|---|
| Overview stats loading | Counting memories… |
| Memory Feed loading | Fetching the feed… |
| Graph nodes loading | Mapping the graph… |
| Insight queue loading | Checking the queue… |
| Evidence raw log loading | Pulling the log… |
| Evidence metadata loading | Reading metadata… |
| Evidence trace loading | Reconstructing the trace… |
| Agents list loading | Loading agents… |
| Projects list loading | Loading projects… |
| Settings panels loading | Loading settings… |
| Search in progress | Searching… |
| Filter applying | Applying filters… |
| Insight approval in flight | Approving… |
| Insight rejection in flight | Rejecting… |
| Export generating | Building the file… |
| Graph layout computing | Arranging nodes… |
| Bulk action running | Updating selected items… |

---

## 5. CTA Labels

Action-first, no articles, no gerunds.

| Action | Label |
|---|---|
| Open agent management | Manage Agents |
| Open graph view | View Graph |
| Approve a proposed insight | Approve |
| Reject a proposed insight | Reject |
| Export evidence content | Export Evidence |
| Copy evidence to clipboard | Copy |
| Create new agent | Add Agent |
| Create new project | Create Project |
| Save settings changes | Save Changes |
| Discard settings changes | Cancel |
| Generate API key | Generate Key |
| Revoke API key | Revoke |
| Regenerate API key | Regenerate |
| Open evidence in new tab | Open in New Tab |
| View full evidence record | View Details |
| Return to previous screen | Back |
| Return to dashboard | Back to Overview |
| Clear active filters | Clear Filters |
| Apply selected filters | Apply |
| Reset filter dropdowns | Reset |
| Load more memories | Load More |
| Approve selected insights (bulk) | Approve Selected |
| Reject selected insights (bulk) | Reject Selected |
| Open insight detail | Review |
| Close detail panel | Close |
| Zoom graph in | Zoom In |
| Zoom graph out | Zoom Out |
| Reset graph zoom / pan | Reset View |
| Focus graph on selected node | Focus |
| Download exported file | Download |
| Invite user to project | Invite |
| Remove user from project | Remove |
| Edit project settings | Edit |
| Delete project (with confirmation) | Delete Project |
| Run agent now (manual trigger) | Run Now |
| Pause agent | Pause |
| Resume agent | Resume |
| View agent logs | View Logs |

---

## 6. Badge / Status Labels

Short. One word where possible. Consistent casing: sentence case for narrative labels, ALL CAPS only if design system demands it (prefer sentence).

| Status | Badge Label |
|---|---|
| Active and running | Active |
| Waiting for review | Pending |
| Approved and committed | Approved |
| Rejected and archived | Rejected |
| Replaced by newer version | Superseded |
| Service degraded but operational | Degraded |
| Operating normally | Healthy |
| Service down or unresponsive | Unhealthy |
| Agent is paused | Paused |
| Agent is disabled | Disabled |
| New / unread | New |
| Processed / seen | Read |
| High confidence (≥ 85%) | Strong |
| Medium confidence (50–84%) | Moderate |
| Low confidence (< 50%) | Weak |
| In progress | Running |
| Completed | Done |
| Failed | Failed |

---

## 7. Tooltip / Hint Text

Contextual, brief, useful.

### Search Bar
**Placeholder:** Search memories, agents, projects, or evidence
**Empty-result hint:** No results. Try broader terms or check spelling.

### Filter Hints
**Filter button:** Filter by type, date, agent, or project
**Date range picker:** Choose a date window. Use "All time" to remove the filter.
**Agent filter:** Show only memories written by this agent
**Project filter:** Show only memories scoped to this project
**Type filter:** Filter by memory type: event, insight, evidence, observation
**Insight filter (Graph):** Highlight nodes generated by a specific insight
**Clear filters:** Remove all active filters

### Confidence Badge Tooltips
**High confidence (≥ 85%):** The Brain is confident this insight is well-supported by evidence.
**Medium confidence (50–84%):** The Brain sees partial support. Review the evidence before approving.
**Low confidence (< 50%):** The Brain is uncertain. This insight needs more evidence or should be rejected.

### Connection Count Tooltips (Graph View)
**Single connection:** 1 connected memory
**Multiple connections:** {n} connected memories
**No connections:** This memory is isolated in the graph

### Memory Row Actions Menu (⋮)
**Tooltip:** Actions for this memory

### Graph Zoom Controls
**Zoom in:** Zoom in
**Zoom out:** Zoom out
**Reset view:** Reset zoom and pan
**Focus node:** Center the graph on this memory

### Copy Button (Evidence Detail)
**Tooltip:** Copy value
**Post-click feedback:** Copied to clipboard

### Export Button (Evidence Detail)
**Tooltip:** Download this view as a file

### Insight Card Actions
**Approve tooltip:** Add this insight to the canonical memory graph
**Reject tooltip:** Archive this insight. It will not be committed.

### Sidebar Collapse Toggle
**Expanded → collapsed:** Collapse sidebar
**Collapsed → expanded:** Expand sidebar

---

## 8. Navigation Labels

One sentence per nav item, explaining what the section is *for*.

| Nav Item | Label | Purpose |
|---|---|---|
| Overview | Overview | See what's happening across your memory graph right now. |
| Memory Feed | Memory Feed | Browse every memory the Brain has recorded. |
| Graph View | Graph View | Explore how memories connect to each other. |
| Insight Review | Insight Review | Approve or reject insights before they become truth. |
| Evidence | Evidence | Inspect the raw source material behind every memory. |
| Agents | Agents | Configure and monitor the agents that write to your Brain. |
| Projects | Projects | Group memory into separate scopes with their own rules. |
| Settings | Settings | Manage the Brain, your account, and how data flows. |

---

## 9. Metrics Labels

The four KPI cards on the Overview screen. Each label must make it obvious what the number means and why it matters.

| Card Position | Metric Label | Supporting Text |
|---|---|---|
| Top-left | Total Memories | Everything the Brain has recorded so far. |
| Top-right | Pending Queue | Insights and memories waiting for your review. |
| Bottom-left | Approved Memories | Insights committed to the canonical graph. |
| Bottom-right | Rejected Memories | Insights archived after review. Not committed. |

> **Note:** The supporting text appears below the number in `typography.fontSize.sm`, `color.text.secondary`. Use the exact phrasing above.

---

## 10. Must-Not List

These words, phrases, and tonal habits are **off-brand** for Allura. Avoid them entirely.

### Forbidden Phrases
- "AI-powered insights"
- "Unlock your potential"
- "Harness the power of"
- "Revolutionize your workflow"
- "Next-generation"
- "Cutting-edge"
- "Seamless experience"
- "Empower your team"
- "Transform your business"
- "Leverage our platform"
- "Drive innovation"
- "Unprecedented visibility"
- "Game-changing"
- "Supercharge"
- "Accelerate your growth"
- "Intelligent automation"
- "Smart suggestions"
- "Deep dive"
- "Actionable insights"
- "At your fingertips"
- "End-to-end"
- "Holistic view"
- "Single source of truth" (ironic, given what we do)

### Forbidden Tone
- **Hype:** No exclamation marks in UI copy unless absolutely necessary (error toasts may use them sparingly).
- **Arrogance:** The Brain does not "know" things. It records, connects, and proposes. Never say "The Brain knows." Say "The Brain found" or "The Brain recorded."
- **Jargon:** No "vectors," "embeddings," "nodes," or "edges" in user-facing copy. Use "memories," "connections," and "graph" instead.
- **Passive voice:** "The insight was approved by you" → "You approved this insight."
- **Vagueness:** No "some error occurred." Name the error.
- **Robotic warmth:** No "Oops! Something went wrong." Be direct.
- **False intimacy:** No "Hey there" or "Welcome back, friend." Be polite, not familiar.

### Forbidden Patterns
- **Ellipsis abuse:** "Loading…" is fine. "Hmm… let me think…" is not.
- **All-caps shouting:** No "IMPORTANT" or "WARNING" in body copy. Use status badges.
- **Marketing speak in error states:** Error states are for facts, not brand promises.

---

## Appendix: Cross-Reference to Screen Frames

This copy pack corresponds to the screen architecture defined in `screen-frames.md` (Deliverable 3) and the token system in `tokens.json`. Every string is designed to fit within the spacing and typography constraints specified in those documents.

| Screen | Frame Spec | Copy Sections Used |
|---|---|---|
| Overview | §Screen 1 | Page Titles, Metrics Labels, Empty State, Loading, CTA |
| Memory Feed | §Screen 2 | Page Titles, Empty State, Loading, CTA, Tooltip, Badge |
| Graph View | §Screen 3 | Page Titles, Empty State, Loading, CTA, Tooltip |
| Insight Review | §Screen 4 | Page Titles, Empty State, Loading, CTA, Badge |
| Evidence Detail | §Screen 5 | Page Titles, Empty State, Loading, CTA, Tooltip |
| Agents | §Screen 6 | Page Titles, Empty State, Loading, CTA, Badge, Navigation |
| Projects | §Screen 7 | Page Titles, Empty State, Loading, CTA, Navigation |
| Settings | §Screen 8 | Page Titles, Empty State, Loading, CTA, Navigation |

---

**End of Copy Pack v2**
