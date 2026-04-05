# Product Context

> **Last Updated:** 2026-04-04

---

## Product Vision

**Allura Agent-OS** — A unified multi-agent enterprise platform that solves the persistent memory problem for AI systems.

### The Problem

Modern agentic systems start every session from zero. They cannot remember past decisions, learn from mistakes, or build institutional knowledge. Every agent run is stateless, ungoverned, and unauditable.

### The Solution

Allura provides:
1. **Persistent memory** — Bitemporal knowledge graph (PostgreSQL + Neo4j)
2. **Governed execution** — RuVix kernel with proof-gated mutation
3. **Multi-tenancy** — Workspace isolation via `group_id`
4. **Human oversight** — HITL approval before behavior changes
5. **Audit trails** — 6-12 month decision reconstruction

---

## Platform Governance Rule

> **Allura governs. Runtimes execute. Curators promote.**

This means:
- **Allura** (Paperclip dashboard) provides governance layer
- **Runtimes** (OpenCode, OpenClaw, ADAS) execute within governed constraints
- **Curators** propose knowledge promotion; **Auditors** approve via HITL

---

## Target Users

### Primary: Sabir Asheed (Founder)

**Roles:**
- Faith Meats owner (butcher shop CMS)
- Creative Studio operator
- Personal productivity user
- Nonprofit manager (501(c)(3))
- Bank audit client
- HACCP compliance manager

**Needs:**
- Single platform for multiple businesses
- Persistent agent memory across sessions
- Audit trails for compliance
- Self-hosted (no cloud lock-in)

---

## Workspaces (Multi-Tenant)

| Workspace | `group_id` | Type | Priority | Use Case |
|-----------|------------|------|----------|----------|
| 🥩 Faith Meats | `allura-faith-meats` | For-profit | P1 | Butcher shop CMS, HACCP |
| 🎨 Creative Studio | `allura-creative` | For-profit | P2 | Content, branding |
| 👤 Personal Assistant | `allura-personal` | For-profit | P2 | Daily ops, scheduling |
| 🏛️ Nonprofit | `allura-nonprofit` | Nonprofit | P3 | Grant/donor management |
| 🏦 Bank Audits | `allura-audits` | For-profit | P3 | GLBA data, mortgage audits |
| 🌡️ HACCP | `allura-haccp` | For-profit | P3 | Food safety monitoring |

**First Production Workflow:** Bank-auditor (`allura-audits`)

---

## Core Agents

### Governance Layer (Paperclip)

| Agent | Role |
|-------|------|
| Curator | Proposes knowledge promotion from PostgreSQL to Neo4j |
| Auditor | HITL quality gate — human sign-off |
| Meta-Agent (ADAS) | Iteratively improves agent building blocks |

### Execution Layer (OpenCode/OpenClaw)

| Agent | Role |
|-------|------|
| Planner | Strategic decomposition |
| Builder | Implementation |
| Orchestrator | Workflow coordination |
| Architect | Design authority, ADR authoring |

### Workflow-Specific (Per Workspace)

| Workspace | Agent | Purpose |
|-----------|-------|---------|
| `allura-faith-meats` | faithmeats-agent | Payload CMS, HACCP |
| `allura-audits` | audits-agent | Bank audit automation |
| `allura-creative` | creative-agent | Content production |
| `allura-personal` | personal-agent | Daily ops, scheduling |
| `allura-nonprofit` | nonprofit-agent | Grant/donor management |
| `allura-haccp` | haccp-agent | Food safety monitoring |

---

## Key Features

### 1. Persistent Memory

**PostgreSQL (Raw Events):**
- Append-only trace storage
- Every agent action logged
- Bitemporal timestamps
- `group_id` isolation

**Neo4j (Curated Knowledge):**
- Promoted insights only
- Steel Frame versioning (`SUPERSEDES`)
- Project + global scope
- Queryable relationships

### 2. Tenant Isolation

Every record, node, and relationship carries `group_id`.

**Guardrails:**
- Application-layer enforcement
- Secondary Neo4j labels (`TenantScope_allura_faith_meats`)
- Query-time filtering
- No cross-tenant reads without `promoted = true`

### 3. HITL Governance

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  PostgreSQL  │────▶│   Curator    │────▶│   Auditor    │
│  (Traces)    │     │  (Proposes)  │     │  (Approves)  │
└──────────────┘     └──────────────┘     └──────────────┘
                                                   │
                                                   ▼
                                          ┌──────────────┐
                                          │    Neo4j     │
                                          │  (Knowledge) │
                                          └──────────────┘
```

### 4. Audit Trail

- 6-12 month decision reconstruction
- ADR 5-layer framework
- Every mutation traceable
- Replayable workflows

---

## Non-Goals

1. **No local execution** — All agents run in Docker (except OpenClaw on Ubuntu)
2. **No PII in memory logs** — Sensitive data excluded
3. **No agent self-modification without HITL** — All behavior changes require approval
4. **No cloud-only lock-in** — System must be self-hostable

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Session memory persistence | 100% recovery after restart |
| Multi-tenant isolation | Zero cross-tenant data leakage |
| Audit trail completeness | 6-12 month reconstruction |
| HITL approval latency | <24 hours for promotions |
| First production workflow | Bank-auditor live |

---

## Risks

| ID | Risk | Mitigation |
|----|------|-------------|
| RK-01 | Group ID enforcement not working | ARCH-001 fix |
| RK-02 | Neo4j promotion bottleneck | Async curation queue |
| RK-03 | HITL latency | Approval delegation rules |