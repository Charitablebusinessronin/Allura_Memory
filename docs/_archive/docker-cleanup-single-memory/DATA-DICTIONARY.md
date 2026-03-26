# Data Dictionary: Docker Cleanup for Single-Memory Architecture

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

This document describes the data structures and file formats used during the Docker cleanup operation. It covers evidence file naming conventions, health check result schemas, guardrail matrix entries, and task dependency definitions.

---

## Table of Contents

- [Evidence File](#evidence-file)
- [Health Check Result](#health-check-result)
- [Guardrail Matrix Entry](#guardrail-matrix-entry)
- [Task Dependency Entry](#task-dependency-entry)
- [Port Mapping Entry](#port-mapping-entry)

---

## Evidence File

All cleanup tasks produce evidence files saved to `docs/evidence/`. These files provide the audit trail for the cleanup operation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filename` | string | Yes | Evidence file name following `task-{N}-{description}.{ext}` pattern |
| `task_id` | string | Yes | Reference to the task that produced this evidence (e.g., "T1", "T5") |
| `content_type` | enum | Yes | `command_output`, `matrix`, `health_report`, `validation` |
| `produced_at` | datetime | Yes | Timestamp when the evidence was captured |
| `verified` | boolean | No | Whether this evidence has been validated in final verification |

**`content_type` values**

| Value | Description |
|-------|-------------|
| `command_output` | Raw output from Docker CLI commands |
| `matrix` | Structured markdown table (guardrail classifications) |
| `health_report` | Service health check results |
| `validation` | Verification and consistency check results |

---

## Health Check Result

Health verification produces structured output for each kept service.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `service_name` | string | Yes | Name of the service being checked |
| `check_type` | enum | Yes | Method used for health verification |
| `target` | string | Yes | Check target (container name, URL, or command) |
| `status` | enum | Yes | Result of the health check |
| `response_code` | integer | No | HTTP status code (for HTTP checks only) |
| `exit_code` | integer | No | Process exit code (for command checks only) |
| `output` | string | No | Raw output from the check command |
| `timestamp` | datetime | Yes | When the check was performed |
| `phase` | enum | Yes | `pre_cleanup` or `post_cleanup` |

**`check_type` values**

| Value | Description |
|-------|-------------|
| `pg_isready` | PostgreSQL ready check via pg_isready command |
| `http_status` | HTTP GET request status code verification |
| `container_status` | Docker container state inspection |

**`status` values**

| Value | Description |
|-------|-------------|
| `healthy` | Service responding/ready as expected |
| `unhealthy` | Service responding but reporting unhealthy state |
| `unreachable` | Service not responding to checks |

**`phase` values**

| Value | Description |
|-------|-------------|
| `pre_cleanup` | Baseline health check before any removal |
| `post_cleanup` | Verification health check after removal |

---

## Guardrail Matrix Entry

Each discovered Docker resource receives a classification entry.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resource_id` | string | Yes | Docker identifier (container name, volume name, network name) |
| `resource_type` | enum | Yes | Type of Docker resource |
| `action` | enum | Yes | Classification decision |
| `rationale` | string | Yes | Explanation for the classification decision |
| `source_decision` | string | Yes | Reference to user decision or policy document |

**`resource_type` values**

| Value | Description |
|-------|-------------|
| `container` | Docker container |
| `volume` | Docker volume |
| `network` | Docker network |
| `image` | Docker image |

**`action` values**

| Value | Description |
|-------|-------------|
| `KEEP` | Service required for runtime operation; must not be removed |
| `REMOVE` | Explicitly targeted for deletion in this cleanup |
| `DO_NOT_TOUCH` | Out of scope for this cleanup; requires separate approval |

---

## Task Dependency Entry

Defines dependencies between cleanup tasks.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `task_id` | string | Yes | Task identifier (e.g., "T6") |
| `task_name` | string | Yes | Human-readable task description |
| `wave` | integer | Yes | Execution wave (1, 2, 3, or 0 for final verification) |
| `parallel_group` | string | No | Parallel execution group identifier |
| `blocked_by` | array | No | List of task IDs that must complete before this task |
| `blocks` | array | No | List of task IDs that depend on this task |
| `can_run_parallel` | boolean | Yes | Whether this task can run concurrently with others in same wave |

---

## Port Mapping Entry

Documents actual port bindings detected from live runtime.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `service_name` | string | Yes | Name of the service |
| `container_port` | string | Yes | Port exposed inside container (e.g., "5432/tcp") |
| `host_port` | integer | Yes | Port bound on host machine |
| `compose_declared` | integer | No | Port declared in docker-compose.yml (may differ) |
| `verified_via` | enum | Yes | How the port was verified |
| `status` | enum | Yes | Port accessibility status |

**`verified_via` values**

| Value | Description |
|-------|-------------|
| `docker_inspect` | Via docker ps / inspect output |
| `curl_test` | Via HTTP request test |
| `pg_isready` | Via PostgreSQL ready check |

**`status` values**

| Value | Description |
|-------|-------------|
| `accessible` | Port responding to requests |
| `bound_unresponsive` | Port bound but service not responding |
| `not_bound` | No port binding detected |

---

## Evidence File Index Reference

The following table maps each task to its expected evidence output:

| Task | Evidence File(s) | Description |
|------|-----------------|-------------|
| T1 | `task-1-baseline.txt` | Full Docker inventory snapshot |
| T2 | `task-2-supabase-artifacts.txt` | Supabase resources list |
| T3 | `task-3-guardrail-matrix.md` | Resource classification matrix |
| T4 | `task-4-rollback-checklist.md` | Rollback commands |
| T5 | `task-5-prehealth.txt` | Pre-cleanup health status |
| T6 | `task-6-stop-supabase.txt` | Stop confirmation |
| T7 | `task-7-removal-results.txt` | Removal confirmation |
| T8 | `task-8-reference-cleanup.txt` | Doc/script alignment |
| T9 | `task-9-port-reconcile.txt` | Actual port bindings |
| T10 | `task-10-posthealth.txt` | Post-cleanup health status |
| T11 | `task-11-doc-consistency.txt` | Doc verification |
| T12 | `task-12-runbook-validation.txt` | Runbook verification |
| T13 | `task-13-evidence-index.md` | Complete evidence catalog |
| T14 | `task-14-handoff-check.txt` | Handoff verification |
