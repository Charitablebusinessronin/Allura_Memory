# lifecycle

> API documentation for `lifecycle` module.

## Functions

### `createHistoryManager`

Create a history manager with default store

---

### `createHistoryManagerWithStore`

Create a history manager with custom store

---

### `createInMemoryStore`

Create an in-memory history store

---

### `createDefaultRules`

Default policy rules generated from configuration

---

### `createPolicyManager`

Create a policy manager

---

### `isAutomaticTransition`

Check if a transition reason is automatic (not manual)

---

### `isManualTransition`

Check if a transition is manual

---

### `getStatePriority`

Get priority for a state (higher = more severe)

---

### `isTerminalState`

Check if a state is terminal (no automatic exits)

---

### `requiresManualIntervention`

Check if a state requires manual intervention to exit

---

### `isValidTransition`

Check if a transition from one state to another is valid

---

### `getAllowedReasons`

Get allowed reasons for a transition

---

### `isValidReason`

Check if a reason is valid for a transition

---

### `createStateMachine`

Create a new lifecycle state machine

---

### `isLifecycleState`

Check if a value is a valid lifecycle state

---

## Classes

### `InMemoryHistoryStore`

In-memory implementation of history store

---

### `HistoryManager`

History Manager  Manages immutable audit trail for lifecycle transitions.

---

### `PolicyManager`

Policy Manager  Manages lifecycle policies and evaluates insights against them.

---

### `LifecycleStateMachine`

Lifecycle State Machine  Manages valid state transitions for insights.

---

## Interfaces

### `HistoryStore`

Interface for history persistence

---

### `TransitionEvent`

A state transition event record

---

### `LifecyclePolicy`

Policy for automatic state transitions

---

### `TransitionRule`

A single transition rule within a policy

---

### `TransitionCondition`

Condition for a transition

---

### `PolicyConfig`

Policy configuration from YAML/JSON

---

### `PolicyGroupConfig`

Policy configuration for a group

---

### `LifecycleInsight`

Insight with lifecycle state

---

### `TransitionValidation`

Result of validating a transition

---

### `TransitionResult`

State transition result

---

### `HistoryQuery`

Query options for history

---

### `HistoryResult`

History query result

---

### `PolicyEvaluation`

Result of policy evaluation for an insight

---

### `RecommendedTransition`

A recommended transition from policy evaluation

---

### `BatchEvaluation`

Batch evaluation result

---

## Type Definitions

### `TransitionMap`

Type for allowed transitions map

---

### `LifecycleState`

Valid lifecycle states for an insight  State progression: - Active → Degraded (confidence drops) - Active → Expired (age threshold exceeded) - Active → Superseded (newer version created) - Degraded → Expired (age threshold) - Degraded → Active (confidence restored) - Any → Deprecated (manual action) - Deprecated → Active (manual restoration) - Any → Reverted (undo last transition)

---

### `TransitionReason`

Reason for a state transition

---
