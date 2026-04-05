# ralph

> API documentation for `ralph` module.

## Functions

### `createCompletionDetector`

Create a completion detector instance

---

### `checkKmax`

Check Kmax integration - ensure we don't exceed max iterations This integrates with budget enforcer for bounded autonomy

---

### `checkCompletionAndKmax`

Check both completion promise and Kmax in one call

---

### `createRalphLoop`

Create a Ralph loop instance

---

### `runRalphLoop`

Convenience function to run a simple Ralph loop

---

### `createSelfCorrector`

Create a self-corrector instance

---

### `createEmptyPerception`

Create default perception

---

### `createInitialRalphState`

Create empty Ralph state

---

### `createRalphError`

Create Ralph error from error object

---

### `classifyError`

Classify an error type

---

### `isRecoverableError`

Determine if an error is recoverable

---

## Classes

### `CompletionDetector`

Completion Promise Detector Checks if output satisfies the completion promise

---

### `RalphLoop`

Ralph Loop Orchestrator Implements the Perceive -> Plan -> Act -> Check -> Adapt cycle

---

### `SelfCorrector`

Self-Corrector class Handles error classification, root cause analysis, and plan modification

---

## Interfaces

### `CompletionCheckResult`

Result of checking a completion promise

---

### `CompletionDetectorConfig`

Detector configuration

---

### `CombinedCheckResult`

Combine completion and Kmax checks

---

### `SelfCorrectorConfig`

Self-Corrector configuration

---

### `ErrorAnalysis`

Error analysis result with suggested strategy

---

### `RalphError`

Error record for Ralph loop history

---

### `CorrectionDecision`

Correction decision

---

### `RalphStep`

Step in the Ralph loop

---

### `RalphPlan`

Plan generated during the Plan phase

---

### `PlanStep`

Individual plan step

---

### `Perception`

Perception data gathered during Perceive phase

---

### `StuckPattern`

Stuck pattern detected in the loop

---

### `AdaptationDecision`

Adaptation decision from Adapt phase

---

### `RalphConfig`

Ralph loop configuration

---

### `BackoffStrategy`

Backoff strategy configuration

---

### `RalphState`

Ralph loop state

---

### `RalphResult`

Ralph loop result

---

### `RalphCallbacks`

Full Ralph loop callback set

---

### `RalphStatus`

Ralph loop status for monitoring

---

## Type Definitions

### `CompletionCheckResult`

Ralph Loop Module Exports Story 3.4: Execute Iterative Ralph Development Loops

---

### `CompletionPromise`

Completion promise type Can be a string to match exactly or a function that evaluates completion

---

### `ErrorClassification`

Error classification for Ralph loops

---

### `CorrectionStrategy`

Correction strategy type

---

### `RalphPhase`

Ralph loop phase

---

### `PerceiveFunction`

Perceive function type

---

### `PlanFunction`

Plan function type

---

### `ActFunction`

Act function type

---

### `CheckFunction`

Check function type

---

### `AdaptFunction`

Adapt function type

---
