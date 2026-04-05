# ADR-001: Requirements Traceability Matrix (RTM) Architecture

**Status**: Proposed  
**Date**: 2026-04-04  
**Decision Maker**: Human (HITL Required)  
**Supersedes**: N/A (Initial Decision)  
**Group ID**: roninmemory

---

## 1. Action Logging

**Decision**: Implement a three-tier Requirements Traceability Matrix (RTM) to maintain conceptual integrity across the Agent-OS architecture, ensuring every agent action can be traced back to its business goal ancestry.

**Components Affected**:
- Paperclip (Management Layer)
- ADAS (Evolutionary Layer)
- OpenClaw (Execution Layer)
- roninmemory (Persistence Layer)

**Implementation Actions**:
- Define B-Tier (Business) requirements
- Decompose into F-Tier (Functional) requirements
- Map F-Tier to components and layers
- Enforce traceability through Aegis review loop
- Log architectural decisions to Neo4j after HITL approval

---

## 2. Decision Context

### The Problem

As we navigate the complexity of coordinating autonomous digital employees, the system faces the risk of becoming a "sprawling werewolf of missed deadlines and fractured logic" — a system where:

1. **Goal drift**: Actions taken without clear business justification
2. **Traceability loss**: Impossible to answer "Why did this agent do X?"
3. **Conceptual integrity erosion**: Each component evolves independently, breaking the whole
4. **Second-system effect**: Temptation to over-complicate execution runtime with management logic

### The Brooksian Defense

> *"The hardest single part of building a software system is deciding precisely what to build."*  
> — Frederick P. Brooks Jr., *The Mythical Man-Month*

The Requirement Matrix serves as our primary defense:

1. **Goal Ancestry**: Every action traceable to business mission
2. **Layer Separation**: Management (Paperclip) vs. Execution (OpenClaw)
3. **AEGIS Gate**: High-stakes transitions require human sign-off
4. **NFR Guardrails**: Security, latency, and training stability enforced

### Current System State

| Layer | Component | Status | AER Integration |
|-------|-----------|--------|-----------------|
| Management | Paperclip | Planning | Not yet |
| Evolutionary | ADAS | Planning | Not yet |
| Execution | OpenClaw | Planning | Not yet |
| Persistence | roninmemory | ✅ Operational | ✅ P0+P1 Complete |

**Learning System**: roninmemory now captures reasoning provenance (intent-observation-inference-action) through AER logging in `memory-query` and `memory-build` skills.

---

## 3. Reasoning Chain

### Why Three Tiers?

**B-Tier (Business Goals)** — *The Why*
- Defines enterprise mission (Who, Why)
- Examples: "B1: Autonomous Growth", "B4: Audit & Compliance"
- Managed by Paperclip layer
- *Reasoning*: Business goals are immutable anchors; they define what success looks like

**F-Tier (Functional Requirements)** — *The What*
- Specific system behaviors to satisfy business goals
- Examples: "FR1: Lifecycle & Scheduling", "FR5: Structured Tracing"
- Cross-cutting across layers
- *Reasoning*: Functional requirements translate business intent into system behavior

**Component Mapping** — *The How*
- Paperclip, ADAS, OpenClaw, roninmemory
- Each component implements specific F-Tier requirements
- *Reasoning*: Component boundaries enforce separation of concerns

### Why Aegis Review Loop?

The **Aegis Quality Gate** prevents high-stakes transitions from occurring without human oversight:

```
Inbox → Assigned → In Progress → Review → Quality Review (AEGIS) → Done
                                                              ↑
                                                      Board Partner Sign-off
```

**Reasoning**:
- Financial mutations, strategic hires, and policy changes affect the real world
- Automated systems cannot assess consequences outside their optimization surface
- Human "Board Partner" provides context, ethics, and business judgment
- Prevents the "innocent-looking monster" of unmanaged risks

### Why NFRs as Constitutional Guardrails?

**NFR3 (Security by Design)**:
- Zero-trust RBAC
- Capability-scoped tool access
- Prompt injection prevention
- *Reasoning*: Agents have broad capabilities; must be constrained by principle of least privilege

**NFR7 (Real-time Responsiveness)**:
- Latency classes: HRT (Hard Real-Time), SRT (Soft Real-Time), DT (Delay-Tolerant)
- Safety filters respond within deterministic bounds
- *Reasoning*: Critical safety decisions cannot wait for "eventual consistency"

**GRPO+ Training Stability**:
- Clip High prevents entropy collapse
- Overlong filtering maintains long-context reasoning
- *Reasoning*: Autonomous agents require stable, scalable intelligence

---

## 4. Alternatives Considered

### Alternative 1: Ad-Hoc Prompt Chaining

**Description**: No formal requirement hierarchy; each agent prompt includes full context and goals.

**Pros**:
- Simplicity: No architectural overhead
- Flexibility: Easy to modify individual prompts

**Cons**:
- **Goal drift**: Prompts evolve independently, losing business context
- **No traceability**: Unable to answer "Why did agent X do action Y?"
- **Conceptual fragmentation**: Each prompt represents isolated knowledge
- **Maintenance burden**: Updating prompts requires touching every agent

**Decision**: ❌ **REJECTED** — This is the "werewolf" scenario. Lacks conceptual integrity.

### Alternative 2: Single-Tier Requirement List

**Description**: Flat list of requirements without business goal ancestry.

**Pros**:
- Easier to implement initially
- Less hierarchical complexity

**Cons**:
- **No business alignment**: Cannot trace functional requirements to business mission
- **Difficult prioritization**: No guidance on which requirements are most important
- **Stakeholder confusion**: Business partners cannot see how their goals map to system behavior

**Decision**: ❌ **REJECTED** — Loses the constitutional alignment that enables stakeholder trust.

### Alternative 3: Four-Tier Matrix (Add "Technical Requirements")

**Description**: Add T-Tier between F-Tier and Components.

**Pros**:
- More granular traceability
- Explicit technical constraints

**Cons**:
- **Second-system effect**: Over-engineering before proving the three-tier model
- **Added complexity**: Another layer to maintain
- **Premature abstraction**: We don't yet know if T-Tier is needed

**Decision**: ⏸️ **DEFERRED** — Start with three tiers; add T-Tier if proven necessary.

### Chosen Alternative: Three-Tier RTM

**Rationale**:
- Proven pattern in safety-critical systems (aerospace, medical devices)
- Clear separation: Business goals → Functional requirements → Components
- Enables AEGIS gate enforcement for high-stakes decisions
- Maintains conceptual integrity without over-engineering

**Trade-offs Accepted**:
- More upfront design required
- Need to maintain traceability matrix
- Requires human discipline to keep matrix updated

---

## 5. Human Oversight Trail

### Initial Proposal

**From**: User (Architectural Guidance)  
**Date**: 2026-04-04  
**Context**: Session continuation after P0+P1 learning integration complete  
**Action Proposed**: Implement three-tier RTM as constitutional framework for Agent-OS  

### AEGIS Gate Status

**Required Sign-off**: Board Partner (Human)  
**Risk Level**: High (Architectural foundation)  
**Consequences If Wrong**: 
- Goal drift across entire system
- Untraceable agent actions
- Conceptual integrity erosion
- Failed stakeholder trust

### Human Decision Required

**Decision 1**: Approve Three-Tier RTM Architecture
- [ ] Approve B-Tier, F-Tier, Component hierarchy
- [ ] Request modifications (specify below)
- [ ] Reject and propose alternative

**Decision 2**: AEGIS Review Loop Implementation
- [ ] Approve six-stage task board with quality gate
- [ ] Modify stages (specify below)
- [ ] Defer to later decision

**Decision 3**: NFR Constitutional Guardrails
- [ ] Approve NFR3 (Security), NFR7 (Latency), GRPO+ requirements
- [ ] Modify requirements (specify below)

### Oversight Log

| Date | Reviewer | Decision | Notes |
|------|----------|----------|-------|
| 2026-04-04 | Human (Pending) | — | Awaiting HITL approval |

---

## Appendix A: Requirement Tables

### B-Tier: Business Requirements

| ID | Business Goal | Description | Owner | Priority |
|----|---------------|-------------|-------|----------|
| **B1** | Autonomous Growth | Self-sustaining revenue growth without proportional human scaling | Business | P0 |
| **B2** | Workforce Evolution | Continuous improvement of agent capabilities through learning | Evolutionary | P0 |
| **B3** | Task Execution | Reliable, correct execution of delegated work | Execution | P0 |
| **B4** | Audit & Compliance | Complete audit trail, regulatory compliance, transparency | Persistence | P1 |
| **B5** | Strategic Hiring | Ability to onboard new agent types without manual configuration | Management | P1 |
| **B6** | Financial Integrity | Zero unauthorized financial transactions | AEGIS | P0 |

### F-Tier: Functional Requirements

| ID | Functional Requirement | Layer | Business Traceability | Status |
|----|------------------------|-------|-----------------------|--------|
| **FR1** | Lifecycle & Scheduling | Paperclip | B1, B5 | Planning |
| **FR2** | Context & Memory | roninmemory | B3, B4 | ✅ Operational |
| **FR3** | Tool Registry & Sandbox | OpenClaw | B3 | Planning |
| **FR4** | Agent Communication | All | B2, B3 | Planning |
| **FR5** | Structured Tracing (OTel) | roninmemory | B4 | ✅ Operational |
| **FR6** | Safety & Governance | AEGIS | B6 | Planning |
| **FR7** | Model/Cost Management | ADAS | B1, B2 | Planning |
| **FR8** | AER Logging | roninmemory | B2, B4 | ✅ Operational (P0+P1) |

### NFR: Non-Functional Requirements

| ID | Requirement Category | Specification | Business Traceability |
|----|-----------------------|--------------|-----------------------|
| **NFR1** | Availability | 99.9% uptime for critical paths | B1, B3 |
| **NFR2** | Durability | Zero data loss for AER traces | B4 |
| **NFR3** | Security by Design | Zero-trust RBAC, capability scoping, prompt injection prevention | B6 |
| **NFR4** | Scalability | Linear scalability up to 10,000 agents | B1, B5 |
| **NFR5** | Auditability | 6-12 month decision trails in Neo4j | B4 |
| **NFR6** | Consistency | Steel Frame versioning for all insights | B2, B4 |
| **NFR7** | Real-time Responsiveness | HRT < 100ms, SRT < 1s, DT < 30s for safety filters | B3, B6 |
| **NFR8** | Training Stability | GRPO+ with Clip High, overlong filtering | B2 |

---

## Appendix B: Aegis Review Loop

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TASK LIFECYCLE                               │
└─────────────────────────────────────────────────────────────────────┘
                                                                      
   ┌──────────┐    ┌───────────┐    ┌──────────────┐    ┌────────┐
   │  INBOX   │───▶│  ASSIGNED │───▶│ IN PROGRESS │───▶│ REVIEW │
   └──────────┘    └───────────┘    └──────────────┘    └────────┘
        │                                                    │
        │                                                    │
        │                                            ┌───────┘
        │                                            │
        │                                            ▼
        │                                     ┌──────────────┐
        │                                     │    AEGIS     │
        │                                     │ QUALITY GATE │
        │                                     │   ▲          │
        │                                     │   │          │
        │                                     │   │ Board    │
        │                                     │   │ Partner   │
        │                                     │   │ Sign-off  │
        │                                     └───┴──────────┘
        │                                            │
        │                                            │
        │                                            ▼
        │                                     ┌──────────────┐
        │                                     │     DONE     │
        └────────────────────────────────────▶│              │
                                              └──────────────┘
                                                                      
                    High-Stakes Tasks ────────────▶ AEGIS Required
                    (Financial, Hiring, Policy)
```

### AEGIS Gate Triggers

| Task Category | AEGIS Required? | Reasoning |
|---------------|----------------|-----------|
| Financial Transactions | ✅ **Yes** | Real-world consequences, fraud risk |
| Strategic Hires | ✅ **Yes** | Long-term organizational impact |
| Policy Changes | ✅ **Yes** | Affects entire agent workforce |
| Code Deployment | ✅ **Yes** (P0) | Production impact, rollback needed |
| Data Queries | ❌ No (FR2) | Read-only, no side effects |
| AER Logging | ❌ No (FR8) | Append-only, no external impact |
| Model Updates | ✅ **Yes** (ADAS) | Affects agent behavior globally |

---

## Appendix C: Component Mapping

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PAPERCLIP                                   │
│                     (Management Layer)                              │
│                                                                     │
│  B1: Autonomous Growth ────────▶ FR1: Lifecycle & Scheduling      │
│  B5: Strategic Hiring ──────────▶ FR1:register/retire             │
│                                                                     │
│  Responsibilities:                                                  │
│  - Agent lifecycle (register → heartbeat → wake → retire)          │
│  - Workforce orchestration                                         │
│  - Business goal decomposition                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           ADAS                                      │
│                    (Evolutionary Layer)                             │
│                                                                     │
│  B2: Workforce Evolution ──────▶ FR7: Model/Cost Management        │
│                                                                     │
│  Responsibilities:                                                  │
│  - Model selection and optimization                                │
│  - Cost tracking and efficiency                                    │
│  - GRPO+ training stability                                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          OpenClaw                                   │
│                      (Execution Layer)                              │
│                                                                     │
│  B3: Task Execution ───────────▶ FR3: Tool Registry & Sandbox      │
│  B3: Task Execution ───────────▶ FR4: Agent Communication          │
│                                                                     │
│  Responsibilities:                                                  │
│  - Tool execution in sandboxed environment                          │
│  - Inter-agent communication                                       │
│  - Action execution                                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        roninmemory                                   │
│                      (Persistence Layer)                             │
│                                                                     │
│  B4: Audit & Compliance ──────▶ FR5: Structured Tracing (OTel)     │
│  B4: Audit & Compliance ──────▶ FR6: Safety & Governance (AEGIS)   │
│  B2: Workforce Evolution ──────▶ FR8: AER Logging                   │
│                                                                     │
│  Responsibilities:                                                  │
│  - AER capture (intent-observation-inference-action)               │
│  - Neo4j promoted insights                                          │
│  - PostgreSQL raw traces                                            │
│  - Steel Frame versioning                                           │
│  - HITL promotion gates                                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                        ┌───────────┐
                        │   AEGIS   │
                        │   GATE    │
                        └───────────┘
                              │
                              ▼
                    Human Board Partner Sign-off
```

---

## Appendix D: Cross-Reference to Existing Architecture

This ADR extends the following existing architectural decisions:

1. **Memory System Integration Plan** (`docs/architecture/memory-system-integration-plan.md`)
   - AER logging (FR8) implements the learning system described in existing plan
   - Neo4j/PostgreSQL dual-memory model supports B4 audit requirements
   - Steel Frame versioning ensures FR6 consistency

2. **Brooksian Principles** (applied throughout)
   - Conceptual Integrity: Three-tier hierarchy maintains single vision
   - Separation of Concerns: Layer boundaries (Paperclip, ADAS, OpenClaw, roninmemory)
   - No Silver Bullet: Focus on essential complexity (traceability), not accidental (tooling)

3. **HITL Governance** (AEGIS gate)
   - Human approval for behavior-changing knowledge promotion
   - Board Partner sign-off for high-stakes decisions
   - ADR 5-layer framework requires human oversight trail

---

## References

- Brooks, F. P. (1995). *The Mythical Man-Month: Essays on Software Engineering*. Addison-Wesley.
- `docs/architecture/memory-system-integration-plan.md` — Existing memory system architecture
- `src/lib/learning/aer-logger.ts` — AER logging implementation
- `src/lib/learning/pattern-query.ts` — Pattern query implementation
- `memory-bank/progress.md` — P0+P1 learning integration milestones

---

**Final Status**: ⏳ **AWAITING HITL APPROVAL**

**Next Steps**:
1. Human review of ADR-001
2. Board Partner sign-off on RTM architecture
3. If approved, promote to Neo4j as Insight
4. Begin implementation of FR1, FR3, FR4, FR6, FR7