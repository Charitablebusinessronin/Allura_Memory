# termination

> API documentation for `termination` module.

## Functions

### `clearTicketStore`

Clear the ticket store (for testing)

---

### `recipient`

Register a custom notification handler

---

### `createEscalationService`

Create an escalation service instance

---

### `escalateTerminatedSession`

Convenience function to escalate a terminated session

---

### `createProgressTracker`

Create a progress tracker instance

---

### `stepProgress`

Analyze bottlenecks for patterns

---

### `createSummaryGenerator`

Create a summary generator instance

---

## Classes

### `EscalationService`

Mission Control Escalation Service Handles escalation tickets and notifications for terminated sessions

---

### `ProgressTracker`

Progress Tracker - Captures execution history and detects stuck patterns

---

### `SummaryGenerator`

Summary Generator - Creates human-readable progress reports

---

## Interfaces

### `EscalationServiceConfig`

Escalation service configuration

---

### `ActionPattern`

Action pattern for stuck detection

---

### `ProgressDelta`

Progress delta tracking

---

### `SummaryGeneratorConfig`

Summary generator configuration

---

### `StuckPattern`

Stuck pattern detection result

---

### `Bottleneck`

Bottleneck detail

---

### `AttemptedStep`

Attempted step record with detailed tracking

---

### `PartialResult`

Partial result with completion status

---

### `ProgressSummary`

Progress summary report Main artifact generated when termination occurs

---

### `HumanReadableSummary`

Human-readable summary format

---

### `EscalationTicket`

Escalation ticket for Mission Control

---

### `NotificationRecord`

Notification record

---

### `EscalationConfig`

Escalation configuration

---

### `EscalationChannel`

Escalation channel configuration

---

### `ProgressTrackerConfig`

Progress tracking configuration

---

### `SummaryGenerationOptions`

Summary generation options

---

## Type Definitions

### `NotificationHandler`

Notification handlers by channel type

---

### `SummaryGeneratorConfig`

Termination Module Exports Story 3.3: Implement Fail-Safe Termination and Escalation

---

### `StepOutcome`

Execution step outcome classification

---

### `BottleneckType`

Bottleneck classification

---
