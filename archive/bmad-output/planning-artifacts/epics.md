---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - PRD (chat-provided): Unified AI Knowledge System with ADAS Integration
  - Architecture (chat-provided): Unified AI Knowledge System with ADAS Integration
  - Architecture Addendum (chat-provided): Making a Cognitive Kernel
  - Checklist (chat-provided): Enterprise Hardening Checklist
---

# memory - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for memory, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: The system must implement a meta agent that iteratively programs new agents in code based on previous discoveries.

FR2: The system must provide an `evaluate_forward_fn` evaluation harness that measures candidate designs against objective metrics including accuracy, cost, and latency.

FR3: Successful ADAS-discovered designs must be versioned as Insights in Neo4j.

FR4: Successful ADAS-discovered designs that meet the confidence threshold of 0.7 or higher must be mirrored to the AI Agents Registry in Notion after approval.

FR5: All raw events, execution logs, workflow traces, and ADAS evaluation traces must be stored in an append-only PostgreSQL log.

FR6: Neo4j must store entities, relationships, and versioned Insights using the Steel Frame model so agents can reason about current and historical truth.

FR7: Human-readable technical documentation, agent definitions, and project specifications must be mirrored to Notion.

FR8: A periodic Knowledge Curator agent must scan PostgreSQL traces and propose promoted knowledge back to Neo4j and Notion.

FR9: The system must deduplicate entities using text embedding similarity and word-distance matching.

FR10: The system must enforce a canonical lowercase tag list to prevent sync drift and ensure correct `group_id` routing.

FR11: The system must manage the insight lifecycle with states including Active, Degraded, Expired, and Superseded.

FR12: The AI reasoning kernel must be separated from execution, state management, and policy enforcement.

FR13: The kernel must interact with the rest of the system through typed tool interfaces and schemas.

FR14: The system must implement a closed-loop control architecture following Perceive -> Plan -> Act -> Adapt / ReAct style execution.

FR15: The control layer must manage state machines for kernel progress.

FR16: The system must provide hierarchical memory across working memory, episodic memory, and semantic memory.

FR17: Every action proposed by the kernel must be mediated by a policy/tool gateway before execution.

FR18: Tool calls and model-generated code must execute in isolated Ubuntu Docker sandboxes.

FR19: The system must capture structured traces for each critical kernel decision, including reasoning chains and alternatives considered.

FR20: All side-effecting actions and high-risk operations must be routed through explicit human approval flows in Mission Control.

FR21: Architectural and behavioral changes must be logged as Agent Decision Records (ADRs).

FR22: The orchestrator must connect worker agents to channels and execution environments through an OpenClaw/OpenCode gateway.

FR23: The ADAS engine must support a `search.py`-style search process for iterative agent design discovery.

FR24: The promotion pipeline must link promoted designs and insights back to PostgreSQL evidence via `trace_ref`.

FR25: The system must support multi-project collaboration and isolation using `group_id`-based tenancy.

### NonFunctional Requirements

NFR1: The PostgreSQL trace store must be append-only and optimized for durable storage of noisy operational data.

NFR2: The Neo4j memory graph must preserve immutable lineage for promoted insights and designs.

NFR3: The system must support audit reconstruction for up to 12 months after a decision or promotion event.

NFR4: Every critical agent decision must capture five audit layers: action logging, decision context, reasoning chain, counterfactuals, and human oversight trail.

NFR5: The architecture must satisfy production safety and compliance expectations for SOC 2, GDPR, and ISO 27001.

NFR6: High-risk or untrusted code execution must be isolated in sandboxed Ubuntu Docker environments.

NFR7: The control layer must enforce bounded autonomy through hard limits on tokens, execution time, tool calls, monetary cost, and step count (`Kmax`).

NFR8: The system must fail safely by summarizing progress, identifying bottlenecks, and escalating to a human operator when limits are reached.

NFR9: Tools must be idempotent so retries do not create duplicate side effects.

NFR10: Multi-tenant isolation must prevent cross-project contamination while still allowing approved global knowledge sharing.

NFR11: Tag governance must use canonical lowercase values to maintain sync integrity and deterministic routing.

NFR12: Tool interfaces must be typed and versioned to preserve operational consistency.

NFR13: The system must support trace-driven debugging as the primary debugging substrate instead of ad hoc logs.

NFR14: Policy checks for authorization, compliance, and risk must occur before external interactions.

### Additional Requirements

- Architecture requires a minimal 4-layer knowledge stack: AI Reasoning, Raw Trace, Promoted Semantic Knowledge, and Human Workspace.
- Architecture requires a governed reference architecture with a specialized Control Layer wrapped around the reasoning kernel.
- The Policy Enforcement Gateway is a mandatory mediator for all side-effecting tool calls.
- Hierarchical memory must distinguish working memory, episodic memory, and semantic memory.
- Tools must be exposed as typed, versioned contracts, such as MCP or OpenAPI-style interfaces.
- The ADAS engine must execute a search process that iteratively programs and evaluates new agent designs in code.
- Winning ADAS designs must be logged as `ADASRun` evidence and promoted to `AgentDesign` only after approval.
- Promotion artifacts in Neo4j must maintain a tamper-evident chain of causality linked back to PostgreSQL traces.
- The runtime must implement graceful degradation and escalation through Mission Control when operational bounds are hit.
- Circuit breakers must halt execution when error rates spike or token/time/cost budgets are exceeded.
- The Ralph Wiggum iterative feedback loop pattern must support self-referential improvement until a completion promise is met.
- The control layer must enforce retry and backoff logic around stochastic reasoning.
- OpenClaw/OpenCode must operate as the central orchestrator for channels, workers, and execution environments.
- An import/lifting pipeline is required to move raw trace material into promoted semantic knowledge.
- The checklist proposes Apache NiFi as an import manager for semantic lifting from PostgreSQL into Neo4j.
- Insight versioning must support immutable versions and relationship/state semantics such as `SUPERSEDES`, `DEPRECATED`, and `REVERTED`.

### UX Design Requirements

No UX Design document was provided for this step.

### FR Coverage Map

FR1: Epic 2 - Meta agent iteratively programs new agent designs
FR2: Epic 2 - Evaluation harness measures candidate performance
FR3: Epic 2 - Successful designs versioned as Insights in Neo4j
FR4: Epic 2 - Approved high-confidence designs mirrored to Notion
FR5: Epic 1 - Raw traces and evaluation logs stored in PostgreSQL
FR6: Epic 1 - Semantic graph stores versioned insights with Steel Frame
FR7: Epic 3 - Human-readable documentation and registries mirrored to Notion/Mission Control governance surfaces where applicable
FR8: Epic 4 - Knowledge Curator proposes promoted knowledge
FR9: Epic 4 - Entity deduplication via embeddings and word-distance
FR10: Epic 4 - Canonical lowercase tags and group_id routing
FR11: Epic 4 - Insight lifecycle state management
FR12: Epic 3 - Reasoning kernel separated from execution and policy
FR13: Epic 3 - Typed interfaces and schemas for system interaction
FR14: Epic 3 - Closed-loop ReAct / Perceive-Plan-Act-Adapt execution
FR15: Epic 3 - State machine management for kernel progress
FR16: Epic 1 - Hierarchical memory across working, episodic, semantic layers
FR17: Epic 3 - Policy/tool gateway mediates all actions
FR18: Epic 3 - Isolated Ubuntu Docker sandbox for execution
FR19: Epic 1 - Structured traces capture critical decisions
FR20: Epic 3 - High-risk actions require Mission Control approval
FR21: Epic 3 - ADRs capture architectural and behavioral change records
FR22: Epic 3 - OpenClaw/OpenCode gateway orchestrates workers and channels
FR23: Epic 2 - search.py-style ADAS discovery process
FR24: Epic 1 - Evidence lineage and trace_ref-backed memory retrieval, plus curation preservation in Epic 4
FR25: Epic 1 - Multi-project collaboration and isolation via group_id

## Epic List

### Epic 1: Persistent Knowledge Capture and Tenant-Aware Memory
Enable AI engineering teams to capture, isolate, and retrieve durable project memory across raw traces, semantic knowledge, and shared/global context without starting from zero.
**FRs covered:** FR5, FR6, FR16, FR19, FR24, FR25

### Epic 2: ADAS Discovery and Design Promotion Pipeline
Automate the search for higher-performing agentic architectures through iterative search, evaluation in a sandbox, and structured promotion to the permanent knowledge registry.
**FRs covered:** FR1, FR2, FR3, FR4, FR23, FR24

### Epic 3: Governed Runtime, Policy Enforcement, and Bounded Autonomy
Implement a hardened execution environment where every agent action is mediated by a policy gateway, restricted by operational budgets, and fully auditable through Agent Decision Records (ADRs).
**FRs covered:** FR7, FR12, FR13, FR14, FR15, FR17, FR18, FR20, FR21, FR22

### Epic 4: Knowledge Lifting and Automated Curation Pipeline
Implement the automated lifecycle that extracts entities and insights from PostgreSQL traces, normalizes them into the Neo4j Steel Frame, and maintains graph health through deduplication and decay logic.
**FRs covered:** FR8, FR9, FR10, FR11, FR24

## Epic 1: Persistent Knowledge Capture and Tenant-Aware Memory

Enable AI engineering teams to capture, isolate, and retrieve durable project memory across raw traces, semantic knowledge, and shared/global context without starting from zero.

### Story 1.1: Record Raw Execution Traces

As an AI engineering team,
I want all workflow events and execution outputs recorded in PostgreSQL,
So that we retain durable raw evidence for debugging, promotion, and audit.

**Acceptance Criteria:**

**Given** an agent executes a workflow step
**When** the step completes or fails
**Then** an append-only trace record is stored in PostgreSQL
**And** the record includes timestamp, agent identity, workflow context, outcome metadata, and a valid `group_id` for tenant isolation

### Story 1.2: Retrieve Episodic Memory from Trace History

As an agent operator,
I want agents to retrieve prior episodic traces from PostgreSQL,
So that they can use recent execution history as working context.

**Acceptance Criteria:**

**Given** prior traces exist for a project or agent session
**When** episodic memory is requested
**Then** the system returns relevant prior trace summaries
**And** the results are scoped to the correct tenant or project context

### Story 1.3: Store Versioned Semantic Insights in Neo4j

As an AI engineering team,
I want promoted insights stored as versioned graph knowledge,
So that agents can reason about current truth and historical truth.

**Acceptance Criteria:**

**Given** a promotable insight is approved
**When** it is written to Neo4j
**Then** it is stored as a versioned Insight node
**And** supersession relationships preserve previous versions rather than mutating them in place using specific status edges: `[:SUPERSEDES]`, `[:DEPRECATED]`, or `[:REVERTED]`

### Story 1.4: Query Dual Context Memory

As an agent,
I want to load both project-specific and global knowledge together,
So that I can reason with local context and shared best practices at the same time.

**Acceptance Criteria:**

**Given** project knowledge and global knowledge both exist
**When** the agent builds its context
**Then** the system loads both scopes in one retrieval flow
**And** the results remain clearly scoped by `group_id`

### Story 1.5: Enforce Tenant Isolation with Group IDs

As a platform owner,
I want all memory records scoped by `group_id`,
So that project knowledge remains isolated unless explicitly shared.

**Acceptance Criteria:**

**Given** a trace or insight is created
**When** it is persisted
**Then** it is stored with a valid `group_id`
**And** retrieval logic prevents cross-project leakage except for approved global context
**And** the system provides a validation mechanism to normalize tags and detect orphaned or misspelled `group_id` tags

### Story 1.6: Link Promoted Knowledge Back to Raw Evidence

As a compliance or audit reviewer,
I want each promoted insight linked back to raw PostgreSQL traces,
So that I can reconstruct why a knowledge item exists.

**Acceptance Criteria:**

**Given** an insight is promoted into Neo4j
**When** it is stored
**Then** it includes a `trace_ref` or equivalent reference to its PostgreSQL evidence
**And** an auditor can navigate from promoted knowledge back to the source trace

### Story 1.7: Automated Knowledge Curation

As an AI engineering team,
I want a Curator agent to automatically propose insights from raw traces,
So that our memory improves without manual data entry.

**Acceptance Criteria:**

**Given** raw traces exist in PostgreSQL
**When** the Curator agent identifies a successful Event -> Outcome pattern
**Then** it creates a draft Insight in Neo4j
**And** it flags the insight for human approval in the Mission Control workspace

## Epic 2: ADAS Discovery and Design Promotion Pipeline

Automate the search for higher-performing agentic architectures through iterative search, evaluation in a sandbox, and structured promotion to the permanent knowledge registry.

### Story 2.1: Implement Domain Evaluation Harness

As an AI researcher,
I want to define an `evaluate_forward_fn` with objective metrics (accuracy, cost, latency),
So that candidate agent designs can be measured against specific performance thresholds.

**Acceptance Criteria:**

**Given** a target domain exists
**When** a candidate agent design is generated
**Then** the harness evaluates it and returns a structured score
**And** the metrics are logged to the raw trace layer in PostgreSQL

### Story 2.2: Execute Meta Agent Search Loop

As an AI engineering team,
I want a meta agent to iteratively program new agent designs in code,
So that we can discover novel architectures that outperform baseline prompts.

**Acceptance Criteria:**

**Given** a domain-specific `search.py` script exists
**When** the search is executed
**Then** the meta agent produces multiple candidate AgentDesign iterations
**And** each iteration is logged as raw evidence in PostgreSQL with references available for promoted knowledge

### Story 2.3: Integrate Sandboxed Execution for ADAS

As a security officer,
I want untrusted, model-generated candidate code to run in an isolated sandbox,
So that we prevent destructive actions during the automated search process.

**Acceptance Criteria:**

**Given** a model-generated agent candidate exists
**When** the evaluation harness runs the candidate code
**Then** the execution occurs in a Docker container with restricted network and file access
**And** the process is terminated if it exceeds safety, budget, or `Kmax` constraints

### Story 2.4: Automate Design Promotion Logic

As a system architect,
I want discovered designs that meet a confidence score of 0.7 or higher to be flagged for promotion,
So that we can transition successful research into production-ready insights.

**Acceptance Criteria:**

**Given** an ADAS run result exists
**When** the performance metric exceeds the defined acceptance threshold
**Then** the system creates a candidate versioned Insight or AgentDesign proposal with linked evidence
**And** the insight becomes active only after human approval in Mission Control

### Story 2.5: Synchronize Best Designs to the Notion Registry

As a developer,
I want the best current design and its rationale mirrored to the Notion AI Agents Registry,
So that I have a human-readable library of best practices for building agents.

**Acceptance Criteria:**

**Given** a promoted AgentDesign has high confidence of 0.7 or higher and required approval
**When** the insight is finalized in Neo4j
**Then** a summary and how-to-run-it guide are mirrored to the Notion knowledge base
**And** the Notion page contains a link back to the source evidence in PostgreSQL

## Epic 3: Governed Runtime, Policy Enforcement, and Bounded Autonomy

Implement a hardened execution environment where every agent action is mediated by a policy gateway, restricted by operational budgets, and fully auditable through Agent Decision Records (ADRs).

### Story 3.1: Mediate Tool Calls via Policy Gateway

As a platform owner,
I want all side-effecting tool calls to be intercepted by a mandatory policy gateway,
So that authorization and risk evaluation precede any external interaction.

**Acceptance Criteria:**

**Given** an agent proposes a tool call
**When** the action is initiated
**Then** the gateway validates the request against typed contracts, RBAC, and security policies before execution
**And** unauthorized or high-risk actions are blocked or routed for human approval

### Story 3.2: Enforce Bounded Autonomy and Budget Caps

As an operator,
I want the system to enforce hard limits on iterations, tokens, tool calls, time, and monetary costs,
So that we prevent runaway agent behavior and infinite loops.

**Acceptance Criteria:**

**Given** an active agent session exists
**When** the loop counter reaches `Kmax` or a budget invariant is breached
**Then** the system immediately halts the execution loop
**And** the session state is preserved for forensic review

### Story 3.3: Implement Fail-Safe Termination and Escalation

As a developer,
I want a fail-safe return path that summarizes progress when limits are hit,
So that I can understand why an agent stopped and take over manually in Mission Control.

**Acceptance Criteria:**

**Given** a session has hit a budget limit or failed a policy check
**When** the loop terminates
**Then** the system generates a progress summary report with bottlenecks and attempted steps
**And** the summary is persisted with trace linkage and escalated to Mission Control for human intervention

### Story 3.4: Execute Iterative Ralph Development Loops

As an AI engineer,
I want the agent to use a self-referential Ralph loop with completion promises,
So that it can autonomously fix its own bugs and iterate until requirements are met.

**Acceptance Criteria:**

**Given** a task description and a specific completion promise exist
**When** the Ralph loop is initiated
**Then** the agent continues to refine its output despite setbacks
**And** the loop terminates only when the exact promise string is detected or `Kmax` is reached

### Story 3.5: Record Five-Layer Agent Decision Records

As a compliance officer,
I want every session to produce a comprehensive ADR capturing reasoning and counterfactuals,
So that we satisfy audit requirements for SOC 2, GDPR, and ISO 27001.

**Acceptance Criteria:**

**Given** an agent completes a reasoning step
**When** the state is updated
**Then** the system logs Action Logging, Decision Context, Reasoning Chain, Counterfactuals, and Human Oversight Trail
**And** the log includes specific model, prompt, and tool versions used for reproducibility

### Story 3.6: Implement Circuit Breakers for Operational Safety

As a system reliability engineer,
I want circuit breakers to halt the agent if error rates spike,
So that we prevent the system from wasting resources on corrupted sessions.

**Acceptance Criteria:**

**Given** an agent is executing a multi-step task
**When** successive tool calls return errors exceeding a defined threshold
**Then** the circuit breaker trips and pauses the agent
**And** the event is logged and alerted to Mission Control for operator review

### Story 3.7: Validate WhatsApp Channel Connectivity in OpenClaw Gateway

As an operator,
I want the WhatsApp channel connectivity baseline verified and documented,
So that channel routing assumptions for the governed runtime are backed by evidence.

**Acceptance Criteria:**

**Given** OpenClaw gateway configuration is present
**When** channel configuration is reviewed
**Then** WhatsApp channel enablement, allowlist policy, and plugin state are confirmed
**And** active session evidence is captured from runtime session metadata

**Given** channel baseline is already connected
**When** story evidence is recorded
**Then** no duplicate implementation work is introduced
**And** the story is tracked as validation and documentation only

## Epic 4: Knowledge Lifting and Automated Curation Pipeline

Implement the automated lifecycle that extracts entities and insights from PostgreSQL traces, normalizes them into the Neo4j Steel Frame, and maintains graph health through deduplication and decay logic.

### Story 4.1: Orchestrate Data Flows with the Import Manager

As a data engineer,
I want an import manager to orchestrate movement of data from PostgreSQL to Neo4j,
So that we have a scalable, observable pipeline for knowledge creation.

**Acceptance Criteria:**

**Given** new execution traces exist in PostgreSQL
**When** the scheduled import process triggers
**Then** it extracts Event -> Outcome pairs
**And** it passes them to the mapping service for transformation

### Story 4.2: Perform Semantic Lifting via Normalized Mapping

As a knowledge architect,
I want heterogeneous trace data mapped into a standardized semantic schema,
So that the knowledge graph remains consistent across providers and workflows.

**Acceptance Criteria:**

**Given** raw trace data exists
**When** the mapping process transforms the input
**Then** it produces standardized nodes and relationships
**And** the output aligns with canonical Neo4j labels such as `KnowledgeItem`, `AIAgent`, and `Insight`

### Story 4.3: Resolve Entity Duplicates and Graph Chaos

As a system owner,
I want an automated process to identify and reconcile duplicate nodes representing the same entity,
So that the graph maintains structural integrity and prevents redundant paths.

**Acceptance Criteria:**

**Given** the lifting pipeline identifies new nodes
**When** potential duplicates are found using embedding similarity and Levenshtein distance
**Then** the system proposes or performs canonical merge operations with audit controls
**And** existing relationships are updated to point to the canonical entity

### Story 4.4: Automate the Insight Lifecycle

As an AI engineering team,
I want the system to periodically review the health of insights based on confidence and age,
So that agents are not distracted by stale or discredited knowledge.

**Acceptance Criteria:**

**Given** versioned insights exist in Neo4j
**When** the cleanup query runs
**Then** it transitions insights to degraded, expired, or superseded states according to policy
**And** immutable history is preserved rather than overwriting prior knowledge states

### Story 4.5: Detect and Report Sync Drift

As an administrator,
I want the system to detect when Notion and Neo4j have fallen out of sync,
So that the human-managed source of truth stays aligned with agent memory.

**Acceptance Criteria:**

**Given** the knowledge base in Notion and the graph in Neo4j exist
**When** the drift detection query runs
**Then** it flags nodes missing from either system
**And** it lists stale nodes where the Notion update timestamp is newer than the Neo4j version

### Story 4.6: Mirror High-Confidence Insights to Notion

As a project manager,
I want the system to automatically create Notion pages for winning insights,
So that we have a human-readable audit trail of the system's learning.

**Acceptance Criteria:**

**Given** an insight reaches a confidence score of 0.7 or higher and required approval
**When** the mirroring process triggers
**Then** it creates a structured page in the Notion knowledge base
**And** it includes the `trace_ref` pointing back to the source evidence in PostgreSQL

## Epic 5: Notion Schema Hardening and Integration Polish

Harden the Notion integration layer with proper schema separation, complete property coverage, and verified end-to-end promotion/approval workflows.

### Story 5.1: Audit and Document Notion Database Schemas

As a system architect,
I want a complete audit of all Notion database schemas with property documentation,
So that we have clear visibility into current state and required fixes.

**Acceptance Criteria:**

**Given** the Notion workspace exists
**When** the schema audit runs
**Then** it documents all databases: Master Knowledge Base, AI Agents Registry, Agent Learning Log, Insights Database
**And** it identifies missing properties in each database
**And** it flags overloaded properties (e.g., Tags containing project/domain/status)

### Story 5.2: Fix Tags Property Overload in Master Knowledge Base

As a knowledge engineer,
I want the Tags property separated into dedicated Project, Domain, Status, and Priority properties,
So that agents don't confuse project identity with workflow state.

**Acceptance Criteria:**

**Given** Master Knowledge Base has overloaded Tags property
**When** the schema migration runs
**Then** it creates distinct properties: Project (multi-select), Domain (multi-select), Status (select), Priority (select)
**And** it migrates existing tag values to correct properties
**And** Tags becomes a free-form classification property

### Story 5.3: Complete Insights Database Schema

As a knowledge engineer,
I want all missing properties added to the Insights Database,
So that promoted insights have complete metadata in Notion.

**Acceptance Criteria:**

**Given** Insights Database is missing critical properties
**When** the schema update runs
**Then** it adds: Summary (rich_text), Canonical Tag (text), Display Tags (multi-select), Status (select), AI Accessible (checkbox), Source Insight ID (text), Source Project (text), Promoted At (date), Approved At (date), Approved By (text), Rationale (rich_text)
**And** all properties are properly typed and named

### Story 5.4: Fix Curator Notion Page Creation

As a developer,
I want the curator pipeline to correctly create Notion pages with proper content parsing,
So that insights are promoted with complete metadata.

**Acceptance Criteria:**

**Given** a candidate insight exists in Neo4j
**When** the curator promotes the insight
**Then** it creates a Notion page with structured content
**And** it stores the notion_page_id in Neo4j
**And** it marks promoted_to_notion = true

### Story 5.5: Fix Approval Sync to Update Notion Content

As a developer,
I want the approval flow to update both Neo4j status and Notion page content,
So that approval state is reflected in all systems.

**Acceptance Criteria:**

**Given** an insight is approved in Neo4j
**When** the approval sync runs
**Then** it updates Neo4j: status = "Approved", approved_by, ai_accessible = true
**And** it updates Notion page content: Status = "Approved", AI Accessible = true
**And** it handles HTML table content format correctly

### Story 5.6: Validate End-to-End Promotion Workflow

As a QA engineer,
I want a complete end-to-end test of the insight lifecycle,
So that we verify the pipeline from creation to approval.

**Acceptance Criteria:**

**Given** a test insight in Neo4j
**When** the full workflow executes
**Then** curator creates Notion page successfully
**And** approval updates Neo4j and Notion correctly
**And** rejection marks insight as rejected
**And** duplicates are detected and blocked
