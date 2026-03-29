# Requirements Traceability Matrix

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model (GitHub Copilot).
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

This matrix traces business and functional requirements for the Autonomous Enterprise stack across design artifacts.

---

## 1. Business Requirements -> Functional Requirements

| ID  | Business Requirement                                 | Functional Requirements                            | Use Cases          |
| --- | ---------------------------------------------------- | -------------------------------------------------- | ------------------ |
| B1  | Define org structure, goals, and governance gates    | [F1](#f1), [F2](#f2), [F3](#f3)                    | MGT-UC1            |
| B2  | Run autonomous employees through controlled runtime  | [F5](#f5), [F6](#f6), [F7](#f7), [F8](#f8)         | EXE-UC1, EXE-UC2   |
| B3  | Preserve institutional memory with tenant isolation  | [F9](#f9), [F10](#f10), [F11](#f11), [F12](#f12)   | MEM-UC1, MEM-UC2   |
| B4  | Continuously improve designs while preserving safety | [F13](#f13), [F14](#f14), [F15](#f15), [F16](#f16) | META-UC1, META-UC2 |
| B5  | Enforce budget limits and stop runaway loops         | [F4](#f4), [F7](#f7), [F18](#f18)                  | MGT-UC2, EXE-UC2   |
| B6  | Reconstruct decisions and outcomes for audit         | [F17](#f17), [F18](#f18)                           | MGT-UC1, MEM-UC1   |

---

## 2. Functional Requirements Detail

### Management & Governance (F1-F4)

| ID                  | Requirement                                      | Satisfied by                                                                                |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| <a name="f1"></a>F1 | Tenant and org-unit lifecycle APIs               | `POST /v1/tenants` · `POST /v1/org-units` · [DESIGN-MANAGEMENT.md](DESIGN-MANAGEMENT.md)    |
| <a name="f2"></a>F2 | Goal ancestry tracking from company goal to task | `POST /v1/goals` · [DESIGN-MANAGEMENT.md#goal-ancestry](DESIGN-MANAGEMENT.md#goal-ancestry) |
| <a name="f3"></a>F3 | Configurable HITL approval gates                 | `POST /v1/approvals/{requestId}/resolve` · [DESIGN-MANAGEMENT.md](DESIGN-MANAGEMENT.md)     |
| <a name="f4"></a>F4 | Budget checks with hard-stop semantics           | `POST /v1/budgets/check` · [DESIGN-MANAGEMENT.md](DESIGN-MANAGEMENT.md)                     |

### Runtime Execution (F5-F8)

| ID                  | Requirement                                | Satisfied by                                                                                                      |
| ------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| <a name="f5"></a>F5 | Versioned runtime agent profile mapping    | `POST /v1/tasks/dispatch` profile resolution · [DESIGN-EXECUTION.md](DESIGN-EXECUTION.md)                         |
| <a name="f6"></a>F6 | Dispatch approved tasks into OpenClaw      | `POST /v1/tasks/dispatch` · [DESIGN-EXECUTION.md](DESIGN-EXECUTION.md)                                            |
| <a name="f7"></a>F7 | Retry, cancel, and blocked-state behavior  | `POST /v1/tasks/{executionId}/cancel` · state machine in [DESIGN-EXECUTION.md](DESIGN-EXECUTION.md#state-machine) |
| <a name="f8"></a>F8 | Operator override controls across channels | override admission and cancel path · [DESIGN-EXECUTION.md](DESIGN-EXECUTION.md)                                   |

### Memory & Knowledge (F9-F12)

| ID                    | Requirement                                  | Satisfied by                                                                                                             |
| --------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| <a name="f9"></a>F9   | Immutable raw traces in Postgres             | `POST /v1/memory/raw-events` · [DESIGN-MEMORY.md](DESIGN-MEMORY.md)                                                      |
| <a name="f10"></a>F10 | Curator-reviewed semantic promotion to Neo4j | `POST /v1/memory/promotions` · `POST /v1/memory/promotions/{promotionId}/approve` · [DESIGN-MEMORY.md](DESIGN-MEMORY.md) |
| <a name="f11"></a>F11 | Strict `group_id` isolation                  | mandatory scope validation · [DESIGN-MEMORY.md](DESIGN-MEMORY.md)                                                        |
| <a name="f12"></a>F12 | Scoped memory recall with provenance         | `GET /v1/memory/insights` · [DESIGN-MEMORY.md](DESIGN-MEMORY.md)                                                         |

### Meta-Agent & Safety (F13-F18)

| ID                    | Requirement                                             | Satisfied by                                                                                                                                   |
| --------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| <a name="f13"></a>F13 | ADAS candidate generation in isolated lane              | `POST /v1/meta/candidates/generate` · [DESIGN-META-AGENT.md](DESIGN-META-AGENT.md)                                                             |
| <a name="f14"></a>F14 | Blue/red evaluations with capability and safety metrics | `POST /v1/meta/candidates/{candidateId}/evaluate` · [DESIGN-META-AGENT.md](DESIGN-META-AGENT.md)                                               |
| <a name="f15"></a>F15 | Promotion requires policy + approval                    | `POST /v1/meta/candidates/{candidateId}/promote` · [DESIGN-MANAGEMENT.md](DESIGN-MANAGEMENT.md) · [DESIGN-META-AGENT.md](DESIGN-META-AGENT.md) |
| <a name="f16"></a>F16 | Failure trajectories become lessons/skills              | promotion and curation pipeline · [DESIGN-MEMORY.md](DESIGN-MEMORY.md) · [DESIGN-META-AGENT.md](DESIGN-META-AGENT.md)                          |
| <a name="f17"></a>F17 | Audit logs for decisions and outcomes                   | governance and promotion audit writes · [DESIGN-MANAGEMENT.md](DESIGN-MANAGEMENT.md) · [DESIGN-MEMORY.md](DESIGN-MEMORY.md)                    |
| <a name="f18"></a>F18 | Alerts for budget/safety regressions                    | event-driven alerts · [DESIGN-EXECUTION.md](DESIGN-EXECUTION.md) · [DESIGN-META-AGENT.md](DESIGN-META-AGENT.md)                                |

---

## 3. Use Case Index

### Management Use Cases

| ID      | Name                                  | Design Doc                                                                                                                               | Requirements |
| ------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| MGT-UC1 | Approve high-risk candidate promotion | [DESIGN-MANAGEMENT.md#mgt-uc1-approve-high-risk-candidate-promotion](DESIGN-MANAGEMENT.md#mgt-uc1-approve-high-risk-candidate-promotion) | F3, F15, F17 |
| MGT-UC2 | Block dispatch on budget hard stop    | [DESIGN-MANAGEMENT.md#mgt-uc2-block-dispatch-on-budget-hard-stop](DESIGN-MANAGEMENT.md#mgt-uc2-block-dispatch-on-budget-hard-stop)       | F4, F17      |

### Execution Use Cases

| ID      | Name                               | Design Doc                                                                                                                       | Requirements |
| ------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| EXE-UC1 | Execute admitted task successfully | [DESIGN-EXECUTION.md#exe-uc1-execute-admitted-task-successfully](DESIGN-EXECUTION.md#exe-uc1-execute-admitted-task-successfully) | F5, F6       |
| EXE-UC2 | Cancel long-running task           | [DESIGN-EXECUTION.md#exe-uc2-cancel-long-running-task](DESIGN-EXECUTION.md#exe-uc2-cancel-long-running-task)                     | F7, F8       |

### Memory Use Cases

| ID      | Name                               | Design Doc                                                                                                                 | Requirements |
| ------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------ |
| MEM-UC1 | Promote high-value failure pattern | [DESIGN-MEMORY.md#mem-uc1-promote-high-value-failure-pattern](DESIGN-MEMORY.md#mem-uc1-promote-high-value-failure-pattern) | F10, F16     |
| MEM-UC2 | Tenant-scoped recall query         | [DESIGN-MEMORY.md#mem-uc2-tenant-scoped-recall-query](DESIGN-MEMORY.md#mem-uc2-tenant-scoped-recall-query)                 | F11, F12     |

### Meta-Agent Use Cases

| ID       | Name                                    | Design Doc                                                                                                                                     | Requirements |
| -------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| META-UC1 | Promote balanced candidate              | [DESIGN-META-AGENT.md#meta-uc1-promote-balanced-candidate](DESIGN-META-AGENT.md#meta-uc1-promote-balanced-candidate)                           | F14, F15     |
| META-UC2 | Reject unsafe high-capability candidate | [DESIGN-META-AGENT.md#meta-uc2-reject-unsafe-high-capability-candidate](DESIGN-META-AGENT.md#meta-uc2-reject-unsafe-high-capability-candidate) | F14, F18     |
