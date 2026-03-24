---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
inputDocuments:
  - /home/ronin704/dev/projects/memory/README.md
  - /home/ronin704/dev/projects/memory/_bmad-output/project-context.md
  - /home/ronin704/dev/projects/memory/memory-bank/projectbrief.md
  - /home/ronin704/dev/projects/memory/memory-bank/productContext.md
  - /home/ronin704/dev/projects/memory/memory-bank/systemPatterns.md
  - /home/ronin704/dev/projects/memory/memory-bank/techContext.md
  - /home/ronin704/dev/projects/memory/memory-bank/activeContext.md
  - /home/ronin704/dev/projects/memory/memory-bank/progress.md
  - /home/ronin704/dev/projects/memory/docs/DEPLOYMENT.md
  - /home/ronin704/dev/projects/memory/docs/api/index.md
  - /home/ronin704/dev/projects/memory/docs/api/adas.md
  - /home/ronin704/dev/projects/memory/docs/api/adr.md
  - /home/ronin704/dev/projects/memory/docs/api/audit.md
  - /home/ronin704/dev/projects/memory/docs/api/budget.md
  - /home/ronin704/dev/projects/memory/docs/api/curation.md
  - /home/ronin704/dev/projects/memory/docs/api/dedup.md
  - /home/ronin704/dev/projects/memory/docs/api/import.md
  - /home/ronin704/dev/projects/memory/docs/api/lifecycle.md
  - /home/ronin704/dev/projects/memory/docs/api/neo4j.md
  - /home/ronin704/dev/projects/memory/docs/api/notion.md
  - /home/ronin704/dev/projects/memory/docs/api/policy.md
  - /home/ronin704/dev/projects/memory/docs/api/postgres.md
  - /home/ronin704/dev/projects/memory/docs/api/ralph.md
  - /home/ronin704/dev/projects/memory/docs/api/sync.md
  - /home/ronin704/dev/projects/memory/docs/api/termination.md
  - /home/ronin704/dev/projects/memory/docs/api/validation.md
documentCounts:
  briefCount: 1
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 18
workflowType: 'prd'
classification:
  projectType: developer_tool
  domain: general
  complexity: high
  projectContext: brownfield
vision:
  layerStack:
    - name: PostgreSQL Layer
      description: Append-only raw execution traces, event logs, and evidence
    - name: Insight Layer (Neo4j)
      description: Versioned semantic insights using Steel Frame with SUPERSEDES, DEPRECATED, REVERTED patterns
    - name: Decision Layer (ADR)
      description: Agent Decision Records capturing approvals, revocations, and counterfactual reasoning
    - name: Knowledge Access Layer
      description: Entity relationships, dual-context queries, retrieval views, and Notion mirror
  promotionModel:
    before: HITL promotion gate, humans manually moving insights into Notion
    after: Policy engine auto-approves strong insights, updates Notion automatically, sends Discord notification immediately, preserves ability to revoke or correct later
  visionStatement: A governed autonomous workflow brain built on a 4-layer memory stack that captures meaningful work in real time, structures it through BMAD, promotes strong insights automatically under policy, updates Notion, alerts via Discord, and preserves human control through immediate revocation and correction paths.
  whatMakesItSpecial: It flips the operator from clerk to commander. The memory stack separates evidence, insight, decision, and access into governed layers. BMAD remains the governing method, Ralph loops run only after stories exist, and policy-based auto-promotion moves strong insights forward without requiring humans to manually shepherd every artifact through Notion.
  coreInsight: Memory is neither passive storage nor a universal human-approval queue. It is a governed promotion system: raw work is captured as evidence, normalized into structured insight, evaluated by policy, surfaced immediately, and revocable when necessary.
  guardrail: Not every memory becomes knowledge, and not every insight becomes behavior-changing truth.
---

# Product Requirements Document - memory

**Author:** Sabir
**Date:** 2026-03-20

## Executive Summary

**Vision**
A governed autonomous workflow brain built on a 4-layer memory stack that captures meaningful work in real time, structures it through BMAD, promotes strong insights automatically under policy, updates Notion, alerts via Discord, and preserves human control through immediate revocation and correction paths.

**Target Users**
- AI engineering teams building and managing intelligent agents
- Developers who need persistent memory across sessions without babysitting every artifact
- Founders and operators who want autonomous memory speed without losing BMAD structure or policy control

**Problem Being Solved**
Most memory and workflow systems either create manual bottlenecks (human-review queues that are too slow to keep up with real work) or produce junk drawers (passive storage where everything accumulates but nothing is trusted). Teams lose momentum because important insights, decisions, and work products die in the gap between thinking and structured execution.

### What Makes This Special

**4-Layer Memory Stack:**
1. **PostgreSQL Layer** — append-only raw execution traces, event logs, and evidence
2. **Insight Layer (Neo4j)** — versioned semantic insights using Steel Frame with SUPERSEDES, DEPRECATED, REVERTED patterns
3. **Decision Layer (ADR)** — Agent Decision Records capturing approvals, revocations, and counterfactual reasoning
4. **Knowledge Access Layer** — entity relationships, dual-context queries, retrieval views, and Notion mirror

**Governed Autonomy:**
- BMAD remains the governing method: work is shaped into epics, stories, and agents
- Ralph loops do not run whenever the model feels inspired — they run only after story structure exists
- Strong insights are auto-approved into Notion when policy thresholds are met
- Discord is the immediate notification and intervention surface
- Revocation is a first-class operation, not an afterthought

**Core Insight:**
Memory is neither passive storage nor a universal human-approval queue. It is a governed promotion system: raw work is captured as evidence, normalized into structured insight, evaluated by policy, surfaced immediately, and revocable when necessary.

**Guardrail:**
Not every memory becomes knowledge, and not every insight becomes behavior-changing truth.

**Why This Is Different:**
It is not "AI asks permission for everything" and it is not "AI writes everywhere unchecked." It is governed autonomy with structured promotion, policy gates, and human override always available.

## Project Classification

- **Project Type:** developer_tool
- **Domain:** general
- **Complexity:** high
- **Project Context:** brownfield

## Success Criteria

### User Success

**Core Experience:**
- Users feel like the system is capturing meaningful work without manually shepherding every artifact
- Users receive Discord notifications only when intervention is actually needed
- Users can revoke or correct an auto-approved insight in under 60 seconds
- Users do not need to open Notion to know what has been promoted

**Behavioral Outcomes:**
- Time from strong insight emerging to it being in Notion: under 5 minutes (auto-approval path)
- Time from Discord notification to user taking action: tracked and visible
- Revocation action completes in one step with confirmation

**Emotional Success:**
- Users feel like commanders, not clerks
- Users trust the system's promotion decisions because they understand the policy gates
- Users feel confident revoking because the audit trail is always available

### Business Success

**Short-term (MVP — first epic complete):**
- Auto-approved insights appear in Notion without manual intervention
- Discord notification fires on every promotion decision
- Revocation flow works end-to-end
- BMAD epics and stories can be created from promoted knowledge

**Medium-term (all 5 epics complete):**
- Policy engine correctly routes insights: auto-approve / queue / reject
- Duplicate insights are flagged before promotion, not after
- Notion and Neo4j stay in sync (drift under 1% of promoted items)

**Long-term:**
- Ralph loop story execution produces measurable productivity gains
- Agent memory becomes a competitive differentiator for team velocity
- Human review time on memory management drops by 80% versus HITL-only flow

### Technical Success

**Functionality:**
- All 5 MCP tools (log_event, search_events, create_insight, search_insights, log_decision) work correctly
- Approval state is consistent across PostgreSQL, Neo4j, and Notion
- Discord webhook fires reliably on promotion state changes
- Policy engine gates: confidence >= threshold, duplicate score < threshold, evidence count >= minimum, canonical tag present
- Embeddings via Ollama qwen3-embedding:8b at localhost:11434 — shared across OpenClaw and OpenCode

**Reliability:**
- Notion writes succeed on first attempt: >95%
- Failed Notion writes are retried with exponential backoff and alerted
- Revocation updates all three systems (PG, Neo4j, Notion) atomically or none

**Performance:**
- Promotion decision latency: <2 seconds (policy engine + Notion write)
- Discord notification latency: <3 seconds from decision
- Ralph loop story execution respects existing BMAD story boundaries

## Product Scope

### MVP — Minimum Viable Product

Must work to be useful:
1. Unified promotion path: promote_insight_to_notion actually writes to Notion (not manual handoff)
2. Discord notification on every approval state change
3. Revocation flow that updates Neo4j, PostgreSQL, and Notion
4. Policy engine with baseline gates: confidence, duplicate, evidence, canonical tag
5. ADR logging on every promotion decision

### Growth Features (Post-MVP)

1. Review queue for borderline / non-auto-approved items
2. Drift detection and auto-repair between Neo4j and Notion
3. BMAD agent integration for orchestrated execution
4. oh-my-openagent-style planner/reviewer agents for evidence gathering

### Vision (Future)

1. Full Ralph loop story execution across all epics
2. Multi-agent orchestration with OpenCode-configured Ollama Cloud + OpenAI routing
3. Predictive promotion: system anticipates strong insights before they are fully formed
4. Team-level memory sharing with group_id governance

## User Journeys

### Journey 1: Sabir — The Commander (Primary Operator)

**Opening Scene:**  
Sabir has been running BMAD sprints on the memory project. After a long coding session, he realizes he has not opened Notion once today — but the system has been capturing his work anyway.

**Rising Action:**
- Strong insights from the session were auto-captured by the PostgreSQL layer
- The policy engine evaluated them against confidence, duplicate, and evidence gates
- High-confidence items were auto-approved into Notion
- A Discord notification arrived: *"Insight promoted: Qwen3-Embedding-8B now active in Notion"*

**Climax:**  
Sabir clicks the Discord notification link, sees the promoted insight in Notion with full ADR lineage. He approves it or revokes it in one click. The system updates Neo4j and logs the decision.

**Resolution:**  
Sabir returns to building without breaking flow. The system handled the clerical work. He stays commander, not clerk.

### Journey 2: BMAD Agent — The Orchestrator (AI Agent)

**Opening Scene:**  
BMAD agent loads session context from memory-bank and Neo4j dual-context query. It knows the current epic, the stories in flight, and the Ralph loop state.

**Rising Action:**
- Ralph loop Perceive phase: load activeContext, progress, systemPatterns
- Plan phase: propose next story task based on epic state
- Act phase: implement, log events to PostgreSQL
- Check phase: run tests, verify behavior
- Adapt phase: if failed, self-correct and retry

**Climax:**  
Story completes. A strong pattern emerges from the implementation traces. The promotion pipeline evaluates it: confidence 0.87, no duplicate found, evidence count 12. Policy says: auto-approve.

**Resolution:**  
Insight is promoted to Notion. Discord notifies Sabir. BMAD agent continues to next story. No human intervention required for strong patterns.

### Journey 3: Sabir — Revocation (Edge Case)

**Opening Scene:**  
Sabir sees a Discord notification: *"Insight auto-approved: Use synchronous promotion for low-confidence items"*

**Rising Action:**
- The insight looked solid but Sabir knows the domain — this is actually a anti-pattern in their specific setup
- He clicks the revoke path in the Discord notification
- System marks insight as Revoked in Neo4j, updates Notion status to Revoked, logs the revocation event

**Climax:**  
Revocation completes in one step. The audit trail shows who revoked, when, and why. Future queries exclude Revoked insights by default but preserve them for reconstructability.

**Resolution:**  
Sabir's correction is captured. The system learned from the revocation. The ADR is complete.

### Journey 4: System — Background Governance (Automated)

**Opening Scene:**  
A weak insight (confidence 0.3, insufficient evidence) tries to get promoted.

**Rising Action:**
- Policy engine evaluates gates: confidence below threshold → queue for review
- Duplicate detector finds 89% similarity to existing insight → flag as potential duplicate
- Notion is NOT updated
- Sabir receives a different Discord notification: *"Insight queued for review: potential duplicate detected"*

**Climax:**  
Sabir reviews in Notion, marks the duplicate, and resolves the queue. The queued item is either merged with the existing insight or explicitly rejected.

**Resolution:**  
Junk does not get promoted. Notion stays clean. The governance model is preserved.

### Journey 5: BMAD Sprint Planning (Multi-Agent)

**Opening Scene:**  
Sabir asks BMAD to run sprint planning for Epic 2.

**Rising Action:**
- BMAD loads epics from `_bmad-output/planning-artifacts/epics.md`
- Creates story packages from epic using `bmad-create-story`
- Generates quick spec for first story using `bmad-quick-spec`
- Ralph loop begins executing stories one at a time

**Climax:**  
Stories complete. Insights are captured. Promotion pipeline activates. Discord pings with updates.

**Resolution:**  
Epic closes. Retrospective runs. Next epic begins. The full BMAD cycle executes with the governed memory brain underneath.

### Journey Requirements Summary

| Capability | Revealed By |
|-----------|-------------|
| Discord notification on all state changes | Journeys 1, 2, 3, 4 |
| One-click revoke from Discord link | Journey 3 |
| Policy engine gates (confidence, duplicate, evidence) | Journeys 2, 4 |
| Notion mirror with audit trail | Journeys 1, 3 |
| Ralph loop story execution | Journey 5 |
| BMAD epic/story creation | Journey 5 |
| PostgreSQL append-only traces | Journey 2 |
| Neo4j Steel Frame versioning | Journeys 1, 2, 3 |

## Innovation & Novel Patterns

### What This Changes

This system turns memory from passive storage into a **governed decision pipeline**.

Most memory systems treat memory as:
- **Storage**: vector DB, logs, embeddings — "save it and retrieve later"
- **Retrieval**: RAG — "find relevant context when asked"
- **Approval queue**: HITL — "ask a human before proceeding"

This system does something different:

> **Memory becomes an active, governed decision pipeline that promotes, structures, and operationalizes work in real time.**

### The Five Core Innovations

**1. Memory → Promotion System**
Capture → Normalize → Evaluate → Promote → Revoke
That is not memory. That is **workflow intelligence**.

**2. "Proceed Unless Revoked" — Not "Ask Permission"**
Auto-promote under policy. Allow immediate revocation. Log everything via ADR.
This flips the control model from *"permission to proceed"* to *"proceed unless revoked"*.

**3. BMAD Shapes Memory Into Executable Work**
Not dump outputs and maybe tag them. Force everything through epics, stories, and agents. Gate Ralph loops after story structure exists.
Memory is not just saved — it is **shaped into executable work**.

**4. Discord Is the Control Plane — Not Just Notifications**
Real-time intervention surface. Revocation interface. Human override channel.
Discord is part of the system's **governance layer**, not just UX.

**5. ADR Completes the Loop**
Not just "what happened" — but **why it happened and what could have happened instead**.
That turns the system into something that can learn, audit, explain, and evolve.

### The Core Innovation Statement

**This system is not an AI memory system. It is a governed workflow brain that turns live work into structured, actionable progress without human bottlenecks — while preserving full control through revocation.**

### What This Solves

**Problem:** How do we move faster than human approval loops without losing control?

**Answer:** Policy-gated auto-promotion + revocation + structured memory + ADR

### Validation Approach

- Track revocation rate: high revocation = policy needs tuning
- Track time-to-promotion: should be under 5 minutes for auto-approved insights
- Track Notion cleanliness: junk should not reach Notion
- Measure human intervention time: should drop significantly versus HITL-only flow

## Developer Tool Specific Requirements

### Project-Type Overview

This is a developer tool in the form of an **MCP-backed memory and workflow system**. It exposes:
- MCP tools for memory operations (log, search, create, decide)
- BMAD workflow agents for orchestrated execution
- A policy engine governing promotion and revocation
- Discord as the real-time control plane

The "users" are primarily AI agents and developer workflows, not end consumers.

### Technical Architecture Considerations

**Language & Runtime:**
- TypeScript/Node.js (Next.js backend)
- MCP protocol for tool exposure
- PostgreSQL + Neo4j as backends
- Ollama Cloud + OpenAI for model inference

**Package & Distribution:**
- NPM package for local development (`@memory/core`)
- MCP server distribution via `npx tsx src/mcp/memory-server.ts`
- Docker Compose for infrastructure (PostgreSQL, Neo4j)
- Environment-based configuration (`.env`)

**API Surface:**
- MCP tools: `log_event`, `search_events`, `create_insight`, `search_insights`, `log_decision`
- MCP tools: `promote_insight_to_notion`, `approve_insight`, `reject_insight`, `revoke_insight`
- MCP tools: `search_knowledge_base`, `sync_drift_report`
- REST/Next.js server actions for UI
- Discord webhook API for notifications

**SDK / Integration Patterns:**
- OpenCode provider integration (Ollama Cloud)
- OpenClaw `memorySearch` integration
- BMAD workflow agent compatibility
- Smithery MCP for Notion integration (create/update knowledge pages)

**Documentation Requirements:**
- API reference for all MCP tools
- Architecture documentation (README, DEPLOYMENT)
- Usage guides for BMAD workflows
- Migration guide for upgrading memory stack

### Skip Sections (per CSV)

- **visual_design**: Not a consumer UI product
- **store_compliance**: Not a mobile or app store product

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP  
The fastest path to validated learning is to wire the governed promotion pipeline end-to-end: policy engine → Notion write → Discord notification. If that works without manual intervention, the core thesis is validated.

**Resource Requirements:**  
Single developer (Sabir) with BMAD agent support. Ralph loop story execution for implementation.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Journey 1: Commander (auto-approval to Notion + Discord)
- Journey 3: Revocation (one-click revoke from Discord link)
- Journey 4: Background Governance (policy gates catching weak insights)

**Must-Have Capabilities:**
1. Unified promotion path: `promote_insight_to_notion` writes to Notion (no manual handoff)
2. Discord notification on every promotion state change (approved, queued, rejected, revoked)
3. Policy engine with baseline gates: confidence, duplicate, evidence
4. Revocation flow updating all three systems (PG, Neo4j, Notion)
5. ADR logging on every promotion decision

### Post-MVP Features

**Phase 2:**
- Review queue for non-auto-approved items
- Drift detection and auto-repair
- BMAD agent integration for orchestrated execution

**Phase 3:**
- Full Ralph loop story execution
- oh-my-openagent planner/reviewer agents
- Multi-agent orchestration with Ollama Cloud + OpenAI routing
- Predictive promotion

### Risk Mitigation Strategy

**Technical Risks:**
- Notion API reliability → retry with exponential backoff, alert on failure
- Policy too loose → track revocation rate, tune thresholds
- Policy too strict → queue items, do not silently fail

**Market Risks:**
- System becomes junk drawer → policy gates + duplicate detection prevent this
- System becomes bottleneck → auto-approval path bypasses human queue

**Resource Risks:**
- Single developer → BMAD agent support, one epic at a time, Ralph loop execution

## Functional Requirements

### 1. Memory Capture & Logging

- **FR1:** Agents can log events with evidence and trace_ref to PostgreSQL for permanent record
- **FR2:** Agents can search historical events by type, date range, content, and group_id
- **FR3:** System logs all promotion decisions as ADR events with full context
- **FR4:** Events are append-only and never mutated after creation
- **FR5:** All memory operations include group_id for tenant isolation

### 2. Insight Management

- **FR6:** Agents can create versioned semantic insights in Neo4j with trace_ref linking to PostgreSQL evidence
- **FR7:** Agents can search knowledge using semantic queries filtered by group_id and confidence
- **FR8:** Insights use SUPERSEDES pattern — new versions create SUPERSEDES relationships, old versions are preserved but deprecated
- **FR9:** Insights with status=Revoked are preserved for audit but excluded from default queries
- **FR10:** Every insight has a canonical tag for governance classification

### 3. Decision & Approval Pipeline

- **FR11:** System auto-promotes strong insights to Notion when all policy gates pass
- **FR12:** Users can manually approve or reject any queued insight at any time
- **FR13:** Users can revoke any auto-approved insight with one action
- **FR14:** Approval/rejection/revocation immediately updates Neo4j, PostgreSQL, and Notion
- **FR15:** System queues insights for review when policy gates are inconclusive

### 4. Promotion & Notification

- **FR16:** System sends Discord webhook notification on every promotion state change
- **FR17:** Discord notification includes insight title, decision, confidence, Notion link, and revoke path
- **FR18:** Notion pages are created or updated automatically when insights are promoted
- **FR19:** Notion pages include full ADR lineage: approval reason, evidence links, counterfactuals
- **FR20:** Revocation updates Notion page status to Revoked in one step

### 5. Governance & Policy Engine

- **FR21:** Policy engine evaluates confidence gate: confidence >= threshold → eligible for auto-approve
- **FR22:** Policy engine evaluates duplicate gate: similarity < threshold → no duplicate conflict
- **FR23:** Policy engine evaluates evidence gate: evidence count >= minimum → sufficient support
- **FR24:** Policy engine evaluates canonical tag gate: tag present → governance criteria met
- **FR25:** Policy engine routes each insight to one of: auto-approve, queue, reject
- **FR26:** All policy decisions are logged with full ADR counterfactual reasoning

### 6. BMAD Workflow Integration

- **FR27:** BMAD creates epics and stories that shape work into executable units
- **FR28:** Ralph loops execute only after story structure exists — not on arbitrary inspiration
- **FR29:** Ralph loop completion is checked per story: if criteria met → story done, move to next
- **FR30:** System logs Ralph loop events and captures emerging insights automatically

### 7. Integration & Access

- **FR31:** MCP tools expose memory operations: log_event, search_events, create_insight, search_insights, log_decision
- **FR32:** MCP tools expose promotion operations: promote_insight_to_notion, approve_insight, reject_insight, revoke_insight
- **FR33:** Embedding similarity uses qwen3-embedding:8b via Ollama at localhost:11434
- **FR34:** Smithery MCP serves as the integration path to Notion for creating and updating knowledge pages
- **FR35:** System detects and reports drift between Smithery-backed Notion state and Neo4j state
- **FR36:** Approved insights include Approved By = agent:name marker in Notion for audit

## Non-Functional Requirements

### Performance

- **NFR1:** Promotion decision latency <2 seconds (policy engine + Smithery Notion write)
- **NFR2:** Discord notification latency <3 seconds from decision
- **NFR3:** Ralph loop story execution respects existing BMAD story boundaries — no unbounded loops
- **NFR4:** Embedding queries via qwen3-embedding:8b at localhost:11434 respond in <500ms for typical similarity checks

### Reliability

- **NFR5:** Smithery Notion writes succeed on first attempt >95% of the time
- **NFR6:** Failed Notion writes are retried with exponential backoff and alerted via Discord
- **NFR7:** Revocation updates all three systems (PostgreSQL, Neo4j, Smithery Notion) atomically — all succeed or all rollback
- **NFR8:** System logs all failures with trace_ref for audit and debugging

### Integration

- **NFR9:** MCP tools (log_event, search_events, create_insight, search_insights, log_decision) respond correctly to all valid inputs
- **NFR10:** Discord webhook fires reliably on promotion state changes — graceful degradation if webhook unreachable
- **NFR11:** Neo4j and PostgreSQL connections use retry logic with exponential backoff
- **NFR12:** Smithery MCP serves as the integration path for Notion page create/update/delete operations

### Security & Governance

- **NFR13:** All database operations include group_id — no cross-tenant data access
- **NFR14:** API keys (Discord webhook URL, Smithery credentials, OpenAI key) stored in environment variables, never hardcoded
- **NFR15:** Insights with status=Revoked are preserved in database but excluded from default knowledge queries

### Scalability

- **NFR16:** System handles concurrent BMAD agent operations without data corruption
- **NFR17:** Ralph loops have bounded iteration (kmax) to prevent infinite loops
