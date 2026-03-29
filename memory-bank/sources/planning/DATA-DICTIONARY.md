# Data Dictionary: Autonomous Enterprise Stack

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model (GitHub Copilot).
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

This dictionary is the canonical field reference for core entities used by the autonomous enterprise architecture.

---

## Table of Contents

- [Entity: tenant](#entity-tenant)
- [Entity: org-unit](#entity-org-unit)
- [Entity: agent-profile](#entity-agent-profile)
- [Entity: task-execution](#entity-task-execution)
- [Entity: raw-memory-event](#entity-raw-memory-event)
- [Entity: semantic-insight](#entity-semantic-insight)
- [Entity: knowledge-promotion](#entity-knowledge-promotion)
- [Entity: scaffold-candidate](#entity-scaffold-candidate)
- [Events](#events)

---

## Entity: tenant

Schema: [`json-schema/tenant.schema.json`](json-schema/tenant.schema.json)

| Field            | Type             | Required | Description                 |
| ---------------- | ---------------- | -------- | --------------------------- |
| `tenant_id`      | string           | Yes      | Stable tenant identifier    |
| `name`           | string           | Yes      | Human-readable tenant name  |
| `status`         | enum             | Yes      | Tenant lifecycle status     |
| `isolation_mode` | enum             | Yes      | Isolation strictness policy |
| `created_at`     | date-time string | Yes      | Creation timestamp          |
| `updated_at`     | date-time string | Yes      | Last update timestamp       |

`status` values: `active`, `paused`, `archived`

`isolation_mode` values: `strict`, `standard`

---

## Entity: org-unit

Schema: [`json-schema/org-unit.schema.json`](json-schema/org-unit.schema.json)

| Field                  | Type             | Required | Description                      |
| ---------------------- | ---------------- | -------- | -------------------------------- |
| `org_unit_id`          | string           | Yes      | Stable org-unit identifier       |
| `tenant_id`            | string           | Yes      | Parent tenant                    |
| `name`                 | string           | Yes      | Department or business-unit name |
| `status`               | enum             | Yes      | Org-unit lifecycle status        |
| `monthly_token_budget` | integer          | No       | Optional unit-level budget cap   |
| `created_at`           | date-time string | Yes      | Creation timestamp               |
| `updated_at`           | date-time string | Yes      | Last update timestamp            |

`status` values: `active`, `frozen`, `retired`

Relationship notes: many `org-unit` rows belong to one `tenant`.

---

## Entity: agent-profile

Schema: [`json-schema/agent-profile.schema.json`](json-schema/agent-profile.schema.json)

| Field                  | Type             | Required | Description                       |
| ---------------------- | ---------------- | -------- | --------------------------------- |
| `agent_id`             | string           | Yes      | Stable profile identifier         |
| `tenant_id`            | string           | Yes      | Tenant scope                      |
| `org_unit_id`          | string           | Yes      | Owning org unit                   |
| `role`                 | string           | Yes      | Functional role label             |
| `runtime_target`       | string           | Yes      | Runtime execution target          |
| `policy_bundle`        | object           | Yes      | Tool and behavior policy settings |
| `token_budget_monthly` | integer          | Yes      | Monthly token envelope            |
| `status`               | enum             | Yes      | Profile lifecycle status          |
| `version`              | integer          | Yes      | Profile revision number           |
| `created_at`           | date-time string | Yes      | Creation timestamp                |
| `updated_at`           | date-time string | Yes      | Last update timestamp             |

`status` values: `candidate`, `approved`, `active`, `suspended`, `retired`

---

## Entity: task-execution

Schema: [`json-schema/task-execution.schema.json`](json-schema/task-execution.schema.json)

| Field           | Type             | Required | Description                          |
| --------------- | ---------------- | -------- | ------------------------------------ |
| `execution_id`  | string           | Yes      | Stable execution identifier          |
| `goal_id`       | string           | Yes      | Goal lineage leaf                    |
| `tenant_id`     | string           | Yes      | Tenant scope                         |
| `org_unit_id`   | string           | Yes      | Org-unit scope                       |
| `group_id`      | string           | Yes      | Isolation partition key              |
| `agent_id`      | string           | Yes      | Assigned agent profile               |
| `status`        | enum             | Yes      | Execution lifecycle status           |
| `attempt_count` | integer          | Yes      | Number of attempts                   |
| `error_code`    | string           | No       | Terminal or attempt-level error code |
| `started_at`    | date-time string | No       | First run timestamp                  |
| `finished_at`   | date-time string | No       | Terminal timestamp                   |
| `created_at`    | date-time string | Yes      | Enqueue timestamp                    |

`status` values: `queued`, `running`, `succeeded`, `failed`, `canceled`, `blocked`

---

## Entity: raw-memory-event

Schema: [`json-schema/raw-memory-event.schema.json`](json-schema/raw-memory-event.schema.json)

| Field          | Type             | Required | Description                |
| -------------- | ---------------- | -------- | -------------------------- |
| `event_id`     | string           | Yes      | Immutable event identifier |
| `group_id`     | string           | Yes      | Tenant isolation key       |
| `tenant_id`    | string           | Yes      | Tenant scope               |
| `org_unit_id`  | string           | No       | Optional org-unit scope    |
| `execution_id` | string           | No       | Related execution          |
| `event_type`   | string           | Yes      | Event classification       |
| `payload`      | object           | Yes      | Event payload data         |
| `occurred_at`  | date-time string | Yes      | Event occurrence time      |
| `recorded_at`  | date-time string | Yes      | Persistence write time     |

Append-only rule: raw-memory-event records are immutable after insert.

---

## Entity: semantic-insight

Schema: [`json-schema/semantic-insight.schema.json`](json-schema/semantic-insight.schema.json)

| Field               | Type             | Required | Description                             |
| ------------------- | ---------------- | -------- | --------------------------------------- |
| `insight_id`        | string           | Yes      | Stable insight identity across versions |
| `group_id`          | string           | Yes      | Tenant isolation key                    |
| `version`           | integer          | Yes      | Insight version                         |
| `status`            | enum             | Yes      | Insight lifecycle state                 |
| `confidence`        | number           | Yes      | Confidence score (`0.0` to `1.0`)       |
| `content`           | string           | Yes      | Canonical insight text                  |
| `source_event_refs` | array[string]    | Yes      | Source raw event identifiers            |
| `created_at`        | date-time string | Yes      | Creation timestamp                      |
| `created_by`        | string           | No       | Curator/operator source                 |

`status` values: `proposed`, `approved`, `published`, `superseded`, `rejected`

---

## Entity: knowledge-promotion

Schema: [`json-schema/knowledge-promotion.schema.json`](json-schema/knowledge-promotion.schema.json)

| Field               | Type             | Required | Description                      |
| ------------------- | ---------------- | -------- | -------------------------------- |
| `promotion_id`      | string           | Yes      | Promotion request identifier     |
| `group_id`          | string           | Yes      | Tenant isolation key             |
| `insight_id`        | string           | Yes      | Target semantic insight identity |
| `status`            | enum             | Yes      | Workflow state                   |
| `requested_by`      | string           | Yes      | Curator or system actor          |
| `reviewed_by`       | string           | No       | Human approver                   |
| `source_event_refs` | array[string]    | Yes      | Supporting event IDs             |
| `rationale`         | string           | Yes      | Why this promotion is proposed   |
| `requested_at`      | date-time string | Yes      | Submission time                  |
| `resolved_at`       | date-time string | No       | Decision time                    |

`status` values: `proposed`, `under_review`, `approved`, `rejected`, `published`

---

## Entity: scaffold-candidate

Schema: [`json-schema/scaffold-candidate.schema.json`](json-schema/scaffold-candidate.schema.json)

| Field                   | Type             | Required | Description                   |
| ----------------------- | ---------------- | -------- | ----------------------------- |
| `candidate_id`          | string           | Yes      | Candidate scaffold identifier |
| `group_id`              | string           | Yes      | Tenant isolation key          |
| `lineage`               | array[string]    | No       | Parent candidate lineage      |
| `objective_set`         | array[string]    | Yes      | Evaluation objective labels   |
| `capability_score`      | number           | Yes      | Normalized capability metric  |
| `safety_score`          | number           | Yes      | Normalized safety metric      |
| `status`                | enum             | Yes      | Candidate lifecycle state     |
| `evaluation_report_ref` | string           | No       | Scorecard/report pointer      |
| `created_at`            | date-time string | Yes      | Candidate creation time       |
| `updated_at`            | date-time string | Yes      | Last state transition time    |

`status` values: `generated`, `benchmarked`, `safety_review`, `approved`, `rejected`, `deployed`

---

## Events

| Event                          | Producer          | Consumers                    | Purpose                             |
| ------------------------------ | ----------------- | ---------------------------- | ----------------------------------- |
| `goal.approved`                | Paperclip         | OpenClaw, dashboards         | Dispatch-ready signal               |
| `execution.state_changed`      | OpenClaw          | Postgres, dashboards, alerts | Runtime lifecycle trace             |
| `budget.threshold_hit`         | Budget controller | Alerts, operator console     | Cost safety notification            |
| `knowledge.promotion.proposed` | Knowledge curator | Paperclip approval queue     | Promotion workflow start            |
| `knowledge.promotion.approved` | Paperclip         | Neo4j publisher, audit       | Promotion workflow decision         |
| `candidate.scored`             | AgentBreeder      | Paperclip governance         | Capability/safety score publication |
| `candidate.promoted`           | Paperclip         | OpenClaw profile registry    | Candidate deployment signal         |

---

**See also:**

- [BLUEPRINT.md](BLUEPRINT.md)
- [SOLUTION-ARCHITECTURE.md](SOLUTION-ARCHITECTURE.md)
- [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md)
- [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md)
