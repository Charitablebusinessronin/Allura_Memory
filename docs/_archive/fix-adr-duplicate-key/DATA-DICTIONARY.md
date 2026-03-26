# Fix ADR Duplicate Key Issue: Data Dictionary

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed. This is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

---

## Table of Contents

- [agent_decision_records](#agent_decision_records)
- [ID Generation Format](#id-generation-format)
- [Events](#events)

---

## agent_decision_records

PostgreSQL table storing Agent Decision Records (ADRs). This table has a unique constraint on `adr_id` which is the source of the duplicate key issue.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `adr_id` | varchar(255) | Yes | Unique ADR identifier. Format: `adr_<random>_<timestamp>`. Has unique constraint `agent_decision_records_adr_id_key`. |
| `session_id` | varchar(255) | Yes | Parent session identifier linking this ADR to an agent session |
| `action` | text | Yes | The action taken by the agent (e.g., "promote_insight", "reject_insight") |
| `context` | jsonb | Yes | JSON object containing decision context including: reasoning, alternatives considered, human oversight notes |
| `created_at` | timestamp | Yes | UTC timestamp when the ADR was created |

**Constraints:**

| Constraint Name | Type | Fields | Description |
|-----------------|------|--------|-------------|
| `agent_decision_records_pkey` | PRIMARY KEY | `adr_id` | Primary key constraint |
| `agent_decision_records_adr_id_key` | UNIQUE | `adr_id` | Unique constraint causing the duplicate key errors |

**Index:**

| Name | Fields | Type |
|------|--------|------|
| `agent_decision_records_adr_id_idx` | `adr_id` | btree |

---

## ID Generation Format

### Current Format (Problematic)

```
adr_<random>_<timestamp>
```

**Example:** `adr_a7k2m9_1712345678901`

**Collision risk:** High when called multiple times within the same millisecond with the same random component.

---

### Enhanced Format (Fixed)

```
adr_<random>_<timestamp>_<counter>
```

**Example:** `adr_a7k2m9_1712345678901_42`

**Components:**

| Component | Source | Purpose |
|-----------|--------|---------|
| `random` | `Math.random().toString(36).substring(2, 10)` | Cross-process uniqueness |
| `timestamp` | `Date.now()` | Millisecond-level uniqueness |
| `counter` | Module-level incrementing counter | Intra-process monotonic sequence |

---

## Events

### adr.creation.started

| Field | Type | Description |
|-------|------|-------------|
| `event_type` | string | `"adr.creation.started"` |
| `adr_id` | string | Generated ADR identifier |
| `session_id` | string | Parent session identifier |
| `timestamp` | datetime | UTC timestamp |

### adr.creation.completed

| Field | Type | Description |
|-------|------|-------------|
| `event_type` | string | `"adr.creation.completed"` |
| `adr_id` | string | Final ADR identifier (may differ from initial if regenerated) |
| `session_id` | string | Parent session identifier |
| `attempts` | number | Number of ID generation attempts (1 if no collision) |
| `timestamp` | datetime | UTC timestamp |

### adr.creation.retry

| Field | Type | Description |
|-------|------|-------------|
| `event_type` | string | `"adr.creation.retry"` |
| `original_id` | string | ID that collided |
| `new_id` | string | Regenerated ID |
| `attempt` | number | Retry attempt number (1-indexed) |
| `timestamp` | datetime | UTC timestamp |

### adr.creation.failed

| Field | Type | Description |
|-------|------|-------------|
| `event_type` | string | `"adr.creation.failed"` |
| `error` | string | Error message (e.g., "duplicate key value violates unique constraint") |
| `max_attempts` | number | Maximum retry attempts reached |
| `timestamp` | datetime | UTC timestamp |

---

## References

- [BLUEPRINT.md](BLUEPRINT.md) - Core design and data model
- [SOLUTION-ARCHITECTURE.md](SOLUTION-ARCHITECTURE.md) - System topology
- [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md) - Requirements traceability
- [RISKS-AND-DECISIONS.md](RISKS-AND-DECISIONS.md) - Architectural decisions
- [TASKS.md](TASKS.md) - Implementation tasks
