# budget

> API documentation for `budget` module.

## Functions

### `utilizationPercent`

Create an execution loop wrapper that enforces budget limits

---

### `createBudgetEnforcer`

Create a budget enforcer instance

---

### `createKmaxEnforcer`

Create a Kmax enforcer instance

---

### `utilizationPercent`

Get time breakdown for reporting

---

### `createBudgetMonitor`

Create a budget monitor instance

---

### `createStateCapture`

Create a state capture instance

---

### `estimateInputTokens`

Helper to estimate input tokens (rough estimate)

---

### `estimateOutputTokens`

Helper to estimate output tokens (rough estimate)

---

### `estimateCost`

Calculate cost from token usage

---

### `calculateUtilization`

Calculate utilization percentage

---

### `isThresholdBreached`

Check if a threshold is breached

---

### `createEmptyConsumption`

Create empty budget consumption

---

### `createSessionState`

Create session state with defaults

---

## Classes

### `BudgetEnforcer`

Budget Enforcer - Ensures hard limits are enforced This is the ENFORCEMENT layer - halts execution immediately on breach

---

### `KmaxEnforcer`

Kmax enforcement helper Simplified interface for step-based limits

---

### `BudgetMonitor`

Budget Monitor - Real-time resource tracking Tracks tokens, tool calls, execution time, and cost

---

### `StateCapture`

State Capture - Preserves session state for forensic review Stores complete session state to PostgreSQL when execution halts

---

## Interfaces

### `ExecutionLoop`

Execution loop control interface Integration point for agent execution loops

---

### `EnforcerConfig`

Enforcer configuration

---

### `EnforcementResult`

Enforcement result

---

### `MonitorConfig`

Monitor configuration

---

### `ActiveSession`

Active session tracking

---

### `StateCaptureConfig`

State capture configuration

---

### `BudgetLimits`

Budget limit configuration

---

### `BudgetConsumption`

Budget consumption snapshot

---

### `WarningThresholds`

Budget warning thresholds

---

### `BudgetStatus`

Budget status for each category

---

### `SessionId`

Session identifier for budget tracking

---

### `BudgetBreach`

Budget breach detail

---

### `SessionState`

Session state for forensic preservation

---

### `ToolCallRecord`

Tool call record for history

---

### `ReasoningStep`

Reasoning step for history

---

### `ErrorRecord`

Error record for session state

---

### `ForensicSnapshot`

Forensic snapshot stored in PostgreSQL

---

### `BudgetConsumptionReport`

Budget consumption report for storage

---

### `LLMPricing`

LLM pricing data for cost estimation

---

### `TokenUsage`

Token usage breakdown

---

### `BudgetConfig`

Budget configuration schema

---

## Type Definitions

### `HaltCallback`

Enforcer callback types

---

### `WarningCallback`

Budget Module Exports Story 3.2: Enforce Bounded Autonomy and Budget Caps

---

### `WarningCallback`

Budget warning callback

---

### `BreachCallback`

Budget breach callback

---

### `BudgetCategory`

Resource category for budget tracking

---

### `BudgetScope`

Budget allocation level

---

### `HaltReason`

Halt reason for session termination

---
