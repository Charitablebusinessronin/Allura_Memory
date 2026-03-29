# Risks & Decisions Matrix: Autonomous Enterprise Stack

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model (GitHub Copilot).
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

This document captures the major architectural decisions and known risks for the autonomous enterprise stack.

---

## Table of Contents

- [1. Architectural Decisions](#1-architectural-decisions)
  - [AD-01: Governance-first admission](#ad-01-governance-first-admission)
  - [AD-02: Atomic budget checks](#ad-02-atomic-budget-checks)
  - [AD-03: group_id scoped isolation](#ad-03-group_id-scoped-isolation)
  - [AD-04: Idempotent cancellation](#ad-04-idempotent-cancellation)
  - [AD-05: Append-only raw traces](#ad-05-append-only-raw-traces)
  - [AD-06: Curated semantic promotion](#ad-06-curated-semantic-promotion)
  - [AD-07: Multi-objective meta-agent promotion](#ad-07-multi-objective-meta-agent-promotion)
  - [AD-08: Isolated evaluation lanes](#ad-08-isolated-evaluation-lanes)
- [2. Risks](#2-risks)
  - [RK-01: Cross-tenant leakage](#rk-01-cross-tenant-leakage)
  - [RK-02: Runaway spend](#rk-02-runaway-spend)
  - [RK-03: Approval deadlocks](#rk-03-approval-deadlocks)
  - [RK-04: Memory contamination](#rk-04-memory-contamination)
  - [RK-05: Unsafe high-capability scaffolds](#rk-05-unsafe-high-capability-scaffolds)
  - [RK-06: Evaluation lane credential exposure](#rk-06-evaluation-lane-credential-exposure)

---

## 1. Architectural Decisions

### AD-01: Governance-first admission

| Field                       | Detail                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Status**                  | Decided                                                                                                                         |
| **Decision**                | All high-risk actions must pass Paperclip governance and HITL approval before OpenClaw execution.                               |
| **Rationale**               | Prevents silent automation of policy-sensitive enterprise actions.                                                              |
| **Alternatives considered** | Direct runtime execution; runtime-only policy checks. Both were rejected because they weaken operator control and auditability. |
| **Owner**                   | Platform governance                                                                                                             |
| **References**              | [BLUEPRINT.md](BLUEPRINT.md#f3), [SOLUTION-ARCHITECTURE.md](SOLUTION-ARCHITECTURE.md#31-governance-and-admission-topology)      |

---

### AD-02: Atomic budget checks

| Field                       | Detail                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Status**                  | Decided                                                                                                                    |
| **Decision**                | Admission budgets are checked atomically per request and enforced as hard stops when exceeded.                             |
| **Rationale**               | Budget drift and double-admission are a common cause of runaway spend.                                                     |
| **Alternatives considered** | Soft alerts only; asynchronous reconciliation. Both were rejected because they allow excess spend before correction.       |
| **Owner**                   | Finance/control plane                                                                                                      |
| **References**              | [BLUEPRINT.md](BLUEPRINT.md#f4), [SOLUTION-ARCHITECTURE.md](SOLUTION-ARCHITECTURE.md#31-governance-and-admission-topology) |

---

### AD-03: group_id scoped isolation

| Field                       | Detail                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Status**                  | Decided                                                                                                        |
| **Decision**                | Every memory, execution, and governance write must include a `group_id` scoping key.                           |
| **Rationale**               | Enables tenant and department isolation with explicit query boundaries.                                        |
| **Alternatives considered** | Implicit tenant routing; org-unit only isolation. Both were rejected because they make leakage easier to miss. |
| **Owner**                   | Data platform                                                                                                  |
| **References**              | [BLUEPRINT.md](BLUEPRINT.md#f11), [DESIGN-MEMORY.md](DESIGN-MEMORY.md)                                         |

---

### AD-04: Idempotent cancellation

| Field                       | Detail                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Status**                  | Decided                                                                                                           |
| **Decision**                | Task cancellation is idempotent and terminal once acknowledged by runtime.                                        |
| **Rationale**               | Operators need predictable stop behavior when tasks overrun or behave unexpectedly.                               |
| **Alternatives considered** | Best-effort cancel without terminal state; forced restart only. Rejected due to inconsistent operator experience. |
| **Owner**                   | Runtime engineering                                                                                               |
| **References**              | [BLUEPRINT.md](BLUEPRINT.md#f7), [DESIGN-EXECUTION.md](DESIGN-EXECUTION.md)                                       |

---

### AD-05: Append-only raw traces

| Field                       | Detail                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------- |
| **Status**                  | Decided                                                                                 |
| **Decision**                | Postgres stores immutable raw memory events; records are never edited in place.         |
| **Rationale**               | Forensics and reproducibility require an unmodified event history.                      |
| **Alternatives considered** | Mutable event rows; event compaction in place. Rejected because it destroys provenance. |
| **Owner**                   | Memory platform                                                                         |
| **References**              | [BLUEPRINT.md](BLUEPRINT.md#f9), [DESIGN-MEMORY.md](DESIGN-MEMORY.md)                   |

---

### AD-06: Curated semantic promotion

| Field                       | Detail                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| **Status**                  | Decided                                                                                        |
| **Decision**                | Neo4j receives only curator-reviewed, versioned semantic insights.                             |
| **Rationale**               | Keeps noisy runtime traces out of the knowledge graph unless they are reviewed and normalized. |
| **Alternatives considered** | Direct automatic graph writes from runtime traces. Rejected due to contamination risk.         |
| **Owner**                   | Knowledge curation                                                                             |
| **References**              | [BLUEPRINT.md](BLUEPRINT.md#f10), [DESIGN-MEMORY.md](DESIGN-MEMORY.md)                         |

---

### AD-07: Multi-objective meta-agent promotion

| Field                       | Detail                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------- |
| **Status**                  | Decided                                                                                 |
| **Decision**                | Candidate promotion uses both capability and safety metrics, not capability alone.      |
| **Rationale**               | High-performing but unsafe scaffolds are unacceptable in enterprise automation.         |
| **Alternatives considered** | Capability-only thresholding. Rejected because it systematically prefers risky designs. |
| **Owner**                   | Meta-agent governance                                                                   |
| **References**              | [BLUEPRINT.md](BLUEPRINT.md#f14), [DESIGN-META-AGENT.md](DESIGN-META-AGENT.md)          |

---

### AD-08: Isolated evaluation lanes

| Field                       | Detail                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Status**                  | Decided                                                                                                 |
| **Decision**                | ADAS and AgentBreeder evaluations run in isolated lanes with no production secret reuse.                |
| **Rationale**               | Red-mode exploration can intentionally stress unsafe behaviors and must be fenced off.                  |
| **Alternatives considered** | Shared production runtime; credential sharing with masking. Rejected because exposure risk is too high. |
| **Owner**                   | Security engineering                                                                                    |
| **References**              | [BLUEPRINT.md](BLUEPRINT.md#f13), [DESIGN-META-AGENT.md](DESIGN-META-AGENT.md)                          |

---

## 2. Risks

| ID                                                  | Title                               | Severity    | Status       |
| --------------------------------------------------- | ----------------------------------- | ----------- | ------------ |
| [RK-01](#rk-01-cross-tenant-leakage)                | Cross-tenant leakage                | High        | 🔴 Open      |
| [RK-02](#rk-02-runaway-spend)                       | Runaway spend                       | High        | ✅ Mitigated |
| [RK-03](#rk-03-approval-deadlocks)                  | Approval deadlocks                  | Medium-High | 🔴 Open      |
| [RK-04](#rk-04-memory-contamination)                | Memory contamination                | High        | ✅ Mitigated |
| [RK-05](#rk-05-unsafe-high-capability-scaffolds)    | Unsafe high-capability scaffolds    | High        | ✅ Mitigated |
| [RK-06](#rk-06-evaluation-lane-credential-exposure) | Evaluation lane credential exposure | High        | ✅ Mitigated |

---

### RK-01: Cross-tenant leakage

| Field                | Detail                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Severity**         | High                                                                                                                          |
| **Likelihood**       | Medium                                                                                                                        |
| **Status**           | 🔴 Open                                                                                                                       |
| **Description**      | A query or write path omits `group_id`, allowing memory or execution state from one tenant to be observed by another.         |
| **Mitigation**       | Enforce `group_id` validation at admission, persistence, and query layers; add automated coverage for tenant boundary checks. |
| **Owner**            | Data platform                                                                                                                 |
| **Related decision** | AD-03                                                                                                                         |

---

### RK-02: Runaway spend

| Field                | Detail                                                                           |
| -------------------- | -------------------------------------------------------------------------------- |
| **Severity**         | High                                                                             |
| **Likelihood**       | Medium                                                                           |
| **Status**           | ✅ Mitigated                                                                     |
| **Description**      | Agent loops or repeated retries consume token budget beyond expected thresholds. |
| **Mitigation**       | Atomic budget admission, hard-stop enforcement, and alerting on threshold hits.  |
| **Owner**            | Finance/control plane                                                            |
| **Related decision** | AD-02                                                                            |

---

### RK-03: Approval deadlocks

| Field                | Detail                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| **Severity**         | Medium-High                                                                                    |
| **Likelihood**       | Medium                                                                                         |
| **Status**           | 🔴 Open                                                                                        |
| **Description**      | Required HITL approvals may stall if approvers are unavailable or policies are misconfigured.  |
| **Mitigation**       | Add escalation paths, timeout policies, and fallback approver sets with explicit audit trails. |
| **Owner**            | Governance operations                                                                          |
| **Related decision** | AD-01                                                                                          |

---

### RK-04: Memory contamination

| Field                | Detail                                                                             |
| -------------------- | ---------------------------------------------------------------------------------- |
| **Severity**         | High                                                                               |
| **Likelihood**       | Medium                                                                             |
| **Status**           | ✅ Mitigated                                                                       |
| **Description**      | Noisy runtime traces could be promoted into semantic memory without proper review. |
| **Mitigation**       | Curator review workflow, promotion approvals, and versioned insight writes only.   |
| **Owner**            | Knowledge curation                                                                 |
| **Related decision** | AD-06                                                                              |

---

### RK-05: Unsafe high-capability scaffolds

| Field                | Detail                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| **Severity**         | High                                                                                                   |
| **Likelihood**       | High                                                                                                   |
| **Status**           | ✅ Mitigated                                                                                           |
| **Description**      | A scaffold may score well on task performance while still exhibiting unsafe behavior or policy bypass. |
| **Mitigation**       | Blue/red evaluation, multi-objective thresholds, and explicit approval gate.                           |
| **Owner**            | Meta-agent governance                                                                                  |
| **Related decision** | AD-07                                                                                                  |

---

### RK-06: Evaluation lane credential exposure

| Field                | Detail                                                                                |
| -------------------- | ------------------------------------------------------------------------------------- |
| **Severity**         | High                                                                                  |
| **Likelihood**       | Medium                                                                                |
| **Status**           | ✅ Mitigated                                                                          |
| **Description**      | A red-mode or benchmark job may access production secrets or production-scoped data.  |
| **Mitigation**       | Isolated evaluation lanes, dedicated credentials, and no reuse of production secrets. |
| **Owner**            | Security engineering                                                                  |
| **Related decision** | AD-08                                                                                 |

---

**See also:**

- [BLUEPRINT.md](BLUEPRINT.md)
- [SOLUTION-ARCHITECTURE.md](SOLUTION-ARCHITECTURE.md)
- [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md)
