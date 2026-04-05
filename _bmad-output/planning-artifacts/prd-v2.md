# 📋 PRD — Allura Agent-OS v2

> **Status:** In Progress — April 2026  
> **Supersedes:** PRD — Roninclaw Custom Agent System (Updated) — March 2026  
> **Rule:** Allura governs. Runtimes execute. Curators promote.

---

## 1. Problem Statement

Modern agentic systems start every session from zero. They cannot remember past decisions, learn from mistakes, or build institutional knowledge. Every agent run is stateless, ungoverned, and unauditable.

**Allura Agent-OS** solves this by providing:
- A persistent, bitemporal memory graph (roninmemory)
- A governed execution environment (RuVix Kernel)
- A multi-tenant workspace isolation model (`group_id`)
- A human-in-the-loop approval layer (Aegis + Paperclip)
- A self-hosted human communication gateway (OpenClaw)

---

## 2. Goals & Non-Goals

### Goals
- Agents accumulate institutional knowledge across sessions
- Every agent action is auditable and replayable
- Multi-tenant isolation: no cross-workspace data leakage
- Human approval required for all behavior-changing promotions
- All execution runs in Docker — never local
- Faith Meats CMS live on Payload + Next.js
- OpenCode drives all agent development

### Non-Goals
- No local execution outside Docker (except OpenClaw on Ubuntu)
- No PII in memory logs
- No agent self-modification without HITL gate
- No cloud-only lock-in — system must be self-hostable

---

## 3. Workspaces (Multi-Tenant)

| Workspace | `group_id` | Type | Priority | Notes |
|-----------|------------|------|----------|-------|
| 🥩 Faith Meats | `allura-faith-meats` | For-profit | P1 | Payload CMS + Next.js + HACCP |
| 🎨 Creative Studio | `allura-creative` | For-profit | P2 | Content + branding agents |
| 👤 Personal Assistant | `allura-personal` | For-profit | P2 | Daily ops, scheduling |
| 🏛️ Nonprofit | `allura-nonprofit` | Nonprofit | P3 | 501(c)(3) — different privilege rules |
| 🏦 Bank Audits | `allura-audits` | For-profit | P3 | GLBA data — most restricted |
| 🌡️ HACCP | `allura-haccp` | For-profit | P3 | Food safety monitoring |

> **Privilege Note:** The nonprofit workspace has no GLBA exposure and different data handling rules. Its `BehaviorSpec.yaml` must declare `privilege_class: nonprofit` and restrict financial tool access.

---

## 4. System Architecture

See: [🏗️ Allura Agent-OS — Architectural Brief](./architectural-brief.md)

### Summary

| Layer | Component | Runs On |
|-------|-----------|---------|
| L1 | RuVix Kernel | Docker |
| L2 | PostgreSQL 16 + Neo4j 5.26 | Docker |
| L3 | Agent Runtime (OpenCode agents) | Docker |
| L4 | Workflow / DAGs / A2A Bus | Docker |
| L5 | Paperclip dashboard + OpenClaw gateway | Docker / Ubuntu |

---

## 5. Tech Stack

| Component | Technology | Docker? |
|-----------|------------|---------|
| Agent Framework | OpenCode | ✅ |
| Language | TypeScript 5.7 strict | ✅ |
| Runtime | Bun | ✅ |
| CMS | Payload CMS | ✅ |
| Frontend | Next.js | ✅ |
| Raw Events | PostgreSQL 16 | ✅ |
| Knowledge Graph | Neo4j 5.26 + APOC | ✅ |
| Tool Protocol | MCP | ✅ |
| Agent Protocol | A2A | ✅ |
| Observability | OpenTelemetry | ✅ |
| Intelligence | ADAS Meta-Agent | ✅ |
| Alignment | GRPO+ | ✅ |
| Human Gateway | OpenClaw | Ubuntu only |

---

## 6. Agent Roster

### Core Agents (All Workspaces)

| Agent | Role | Latency Class |
|-------|------|---------------|
| **Curator** | Sifts PostgreSQL traces → proposes Neo4j insights | DT |
| **Auditor (HITL)** | Aegis quality gate — human sign-off | DT |
| **Meta-Agent (ADAS)** | Iteratively improves agent building blocks | SRT |
| **SENTINEL** | HACCP + compliance monitoring | HRT |

### Workspace-Specific Agents

```javascript
allura-faith-meats
  ├── faithmeats-coder       ← Payload / Next.js dev
  ├── faithmeats-agent       ← Business ops
  └── faithmeats-sentinel    ← HACCP food safety

allura-audits
  ├── audits-coder
  └── audits-agent           ← GLBA-restricted

allura-nonprofit
  ├── nonprofit-coder
  └── nonprofit-agent        ← 501(c)(3) privilege class
```

### Naming Convention

```javascript
[workspace]-coder       → Code implementation
[workspace]-agent       → General purpose
[workspace]-sentinel    → Monitoring / compliance
[workspace]-reviewer    → Code review (optional)
```

---

## 7. The 12 Anthropic Agent Primitives

All agents must implement these before any workspace goes live:

| # | Primitive | Status |
|---|-----------|--------|
| 1 | Tool Registry (metadata-first, SKILL.md manifests) | 🔴 Pending |
| 2 | Permission System (3 tiers: kernel / plugin / skill) | 🔴 Pending |
| 3 | Session Persistence (envelope.json + steps.jsonl + verdict.json) | 🔴 Pending |
| 4 | Workflow State vs Conversation State | 🔴 Pending |
| 5 | Token Budget Pre-Turn Checks | 🔴 Pending |
| 6 | Structured Streaming Events (typed, not raw text) | 🔴 Pending |
| 7 | System Event Logging (PostgreSQL events table) | 🔴 Pending |
| 8 | Two-Level Verification (run + harness) | 🔴 Pending |
| 9 | Dynamic Tool Pool Assembly (per group_id) | 🔴 Pending |
| 10 | Transcript Compaction (Curator Agent → Neo4j) | 🔴 Pending |
| 11 | Permission Audit Trail (3 handler types) | 🔴 Pending |
| 12 | Six Agent Types (Constrained Roles) | 🔴 Pending |

---

## 8. Critical Path (Build Order)

> Nothing is safe until RK-01 is resolved.

| Priority | Item | Blocks |
|----------|------|--------|
| **RK-01 CRITICAL** | `groupIdEnforcer.ts` | Everything |
| P1 | `WorkflowState` type system | Agent runtime |
| P1 | `BehaviorSpec.yaml` × 6 workspaces | Agent contracts |
| P1 | `DATA-DICTIONARY.md` | Payload schema |
| P2 | Payload CMS schema — Faith Meats | Faith Meats site |
| P2 | OpenCode plugin manifests × 6 | Agent dev |
| P2 | OpenClaw plugin handlers × 6 | Human comms |
| P3 | 12 Primitives implementation | Production readiness |
| P3 | Faith Meats Next.js frontend | Public site |

---

## 9. Faith Meats — Payload CMS Spec

### Brand Tokens

| Token | Value |
|-------|-------|
| Background (Snow) | `#FBF5F3` |
| Primary Text (Night) | `#0B0808` |
| Accent (Gold) | `#C8AD55` |
| Display Font | Crimson Pro (Bold, SemiBold) |
| Body Font | Basic Sans (Regular, Light, Bold) |
| Tagline | "A snack you can believe in." |

### Flavor Color Map

| Flavor | Color Name | Hex |
|--------|------------|-----|
| Shawarma | Cal Poly Green | `#2B4E27` |
| Moroccan Beef | Brown | `#A3320B` |
| Korean BBQ | Russian Violet | `#4C1A54` |
| Balinese Curry | Cocoa / Orange | `#D46313` |
| Honey Sriracha | Fire Engine Red | `#C1292E` |

### Payload Collections (Planned)

| Collection | Key Fields |
|------------|------------|
| `products` | name, flavor, color_token, description, certifications |
| `flavors` | name, hex, tagline, ingredients, pairings |
| `certifications` | name, body, issued_date, document |
| `posts` | title, body, author, tags, published_at |
| `media` | file, alt, category |
| `wholesale` | company, contact, tier, notes |

---

## 10. Data Schema — PostgreSQL Events Table

```sql
CREATE TABLE events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT        NOT NULL,  -- 'task-start', 'tool-call', 'checkpoint'
  group_id     TEXT        NOT NULL,  -- ENFORCED: 'allura-faith-meats' etc.
  agent_id     TEXT        NOT NULL,
  payload      JSONB       NOT NULL,
  metadata     JSONB,
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON events (group_id, timestamp);
CREATE INDEX ON events (agent_id);
```

---

## 11. Neo4j Insight Schema

```javascript
// Insight node — Steel Frame Versioning
CREATE (i:Insight {
  id:          randomUUID(),
  title:       "...",
  content:     "...",
  status:      "Active",         // Active | Degraded | Expired | Superseded
  confidence:  0.92,
  group_id:    "allura-faith-meats",
  StartDate:   datetime(),
  EndDate:     null
})

// Lineage
(:Insight)-[:SUPERSEDES]->(:Insight)
(:Outcome)-[:GENERATED]->(:Insight)
```

---

## 12. Governance Rules

- All writes require `group_id` — enforced at DB level
- No cross-tenant data reads — `groupIdEnforcer.ts` is the guard
- Insights are SUPERSEDED, never UPDATE'd
- Schema changes require human approval via Aegis gate
- Nonprofit workspace: no GLBA tools, no financial data access
- Audits workspace: highest restriction tier — GLBA compliant
- Token budgets set per agent contract — no runaway spending
- Weekly drift audits on Neo4j graph

---

## 13. Documentation Standards

All spec documents must follow the Brooks Standard:

| Document | Status |
|----------|--------|
| `BLUEPRINT.md` | ✅ Complete (v1) |
| `SOLUTION-ARCHITECTURE.md` | ✅ Complete (v1) |
| `DATA-DICTIONARY.md` | 🔴 Needs update for Allura v2 |
| `REQUIREMENTS-MATRIX.md` | 🔴 Needs update |
| `RISKS-AND-DECISIONS.md` | 🔴 Needs update |
| `BehaviorSpec.yaml` × 6 | 🔴 Not started |
| `PAYLOAD-SCHEMA.md` | 🔴 Not started |

---

## 14. Success Metrics

| Metric | Target |
|--------|--------|
| `group_id` enforcement coverage | 100% — zero cross-tenant leaks |
| Agent session persistence | 100% — every run has AER |
| HITL approval rate | 100% — no unreviewed promotions to Neo4j |
| Token budget compliance | 100% — no runaway costs |
| Faith Meats Payload CMS live | Q2 2026 |
| All 6 workspaces operational | Q3 2026 |
| 12 Primitives implemented | Q2 2026 |

---

## The Brooksian Principle

> "Do not be seduced by the promise of a silver bullet. This design requires the patient, disciplined labor of the surgical team. By separating cognition from execution and ensuring every decision has structured provenance, we create a castle in the air that is not only flexible but fundamentally auditable and secure."

**Rule: Allura governs. Runtimes execute. Curators promote.**
