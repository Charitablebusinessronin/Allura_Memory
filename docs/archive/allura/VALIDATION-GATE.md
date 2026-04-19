# Validation Gate: Allura Memory System

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model (GitHub Copilot).
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

This document defines the **canonical release gate** for the Allura Memory governed pipeline. The system only passes when it proves end-to-end completion of the full memory lifecycle: raw trace capture → curator proposal → approval → immutable Neo4j write → controlled retrieval → second-agent reuse.

---

## Acceptance Checklist

| ID | Acceptance Check | Pass Condition | Evidence | Status |
|---|---|---|---|---|
| AC-01 | Raw trace persistence | An agent task writes append-only raw trace events for request, tool activity, outputs, retries, and terminal status. | PostgreSQL rows in `events` table linked to one task run. | ⬜ |
| AC-02 | No raw-trace mutation | Existing raw trace records are not updated in place; new events are appended only. | Schema/trigger/policy proof plus audit query showing no UPDATE path. | ⬜ |
| AC-03 | Curator proposal generation | Curator reads raw traces and creates a **proposed** insight, not an active one. | Proposal record in `canonical_proposals` with summary, evidence, confidence, timestamp, status=`pending`. | ⬜ |
| AC-04 | Approval queue exists | Proposed insights appear in an approval flow before activation. | API response from `GET /api/curator/proposals?status=pending` showing pending proposal. | ⬜ |
| AC-05 | Approval audit event | Approval or rejection is recorded as an audit event with actor and timestamp. | `proposal_approved` or `proposal_rejected` event in `events` table tied to proposal ID. | ⬜ |
| AC-06 | Immutable Neo4j insight write | Approved insight is written to Neo4j as a new immutable node; existing insight nodes are not edited in place. | Neo4j Cypher query showing Insight node with `status: active`, `version: 1`, and `created_at` timestamp. | ⬜ |
| AC-07 | Version linking works | A changed insight creates a new node linked by `SUPERSEDES`, `DEPRECATED`, or `REVERTED`. | Neo4j relationship query showing `(v2)-[:SUPERSEDES]->(v1)` with both node IDs. | ⬜ |
| AC-08 | Retrieval layer mediation | Agents retrieve knowledge via a retrieval service, not by querying DBs directly. | API call to `POST /api/memory/retrieval` returning approved insights with provenance. | ⬜ |
| AC-09 | Scoped retrieval | Retrieval supports project-scoped plus global context. | Query examples proving both `project` and `global` scope results. | ⬜ |
| AC-10 | Mixed retrieval support | Retrieval layer can use approved Neo4j insights and optionally raw traces. | Response payload showing `source: neo4j` and optional `source: postgres` with provenance. | ⬜ |
| AC-11 | Policy/API enforcement | All reads/writes go through controlled endpoints with project access, permissions, and audit logging. | Authz config, endpoint logs, and denied-access test. | ⬜ |
| AC-12 | Second-agent reuse | A second agent successfully retrieves approved knowledge and uses it correctly in a later task. | Transcript or execution log proving correct reuse of approved insight. | ⬜ |

---

## Benchmark Matrix

| B/F | Requirement | Benchmark Test | Pass Threshold | Status |
|-----|-------------|----------------|----------------|--------|
| B1 | Agents store all activity as raw traces. | Run one agent task with tool usage and retries. | 100% of lifecycle events persisted and queryable. | ⬜ |
| F1 | Raw trace store is append-only. | Attempt update-in-place on prior trace row. | Update blocked or replaced by append event only. | ⬜ |
| B2 | Curator converts traces into proposed insights. | Execute curator against seeded traces. | At least one proposal generated with all required fields. | ⬜ |
| F2 | Proposed insight includes summary, evidence, confidence, timestamp, and status. | Validate proposal schema. | 100% required fields present. | ⬜ |
| B3 | No insight becomes active without approval. | Attempt retrieval before approval. | Unapproved insight excluded from active retrieval. | ⬜ |
| F3 | Approval is recorded as an audit event. | Approve one proposal. | Audit event exists with actor, action, time, target. | ⬜ |
| B4 | Approved insights are stored immutably in Neo4j. | Approve one proposal and inspect graph. | New node created; no in-place overwrite. | ⬜ |
| F4 | Changed insights create version links. | Submit superseding proposal and approve it. | `SUPERSEDES` edge exists between old and new nodes. | ⬜ |
| B5 | Agents retrieve approved knowledge through a retrieval layer. | Invoke second-agent task with retrieval enabled. | Retrieval response contains approved insight context and provenance. | ⬜ |
| F5 | Retrieval supports semantic + structured queries. | Run one semantic query and one structured query. | Both return scoped, source-tagged context. | ⬜ |
| B6 | Every decision and change is traceable and reversible. | Walk one insight from trace → proposal → approval → graph node → supersession. | Full evidence chain exists with immutable IDs. | ⬜ |

---

## Hard Gates

A release **fails immediately** if any of these checks fail:

- **AC-01** — Raw trace persistence (no data = no system)
- **AC-03** — Curator proposal generation (no proposals = no governance)
- **AC-05** — Approval audit event (no audit = no compliance)
- **AC-06** — Immutable Neo4j insight write (no graph = no knowledge)
- **AC-08** — Retrieval layer mediation (no retrieval = no agent reuse)
- **AC-12** — Second-agent reuse (no reuse = no end-to-end proof)

---

## Scoring

| Score | Meaning |
|-------|---------|
| 0 | Fail — check not passed |
| 1 | Partial — check partially satisfied, needs work |
| 2 | Pass — check fully satisfied with evidence |

**Demo environment target:** 18/24 with all hard gates passing.
**Production readiness:** 24/24 or explicit signed exception in [RISKS-AND-DECISIONS.md](../../allura/RISKS-AND-DECISIONS.md).

---

## Validation Commands

### Gate 1: Raw Trace Persistence (AC-01)

```sql
-- Verify trace events exist for a known agent run
SELECT id, event_type, agent_id, status, created_at
FROM events
WHERE group_id = 'allura-roninmemory'
  AND agent_id = 'validation-agent'
ORDER BY created_at DESC
LIMIT 5;
```

### Gate 2: No Raw-Trace Mutation (AC-02)

```sql
-- Verify no UPDATE/DELETE grants on events table
SELECT has_table_privilege('ronin4life', 'events', 'UPDATE') AS can_update,
       has_table_privilege('ronin4life', 'events', 'DELETE') AS can_delete;
```

### Gate 3: Curator Proposal (AC-03)

```sql
-- Verify proposal exists with required fields
SELECT id, content, score, reasoning, tier, status, trace_ref, created_at
FROM canonical_proposals
WHERE group_id = 'allura-roninmemory'
  AND status = 'pending'
ORDER BY created_at DESC
LIMIT 1;
```

### Gate 4: Approval Queue (AC-04)

```bash
# Verify pending proposals appear in API
curl -s "http://localhost:3100/api/curator/proposals?group_id=allura-roninmemory&status=pending" | jq .
```

### Gate 5: Approval Audit Event (AC-05)

```sql
-- Verify approval audit event exists
SELECT id, event_type, agent_id, metadata->>'proposal_id' AS proposal_id, created_at
FROM events
WHERE group_id = 'allura-roninmemory'
  AND event_type IN ('proposal_approved', 'proposal_rejected')
ORDER BY created_at DESC
LIMIT 1;
```

### Gate 6: Immutable Neo4j Insight (AC-06)

```cypher
// Verify insight node exists and is immutable
MATCH (i:Insight {group_id: 'allura-roninmemory', status: 'active'})
RETURN i.insight_id, i.version, i.content, i.confidence, i.created_at
ORDER BY i.created_at DESC
LIMIT 1
```

### Gate 7: Version Linking (AC-07)

```cypher
// Verify SUPERSEDES relationship exists
MATCH (v2:Insight)-[:SUPERSEDES]->(v1:Insight)
WHERE v2.group_id = 'allura-roninmemory'
RETURN v1.insight_id, v1.version, v2.insight_id, v2.version
LIMIT 1
```

### Gate 8: Retrieval Layer (AC-08)

```bash
# Verify retrieval endpoint returns approved insights
curl -s -X POST "http://localhost:3100/api/memory/retrieval" \
  -H "Content-Type: application/json" \
  -d '{
    "group_id": "allura-roninmemory",
    "agent_id": "validation-agent-2",
    "query": "test",
    "mode": "hybrid",
    "scope": { "project": true, "global": true },
    "limit": 5
  }' | jq .
```

### Gate 12: Second-Agent Reuse (AC-12)

Run the E2E validation script:

```bash
bun run scripts/e2e-validation-gate.ts
```

---

## References

- [BLUEPRINT.md](../../allura/BLUEPRINT.md) — source of B#/F# intent
- [DESIGN-MEMORY-SYSTEM.md](../../allura/DESIGN-MEMORY-SYSTEM.md) — implementation design
- [REQUIREMENTS-MATRIX.md](../../allura/REQUIREMENTS-MATRIX.md) — requirement traceability
- [RISKS-AND-DECISIONS.md](../../allura/RISKS-AND-DECISIONS.md) — exceptions and rollout risks