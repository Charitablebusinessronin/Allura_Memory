# Allura Agent-OS Epics

> **Source of Truth:** This document defines all epics and stories for the Allura Agent-OS project.
> **Last Updated:** 2026-04-07
> **Status:** Active — expanded from Winston planning session Apr 7 2026

---

## Epic Overview

| Epic | Name | Status | Priority |
|------|------|--------|----------|
| 1 | Persistent Knowledge Capture and Tenant-Aware Memory | `in-progress` | P0 |
| 2 | Multi-Organization Plugin Architecture | `expanded` | P1 |
| 3 | Human-in-the-Loop Governance (Paperclip) | `expanded` | P2 |
| 4 | Cross-Organization Knowledge Sharing | `planned` | P3 |
| 5 | Regulator-Grade Audit Trail | `planned` | P3 |
| 6 | Production Workflows | `expanded` | P4 |
| 7 | Client Deployment Model | `new` | P1 |

---

## Epic 1: Persistent Knowledge Capture and Tenant-Aware Memory

**Status:** `in-progress`
**Priority:** P0 (Critical)
**Goal:** Enable agents to persist context across sessions with proper tenant isolation.

### Architecture Foundation

**Story ARCH-001: Fix groupIdEnforcer.ts (RK-01)**

**Status:** `ready-for-dev`
**Priority:** 🔴 Critical (Blocks all multi-tenant features)
**Risk:** High (Security boundary)
**Target:** `src/lib/runtime/groupIdEnforcer.ts`

**Problem:** The `groupIdEnforcer.ts` module is non-functional, breaking tenant isolation.

**Acceptance Criteria:**
- [ ] Enforcer validates `group_id` is provided (not null, undefined, or empty)
- [ ] Enforcer validates `group_id` format matches `allura-{org}` pattern
- [ ] PostgreSQL queries include `WHERE group_id = $1` clause
- [ ] Neo4j queries filter by `group_id` property
- [ ] Cross-tenant data access returns empty results
- [ ] Error includes specific code: `RK-01`
- [ ] Error is logged to audit trail with full context

**Definition of Done:**
- [ ] Unit tests cover all validation scenarios (100% branch coverage)
- [ ] Integration tests verify end-to-end isolation
- [ ] Security tests confirm tenant isolation
- [ ] MCP servers updated to use enforcer
- [ ] Documentation updated

**Blocker:** This must be fixed before any other stories can proceed.

---

### Story 1.1: Record Raw Execution Traces

**Status:** `ready-for-dev` (Blocked by ARCH-001)
**Priority:** P0
**Goal:** Log all agent actions to PostgreSQL with append-only semantics.

**Acceptance Criteria:**
- [ ] Every agent action is logged to `events` table
- [ ] Logs include: `id`, `group_id`, `agent_id`, `workflow_id`, `status`, `created_at`, `evidence_ref`
- [ ] Logs are append-only (never mutated)
- [ ] Logs include confidence scoring
- [ ] Logs are queryable by agent, type, and date range

**Implementation Status:**
- ✅ `src/lib/postgres/trace-logger.ts` — Created
- ✅ `src/lib/postgres/trace-logger.test.ts` — Test suite created
- ⏳ Awaiting ARCH-001 fix

---

### Story 1.2: Implement NOTION_SYNC Workflow

**Status:** `backlog`
**Priority:** P1
**Goal:** Sync traces to Notion Knowledge Hub for human review.

**Acceptance Criteria:**
- [ ] Traces sync to Notion database
- [ ] Human review queue in Notion
- [ ] Approval workflow triggers promotion
- [ ] Sync status tracked in PostgreSQL

---

### Story 1.3: Create Agent Knowledge Nodes

**Status:** `completed`
**Priority:** P1
**Goal:** Create persistent Neo4j nodes for each agent.

**Acceptance Criteria:**
- [x] 7 Agent nodes created in Neo4j
- [x] Agent records synced to PostgreSQL
- [x] AgentGroup with INCLUDES relationships
- [x] KNOWS relationships established

**Completed:** 2026-04-05

---

### Story 1.4: Implement Relationship Schemas

**Status:** `completed`
**Priority:** P1

**Completed:** 2026-04-05

---

### Story 1.5–1.7: CONTRIBUTED, LEARNED, memory() Wrapper

**Status:** `backlog`
**Priority:** P2
(See prior spec for full acceptance criteria)

---

## Epic 2: Multi-Organization Plugin Architecture

**Status:** `expanded`
**Priority:** P1
**Goal:** Enable Allura to run on multiple agent platforms with a full plugin matrix covering all major runtimes and communication tools.

---

### Plugin Matrix — Full Target State

| Plugin | Platform | User OS | Status | Priority |
|--------|----------|---------|--------|----------|
| OpenCode | Agent coding runtime | Docker | ✅ Documented | P1 |
| Claude Code | Anthropic coding agent | Docker | ⚠️ 1/8 agents | P1 |
| GitHub Copilot | VS Code / WSL / Ubuntu / Mac | Any | 🔴 Not specced | P2 |
| OpenClaw | Communication gateway (WhatsApp/email/Telegram) | Ubuntu / Docker | 🔴 Not built | P1 |
| Perplexity MCP | Real-time web search tool for agents | Docker MCP | 🔴 Not specced | P2 |
| BrowserOS | Browser automation / web interaction | Docker | 🔴 Not specced | P2 |
| OpenWork | Workflow automation / integration layer | Docker | 🔴 Not specced | P3 |
| Claude CoWork | Multi-agent collaboration via Anthropic | Docker | 🔴 Not specced | P3 |

---

### Story 2.1: OpenCode Plugin Documentation

**Status:** `completed`
**Completed:** 2026-04-05

---

### Story 2.2: Claude Code Plugin Specification

**Status:** `partial`
**Remaining:** 6 of 8 agents not yet migrated

**Remaining agents to migrate:**
- [ ] faithmeats-coder
- [ ] faithmeats-sentinel
- [ ] audits-agent
- [ ] nonprofit-agent
- [ ] creative-agent
- [ ] personal-agent

---

### Story 2.3: OpenClaw Plugin

**Status:** `spec-complete / not-built`
**Priority:** P1

**What it does:** Routes WhatsApp, email, Telegram, Discord messages into the Allura agent runtime. Enables clients (e.g. bankers) to interact with agents via their phone.

**Acceptance Criteria:**
- [ ] OpenClaw Docker service defined in `docker-compose.yml`
- [ ] WhatsApp channel handler implemented
- [ ] Email channel handler implemented
- [ ] Telegram channel handler implemented
- [ ] Messages route through RuVix kernel policy check before reaching agents
- [ ] Responses return in same channel
- [ ] `group_id` injected per channel config
- [ ] Conversation logs stored in PostgreSQL `events` table

---

### Story 2.4: Bun-Only Package Strategy

**Status:** `completed`
**Completed:** 2026-04-05

---

### Story 2.5: GitHub Copilot Plugin

**Status:** `backlog`
**Priority:** P2
**Goal:** Support developers using GitHub Copilot on Ubuntu, WSL, and Mac connecting to Allura Memory via MCP.

**Acceptance Criteria:**
- [ ] Copilot MCP config documented for Ubuntu
- [ ] Copilot MCP config documented for WSL (Windows)
- [ ] Copilot MCP config documented for Mac
- [ ] MCP server exposes same memory tools as OpenCode plugin
- [ ] `group_id` enforcement applies to all Copilot tool calls
- [ ] Install instructions added to `INSTALL.md`

---

### Story 2.6: Perplexity MCP Plugin

**Status:** `backlog`
**Priority:** P2
**Goal:** Give agents real-time web search capability via Perplexity MCP server.

**What it does:** Agents can call `perplexity_search` tool to look up current information (prices, regulations, news) during task execution.

**Acceptance Criteria:**
- [ ] Perplexity MCP server added to Docker MCP config
- [ ] `perplexity_search` tool available in all workspace agent configs
- [ ] Search results logged to `events` table with `event_type: tool-call`
- [ ] API key stored in `.env`, not hardcoded
- [ ] Rate limit handling implemented
- [ ] Faith Meats agent: can search ingredient sourcing, competitor pricing
- [ ] Audits agent: can search GLBA regulation updates

---

### Story 2.7: BrowserOS Plugin

**Status:** `backlog`
**Priority:** P2
**Goal:** Enable agents to interact with web browsers for research, form filling, and data extraction.

**What it does:** Agents can automate browser sessions — scraping, navigating, submitting forms — from within Docker.

**Acceptance Criteria:**
- [ ] BrowserOS Docker service defined
- [ ] Browser tool exposed via MCP
- [ ] Sandboxed with `--network` limited to allow-list only
- [ ] Screenshots logged to `events` table as evidence
- [ ] Faith Meats use case: scrape competitor product listings
- [ ] Bank use case: pull public regulatory filings

---

### Story 2.8: OpenWork Plugin

**Status:** `backlog`
**Priority:** P3
**Goal:** Connect Allura agents to workflow automation platforms (n8n / Make / Zapier equivalent, self-hosted).

**Acceptance Criteria:**
- [ ] OpenWork Docker service defined
- [ ] Webhook trigger handler implemented
- [ ] Allura can both send and receive workflow events
- [ ] `group_id` passed in all webhook payloads
- [ ] Faith Meats use case: order received → trigger inventory check workflow

---

### Story 2.9: Claude CoWork Plugin

**Status:** `backlog`
**Priority:** P3
**Goal:** Enable multi-agent collaboration sessions where multiple Claude agents work on the same task simultaneously.

**Acceptance Criteria:**
- [ ] Claude CoWork session handler defined
- [ ] Shared context scoped to `group_id`
- [ ] Agent-to-agent messages logged to `events` table
- [ ] HITL gate required before any CoWork session promotes to memory

---

## Epic 3: Human-in-the-Loop Governance (Paperclip)

**Status:** `expanded`
**Priority:** P2
**Goal:** Build Paperclip as a full product-grade governance dashboard on Next.js 16 + shadcn/ui, containerized as a Docker service.

**Architecture Decision:** Paperclip = Next.js 16 App Router + shadcn/ui admin dashboard template, Docker service port 3001, connects to RuVix kernel via REST, reads from PostgreSQL `events` table scoped by `group_id`. (→ AD-17)

---

### Story 3.1: Paperclip Dashboard Foundation

**Status:** `backlog`
**Priority:** P2

**Base Template:** [Next.js + shadcn/ui Admin Dashboard](https://vercel.com/templates/next.js/next-js-and-shadcn-ui-admin-dashboard)
**Repo to fork:** `arhamkhnz/next-shadcn-admin-dashboard`

**Acceptance Criteria:**
- [ ] Template forked and `Dockerfile` added
- [ ] `paperclip` service added to `docker-compose.yml` on port 3001
- [ ] Workspace selector shows all `group_id` workspaces current user has access to
- [ ] Home screen: workspace cards showing active agents, budget burn, pending approvals count
- [ ] Auth: login scoped to workspace — users only see their `group_id`
- [ ] Admin login: sees all workspaces

---

### Story 3.2: Approval Workflow — HITL Queue

**Status:** `backlog`
**Priority:** P2

**Acceptance Criteria:**
- [ ] Approval queue screen: TanStack Table listing all `status: pending` curator proposals
- [ ] Each row shows: agent name, insight title, confidence score, timestamp
- [ ] Click into row: shows full AER reasoning (Intent, Observation, Inference)
- [ ] Approve button: writes signed proof-of-intent to RuVix kernel → Neo4j promotion
- [ ] Reject button: marks record `status: rejected` in PostgreSQL, no Neo4j write
- [ ] Override button: allows human to edit the insight before approving
- [ ] All actions timestamped and written to audit trail

---

### Story 3.3: Memory Management Panel

**Status:** `backlog`
**Priority:** P2
**Goal:** Allow humans to view, supersede, and audit all memories in a workspace.

**Acceptance Criteria:**
- [ ] Memory browser screen: searchable table of all Neo4j Insight nodes per `group_id`
- [ ] Filter by: status (Active / Superseded / Expired), agent, date range
- [ ] Click insight: view full content + confidence + AER source
- [ ] Supersede button: opens form to write replacement insight
- [ ] On supersede: new Insight node created, old marked SUPERSEDED with SUPERSEDES chain intact
- [ ] History view: shows full SUPERSEDES lineage chain for any insight
- [ ] Bulk export: download all active memories as JSON

---

### Story 3.4: Agent Output Viewer

**Status:** `backlog`
**Priority:** P2
**Goal:** Show structured agent reasoning output in Paperclip — not raw chat, but clean structured results.

**Acceptance Criteria:**
- [ ] Agent runs screen: list of all workflow executions per workspace
- [ ] Each run shows: agent, workflow name, status, duration, timestamp
- [ ] Click into run: shows structured output
  - Intent: what the agent was trying to do
  - Observations: what it found
  - Inference: what it concluded
  - Flags: any anomalies raised
  - Confidence: score per finding
- [ ] Raw event log toggle: shows raw PostgreSQL `events` for that run

---

### Story 3.5: Token Budget Monitor

**Status:** `backlog`
**Priority:** P2

**Acceptance Criteria:**
- [ ] Budget screen: per-agent token usage vs limit for current billing period
- [ ] Color coding: green < 50%, yellow 50–80%, red > 80%
- [ ] Hard stop toggle: admin can pause an agent at budget limit
- [ ] Usage history: chart of daily token burn per agent
- [ ] Alert threshold: notify admin when any agent hits 80%

---

## Epic 4: Cross-Organization Knowledge Sharing

**Status:** `planned`
**Priority:** P3

(Stories 4.1–4.2 unchanged — see prior spec)

---

## Epic 5: Regulator-Grade Audit Trail

**Status:** `planned`
**Priority:** P3

### Story 5.1: Audit Query Interface

**Status:** `backlog`
**Priority:** P3

**Acceptance Criteria:**
- [ ] Query decision provenance by loan/file ID
- [ ] Query rule versions active at time of decision
- [ ] Reconstruct full evidence chain for any finding
- [ ] Review human override history
- [ ] Export audit trail as timestamped PDF or JSON
- [ ] GLBA: export includes agent ID, human approver, timestamp, decision, evidence_ref for every action

---

## Epic 6: Production Workflows

**Status:** `expanded`
**Priority:** P4

---

### Story 6.1: Bank-Auditor Workflow — Full Spec

**Status:** `backlog`
**Priority:** P4

**Goal:** GLBA-compliant mortgage document audit workflow with HITL approval and regulator-grade export.

**Document Ingestion:**
- [ ] Paperclip upload screen: drag-and-drop PDF batch upload
- [ ] Files stored in Docker volume, path logged to `events` table with `group_id: allura-audits`
- [ ] Upload triggers `bank-audit-run` workflow automatically (event-driven trigger)

**Agent Analysis:**
- [ ] `audits-agent` reads each document
- [ ] Checks against GLBA rule set (defined in `BehaviorSpec.yaml` for `allura-audits`)
- [ ] GLBA rules to implement:
  - Income verification gap > 15% → 🔴 flag
  - Missing disclosure document → 🔴 flag
  - Appraisal date > 6 months before closing → 🟡 flag
  - Co-borrower signature missing → 🔴 flag
  - Interest rate deviation > 0.5% from quoted → 🟡 flag
- [ ] Each finding scored with confidence (0.0–1.0)
- [ ] Results written to PostgreSQL `events` table

**Paperclip Review:**
- [ ] Audit results table: Loan # | Borrower | Flag | Severity | Confidence | Status
- [ ] Human clicks into flagged item → sees agent reasoning
- [ ] Approve / Override / Reject each finding
- [ ] All human decisions timestamped and stored

**Export:**
- [ ] "Export Audit Report" button generates timestamped PDF/JSON
- [ ] Report includes: all findings, confidence scores, human approver, decision timestamps
- [ ] Format meets GLBA examination documentation standards

---

### Story 6.2: Faith Meats Operations Workflow — Full Spec

**Status:** `backlog`
**Priority:** P4

**Goal:** CRM assistant, email automation, CRM updates, and business intelligence dashboard for Faith Meats — an omakase meat snack brand (`allura-faith-meats`).

---

#### 6.2a — CRM Assistant + Email Automation

**What it does:** The `faithmeats-agent` manages wholesale and retail customer relationships — sending follow-up emails, updating CRM records, and flagging high-value leads.

**Acceptance Criteria:**
- [ ] CRM integration: read/write to Payload CMS `wholesale` collection as the CRM of record
- [ ] Email automation: agent sends templated emails for:
  - New wholesale inquiry follow-up (within 24h)
  - Order confirmation to wholesale buyer
  - Re-engagement for inactive wholesale accounts (90+ days no order)
  - HACCP certification renewal reminder to relevant contacts
- [ ] Email drafts surface in Paperclip approval queue before sending — human approves each batch
- [ ] Sent emails logged to `events` table: `event_type: email-sent`, includes recipient, template used, `group_id: allura-faith-meats`
- [ ] CRM updates: after email sent, Payload `wholesale` record updated with `last_contacted_at` timestamp
- [ ] Agent flags any reply containing a new order inquiry → routes to order processing flow

---

#### 6.2b — CRM Updates + Lead Intelligence

**What it does:** Agent monitors incoming leads, scores them, and keeps Payload CRM records current without manual data entry.

**Acceptance Criteria:**
- [ ] New wholesale inquiry form on Faith Meats website → triggers agent to create `wholesale` record in Payload
- [ ] Agent scores lead: Small Retail / Mid Retail / Distributor / National Chain (based on order size, location, business type)
- [ ] Lead score written to `wholesale.tier` field in Payload
- [ ] Agent searches Perplexity MCP for business context on new wholesale inquiry (e.g. store count, reputation)
- [ ] Research summary saved to `wholesale.notes` in Payload and to Neo4j Insight node
- [ ] Weekly CRM hygiene run: agent flags stale records (no activity 180+ days) for human review in Paperclip

---

#### 6.2c — Order Processing Integration

**What it does:** Agent receives order notifications and keeps inventory and fulfillment records current.

**Acceptance Criteria:**
- [ ] Order trigger: new order in Payload `wholesale` collection → fires `faithmeats-order-workflow`
- [ ] Agent checks inventory levels in Payload against order quantity
- [ ] If inventory sufficient: confirm order, update `inventory` record, log event
- [ ] If inventory insufficient: flag in Paperclip, notify human before confirming
- [ ] Order status tracked: Received → Confirmed → Packed → Shipped → Delivered
- [ ] Shipping confirmation email sent automatically on status change to Shipped
- [ ] All order events logged to PostgreSQL `events` table

---

#### 6.2d — Business Intelligence Dashboard (Paperclip Screen)

**What it does:** Faith Meats Ops board in Paperclip — at-a-glance view of business health.

**Dashboard Screens:**

| Screen | What It Shows |
|--------|---------------|
| **Sales Overview** | Revenue MTD, orders MTD, top flavor by units, top wholesale account |
| **CRM Pipeline** | Lead funnel: New → Contacted → Sampled → Active Account → Churned |
| **Inventory Status** | Stock levels per flavor, reorder threshold alerts (< 2 weeks supply = 🔴) |
| **HACCP Compliance** | Current certification status, next renewal date, open violations |
| **Email Performance** | Sent this week, open rate, reply rate, orders generated from email |
| **Agent Activity** | What `faithmeats-agent` did today — tasks completed, emails sent, CRM updates |

**Acceptance Criteria:**
- [ ] All screens scoped to `group_id: allura-faith-meats`
- [ ] Data reads from Payload CMS collections via Payload REST API
- [ ] Refreshes on page load + 15-min auto-refresh
- [ ] Mobile-responsive (owner checks from phone)
- [ ] Low-inventory alert sends WhatsApp notification via OpenClaw when stock < 2 weeks

---

#### 6.2e — HACCP Compliance Monitoring

**What it does:** `faithmeats-sentinel` continuously monitors food safety compliance.

**Acceptance Criteria:**
- [ ] HACCP checklist items defined in `BehaviorSpec.yaml` for `allura-haccp`
- [ ] Daily compliance check run automatically at 6am
- [ ] Any violation → immediate flag in Paperclip + WhatsApp alert via OpenClaw
- [ ] Certification expiry tracked: alert 60 days before expiry, 30 days, 7 days
- [ ] Compliance history exportable for FDA/USDA audits

---

## Epic 7: Client Deployment Model

**Status:** `new`
**Priority:** P1
**Goal:** Enable Allura to be deployed as a dedicated, isolated instance for external clients (not shared workspaces). Each client gets their own Docker stack, their own Paperclip, their own Allura Memory.

**Architecture Decision:** Each external client = separate Allura instance. `group_id` isolation is for internal workspace separation only. (→ AD-18)

---

### Story 7.1: Client Install Script

**Status:** `backlog`
**Priority:** P1

**Goal:** One-command deployment of a complete Allura instance for a new client.

**Acceptance Criteria:**
- [ ] `install-client.sh` script accepts: `CLIENT_NAME`, `CLIENT_DOMAIN`, `ADMIN_EMAIL`
- [ ] Script generates: `.env` file with client-scoped variables, unique `group_id` namespace
- [ ] Script spins up: PostgreSQL, Neo4j, RuVix kernel, Paperclip, OpenClaw — all in Docker
- [ ] Script seeds: default workspace, admin user, base agent set
- [ ] Script outputs: login URL, admin credentials, next steps
- [ ] Tested on: Ubuntu 22.04, Mac (Apple Silicon), WSL2

---

### Story 7.2: Client Onboarding Config

**Status:** `backlog`
**Priority:** P2

**Goal:** Per-client configuration layer that customizes Allura without touching core code.

**Acceptance Criteria:**
- [ ] `client.config.json` defines: client name, workspaces, agent roster, plugin list, branding
- [ ] Paperclip reads `client.config.json` to set dashboard title, logo, color theme
- [ ] `BehaviorSpec.yaml` generated per workspace from client config
- [ ] Config validated against JSON schema on startup

---

### Story 7.3: Client Update Strategy

**Status:** `backlog`
**Priority:** P2

**Goal:** When core Allura improves, client instances can update without losing their data.

**Acceptance Criteria:**
- [ ] `update-client.sh` pulls latest Docker images without touching client data volumes
- [ ] Database migrations run automatically with rollback on failure
- [ ] Client configs preserved across updates
- [ ] Update changelog surfaced in Paperclip admin screen

---

## Automation Trigger Architecture (AD-19)

Three trigger types apply to all workflows across all epics:

| Type | How It Works | Example |
|------|-------------|---------|
| **Scheduled** | `pg_cron` job fires at set time | Bank audit runs every Monday 8am |
| **Event-driven** | PostgreSQL trigger on `file_uploads` or `orders` table | New mortgage PDF dropped → audit starts |
| **Human-initiated** | Paperclip button → REST POST to RuVix kernel | "Run Audit Now" button |

All three trigger types write a `workflow-triggered` event to the `events` table before execution begins.

---

## Story Status Legend

| Status | Description |
|--------|-------------|
| `ready-for-dev` | Ready to start, no blockers |
| `in-progress` | Currently being worked on |
| `completed` | Fully completed and verified |
| `blocked` | Blocked by dependency |
| `backlog` | Not yet scheduled |
| `planned` | Planned but not started |
| `expanded` | Existing epic with new stories added |
| `new` | Net-new epic added Apr 7 2026 |
| `partial` | Spec done, implementation incomplete |

---

## Critical Path

```
ARCH-001 (groupIdEnforcer.ts)
    ↓
Story 1.1 (Record Raw Execution Traces)
    ↓
Story 1.5–1.7 (Relationships + memory() Wrapper)
    ↓
Epic 2 Plugin Matrix
  ├── Story 2.3 (OpenClaw — required for WhatsApp alerts)
  ├── Story 2.5 (Copilot — Ubuntu/WSL/Mac devs)
  ├── Story 2.6 (Perplexity MCP — agent web search)
  └── Story 2.7–2.9 (BrowserOS, OpenWork, CoWork)
    ↓
Epic 3 (Paperclip — governance dashboard)
  ├── Story 3.1 (Foundation + Docker service)
  ├── Story 3.2 (HITL Approval Queue)
  ├── Story 3.3 (Memory Management Panel)
  ├── Story 3.4 (Agent Output Viewer)
  └── Story 3.5 (Token Budget Monitor)
    ↓
Epic 7 (Client Deployment Model)
  └── Story 7.1 (Install script — required before bank demo)
    ↓
Epic 6 (Production Workflows)
  ├── Story 6.1 (Bank Auditor — full spec)
  └── Story 6.2 (Faith Meats — CRM + email + BI + HACCP)
```

**Current Blocker:** ARCH-001 must be fixed before any other Epic 1 stories can proceed.

---

## New ADRs Required (from Apr 7 2026 session)

| ID | Decision | Priority |
|----|----------|----------|
| AD-17 | Paperclip UI = Next.js 16 + shadcn/ui, Docker port 3001 | P1 |
| AD-18 | External clients = dedicated Allura instances, not shared group_id | P1 |
| AD-19 | Three workflow trigger types: pg_cron, Postgres event trigger, human REST call | P2 |

---

## References

- [PRD v2](./prd-v2.md) — Product requirements
- [Architectural Brief](./architectural-brief.md) — Architecture overview
- [Tenant & Memory Boundary Spec](./tenant-memory-boundary-spec.md) — Tenant isolation
- [Data Dictionary](./data-dictionary.md) — Field definitions
- [Source of Truth](./source-of-truth.md) — Document hierarchy
- [Architectural Decisions](./architectural-decisions.md) — All ADRs including AD-17, AD-18, AD-19
