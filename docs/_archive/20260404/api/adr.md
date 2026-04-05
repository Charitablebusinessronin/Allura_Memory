# adr

> API documentation for `adr` module.

## Functions

### `createADRCapture`

Create a new ADR capture instance

---

### `createInMemoryStorage`

Create in-memory storage (for testing)

---

### `createPostgreSQLStorage`

Create PostgreSQL storage (for production)

---

### `captureActionFromState`

Create action layer from state update Helper for capturing action from Ralph loop step

---

### `captureContextFromState`

Create context layer from current state Helper for capturing context from Ralph loop

---

### `initializeADRTables`

Initialize ADR tables in PostgreSQL

---

### `createFiveLayerADRBuilder`

Create a five-layer ADR builder

---

### `createOversightCapture`

Create an oversight capture instance

---

### `createADRReconstructor`

Create an ADR reconstructor instance

---

### `createReasoningManager`

Create a reasoning manager instance

---

### `createReasoningCapture`

Create a reasoning capture instance

---

### `createCounterfactualsCapture`

Create a counterfactuals capture instance

---

### `computeChecksum`

Compute checksum for data integrity Excludes checksum fields from calculation (checksum, finalChecksum, overallChecksum) Uses deterministic JSON serialization with sorted keys

---

### `removeChecksums`

Remove checksum fields recursively from an object

---

### `sortObjectKeys`

Recursively sort object keys for deterministic serialization

---

### `generateId`

Generate unique ID for ADR components

---

### `createEmptyBudgetSnapshot`

Create empty budget snapshot

---

### `createDefaultReproducibilityInfo`

Create default reproducibility info

---

### `createDefaultADR`

Create default ADR with all five layers initialized

---

## Classes

### `PostgreSQLADRStorage`

PostgreSQL-backed ADR storage

---

### `InMemoryADRStorage`

In-memory ADR storage for testing

---

### `ADRCapture`

ADRCapture - Main capture class for recording decisions AC 1: Captures all five layers

---

### `FiveLayerADRBuilder`

Five-layer ADR builder for creating complete decision records

---

### `OversightCapture`

Human Oversight Capture for Layer 5 Records all human interactions with the decision process

---

### `ADRReconstructor`

ADR Reconstruction Manager AC 3: Reconstruct decision process for audit

---

### `ReasoningCapture`

Reasoning capture builder for Layer 3 Records the thought process and evidence for decisions

---

### `CounterfactualsCapture`

Counterfactuals capture builder for Layer 4 Records alternatives considered and options rejected

---

### `ReasoningManager`

ADR Reasoning Manager Coordinates reasoning and counterfactuals capture

---

## Interfaces

### `ADRStorage`

ADR storage interface - abstract storage backend

---

### `ModelVersion`

Model version information for reproducibility

---

### `PromptVersion`

Prompt version information for reproducibility

---

### `ToolVersion`

Tool version information for reproducibility

---

### `ReproducibilityInfo`

Reproducibility metadata - AC2: model, prompt, tool versions

---

### `ActionLayer`

Layer 1: Action Logging WHAT was done - the observable action

---

### `ToolCallRecord`

Tool call record for action layer

---

### `ContextLayer`

Layer 2: Decision Context WHY it was done - state, goals, constraints at decision time

---

### `SessionContext`

Session context at decision time

---

### `BudgetSnapshot`

Budget snapshot for context

---

### `GoalContext`

Goal being pursued

---

### `ConstraintContext`

Constraint affecting the decision

---

### `OptionContext`

Available option at decision point

---

### `EnvironmentalFactors`

Environmental factors

---

### `ReasoningLayer`

Layer 3: Reasoning Chain HOW the decision was made - thought process and evidence

---

### `ThoughtStep`

Single thought step in the reasoning chain

---

### `Evidence`

Evidence supporting the reasoning

---

### `CounterfactualsLayer`

Layer 4: Counterfactuals WHAT ELSE COULD have been done - alternatives and rejections

---

### `AlternativeConsidered`

Alternative that was considered

---

### `RejectedOption`

Rejected option with reason

---

### `RiskAssessment`

Risk assessment for counterfactuals

---

### `RiskItem`

Individual risk item

---

### `MitigationStrategy`

Mitigation strategy

---

### `OversightLayer`

Layer 5: Human Oversight Trail WHO reviewed and approved - human interactions

---

### `HumanInteraction`

Human interaction record

---

### `ApprovalRecord`

Approval record

---

### `ModificationRecord`

Modification record

---

### `EscalationRecord`

Escalation record

---

### `VersionTrailEntry`

Version trail entry

---

### `AuditStatus`

Audit status for oversight layer

---

### `ComplianceFlag`

Compliance flag for SOC 2, GDPR, ISO 27001

---

### `AgentDecisionRecord`

Complete Agent Decision Record Five-layer audit trail with tamper-evidence

---

### `ADRCreationOptions`

ADR Creation options

---

### `ADRQueryOptions`

ADR Query options for retrieval

---

### `ADRReconstruction`

ADR Reconstruction result for audits (AC3)

---

### `DecisionTimelineEntry`

Decision timeline entry

---

### `EvidenceChainEntry`

Evidence chain entry

---

### `HumanOversightSummary`

Human oversight summary

---

### `ComplianceVerification`

Compliance verification result

---

### `ComplianceStatus`

Compliance status for a framework

---

### `ComplianceIssue`

Compliance issue

---

### `TamperIntegrityCheck`

Tamper integrity check

---

## Type Definitions

### `AgentDecisionRecord`

ADR Capture - Recording Agent Decision Records Story 3.5: Record Five-Layer Agent Decision Records  AC 1: Given an agent completes a reasoning step, when the state is updated,       then the system logs Action, Context, Reasoning, Counterfactuals, and Oversight.  This module handles the capture and storage of decision records.

---

### `ADRStorage`

ADR Index - Public API for Agent Decision Records Story 3.5: Record Five-Layer Agent Decision Records  Five-layer audit trail for SOC 2, GDPR, ISO 27001 compliance: - Layer 1: Action Logging (what was done) - Layer 2: Decision Context (why it was done) - Layer 3: Reasoning Chain (how the decision was made) - Layer 4: Counterfactuals (what else could have been done) - Layer 5: Human Oversight Trail (who reviewed and approved)

---

### `OversightLayer`

ADR Human Oversight Trail - Layer 5 Story 3.5: Record Five-Layer Agent Decision Records  AC 1, AC 2: Captures human interactions, approvals, version tracking This module handles Layer 5 (Human Oversight Trail)

---

### `ReasoningLayer`

ADR Reasoning Layer - Thought Process and Counterfactual Capture Story 3.5: Record Five-Layer Agent Decision Records  AC 1: Records reasoning chain and counterfactuals This module handles Layer 3 (Reasoning) and Layer 4 (Counterfactuals)

---

### `ADRLifecycle`

ADR Lifecycle states

---

### `ActionType`

Types of actions that can be logged

---

### `ActionResult`

Result of an action

---

### `ReasoningType`

Types of reasoning

---
