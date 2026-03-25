# ADAS Data Dictionary

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model (Claude).
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.

<!-- This dictionary describes every database entity and event in the ADAS system. Field names match PostgreSQL column names and TypeScript interfaces exactly. -->

---

## Table of Contents

- [adas_runs](#adas_runs)
- [adas_trace_events](#adas_trace_events)
- [adas_promotion_proposals](#adas_promotion_proposals)
- [Events (Event-Driven Architecture)](#events-event-driven-architecture)

---

## adas_runs

PostgreSQL table — one row per evaluation run. A "run" is one complete evaluation of a single candidate design against the full domain ground-truth suite.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `run_id` | uuid | Yes | Unique identifier — UUID v4, one per `EvaluationHarness` instance |
| `group_id` | varchar(255) | Yes | Logical group this run belongs to (e.g., `"adas-cli"`, `"test-group"`) |
| `design_id` | uuid | Yes | `AgentDesign.design_id` at evaluation time |
| `design_name` | varchar(255) | Yes | Human-readable design name for debugging |
| `domain_id` | varchar(255) | Yes | `DomainConfig.domainId` (e.g., `"math"`, `"reasoning"`) |
| `model_id` | varchar(255) | Yes | Ollama model used (e.g., `"qwen3-coder-next:cloud"`) |
| `strategy` | varchar(50) | Yes | Reasoning strategy — one of `"cot"`, `"react"`, `"plan-and-execute"`, `"reflexion"` |
| `system_prompt` | text | Yes | Full system prompt text used at evaluation time |
| `accuracy` | numeric(5,4) | Yes | Accuracy score 0.0000–1.0000 (passed cases / total cases) |
| `cost` | numeric(20,10) | Yes | Estimated token cost (prompt tokens + completion tokens × model pricing) |
| `latency_ms` | integer | Yes | End-to-end evaluation latency in milliseconds |
| `composite_score` | numeric(5,4) | Yes | Weighted composite: `accuracyWeight*accuracy + costWeight*normCost + latencyWeight*normLatency` |
| `status` | varchar(20) | Yes | Run outcome — `"completed"`, `"failed"`, `"timeout"` |
| `created_at` | timestamp | Yes | When the harness began evaluating (UTC) |

**`status` values**

| Value | Description |
|-------|-------------|
| `completed` | All ground-truth cases processed, metrics computed |
| `failed` | Evaluation threw an exception (network error, etc.) |
| `timeout` | Evaluation exceeded configured timeout |

---

## adas_trace_events

PostgreSQL table — every event during evaluation, for audit and debugging. One row per event.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event_id` | uuid | Yes | Unique event identifier |
| `run_id` | uuid | Yes | FK → `adas_runs.run_id` |
| `event_type` | varchar(50) | Yes | Event type — see event type catalogue below |
| `payload` | jsonb | Yes | Event-specific data as JSON |
| `created_at` | timestamp | Yes | Event timestamp (UTC) |

**`event_type` values**

| Value | Description |
|-------|-------------|
| `evaluation_started` | Harness has begun evaluating a candidate |
| `ollama_request` | About to call Ollama — includes model ID and input |
| `ollama_response` | Ollama responded — includes tokens, latency, text length |
| `ollama_error` | Ollama call failed — includes error message |
| `test_case_passed` | One ground-truth case matched expected output |
| `test_case_failed` | One ground-truth case did not match |
| `evaluation_completed` | All cases processed — includes final metrics |
| `evaluation_failed` | Evaluation threw — includes error message |

**`payload` examples:**

```jsonc
// ollama_request
{ "modelId": "qwen3-coder-next:cloud", "input": "What is 2+2?", "caseId": "m1" }

// ollama_response
{ "tokens": 27, "latencyMs": 722, "textLength": 15 }

// test_case_passed
{ "caseId": "m1", "expected": "4", "actual": "2 + 2 = **4** 🎉" }

// evaluation_completed
{ "accuracy": 1.0, "cost": 0.00002, "latencyMs": 2104, "compositeScore": 0.967 }
```

---

## adas_promotion_proposals

PostgreSQL table — HITL governance proposals. One row per candidate that qualified for promotion review.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `proposal_id` | uuid | Yes | Unique proposal identifier |
| `design_id` | uuid | Yes | Candidate `AgentDesign.design_id` |
| `design_snapshot` | jsonb | Yes | Full `AgentDesign` JSON at proposal time (immutable record) |
| `evaluation_metrics` | jsonb | Yes | Metrics at proposal time — accuracy, cost, latency, compositeScore |
| `status` | varchar(20) | Yes | Proposal status — `"pending"`, `"approved"`, `"rejected"`, `"modified"` |
| `reviewer_notes` | text | No | Human feedback, modification requests, or rejection reason |
| `human_decision` | varchar(20) | No | Final decision — `"approved"`, `"rejected"` |
| `created_at` | timestamp | Yes | When proposal was created (UTC) |
| `decided_at` | timestamp | No | When human made the decision (UTC) |

**`status` values**

| Value | Description |
|-------|-------------|
| `pending` | Awaiting human review |
| `approved` | Human approved — design may be promoted |
| `rejected` | Human rejected — design discarded |
| `modified` | Human requested modifications — new proposal with edits |

**`evaluation_metrics` example:**

```jsonc
{
  "accuracy": 1.0,
  "cost": 0.00002,
  "latencyMs": 2104,
  "compositeScore": 0.967,
  "modelId": "qwen3-coder-next:cloud",
  "strategy": "cot"
}
```

---

## Events (Event-Driven Architecture)

**Producer:** `EvaluationHarness`  
**Consumer(s):** `PromotionDetector` (for threshold detection), future dashboard

### `adas.evaluation.started`

| Field | Type | Description |
|-------|------|-------------|
| `event_id` | uuid | Unique event ID |
| `event_type` | string | `"adas.evaluation.started"` |
| `timestamp` | datetime | UTC timestamp |
| `run_id` | uuid | The run being started |
| `design_id` | uuid | Candidate design ID |
| `domain_id` | string | Domain identifier |

### `adas.evaluation.completed`

| Field | Type | Description |
|-------|------|-------------|
| `event_id` | uuid | |
| `event_type` | string | `"adas.evaluation.completed"` |
| `timestamp` | datetime | UTC timestamp |
| `run_id` | uuid | The run that completed |
| `accuracy` | number | Accuracy score 0–1 |
| `cost` | number | Token cost estimate |
| `latency_ms` | number | Milliseconds |
| `composite_score` | number | Weighted composite score |

### `adas.proposal.pending`

| Field | Type | Description |
|-------|------|-------------|
| `event_id` | uuid | |
| `event_type` | string | `"adas.proposal.pending"` |
| `timestamp` | datetime | UTC timestamp |
| `proposal_id` | uuid | The proposal created |
| `design_id` | uuid | Candidate design |
| `composite_score` | number | Score that triggered proposal |

---

**See also:**
- [BLUEPRINT.md](BLUEPRINT.md) — core design
- [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) — decisions and risks
