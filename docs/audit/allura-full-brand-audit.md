# Allura Dashboard — Full Brand Compliance Audit
## Conducted: 2026-05-07 | Auditor: Steve Jobs persona (BrowserOS)
## Standard: impeccable/reference/brand.md, typography.md, ux-writing.md, layout.md, interaction-design.md, color-and-contrast.md

---

## EXECUTIVE SUMMARY

**Verdict: FAILS brand compliance. Every single page.**

This is not a case of "one page needs polish." This is a systemic failure across all 12 routes where the same anti-patterns repeat identically. The interface looks like what it is: a capable engineering team that reached for Shadcn UI defaults, added a logo, and called it a day.

The product is called **Allura** — evocative of beauty, magnetism, distinction. The interface says "generic SaaS dashboard circa 2024."

**Score: 6/20** (Poor — major overhaul needed)

| Dimension | Score | Key Finding |
|-----------|-------|-------------|
| Typography | 1/4 | IBM Plex Sans (reflex-reject) on every page; no modular scale; duplicated h1s |
| Color | 1/4 | #1d4ed8 default blue; dead token system; no tinted neutrals |
| Layout | 2/4 | Identical card grids; no asymmetry; metric template default |
| Copy/Voice | 2/4 | "INSIGHT CANDIDATE" all-caps; raw JSON as content; no empty states |
| Accessibility | 2/4 | "New" badge merges with label; h1 duplication; broken error page |
| **TOTAL** | **8/20** | **Poor (Major overhaul needed)** |

---

## UNIVERSAL FAILURES (Every Page)

These appear on 100% of audited routes. They are not page-specific bugs. They are design decisions that were made once and propagated everywhere.

### [P0] IBM Plex Sans — The Reflex-Rejected Font
**Location:** Every page, `body` element  
**Standard violated:** brand.md line 30 (reflex-reject list)  
**Impact:** The moment a visitor sees IBM Plex Sans at 16px with a blue primary button, they know this was built from a template. It is literally on the ban list. Your own `--font-family-display: "Montserrat"` token sits unused.

### [P0] #1d4ed8 — The Default Blue
**Location:** Primary buttons, active nav states, links, `--allura-blue` token  
**Standard violated:** color-and-contrast.md ("Do not reach for blue (hue 250) by reflex")  
**Impact:** This is the Tailwind default primary blue. It has zero brand character. Your `--brand-amber-ochre` and `--brand-rich-navy` tokens are defined but untouched.

### [P0] Two H1 Elements Per Page
**Location:** Every page — one in section header (20px), one in hero area (44px)  
**Standard violated:** layout.md (hierarchy strategy), basic HTML semantics  
**Impact:** Screen readers announce "Heading level 1: Insights. Heading level 1: Insights." Search engines cannot determine primary topic. This is not a design choice. It is a bug that ships on every route.

### [P1] "Memory ExplorerNew" — Accessibility Failure
**Location:** Sidebar navigation, every page  
**Standard violated:** interaction-design.md (ARIA labels), ux-writing.md (standalone link text)  
**Impact:** Screen readers announce "Memory ExplorerNew" as a single word. The "New" badge has no semantic separation from the label. A 5-minute fix with a `<span aria-hidden="true">` wrapper, but it ships broken on every page.

### [P1] No Empty States (Broken, Not Designed)
**Location:** Agents page (Role —, Last Seen —, Confidence 0%)  
**Standard violated:** ux-writing.md ("Empty states are onboarding moments")  
**Impact:** The Agents page shows 10 agents, every single one with "Unknown" status and "—" for every field. The user sees a page full of failures, not a helpful "No active agents" message with a create button.

---

## PAGE-BY-PAGE FINDINGS

### 1. OVERVIEW (/dashboard)
**Screenshot:** See initial audit  
**Issues:** All universal failures apply. Additional: "MEMORY THAT SHOWS ITS WORK" eyebrow is good copy trapped in a generic layout. Metric cards follow the exact "hero metric" anti-pattern banned in layout.md.

### 2. MEMORY EXPLORER (/dashboard/memory-explorer)
**Content:** "Umemoryinsightevidenceagentprojectsystem" — garbled text near avatar  
**Issues:**
- [P1] **Nav inconsistency:** Shows "Memories" item that does NOT appear on Overview page. Nav items should be consistent across routes.
- [P2] **Garbled DOM text:** The string "Umemoryinsightevidenceagentprojectsystem" appears as plain text — likely a missing space between icon labels or a rendering bug.
- [P2] **Empty page:** Beyond the garbled text, no actual memory explorer content loads.

### 3. MEMORY FEED (/dashboard/feed)
**Content:** Memory cards with RAW MEMORY labels, timestamps, confidence scores  
**Issues:**
- [P1] **"RAW MEMORY" all-caps labels:** Banned by brand.md. Use sentence case or CSS text-transform.
- [P1] **Confidence 50% as plain text:** Displayed as "Confidence 50%" with no visual indicator. A simple colored badge would communicate quality at a glance.
- [P2] **Relative time without absolute:** "35m ago" with no tooltip or hover state for the absolute timestamp.
- [P2] **Card grid monotony:** Identical card structure for every memory. No differentiation between types (conversation vs. system vs. manual).

### 4. GRAPH (/dashboard/graph)
**Content:** Neo4j graph visualization with UUID labels  
**Issues:**
- [P1] **Raw UUIDs as node labels:** "4:67ef4415-5231-4506-8be3-bfc829056176:17" is not human-readable. The graph shows data structure, not meaning.
- [P1] **"connected_to" in camelCase:** Relationship labels are raw database field names, not human language.
- [P2] **"Filter:" with no controls:** A filter label exists with no actual filter UI.
- [P2] **No node type differentiation:** All nodes look visually identical. Agents, memories, and projects should have distinct shapes or colors.

### 5. INSIGHTS (/dashboard/insights)
**Content:** 27 insight candidate cards, all "Confidence: 85%"  
**Issues:**
- [P0] **Every insight is 85% confidence:** This suggests the confidence metric is meaningless. If everything is the same, it's not a signal.
- [P1] **"View Evidence" + "INSIGHT CANDIDATE" merged:** Rendered as "View EvidenceINSIGHT CANDIDATE" with zero whitespace between cards — a layout/CSS bug.
- [P1] **All titles prefixed with technical jargon:** "ARCHITECTURE_DECISION:", "Configured dd-site-payload..." — these are system tags, not human-readable summaries.
- [P2] **"INSIGHT CANDIDATE" all-caps on every card:** Same anti-pattern. Use a badge component with sentence-case text.

### 6. EVIDENCE (/dashboard/evidence)
**Content:** Raw JSON traces interspersed with timestamps  
**Issues:**
- [P0] **Raw JSON as page content:** Evidence records appear as unformatted JSON blobs: `{"tool":"memory_search","outcome":"success"}`. This is telemetry, not a user interface.
- [P0] **No visual hierarchy:** Timestamps, agent names, and JSON objects all rendered at the same weight and size.
- [P1] **No formatting or syntax highlighting:** Even a basic `<pre>` block with monospace font would be an improvement.

### 7. AGENTS (/dashboard/agents)
**Content:** 10 agent cards, all "Unknown" status, all 0% confidence  
**Issues:**
- [P0] **Broken empty state:** Every agent shows "Unknown" status, "Role —", "Last Seen —", "Memories —", "Confidence 0%". This is not empty-state design. This is failure presented as data.
- [P1] **Metric cards (Total 10, Active 0, Pending 0, Avg 0%)** tell a story the user has to decode: "None of your agents are working." Why make them do the math?
- [P2] **No action available:** No "Activate agent" or "Configure agent" button. The user sees broken data with no path forward.

### 8. PROJECTS (/dashboard/projects)
**Content:** "Agent OS" (1 connection), "Allura Memory" (81 connections)  
**Issues:**
- [P2] **No project actions:** No "View project", "Edit", or "Manage" affordances. Just names and connection counts.
- [P2] **No status indicators:** Are these projects active? Inactive? Archived? No visual signal.
- [P3] **Sparse content:** Two projects do not need a dedicated page with this much chrome. Consider integrating into Overview or Graph.

### 9. DECISION RECORDS (/dashboard/decisions)
**Content:** `ADR Registry Failed to construct 'Request': Invalid URL "/api/audit/events?group_id=allura-system&event_type=ARCHITECTURE_DECISION&limit=50"`
**Issues:**
- [P0] **PAGE IS BROKEN:** This is a raw JavaScript error message displayed to the user. No error boundary. No "Something went wrong" UI. Just a stack trace in body copy.
- [P0] **No error recovery:** No retry button. No "Contact support" link. The user hits a wall.

### 10. INSIGHT BUILDER (/dashboard/builder)
**Content:** Form (Content + Rationale) + same insight cards as Insights page  
**Issues:**
- [P1] **Content duplication:** The "Curator Queue" section here is identical to the Insights page. If it's the same data, why two pages?
- [P2] **Form has no validation feedback:** "Content *" is marked required but no error state is visible.
- [P2] **"Content" and "Rationale (optional)" labels are vague:** What kind of content? What does rationale mean in this context?
- [P3] **No guidance text:** "Manually compose and promote insights" — okay, but *how*? What makes a good insight?

### 11. SYSTEM HEALTH (/dashboard/health)
**Content:** Service status cards + Curator Queue metrics + duplicate System Status section  
**Issues:**
- [P1] **Duplicated System Status section:** This page repeats the exact same "System Status" block from the Overview page. Same five services, same "healthy" badges. If the data is the same, the presentation should be different, or the section should be removed from one location.
- [P1] **"Oldest pending: 414.6h"** (17 days!): This is buried in a metric card without any visual alarm. A 17-day-old pending item should be screaming red, not sitting quietly in a number box.
- [P2] **No historical trend:** PostgreSQL shows "695 memories" with a 1ms latency. Is that trending up? Is latency spiking? Raw numbers without context.

### 12. SETTINGS (/dashboard/settings)
**Content:** Brain configuration, promotion mode, Neo4j health  
**Issues:**
- [P2] **Very minimal:** Three settings items on a full-page layout feels empty.
- [P2] **No grouping or hierarchy:** "Default group scope", "Promotion mode", and "Neo4j health" are all at the same visual level, even though one is a configuration choice, one is a policy statement, and one is system status.
- [P3] **"Degraded" status with no action:** Neo4j shows "Degraded" — does the user need to do something? Is there a "Restart" or "Check status" link?

---

## DESIGN HEALTH SCORE SUMMARY

| Page | Typography | Color | Layout | Copy | Accessibility | Overall |
|------|-----------|-------|--------|------|---------------|---------|
| Overview | 1 | 1 | 2 | 2 | 2 | **1.6** |
| Memory Explorer | 1 | 1 | 1 | 1 | 1 | **1.0** |
| Memory Feed | 1 | 1 | 2 | 2 | 2 | **1.6** |
| Graph | 1 | 1 | 1 | 1 | 2 | **1.2** |
| Insights | 1 | 1 | 2 | 2 | 2 | **1.6** |
| Evidence | 1 | 1 | 1 | 1 | 2 | **1.2** |
| Agents | 1 | 1 | 1 | 1 | 2 | **1.2** |
| Projects | 2 | 1 | 2 | 2 | 3 | **2.0** |
| Decision Records | 1 | 1 | 1 | 1 | 1 | **1.0** |
| Insight Builder | 1 | 1 | 2 | 2 | 2 | **1.6** |
| System Health | 1 | 1 | 2 | 2 | 2 | **1.6** |
| Settings | 2 | 1 | 2 | 2 | 3 | **2.0** |
| **AVERAGE** | **1.2** | **1.0** | **1.7** | **1.7** | **2.0** | **1.5** |

Scale: 0=Critical, 1=Poor, 2=Acceptable, 3=Good, 4=Excellent

---

## THE THREE SYSTEMIC PROBLEMS

### 1. You Shipped Defaults
IBM Plex Sans. #1d4ed8. Shadcn sidebar. Metric cards. "New" badge. These are not design decisions. They are absences of decisions. Your brand guidelines exist precisely to prevent this. They were written, saved to disk, and *ignored by the code*.

### 2. Content Is Telemetry, Not Interface
The Evidence page dumps JSON. The Graph page shows UUIDs. The Agents page shows database NULL values as "—". The Insights page shows system tags ("ARCHITECTURE_DECISION:") as titles. **The interface is showing the internal representation, not the human meaning.** A product named Allura — about curation, judgment, evidence — should never show raw JSON to a human.

### 3. Error Handling Is Absent
The Decision Records page fails with a raw JS error. The Agents page displays empty data as if it were populated. The Graph page shows node IDs instead of handling missing labels gracefully. When things go wrong, the user sees exactly what went wrong — in code — instead of what to do next.

---

## WHAT IS WORKING

1. **Tagline is real:** "Memory that shows its work" has voice. It's the only copy on any page that feels written, not generated.
2. **Approval pipeline separation:** Queue / Approved / Rejected / Superseded is conceptually clean. The state machine is sound even if the UI isn't.
3. **Audit trail completeness:** The Evidence page, despite being unformatted, captures every action with full provenance. The *system* works. The presentation doesn't.
4. **Contrast is safe:** #111827 on #ffffff gives 15.3:1. No accessibility disaster on basic text.

---

## PRIORITY FIXES (Cross-Page Impact)

### [P0] Replace IBM Plex Sans
**Impact:** Every page. The single biggest visual change available.  
**Action:** Follow brand.md font selection procedure: write three voice words, browse a real catalog, don't pick the first "designy" thing. Consider activating the existing Montserrat display token.

### [P0] Eliminate h1 Duplication  
**Impact:** Every page. Accessibility and SEO.  
**Action:** Make the hero title the single `<h1>`. Demote section header to `<h2>` or use layout-only elements. This is a one-line HTML change per page.

### [P0] Fix Decision Records Page
**Impact:** One page, but it makes the whole app look broken.  
**Action:** Wrap the API call in error handling. Show a designed error state with "Retry" button. Never show raw JS errors.

### [P0] Fix Agents Empty State
**Impact:** One page, but deeply confusing.  
**Action:** Design a real empty state: "No agents are currently active. [Connect an agent] [Learn more]". Remove the broken metric cards if the data is all zeros.

### [P1] Fix the "New" Badge Accessibility
**Impact:** Every page. One component fix propagates everywhere.  
**Action:** `aria-hidden="true"` on the badge span, or use a proper badge component with semantic separation.

### [P1] Choose a Real Brand Color
**Impact:** Every page.  
**Action:** Promote `--brand-rich-navy` (#2c3e56) or `--brand-amber-ochre` (#b8893c) to primary. Delete `--allura-blue` or map it to a real choice.

### [P1] Format the Evidence Page
**Impact:** One page, but it's currently unusable.  
**Action:** Parse JSON into structured cards. Show agent, tool, outcome, and timestamp as distinct fields. Add syntax highlighting if raw JSON is needed.

### [P1] Add Whitespace Between Insight Cards
**Impact:** Insights and Builder pages.  
**Action:** Fix the CSS gap between "View Evidence" and the next "INSIGHT CANDIDATE" label. This is a layout bug, not a design choice.

### [P2] Remove Duplicated System Status
**Impact:** Overview and Health pages.  
**Action:** Keep it on Health, remove from Overview. Or show a summary on Overview (3 green dots = all good) and full detail on Health.

### [P2] Nav Consistency
**Impact:** All pages.  
**Action:** "Memories" either appears on every page's nav or on none. Decide which nav items are global and enforce consistency.

---

## ANTI-PATTERNS CHECKLIST

From brand.md and critique.md — how many does Allura hit?

| Anti-Pattern | Found | Count |
|-------------|-------|-------|
| Reflex-reject font (IBM Plex Sans) | ✅ | 12/12 pages |
| Default blue primary (#1d4ed8) | ✅ | 12/12 pages |
| Hero metric layout as template | ✅ | Overview, System Health |
| Identical card grids | ✅ | Insights, Builder, Memory Feed |
| All-caps body/labels | ✅ | "INSIGHT CANDIDATE", "RAW MEMORY" |
| No empty states (broken data shown) | ✅ | Agents |
| Raw JSON as UI content | ✅ | Evidence |
| Monospace as lazy "technical" shorthand | ❌ | Not found |
| Large rounded icons above headings | ❌ | Not found |
| Timid palette (beige-and-muted) | ⚠️ | Borderline — beige cream bg with bright blue is the mismatch |
| **TOTAL HITS** | **7/10** | |

---

## FINAL WORD

This interface does not comply with its own brand guidelines. The guidelines are good — they're perceptive, opinionated, and specific. But they live in `.agents/skills/impeccable/reference/` while the code lives in `/dashboard/` and the two have never met.

Your dashboard even detected this: **"Allura Brand System Drift: Two coexisting brand systems in the codebase."** The Curator identified it at 85% confidence. It's been sitting in your Needs Review queue while the interface keeps shipping the wrong system.

Fix the font. Fix the headings. Pick a color with a point of view. Then make the interface show *meaning*, not *data*.

"Memory that shows its work" is a promise. The current interface shows *code*.

---

*Audit artifacts: Screenshots captured for all 12 pages. Content extracted and saved. DOM inspected for computed styles and token usage. Brand guideline files loaded as reference standard.*
