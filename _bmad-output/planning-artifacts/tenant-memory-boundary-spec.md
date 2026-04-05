# 🛡️ Tenant & Memory Boundary Spec

**Status:** Draft · **Author:** Winston (Architect) · **Date:** 2026-04-03  
**Module:** BMM — Allura Memory Infrastructure

> This artifact defines how Allura isolates organizations, controls agent reads and writes, governs cross-org knowledge promotion, and produces regulator-grade audit evidence. It is the authoritative boundary contract for all agents, workflows, and contributors.

---

## 1 — Scope & Context

Allura Memory operates a **shared PostgreSQL + Neo4j infrastructure** partitioned at the application layer by a mandatory `group_id` tenant key. Current live tenant patterns follow the `allura-*` naming convention:
- `allura-faith-meats` — client org: Faith Meats (P1)
- `allura-creative` — client org: Creative Studio (P2)
- `allura-personal` — client org: Personal Assistant (P2)
- `allura-nonprofit` — client org: Nonprofit (P3)
- `allura-audits` — client org: Bank Audits (P3)
- `allura-haccp` — client org: HACCP (P3)

All agents, workflows, and services run inside Docker. No local execution. All database operations MUST use MCP_DOCKER tools — never `docker exec` directly.

---

## 2 — Schema Contract

### 2.1 PostgreSQL — Required Fields on Every Record

Every table that stores operational, memory, or audit data MUST carry the following columns:

| Column | Type | Description |
|--------|------|-------------|
| `group_id` | `TEXT NOT NULL` | Tenant key — primary isolation boundary |
| `agent_id` | `TEXT NOT NULL` | Originating agent identifier |
| `workflow_id` | `TEXT` | Workflow execution context (nullable for manual ops) |
| `status` | `TEXT NOT NULL` | Enum: pending, active, promoted, archived, rejected |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Last mutation timestamp |
| `evidence_ref` | `TEXT[]` | Array of linked evidence node IDs from Neo4j |
| `rule_version` | `TEXT` | Active governance rule version at write time |
| `human_override` | `BOOLEAN NOT NULL DEFAULT false` | Whether a human overrode automated logic |
| `override_actor` | `TEXT` | User ID of override actor (NULL if no override) |

Enforcement point: Application-layer service boundary before any INSERT or UPDATE. No record may be written without `group_id` and `agent_id`.

### 2.2 Neo4j — Required Properties on Every Node & Relationship

Allura uses the **application-enforced tenant label + property** pattern, NOT separate Neo4j databases. This keeps infrastructure costs low while allowing cross-graph traversal under explicit promotion rules.

Every node MUST carry:

```javascript
group_id: String
agent_id: String
workflow_id: String?
status: String
created_at: DateTime
updated_at: DateTime
rule_version: String
evidence_refs: [String]
```

Every relationship MUST carry:

```javascript
group_id: String
created_at: DateTime
agent_id: String
promoted: Boolean
```

Tenant label convention: Each node receives a secondary label `TenantScope_<group_id>`, e.g. `TenantScope_allura_faith_meats`. This enables index-backed label filters alongside property checks for defense-in-depth isolation.

Enforcement point: Cypher write templates pre-inject `group_id` and `TenantScope_*` label. Raw Cypher that omits `group_id` is blocked by the MCP_DOCKER write wrapper.

---

## 3 — Read / Write Guardrails

### 3.1 Default Deny Policy

The default stance is tenant-scoped read/write only. An agent operating under `group_id = allura-faith-meats` MAY NOT:
- Read nodes or records where `group_id != allura-faith-meats`
- Write nodes, relationships, or records into any other tenant namespace
- Traverse graph relationships that cross tenant boundaries unless a `promoted = true` edge exists on a Platform Knowledge node

### 3.2 Agent Permission Matrix

| Agent Class | Own-Tenant Read | Own-Tenant Write | Cross-Tenant Read | Cross-Tenant Write | Promotion Submit |
|-------------|-----------------|------------------|-------------------|--------------------|------------------|
| Operational Agent | YES | YES | NO | NO | NO |
| Curator Agent | YES | YES | Promoted nodes only | NO | Submit only |
| Platform Overseer | YES | YES | YES | Promoted nodes only | Approve/Reject |
| Human (Notion HITL) | YES | YES | YES | YES | Final authority |

Violations are logged as `SECURITY_VIOLATION` audit events.

### 3.3 Elevated Access Path

When a Curator or Overseer agent needs temporary cross-tenant read for a specific diagnostic workflow:

1. Agent submits an `ElevatedAccessRequest` to the Changes database in Notion with: requesting `agent_id`, target `group_id`, justification, duration, and `workflow_id`.
2. A human reviewer approves or rejects in Notion.
3. On approval, a time-boxed `AccessGrant` record is written to Postgres with an expiry `TIMESTAMPTZ`.
4. The MCP_DOCKER read wrapper checks for a valid unexpired `AccessGrant` before allowing the cross-tenant query.
5. All reads during the grant window are logged with `access_grant_id` on every query audit row.

---

## 4 — Cross-Org Promotion Workflow

Promotion is how a local org insight becomes platform-wide reusable knowledge without exposing raw tenant operational data.

### 4.1 Promotion States

```javascript
[local_insight] -> PROPOSED -> CURATOR_REVIEW -> APPROVED -> ABSTRACTED -> PUBLISHED
                                              -> REJECTED
```

### 4.2 Step-by-Step Flow

**Step 1 — Identify.** An Operational Agent tags a memory node or pattern with `status = proposed_promotion`. The node retains its `group_id` and is NOT shared yet.

**Step 2 — Stage.** A Curator Agent extracts a sanitized, abstracted version of the insight. Raw data fields (group_id, agent_id, client-identifiable values) are stripped. The abstraction is written as a new `ProposedKnowledge` node with `group_id = platform`, `promoted = false`, linked to the source node by a `DERIVED_FROM` relationship visible only to the Overseer.

**Step 3 — Review.** The `ProposedKnowledge` node is synced to the Notion Changes database. A human curator reviews: Is this safe to share? Does it reveal client PII or operational detail? Is the abstraction accurate?

**Step 4 — Approve or Reject.** On approval, the Overseer Agent sets `promoted = true` on the `ProposedKnowledge` node and writes a `PromotionAudit` record to Postgres. On rejection, `status = rejected` is set on both the proposal and the source node's promotion tag.

**Step 5 — Publish.** Approved `ProposedKnowledge` nodes become readable by all Curator and Overseer agents across tenants via the `group_id = platform` namespace. Operational Agents in other tenants MAY reference but NOT modify platform knowledge nodes.

### 4.3 What NEVER Promotes

- Raw `group_id`-tagged operational records
- Client-identifying strings, project names, or financial figures
- Agent execution traces and intermediate reasoning
- Any node created within 7 days of a compliance-flagged workflow

---

## 5 — Audit Queries (Regulator-Grade Evidence)

All queries below target the `roninmemory` Postgres schema. Run via MCP_DOCKER tools inside the Docker network only.

### Query 1 — Decision Lineage

Who made the decision, what rule version was active, and what evidence supported it?

```sql
SELECT
  d.id              AS decision_id,
  d.group_id,
  d.agent_id,
  d.workflow_id,
  d.rule_version,
  d.status,
  d.human_override,
  d.override_actor,
  d.created_at,
  d.evidence_ref    AS evidence_nodes,
  u.display_name    AS override_actor_name
FROM decisions d
LEFT JOIN users u ON u.id = d.override_actor
WHERE d.group_id = :tenant_group_id
  AND d.workflow_id = :workflow_id
ORDER BY d.created_at ASC;
```

### Query 2 — Override Review

All human overrides in a time window with actor and evidence.

```sql
SELECT
  d.id,
  d.group_id,
  d.agent_id,
  d.workflow_id,
  d.override_actor,
  u.display_name    AS override_actor_name,
  d.rule_version,
  d.status,
  d.created_at,
  d.updated_at,
  d.evidence_ref
FROM decisions d
JOIN users u ON u.id = d.override_actor
WHERE d.human_override = true
  AND d.created_at BETWEEN :start_ts AND :end_ts
ORDER BY d.created_at DESC;
```

### Query 3 — Historical Reconstruction

Full before-and-after state timeline for any entity.

```sql
SELECT
  ah.id,
  ah.entity_id,
  ah.entity_type,
  ah.group_id,
  ah.agent_id,
  ah.operation,
  ah.old_status,
  ah.new_status,
  ah.rule_version,
  ah.human_override,
  ah.override_actor,
  ah.changed_at,
  ah.change_payload
FROM audit_history ah
WHERE ah.entity_id = :entity_id
  AND ah.entity_type = :entity_type
ORDER BY ah.changed_at ASC;
```

### Query 4 — Rule Version Validation

Was the correct rule version active at decision time? Surfaces tampering or clock-skew anomalies.

```sql
SELECT
  d.id              AS decision_id,
  d.group_id,
  d.created_at      AS decision_time,
  d.rule_version    AS applied_rule_version,
  rv.version        AS expected_active_version,
  rv.effective_from,
  rv.effective_to,
  CASE
    WHEN d.rule_version = rv.version THEN 'VALID'
    ELSE 'MISMATCH - INVESTIGATE'
  END               AS validation_result
FROM decisions d
JOIN rule_versions rv
  ON d.created_at BETWEEN rv.effective_from AND COALESCE(rv.effective_to, now())
WHERE d.group_id = :tenant_group_id
  AND d.created_at BETWEEN :start_ts AND :end_ts
ORDER BY d.created_at DESC;
```

---

## 6 — Definition of Done Checklist

- [ ] Single tenant boundary model implemented for PostgreSQL and Neo4j with `group_id` on all records and nodes
- [ ] Application-layer write wrappers enforce `group_id` injection — no raw writes bypass the wrapper
- [ ] Neo4j `TenantScope_<group_id>` label strategy applied in all Cypher templates
- [ ] Default deny cross-org policy active; exceptions require `AccessGrant` or `PromotionAudit` record
- [ ] Promotion pipeline (5 states) implemented: proposed → curator review → approved/rejected → abstracted → published
- [ ] Raw tenant data fields stripped before any `ProposedKnowledge` node is staged
- [ ] All 4 audit queries tested against `roninmemory` and returning correct results
- [ ] Notion Changes database wired as the HITL gate for promotions and elevated access requests
- [ ] `SECURITY_VIOLATION` audit events fire on any blocked cross-tenant attempt
- [ ] `rule_versions` table populated and Query 4 validated

---

## 8 — Execution Boundary & Skill Improvement Loop

### Governance Rule

Allura remains the authoritative governance and control plane for tenant isolation, approvals, audit evidence, and promotion rules. External execution substrates such as RuVix or RuVector may execute bounded skill-improvement runs but must not own tenant boundaries, policy, or promotion authority.

**Rule:** Any improvement proposed by a runtime must pass through curator review and the existing promotion controls before it becomes reusable system behavior.

### Skill Improvement Loop

The loop operates across three roles:

| Role | Responsibility |
|------|----------------|
| **Worker Agent** | Executes tasks, generates raw execution evidence |
| **Evaluator Logic** | Scores outcomes against quality signals (success rate, retry count, human edits, time to completion) |
| **Curator Agent** | Reviews proposed improvements, approves or rejects promotion |

Improvement targets (in scope):
- Prompts, instructions, checklists
- Tool-use patterns
- Workflow step ordering, escalation paths, retry rules

Never in scope for automated change:
- Tenant isolation rules (`group_id` schema)
- Access grant or permission matrix
- Promotion pipeline rules
- Audit query contracts
- Any change that bypasses HITL gate

### Dual Persistence

- **Raw experiment traces** — stored in PostgreSQL under `group_id` with `status = proposed`
- **Promoted knowledge** — reaches Neo4j only after curator approval and the 5-stage promotion pipeline (Section 4)

This prevents noisy or degraded experiment data from polluting the knowledge graph.

---

## 7 — Related Artifacts

- [Allura Memory Repo](https://github.com/Charitablebusinessronin/Allura_Memory)
- [Allura Memory Control Center](https://www.notion.so/3371d9be65b381a9b3bec24275444b68)
- Bank-Auditor Evidence Spec (predecessor artifact)
- [BLUEPRINT.template.md](http://BLUEPRINT.template.md) — service design standards
- [AI-GUIDELINES.md](http://AI-GUIDELINES.md) — documentation and review standards
