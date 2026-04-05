---
version: 2.0
status: superseded
date: 2026-04-04
source: notion (updated with platform vision)
classification:
  domain: multi-agent-platform
  projectType: enterprise-saas
  complexity: enterprise
---

> ⚠️ **SUPERSEDED**
> 
> This document is historical reference. The canonical version is:
> 
> **`docs/allura/prd-v2.md`**
> 
> See [`docs/allura/source-of-truth.md`](../allura/source-of-truth.md) for document hierarchy.

---

# PRD — Allura: Unified Multi-Agent Enterprise Platform

## Executive Summary

**Allura** is a unified multi-agent enterprise platform that manages multiple organizations through one governed system. Unlike single-purpose automation tools, Allura provides enterprise-grade orchestration, governance, and institutional memory across diverse business workflows.

**The Problem:** Organizations struggle with disconnected automation tools that lack governance, audit trails, and cross-functional intelligence. Each new workflow requires rebuilding infrastructure, agents, and oversight from scratch.

**The Solution:** Allura provides a three-layer architecture:
1. **Governance Layer (Paperclip)** — Centralized management, approvals, and oversight
2. **Execution Layer (OpenClaw/OpenCode)** — Agent runtime and workflow execution
3. **Memory Layer (PostgreSQL + Neo4j)** — Persistent context and regulator-grade audit trails

**Target Users:** Enterprise teams requiring governed AI agents for regulated workflows (banking audit, CRM operations, supply chain), plus developers building custom agent workflows.

**Differentiator:** Multi-tenant isolation with cross-org knowledge sharing via HITL-approved promotion, delivering both organizational autonomy and platform-wide intelligence.

---

## Success Criteria

### SC-1: Multi-Organization Support
**Given** Allura is deployed  
**When** a new organization joins  
**Then** they have isolated data, dedicated agents, and governed access within 10 minutes

### SC-2: Cross-Org Knowledge Sharing
**Given** an organization creates a valuable insight  
**When** the curator approves for promotion  
**Then** the sanitized insight becomes available platform-wide without exposing raw data

### SC-3: Regulator-Grade Audit Trail
**Given** a compliance review requires evidence  
**When** an auditor queries the system  
**Then** they receive complete decision provenance, rule versions, evidence chains, and human overrides within 5 minutes

### SC-4: Banking Audit Workflow
**Given** the Banking organization uses Allura  
**When** the `bank-auditor` workflow processes an audit  
**Then** it completes with 95% accuracy, full audit trail, and human approval gates as required by regulation

### SC-5: Platform Extensibility
**Given** Allura supports Banking  
**When** implementing CRM assistant or Faith Meats operations  
**Then** reuse 80%+ of infrastructure, agents, and governance without rebuilding

---

## Product Scope

### MVP (Current → Q2 2026)

**Core Platform:**
- Multi-tenant architecture with `group_id` isolation
- Three-layer governance/execution/memory stack
- Basic agent types (ClawCoder, ClawAgent)
- PostgreSQL + Neo4j dual persistence
- Paperclip governance dashboard (basic)
- OpenClaw communication gateway

**First Production Workflow:**
- `bank-auditor` — Banking organization audit workflow
- HITL approval gates for compliance
- Regulator-grade audit queries
- Cross-tenant isolation validation

**Organizations:**
- `roninclaw-banking` — Banking (first production)

### Growth Phase (Q3-Q4 2026)

**Additional Organizations:**
- `roninclaw-crm` — CRM assistant workflow
- `roninclaw-faithmeats` — Faith Meats operations
- `roninclaw-personal` — Personal assistant

**Enhanced Governance:**
- Curator agents for knowledge promotion
- HITL workflow automation
- Cross-org insight sharing
- Advanced audit queries

**Platform Intelligence:**
- Platform-wide insight repository
- Cross-organizational pattern recognition
- Shared best practices library

### Vision Phase (2027+)

**Enterprise Features:**
- Custom organization onboarding
- White-label agent capabilities
- Advanced compliance frameworks (HIPAA, SOX)
- Real-time collaboration features
- Marketplace for agent workflows

**Ecosystem:**
- Third-party agent integration
- Community-contributed skills
- Industry-specific templates
- Certification programs

---

## User Journeys

### UJ-1: Compliance Officer (Banking)

**As a** Compliance Officer at a mid-size bank  
**I want** to audit loan decisions with AI assistance  
**So that** I meet regulatory requirements while reducing audit time by 60%

**Workflow:**
1. Log into Paperclip Dashboard
2. Access `bank-auditor` workflow
3. Upload loan decision documents
4. AI analyzes for compliance patterns
5. Review flagged decisions in HITL queue
6. Approve/reject with documented reasoning
7. Export audit trail for regulators

**Pain Points:**
- Current audits take 40+ hours per 100 loans
- Manual document review is error-prone
- No systematic pattern recognition
- Audit trails are fragmented across systems

### UJ-2: CRM Manager (Sales Organization)

**As a** CRM Manager  
**I want** AI agents to qualify leads and update Salesforce  
**So that** sales reps focus on high-probability opportunities

**Workflow:**
1. Configure `crm-assistant` workflow
2. Connect to lead sources (website, email, calls)
3. AI qualifies leads using historical patterns
4. Qualified leads auto-sync to Salesforce
5. Reps receive prioritized daily list
6. AI learns from rep feedback

**Pain Points:**
- Reps spend 30% of time on unqualified leads
- Lead scoring is manual and inconsistent
- No automated follow-up sequences
- Lost leads due to slow response

### UJ-3: Platform Administrator (Allura)

**As a** Platform Admin  
**I want** to onboard new organizations with proper isolation  
**So that** each org has secure, governed access without cross-contamination

**Workflow:**
1. Create new tenant (`roninclaw-{org}`)
2. Configure organization-specific policies
3. Deploy base agents with org-specific customization
4. Set up HITL approval workflows
5. Monitor cross-tenant access attempts
6. Review and approve insight promotions

**Pain Points:**
- Manual tenant setup is error-prone
- Ensuring data isolation requires constant vigilance
- No standardized governance framework
- Compliance audits are time-consuming

### UJ-4: Knowledge Curator (Cross-Org)

**As a** Knowledge Curator  
**I want** to identify valuable insights from one organization and share platform-wide  
**So that** all organizations benefit from best practices without exposing sensitive data

**Workflow:**
1. Review insights flagged for promotion
2. Sanitize tenant-specific data
3. Create abstracted pattern
4. Submit for HITL approval
5. Upon approval, publish to platform library
6. Monitor adoption across organizations

**Pain Points:**
- Valuable patterns trapped in org silos
- Manual knowledge transfer is slow
- Risk of exposing sensitive data
- No systematic knowledge harvesting

---

## Functional Requirements

### FR-1: Tenant Isolation
**Users can** create isolated organizational workspaces with dedicated data, agents, and governance.

**Acceptance Criteria:**
- AC-1.1: Each organization has unique `group_id` (format: `roninclaw-{org}`)
- AC-1.2: Data queries automatically filtered by `group_id`
- AC-1.3: Cross-tenant access denied by default (RK-01)
- AC-1.4: Tenant metadata configurable (retention, policies)
- AC-1.5: Tenant onboarding completes in < 10 minutes

### FR-2: Agent Orchestration
**Users can** deploy specialized agents for different workflows within their tenant.

**Acceptance Criteria:**
- AC-2.1: Agent types: ClawCoder, ClawAgent, MemoryOrchestrator, Curator
- AC-2.2: Agents scoped to single tenant by default
- AC-2.3: Agent lifecycle: Provisioning → Active → Paused → Archived
- AC-2.4: Agent capabilities configurable per tenant
- AC-2.5: Agent performance tracked and auditable

### FR-3: Governance Dashboard (Paperclip)
**Users can** manage organizations, approve workflows, and audit decisions through a centralized dashboard.

**Acceptance Criteria:**
- AC-3.1: View all organizations and their status
- AC-3.2: HITL approval queue for sensitive operations
- AC-3.3: Agent roster with contract viewing
- AC-3.4: Token budget monitoring with burn rate tracking
- AC-3.5: Audit log with export capability
- AC-3.6: Role-based access (Owner vs Auditor)

### FR-4: Communication Gateway (OpenClaw)
**Users can** interact with agents through familiar channels (WhatsApp, Telegram, Discord).

**Acceptance Criteria:**
- AC-4.1: Channel integration: WhatsApp, Telegram, Discord
- AC-4.2: Policy enforcement on every message (RuVix kernel)
- AC-4.3: Message routing to appropriate agent
- AC-4.4: Live routing log with monospace display
- AC-4.5: Blocked message highlighting for policy violations

### FR-5: Dual Persistence
**The system can** store raw events (PostgreSQL) and curated insights (Neo4j) with full audit trail.

**Acceptance Criteria:**
- AC-5.1: PostgreSQL: append-only event log
- AC-5.2: Neo4j: curated insights with versioning
- AC-5.3: Events immutable (never updated, only appended)
- AC-5.4: Insights versioned via SUPERSEDES relationships
- AC-5.5: All records include `group_id`, `agent_id`, timestamps

### FR-6: Knowledge Promotion
**Users can** promote insights from tenant-specific to platform-wide with HITL approval.

**Acceptance Criteria:**
- AC-6.1: Propose insight for promotion
- AC-6.2: Curator review and sanitization
- AC-6.3: HITL approval workflow
- AC-6.4: Sanitized insight published to platform library
- AC-6.5: Original insight linked via provenance

### FR-7: Bank-Auditor Workflow
**Banking users can** process loan audits with AI assistance and compliance guarantees.

**Acceptance Criteria:**
- AC-7.1: Upload loan decision documents
- AC-7.2: AI analysis for compliance patterns
- AC-7.3: Flag suspicious decisions for review
- AC-7.4: HITL approval before finalizing
- AC-7.5: Complete audit trail export
- AC-7.6: 95% accuracy in compliance detection

### FR-8: Regulator-Grade Audit
**Auditors can** query complete decision provenance, evidence, and overrides.

**Acceptance Criteria:**
- AC-8.1: Query decision provenance (who, when, why)
- AC-8.2: Query rule version at decision time
- AC-8.3: Reconstruct evidence chain
- AC-8.4: Review human overrides
- AC-8.5: Cross-tenant access audit
- AC-8.6: Historical reconstruction

---

## Non-Functional Requirements

### NFR-1: Multi-Tenant Security
**The system shall** enforce tenant isolation with zero cross-tenant data leakage.

**Metric:** 0 unauthorized cross-tenant access attempts succeed  
**Measurement:** Security audit logs, penetration testing  
**Context:** Critical for regulated industries (banking, healthcare)

### NFR-2: Audit Query Performance
**The system shall** respond to regulator-grade audit queries within 5 seconds.

**Metric:** 95th percentile query response time < 5s for decision provenance queries  
**Measurement:** Query timing logs, load testing  
**Context:** Compliance reviews require near-real-time evidence access

### NFR-3: Agent Uptime
**The system shall** maintain 99.9% uptime for agent execution during business hours.

**Metric:** Uptime percentage, excluding scheduled maintenance  
**Measurement:** Monitoring dashboards, incident reports  
**Context:** Business-critical workflows cannot tolerate downtime

### NFR-4: Data Retention
**The system shall** retain audit events for 7 years per regulatory requirements.

**Metric:** 100% of audit events retained for 7 years  
**Measurement:** Data retention audits, storage metrics  
**Context:** Banking regulations require long-term audit trails

### NFR-5: Concurrent Users
**The system shall** support 100+ concurrent users per organization without performance degradation.

**Metric:** Response time < 2s under 100 concurrent users  
**Measurement:** Load testing, production monitoring  
**Context:** Enterprise deployments require scale

### NFR-6: Knowledge Promotion Latency
**The system shall** complete insight promotion workflow within 24 hours of HITL approval.

**Metric:** 95% of promotions complete within 24 hours  
**Measurement:** Workflow timing logs  
**Context:** Timely knowledge sharing drives platform value

### NFR-7: API Response Time
**The system shall** respond to MCP API calls within 200ms for 95th percentile.

**Metric:** API response time < 200ms (p95)  
**Measurement:** APM monitoring, API logs  
**Context:** Real-time agent interactions require low latency

### NFR-8: Documentation Coverage
**The system shall** maintain 100% documentation compliance with AI-Guidelines.

**Metric:** All architectural decisions documented with ADRs  
**Measurement:** Documentation audit, checklist validation  
**Context:** AI-assisted development requires clear specifications

---

## Domain Requirements

### Banking (Primary Use Case)
- **Audit Trail:** Complete decision provenance required
- **HITL Workflow:** Human approval for sensitive decisions
- **Compliance:** Regulatory reporting capabilities
- **Data Retention:** 7-year minimum for audit events
- **Access Control:** Role-based with separation of duties

### CRM Operations
- **Integration:** Salesforce/HubSpot connectivity
- **Lead Scoring:** AI-powered qualification
- **Workflow Automation:** Automated follow-up sequences
- **Performance Tracking:** Conversion metrics and attribution

### Faith Meats (Business Operations)
- **Inventory Management:** Supply chain workflows
- **Quality Control:** Compliance tracking
- **Customer Orders:** Order processing automation
- **Reporting:** Business intelligence dashboards

---

## Architecture Overview

### Three-Layer Stack

```
┌─────────────────────────────────────────┐
│  GOVERNANCE LAYER (Paperclip)           │
│  - Organization management              │
│  - HITL approval queues                 │
│  - Audit dashboards                     │
│  - Token budget monitoring              │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  EXECUTION LAYER (OpenClaw/OpenCode)    │
│  - Agent runtime                        │
│  - Policy enforcement (RuVix)           │
│  - Communication gateway                │
│  - Workflow orchestration               │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  MEMORY LAYER (PostgreSQL + Neo4j)      │
│  - Raw events (append-only)             │
│  - Curated insights (versioned)         │
│  - Audit trails (regulator-grade)       │
│  - Cross-org promotion                  │
└─────────────────────────────────────────┘
```

### Tenant Isolation Model

**Primary Key:** `group_id` (format: `roninclaw-{organization}`)

```javascript
roninclaw                    // Platform-level
roninclaw-banking           // Banking organization (first production)
roninclaw-crm               // CRM organization
roninclaw-faithmeats        // Faith Meats
roninclaw-personal          // Personal assistant
roninclaw-{org}             // Pattern for new organizations
```

**Enforcement:**
- Layer 1: API Gateway (OpenClaw)
- Layer 2: Policy Engine (RuVix kernel)
- Layer 3: Database Enforcer (group_id validation)
- Layer 4: Database constraints (NOT NULL, indexes)

### Knowledge Promotion Flow

```
Local Insight (Tenant-Specific)
    ↓
Propose for Promotion
    ↓
Curator Review & Sanitization
    ↓
HITL Approval (Human)
    ↓
Publish to Platform Library
    ↓
Available to All Organizations (Abstracted Pattern)
```

---

## Project-Specific Customization

### Supported Organizations

- **roninclaw-banking** — Banking audit (first production workflow)
- **roninclaw-crm** — CRM assistant
- **roninclaw-faithmeats** — Faith Meats operations
- **roninclaw-personal** — Personal assistant
- **roninclaw-{org}** — Pattern for new organizations

### Agent Inheritance Model

```javascript
Base Agents (in .opencode/agent/core/)
  ├── ClawCoder
  │     └── banking-coder
  │     └── crm-coder
  │     └── faithmeats-coder
  └── ClawAgent
        └── banking-agent
        └── crm-agent
        └── faithmeats-agent
        └── curator-agent (platform-level)
```

### Organization Setup Process

1. **Create Tenant:** `roninclaw-{org}` with isolated data
2. **Configure Policies:** Organization-specific governance rules
3. **Deploy Agents:** Base agents with org customization
4. **Set Up HITL:** Approval workflows for sensitive operations
5. **Enable Workflows:** Organization-specific capabilities

---

## Integration Points

### OpenAgentsControl
- **Repository:** github.com/darrenhinde/OpenAgentsControl
- **Usage:** Core framework for agent orchestration
- **Agents:** ClawCoder, ClawAgent configured with memory
- **Skills:** Loaded from `.opencode/skills/`

### roninmemory
- **Components:** PostgreSQL (raw events) + Neo4j (insights)
- **Tenant Isolation:** `group_id` enforcement
- **Connection:** MCP_DOCKER tools
- **Logging:** All skills log session lifecycle

### Superpowers
- **Repository:** github.com/obra/superpowers
- **Pattern:** Brainstorm → Plan → Execute → Verify
- **Skills:** 13 core skills with memory logging

### Notion API
- **Purpose:** Governance workspace sync
- **Databases:** Projects, Tasks, Changes, Approvals
- **Pages:** 77+ pages across 6 databases

---

## Success Metrics

### Current Performance

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Skills in shared library | 20+ | 25 | ✅ Exceeds |
| Notion pages created | 50+ | 77+ | ✅ Exceeds |
| Documentation compliance | 100% | 100% | ✅ Met |
| Organizations supported | 1+ | 1 (Banking) | ✅ Met |
| Tenant isolation | 100% | 100% | ✅ Met |

### Updated Metrics

- Time to onboard new organization: < 10 minutes
- Agent creation with templates: < 5 minutes
- Cross-project skill reuse: 100% (shared library)
- Audit query response time: < 5 seconds
- Knowledge promotion cycle: < 24 hours

---

## Security & Governance

### Tenant Isolation

- **Primary:** `group_id: roninclaw` (core)
- **Project-scoped:** `roninclaw-{organization}`
- **Enforcement:** 4-layer validation (API → Policy → Database → Constraints)
- **Risk:** Cross-tenant leakage mitigated via strict group_id enforcement (RK-01)

### Access Control

- **Notion:** Teamspace-based access
- **Skills:** Read-only shared library
- **Agents:** Tenant-scoped with platform-level curator
- **HITL:** Human approval for sensitive operations

### Audit & Compliance

- **PostgreSQL:** Immutable raw events (append-only)
- **Neo4j:** Curated insights with SUPERSEDES versioning
- **Retention:** 7-year minimum for audit events
- **Queries:** 6 regulator-grade audit queries defined

---

## Technical Specifications

### Memory Schema (Raw Events)

```sql
CREATE TABLE events (
  event_id SERIAL PRIMARY KEY,
  group_id TEXT NOT NULL,          -- Tenant key (REQUIRED)
  agent_id TEXT NOT NULL,          -- Source agent
  workflow_id TEXT,                -- Workflow context
  event_type TEXT NOT NULL,        -- 'decision', 'approval', etc.
  status TEXT NOT NULL,            -- 'pending', 'completed', 'blocked'
  intent TEXT,                     -- Human-readable intent
  observation JSONB,               -- Raw data
  inference TEXT,                -- AI inference
  evidence_chain JSONB,          -- Evidence references
  metadata JSONB,                  -- Flexible metadata
  occurred_at TIMESTAMP NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW()
);
```

### Neo4j Knowledge Graph

**Entity Types:**
- `Insight` — Curated knowledge with versioning
- `Organization` — Tenant entities
- `Agent` — Agent instances
- `Workflow` — Workflow definitions

**Relations:**
- `(:Insight)-[:SUPERSEDES]->(:Insight)` — Versioning
- `(:Organization)-[:HAS_AGENT]->(:Agent)` — Membership
- `(:Insight)-[:PROMOTED_TO]->(:Organization)` — Cross-org sharing

---

## References

- **Tenant & Memory Boundary Spec:** `docs/planning-artifacts/tenant-memory-boundary-spec.md`
- **Architecture Decisions:** `docs/planning-artifacts/architecture.md`
- **Agent Definitions:** `.opencode/agent/`
- **Implementation Stories:** `docs/implementation-artifacts/`

---

## Summary

**Allura** is a unified multi-agent enterprise platform managing multiple organizations through one governed system. It combines:

- ✅ **Multi-tenant architecture** with strict `group_id` isolation
- ✅ **Three-layer stack** (Governance → Execution → Memory)
- ✅ **First production workflow:** `bank-auditor` (Banking)
- ✅ **Future support:** CRM, Faith Meats, Personal assistant
- ✅ **Knowledge promotion:** HITL-approved cross-org sharing
- ✅ **Regulator-grade audit:** Complete decision provenance

**Status:** MVP Complete, Ready for Project Expansion  
**Next Milestone:** Banking organization production deployment
