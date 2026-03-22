# adas

> API documentation for `adas` module.

## Functions

### `createAgentDesign`

Create a new agent design

---

### `generateSystemPrompt`

Generate system prompt from configuration

---

### `generateAgentCode`

Generate executable code from agent design Returns TypeScript code representation

---

### `generateImports`

Generate imports section

---

### `generateConfigSection`

Generate configuration section

---

### `generateImplementation`

Generate implementation section

---

### `generateCoTImplementation`

Generate Chain-of-Thought implementation

---

### `generateReActImplementation`

Generate ReAct implementation

---

### `generatePlanAndExecuteImplementation`

Generate Plan-and-Execute implementation

---

### `generateReflexionImplementation`

Generate Reflexion implementation

---

### `generateDefaultImplementation`

Generate default implementation

---

### `generateToolImplementations`

Generate tool implementations

---

### `generateExports`

Generate exports section

---

### `serializeDesign`

Serialize agent design to JSON

---

### `deserializeDesign`

Deserialize agent design from JSON

---

### `cloneDesign`

Clone an agent design with modifications

---

### `incrementVersion`

Increment semantic version

---

### `generateRandomDesign`

Generate a random agent design from search space

---

### `calculateDiversity`

Calculate diversity between two designs

---

### `convertNumber`

Convert Neo4j node to AgentDesignNode

---

### `createApprovalWorkflowManager`

Create an approval workflow manager

---

### `approveProposal`

Convenience function to approve a proposal

---

### `rejectProposal`

Convenience function to reject a proposal

---

### `getApprovalStatus`

Convenience function to get approval status

---

### `listProposalsByStatus`

Convenience function to list proposals by status

---

### `insertADASRun`

ADAS Runs database operations

---

### `updateADASRun`

Update ADAS run status and results

---

### `logEvaluationEvent`

Log evaluation event to PostgreSQL

---

### `logEvaluationOutcome`

Log evaluation outcome to PostgreSQL

---

### `createEvaluationHarness`

Factory function to create an evaluation harness

---

### `evaluateCandidate`

Convenience function to evaluate a single candidate

---

### `evaluateAndRankCandidates`

Convenience function to evaluate and rank multiple candidates

---

### `calculateCost`

Calculate cost from token usage

---

### `calculateAccuracy`

Calculate accuracy from test results Supports both binary and weighted scoring

---

### `calculateCompositeScore`

Calculate composite score from metrics Weighted average of accuracy, cost, and latency  Cost and latency are normalized and inverted (lower is better)

---

### `buildMetrics`

Build complete metrics from evaluation results

---

### `compareMetrics`

Compare two sets of metrics Returns positive if a is better, negative if b is better

---

### `rankCandidates`

Rank candidates by composite score Implements AC3: rank candidates by composite score across accuracy, cost, latency

---

### `meetsThresholds`

Check if metrics meet minimum thresholds for a domain

---

### `normalizeMetrics`

Normalize metrics to 0-1 scale for comparison

---

### `aggregateMetrics`

Aggregate metrics across multiple evaluations

---

### `applyRandomMutation`

Apply a random mutation to a design

---

### `mutatePrompt`

Mutate the system prompt

---

### `addTool`

Add a random tool to the design

---

### `removeTool`

Remove a random tool from the design

---

### `changeModel`

Change the model configuration

---

### `changeStrategy`

Change the reasoning strategy

---

### `mutateTemperature`

Mutate model temperature

---

### `mutateMaxTokens`

Mutate max tokens

---

### `crossoverDesigns`

Crossover two designs to create offspring

---

### `createMutationRecord`

Create a mutation record for logging

---

### `applyMutations`

Apply multiple mutations in sequence

---

### `createPromotionDetector`

Create a promotion detector with configuration

---

### `scanForPromotionCandidates`

Convenience function to scan for promotion candidates

---

### `getHighConfidenceDesigns`

Convenience function to get high-confidence designs (AC3)

---

### `convertNumber`

Convert Neo4j node to AgentDesignNode

---

### `createPromotionProposalManager`

Create a promotion proposal manager

---

### `createPromotionProposal`

Convenience function to create a proposal

---

### `getPendingProposals`

Convenience function to get pending proposals

---

### `memoryMB`

Get resource usage from container

---

### `createSafetyMonitor`

Create a safety monitor with specified limits

---

### `shouldTerminateExecution`

Check if execution should be terminated based on violations

---

### `formatViolation`

Format violation for logging

---

### `run`

Generated Agent: ${design.name} Design ID: ${design.design_id} Domain: ${design.domain}

---

### `main`

Generate runner script

---

### `systemDelta`

Get resource usage from container

---

### `createSandboxExecutor`

Create a sandbox executor

---

### `executeInSandbox`

Execute design in sandbox with forward function Convenience function for evaluation harness integration

---

### `getDefaultSandboxExecutor`

Get or create default sandbox executor

---

### `createSandboxedForwardFn`

Sandboxed forward function wrapper Creates a forward function that executes in the sandbox

---

### `evaluateCandidateInSandbox`

Evaluate a candidate in sandbox AC1: Execution occurs in Docker container with restricted network/file access

---

### `createSandboxedEvaluationHarness`

Create a sandboxed evaluation harness

---

### `executeCodeInSandbox`

Execute code safely in sandbox with result extraction

---

### `batchEvaluateInSandbox`

Batch evaluate candidates in sandbox

---

### `createSearchConfig`

Create a search configuration with defaults

---

### `runMetaAgentSearch`

Run a meta agent search Convenience function for AC1, AC2, AC3

---

## Classes

### `ApprovalWorkflowManager`

Approval Workflow Manager Handles approve/reject actions with audit trail

---

### `EvaluationHarness`

Evaluation Harness class The core component for measuring candidate agent designs

---

### `TokenCounter`

Token usage tracker for evaluating agents

---

### `LatencyTracker`

Latency tracker for evaluating agents

---

### `PromotionDetector`

Promotion Detector Scans ADAS runs and identifies promotion candidates

---

### `PromotionProposalManager`

Promotion Proposal Manager Creates and manages AgentDesign proposals in Neo4j

---

### `SafetyMonitor`

Safety Monitor class Monitors Docker containers for resource violations

---

### `SandboxExecutor`

Sandbox executor class Manages Docker-based isolated execution for agent candidates

---

### `KmaxCounter`

Kmax step counter for bounded autonomy

---

### `SandboxedEvaluationHarness`

Sandboxed evaluation harness wrapper Provides sandboxed execution for all evaluation operations

---

### `MetaAgentSearch`

Meta Agent Search class

---

## Interfaces

### `SearchSpace`

Search space configuration Defines the space of possible agent configurations

---

### `ApprovalResult`

Approval result

---

### `RejectionResult`

Rejection result

---

### `ApprovalStatus`

Approval status check result

---

### `MutationConfig`

Mutation configuration

---

### `MutationRecord`

Mutation record for logging

---

### `PromotionConfig`

Promotion configuration

---

### `PromotionCandidate`

Promotion candidate identified from ADAS runs

---

### `PromotionEvidence`

Evidence collected for a promotion decision

---

### `PromotionDetectionResult`

Promotion detection result

---

### `ADASRunWithEvidence`

Query result from adas_runs joined with events/outcomes

---

### `EventWithMetrics`

Event result with metrics

---

### `AgentDesignNode`

AgentDesign node type Stored in Neo4j for versioned agent designs

---

### `AgentDesignHead`

AgentDesign head node (tracks current version)

---

### `CreateProposalPayload`

Proposal creation payload

---

### `CreateProposalResult`

Proposal creation result

---

### `ApprovalAction`

Approval action payload

---

### `RejectionAction`

Rejection action payload

---

### `ApprovalHistoryRecord`

Approval history record

---

### `SafetyViolation`

Safety violation record

---

### `ResourceUsageStats`

Resource usage statistics

---

### `ResourceLimits`

Resource limits configuration

---

### `SafetyCheckResult`

Safety check result

---

### `SandboxOptions`

Sandbox configuration options

---

### `ExecutionResult`

Execution result from sandbox AC3: Captures stdout, stderr, and exit code

---

### `ResourceUsage`

Resource usage statistics

---

### `KmaxState`

Kmax step counting for bounded autonomy

---

### `SandboxExecutionRequest`

Sandbox execution request

---

### `DockerManager`

Manager for Docker container operations

---

### `SandboxedEvaluationConfig`

Configuration for sandboxed evaluation

---

### `SearchConfig`

Search configuration

---

### `SearchIteration`

Search iteration result

---

### `SearchResult`

Search result

---

### `SearchStateRecord`

Search iteration result

---

### `StoredDesign`

Design storage for PostgreSQL Note: Design data is stored via events/outcomes tables for trace evidence

---

### `AgentDesign`

Agent Design candidate representation This is a serializable representation of an agent architecture that can be evaluated by the harness

---

### `AgentDesignConfig`

Agent design configuration Contains the actual architectural decisions

---

### `AgentTool`

Tool definition for an agent

---

### `ModelConfig`

Model configuration

---

### `AgentDesignMetadata`

Design metadata

---

### `EvaluationMetrics`

Evaluation metrics for a candidate agent design These form the structured score from AC1

---

### `TokenUsage`

Token usage tracking for cost calculation

---

### `EvaluationDetails`

Detailed evaluation context

---

### `EvaluationResult`

Evaluation result combining design and metrics

---

### `CandidateRanking`

Comparison ranking result Used for AC3 - ranking candidates by composite score

---

### `DomainConfig`

Domain configuration for evaluation Configurable per-domain evaluation criteria from Task 1.2.3

---

### `GroundTruthCase`

Ground truth test case

---

### `EvaluationHarnessConfig`

Evaluation harness configuration

---

### `ADASRun`

ADAS run record - mirrors adas_runs table

---

### `ADASRunInsert`

ADAS run insert payload for PostgreSQL

---

### `ADASRunRecord`

ADAS run result record from PostgreSQL

---

### `EvaluationEventInsert`

Evaluation event insert payload

---

### `EvaluationOutcomeInsert`

Evaluation outcome insert payload

---

## Type Definitions

### `ManagedTransaction`

Approval Workflow for ADAS Promotion Story 2.4: Automate Design Promotion Logic  Manages approval/rejection of promotion proposals. Implements AC2: Insight becomes active only after human approval in Mission Control

---

### `MutationType`

Mutation type for tracking

---

### `PromotionStatus`

Promotion status values following the state machine from Task 1: candidate -> pending_approval -> approved/rejected

---

### `ManagedTransaction`

Promotion Proposal Creation for ADAS Story 2.4: Automate Design Promotion Logic  Creates Neo4j AgentDesign proposals for high-confidence designs. Implements AC1: Creates candidate versioned Insight/AgentDesign with linked evidence

---

### `ViolationType`

Safety constraint violations

---

### `of`

Get the most severe violation

---

### `SandboxOptions`

Sandboxed Evaluation Integration Story 2.3: Integrate Sandboxed Execution for ADAS  Integrates sandbox execution with the evaluation harness to provide safe evaluation of untrusted agent candidates.

---

### `ReasoningStrategy`

Reasoning strategy types

---

### `ForwardFn`

Forward function signature The core function that agents implement to solve domain tasks This is what the harness evaluates

---

### `EvaluationEventType`

Evaluation event types for tracking in PostgreSQL

---
