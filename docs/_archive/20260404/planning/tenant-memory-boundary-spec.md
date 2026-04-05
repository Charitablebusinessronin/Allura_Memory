# Tenant & Memory Boundary Spec — Allura Multi-Agent Enterprise Platform

> ⚠️ **SUPERSEDED**
> 
> This document is historical reference. The canonical version is:
> 
> **`docs/allura/tenant-memory-boundary-spec.md`**
> 
> See [`docs/allura/source-of-truth.md`](../allura/source-of-truth.md) for document hierarchy.

---

**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-04-04  
**Owner:** Sabir Asheed  
**Scope:** Allura Platform Architecture  

---

## Executive Summary

**Allura** is a unified multi-agent enterprise platform that manages multiple organizations through one governed system. This specification defines how tenant isolation, cross-organization knowledge sharing, and regulator-grade audit trails work across the platform.

**Three-Layer Architecture:**
1. **Governance Layer (Paperclip)** — Management, approvals, and oversight
2. **Execution Layer (OpenClaw/OpenCode)** — Agent runtime and workflow execution
3. **Institutional Memory Layer (PostgreSQL + Neo4j)** — Persistent context and audit trails

**First Production Workflow:** `bank-auditor` (Banking organization)  
**Future Workflows:** CRM assistant, Faith Meats operations, Personal assistant, and other business processes

---

## 1. Schema Contract

### 1.1 Tenant Identification

**Primary Tenant Key:** `group_id`

```typescript
// Required on EVERY record and node
interface TenantKeyed {
  group_id: string;        // Format: "{platform}-{organization}"
  agent_id: string;        // Unique agent identifier
  workflow_id?: string;    // Optional workflow context
  status: 'active' | 'pending' | 'archived' | 'deprecated';
  created_at: string;      // ISO 8601 timestamp
  updated_at: string;      // ISO 8601 timestamp
  evidence_ref?: string;   // Reference to audit evidence
}
```

**Tenant Key Patterns:**
```javascript
roninclaw                    // Platform-level (core/meta)
roninclaw-faithmeats        // Faith Meats organization
roninclaw-differencedriven  // Difference Driven organization
roninclaw-banking          // Banking organization
roninclaw-crm              // CRM organization
roninclaw-personal         // Personal assistant org
roninclaw-{org}            // Pattern for new organizations
```

### 1.2 PostgreSQL Schema (Raw Events)

**Table: `events`**

```sql
CREATE TABLE events (
  event_id SERIAL PRIMARY KEY,
  group_id TEXT NOT NULL,          -- Tenant key (REQUIRED)
  agent_id TEXT NOT NULL,          -- Source agent
  workflow_id TEXT,              -- Optional workflow context
  event_type TEXT NOT NULL,        -- 'session_start', 'decision', 'promotion', etc.
  status TEXT NOT NULL,            -- 'pending', 'completed', 'failed', 'blocked'
  intent TEXT,                     -- Human-readable intent
  observation JSONB,               -- Raw observation data
  inference TEXT,                -- AI inference/result
  evidence_chain JSONB,          -- References to supporting evidence
  metadata JSONB,                  -- Flexible metadata
  occurred_at TIMESTAMP NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT idx_events_group_id GROUP_ID (group_id),
  CONSTRAINT idx_events_agent_id AGENT_ID (agent_id),
  CONSTRAINT idx_events_workflow_id WORKFLOW_ID (workflow_id),
  CONSTRAINT idx_events_occurred_at OCCURRED_AT (occurred_at)
);

-- Critical: Every query MUST include group_id filter
-- Example: SELECT * FROM events WHERE group_id = 'roninclaw-banking';
```

**Table: `tenant_metadata`**

```sql
CREATE TABLE tenant_metadata (
  group_id TEXT PRIMARY KEY,
  org_name TEXT NOT NULL,          -- Human-readable org name
  org_type TEXT,                   -- 'banking', 'crm', 'retail', etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  governance_settings JSONB,       -- Tenant-specific governance rules
  data_retention_days INTEGER,     -- Retention policy
  is_active BOOLEAN DEFAULT true,
  
  -- Constraints
  CONSTRAINT chk_group_id_format CHECK (group_id ~ '^roninclaw-[a-z0-9-]+$')
);
```

### 1.3 Neo4j Schema (Curated Insights)

**Multi-Tenancy Pattern:** Application-enforced tenant properties (NOT separate databases)

**Node Types:**

```cypher
// Core Insight Node
(:Insight {
  id: string,                    // Unique identifier
  group_id: string,               // REQUIRED tenant key
  agent_id: string,               // Source agent
  workflow_id: string,            // Workflow context
  
  // Content
  intent: string,                 // Human-readable intent
  observation: string,            // What was observed
  inference: string,              // AI inference
  confidence: float,              // 0.0 to 1.0
  
  // Versioning (Steel Frame)
  version: integer,               // Semantic version
  status: 'active' | 'deprecated' | 'superseded',
  superseded_by: string,          // ID of newer version
  
  // Audit
  created_at: datetime,
  updated_at: datetime,
  evidence_refs: [string],        // Evidence chain
  
  // Governance
  approval_status: 'pending' | 'approved' | 'rejected',
  approved_by: string,            // Human approver
  approved_at: datetime
})

// Organization Node
(:Organization {
  group_id: string,               // Primary key
  name: string,                   // Display name
  type: string,                   // 'banking', 'crm', 'faith-meats', etc.
  created_at: datetime,
  is_active: boolean
})

// Agent Node
(:Agent {
  agent_id: string,               // Unique identifier
  group_id: string,               // REQUIRED tenant key
  name: string,                   // Display name
  type: 'ClawCoder' | 'ClawAgent' | 'MemoryAgent',
  capabilities: [string],         // List of capabilities
  status: 'active' | 'paused' | 'archived',
  created_at: datetime
})

// Workflow Node
(:Workflow {
  workflow_id: string,              // Unique identifier
  group_id: string,               // REQUIRED tenant key
  name: string,                   // Display name
  type: string,                   // 'bank-auditor', 'crm-assistant', etc.
  status: 'active' | 'draft' | 'archived',
  created_at: datetime
})
```

**Relationships:**

```cypher
// Versioning
(:Insight)-[:SUPERSEDES]->(:Insight)

// Organizational
(:Organization)-[:HAS_AGENT]->(:Agent)
(:Organization)-[:HAS_WORKFLOW]->(:Workflow)
(:Organization)-[:HAS_INSIGHT]->(:Insight)

// Provenance
(:Agent)-[:CREATED]->(:Insight)
(:Workflow)-[:PRODUCED]->(:Insight)

// Cross-org promotion (approved only)
(:Insight)-[:PROMOTED_TO { approved_by: string, approved_at: datetime }]->(:Organization)
```

### 1.4 Enforcement Points

**All data access MUST include group_id filter:**

```typescript
// PostgreSQL
const query = `
  SELECT * FROM events 
  WHERE group_id = $1 
    AND event_type = $2
`;
await db.query(query, [groupId, eventType]);

// Neo4j
const cypher = `
  MATCH (i:Insight {group_id: $groupId})
  WHERE i.status = 'active'
  RETURN i
`;
await neo4j.run(cypher, { groupId });
```

---

## 2. Read/Write Guardrails

### 2.1 Default Deny Policy

**Principle:** Agents can ONLY access data within their own tenant (`group_id`) by default.

**Blocked Operations (without explicit approval):**
- ❌ Cross-tenant reads
- ❌ Cross-tenant writes
- ❌ Query without group_id filter
- ❌ Bulk operations across tenants
- ❌ Raw SQL/Cypher bypassing enforcer

### 2.2 Agent Access Matrix

| Agent Type | Own Tenant | Cross-Tenant Read | Cross-Tenant Write | Notes |
|------------|------------|-------------------|---------------------|-------|
| **ClawCoder** | ✅ Read/Write | ❌ Denied | ❌ Denied | Code implementation only |
| **ClawAgent** | ✅ Read/Write | ❌ Denied | ❌ Denied | General purpose, tenant-scoped |
| **MemoryOrchestrator** | ✅ Read | ✅ Approved Orgs Only | ❌ Denied | Platform-level oversight |
| **Curator** | ✅ Read | ✅ Approved Insights Only | ✅ Promote Only | HITL approval required |
| **Auditor** | ✅ Read All | ✅ Read All (Audit) | ❌ Denied | Compliance/audit role |

### 2.3 Access Control Enforcement

**Layer 1: API Gateway (OpenClaw)**
```typescript
// Every request validated at entry
export function validateRequest(req: Request): ValidationResult {
  const groupId = extractGroupId(req);
  
  if (!groupId) {
    return {
      valid: false,
      error: 'RK-01: group_id required',
      code: 'GROUP_ID_MISSING'
    };
  }
  
  if (!isValidGroupId(groupId)) {
    return {
      valid: false,
      error: 'RK-01: Invalid group_id format',
      code: 'GROUP_ID_INVALID'
    };
  }
  
  return { valid: true, groupId };
}
```

**Layer 2: Policy Engine (RuVix Kernel)**
```typescript
// Policy evaluation before data access
export async function evaluatePolicy(
  agentId: string,
  groupId: string,
  operation: 'read' | 'write' | 'promote',
  resource: string
): Promise<PolicyResult> {
  // Check if agent belongs to this tenant
  const agentTenant = await getAgentTenant(agentId);
  if (agentTenant !== groupId) {
    return {
      allowed: false,
      reason: 'Cross-tenant access denied',
      action: 'block',
      logLevel: 'warning'
    };
  }
  
  // Check operation-specific policies
  if (operation === 'promote') {
    return await evaluatePromotionPolicy(agentId, groupId, resource);
  }
  
  return { allowed: true };
}
```

**Layer 3: Database Enforcer**
```typescript
// Final enforcement before query execution
export async function executeWithEnforcement<T>(
  groupId: string,
  queryFn: () => Promise<T>
): Promise<T> {
  // Validate group_id exists and is valid
  if (!groupId || !isValidGroupId(groupId)) {
    throw new GroupIdViolationError('RK-01', groupId);
  }
  
  // Log access attempt
  await auditLog.record({
    event: 'data_access',
    group_id: groupId,
    timestamp: new Date()
  });
  
  // Execute query
  return await queryFn();
}
```

### 2.4 Elevated Access Approval

**Cross-Tenant Read (for approved insights):**
```typescript
// Curator can read approved insights from other tenants
export async function readCrossTenantInsight(
  curatorAgentId: string,
  targetGroupId: string,
  insightId: string
): Promise<Insight> {
  // Verify curator has platform-level access
  if (!await isPlatformAgent(curatorAgentId)) {
    throw new UnauthorizedError('Platform access required');
  }
  
  // Verify insight is approved for cross-org sharing
  const insight = await neo4j.run(`
    MATCH (i:Insight {id: $insightId, group_id: $targetGroupId})
    WHERE i.approval_status = 'approved'
      AND i.status = 'active'
    RETURN i
  `, { insightId, targetGroupId });
  
  if (!insight) {
    throw new NotFoundError('Insight not found or not approved');
  }
  
  // Log cross-tenant access
  await auditLog.record({
    event: 'cross_tenant_read',
    curator_agent_id: curatorAgentId,
    target_group_id: targetGroupId,
    insight_id: insightId,
    timestamp: new Date()
  });
  
  return insight;
}
```

---

## 3. Cross-Org Promotion Workflow

### 3.1 Promotion Flow

**Stage 1: Local Insight Creation**
```
Agent (roninclaw-banking) → Creates insight → Stored in Neo4j
                                              (group_id: roninclaw-banking)
```

**Stage 2: Proposal for Promotion**
```
Agent → Marks insight as "proposed_for_promotion"
     → Creates proposal in Notion (Changes DB)
     → HITL queue entry created
```

**Stage 3: Curator Review**
```
Curator Agent → Reviews proposal
             → Evaluates quality and generalizability
             → Sanitizes (removes tenant-specific data)
             → Creates abstracted pattern
```

**Stage 4: Human Approval (HITL)**
```
Human Approver → Reviews in Paperclip Dashboard
              → Approves / Rejects with reasoning
              → Approval logged to audit trail
```

**Stage 5: Promotion Execution**
```
Curator → Creates new insight (platform-level)
       → Links to original (provenance)
       → Sets group_id: 'roninclaw' (platform)
       → Original insight marked as "promoted"
```

### 3.2 Data Sanitization Rules

**Must Remove:**
- ❌ Specific account numbers
- ❌ Personal identifiers (PII)
- ❌ Organization-specific configuration
- ❌ Raw transaction data
- ❌ Specific dates/times (keep relative)

**Can Keep:**
- ✅ Abstracted patterns
- ✅ Generalizable rules
- ✅ Decision logic
- ✅ Validation criteria
- ✅ Best practices

**Example:**
```typescript
// Original (tenant-specific)
{
  observation: "Account #12345 overdrafted on 2026-04-01",
  inference: "High-risk customer"
}

// Abstracted (platform-level)
{
  observation: "Account with 3+ overdrafts in 30 days",
  inference: "Pattern: Recurring overdraft behavior",
  applicable_to: ["banking", "fintech"]
}
```

### 3.3 Approval States

```typescript
type PromotionStatus = 
  | 'local'           // Created in tenant, not proposed
  | 'proposed'        // Submitted for promotion
  | 'under_review'    // Curator reviewing
  | 'sanitized'       // Ready for approval
  | 'approved'        // Human approved
  | 'rejected'        // Human rejected
  | 'promoted'        // Successfully promoted
  | 'archived';       // No longer relevant
```

### 3.4 Neo4j Promotion Pattern

```cypher
// Original insight (tenant-specific)
CREATE (original:Insight {
  id: 'insight-banking-001',
  group_id: 'roninclaw-banking',
  status: 'active',
  promotion_status: 'promoted'
})

// Platform insight (abstracted)
CREATE (platform:Insight {
  id: 'insight-platform-001',
  group_id: 'roninclaw',
  status: 'active',
  derived_from: 'insight-banking-001'
})

// Provenance link
CREATE (original)-[:PROMOTED_TO {
  approved_by: 'sabir@example.com',
  approved_at: datetime(),
  sanitized: true
}]->(platform)

// Cross-org availability
MATCH (o:Organization)
WHERE o.group_id IN ['roninclaw-banking', 'roninclaw-crm', 'roninclaw-faithmeats']
CREATE (platform)-[:AVAILABLE_TO]->(o)
```

---

## 4. Audit Queries for Regulator-Grade Evidence

### 4.1 Query 1: Decision Provenance

**Purpose:** Trace who made a decision, when, and why

```sql
-- PostgreSQL: Full decision trail
SELECT 
  e.event_id,
  e.group_id,
  e.agent_id,
  e.workflow_id,
  e.event_type,
  e.intent,
  e.inference,
  e.evidence_chain,
  e.occurred_at,
  e.recorded_at,
  jsonb_extract_path(e.metadata, 'rule_version') as rule_version,
  jsonb_extract_path(e.metadata, 'human_override') as human_override
FROM events e
WHERE e.group_id = 'roninclaw-banking'
  AND e.workflow_id = 'bank-auditor'
  AND e.event_type IN ('decision', 'approval', 'rejection')
  AND e.occurred_at BETWEEN '2026-04-01' AND '2026-04-30'
ORDER BY e.occurred_at DESC;
```

```cypher
-- Neo4j: Insight decision graph
MATCH (i:Insight {group_id: 'roninclaw-banking'})
WHERE i.created_at >= datetime('2026-04-01')
MATCH (a:Agent)-[:CREATED]->(i)
MATCH (w:Workflow)-[:PRODUCED]->(i)
RETURN 
  i.id as insight_id,
  i.intent as decision_intent,
  i.inference as decision_result,
  i.confidence as confidence_score,
  a.agent_id as created_by_agent,
  w.workflow_id as workflow_context,
  i.approved_by as human_approver,
  i.approved_at as approval_time,
  i.evidence_refs as evidence_references
ORDER BY i.created_at DESC;
```

### 4.2 Query 2: Rule Version Validation

**Purpose:** Prove which rule version was active at decision time

```sql
-- Active rules at specific time
SELECT 
  e.event_id,
  e.occurred_at,
  jsonb_extract_path(e.metadata, 'rule_version') as rule_version,
  jsonb_extract_path(e.metadata, 'rule_snapshot') as rule_definition,
  e.intent,
  e.inference
FROM events e
WHERE e.group_id = 'roninclaw-banking'
  AND e.event_type = 'decision'
  AND e.occurred_at <= '2026-04-15T10:30:00Z'
ORDER BY e.occurred_at DESC
LIMIT 1;
```

```cypher
-- Rule change history
MATCH (e:Event {group_id: 'roninclaw-banking', event_type: 'rule_update'})
WHERE e.occurred_at <= datetime('2026-04-15T10:30:00')
RETURN 
  e.rule_version,
  e.rule_definition,
  e.occurred_at as effective_date
ORDER BY e.occurred_at DESC;
```

### 4.3 Query 3: Evidence Chain Reconstruction

**Purpose:** Show what evidence supported a decision

```sql
-- Evidence for specific decision
WITH decision AS (
  SELECT 
    event_id,
    evidence_chain,
    occurred_at
  FROM events
  WHERE event_id = 'evt-12345'
)
SELECT 
  d.event_id,
  d.occurred_at,
  jsonb_array_elements(d.evidence_chain) as evidence_item
FROM decision d;
```

```cypher
-- Full evidence chain graph
MATCH (i:Insight {id: 'insight-banking-001'})
UNWIND i.evidence_refs as evidence_id
MATCH (e:Evidence {id: evidence_id})
RETURN 
  i.id as decision_id,
  i.intent as decision_intent,
  collect({
    evidence_id: e.id,
    evidence_type: e.type,
    evidence_data: e.data,
    collected_at: e.created_at
  }) as evidence_chain;
```

### 4.4 Query 4: Human Override Review

**Purpose:** Show when humans overrode AI and why

```sql
-- All human overrides
SELECT 
  e.event_id,
  e.group_id,
  e.agent_id,
  e.occurred_at,
  e.intent as ai_recommendation,
  e.inference as ai_decision,
  jsonb_extract_path(e.metadata, 'human_override') as override,
  jsonb_extract_path(e.metadata, 'override_reason') as reason,
  jsonb_extract_path(e.metadata, 'overridden_by') as human_user
FROM events e
WHERE e.group_id = 'roninclaw-banking'
  AND e.metadata ? 'human_override'
  AND e.occurred_at BETWEEN '2026-04-01' AND '2026-04-30'
ORDER BY e.occurred_at DESC;
```

```cypher
-- Override patterns
MATCH (i:Insight {group_id: 'roninclaw-banking'})
WHERE i.metadata.human_override = true
WITH 
  i.metadata.override_reason as reason,
  count(*) as override_count
RETURN 
  reason,
  override_count,
  (override_count * 100.0 / sum(override_count) OVER ()) as percentage
ORDER BY override_count DESC;
```

### 4.5 Query 5: Cross-Tenant Access Audit

**Purpose:** Prove no unauthorized cross-tenant access occurred

```sql
-- All cross-tenant access attempts
SELECT 
  e.event_id,
  e.group_id as accessed_tenant,
  jsonb_extract_path(e.metadata, 'requesting_agent') as requesting_agent,
  jsonb_extract_path(e.metadata, 'requesting_tenant') as requesting_tenant,
  e.event_type,
  jsonb_extract_path(e.metadata, 'access_granted') as access_granted,
  jsonb_extract_path(e.metadata, 'denial_reason') as denial_reason,
  e.occurred_at
FROM events e
WHERE e.event_type = 'cross_tenant_access_attempt'
  AND e.occurred_at >= '2026-04-01'
ORDER BY e.occurred_at DESC;
```

```cypher
-- Cross-tenant promotion audit
MATCH (i:Insight)-[p:PROMOTED_TO]->(target)
WHERE i.group_id STARTS WITH 'roninclaw-'
  AND target.group_id = 'roninclaw'
RETURN 
  i.id as original_insight,
  i.group_id as source_tenant,
  target.id as platform_insight,
  p.approved_by as human_approver,
  p.approved_at as approval_time,
  p.sanitized as was_sanitized
ORDER BY p.approved_at DESC;
```

### 4.6 Query 6: Historical Reconstruction

**Purpose:** Reconstruct system state at any point in time

```sql
-- System state as of specific date
WITH RECURSIVE state_changes AS (
  -- Get all events up to target date
  SELECT 
    event_id,
    event_type,
    entity_id,
    entity_type,
    change_data,
    occurred_at,
    ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY occurred_at DESC) as rn
  FROM events
  WHERE occurred_at <= '2026-04-15T10:30:00Z'
    AND group_id = 'roninclaw-banking'
)
SELECT 
  entity_type,
  entity_id,
  change_data as final_state
FROM state_changes
WHERE rn = 1
ORDER BY entity_type, entity_id;
```

```cypher
-- Neo4j state reconstruction
MATCH (n)
WHERE n.group_id = 'roninclaw-banking'
  AND n.created_at <= datetime('2026-04-15T10:30:00')
  AND (n.deprecated_at IS NULL OR n.deprecated_at > datetime('2026-04-15T10:30:00'))
RETURN 
  labels(n) as node_type,
  n.id as entity_id,
  properties(n) as state
ORDER BY n.created_at DESC;
```

---

## 5. Implementation Checklist

### Phase 1: Foundation (First)
- [ ] Implement `groupIdEnforcer.ts` (RK-01 fix)
- [ ] Add group_id validation to all database queries
- [ ] Create tenant_metadata table
- [ ] Implement audit logging

### Phase 2: Banking Organization
- [ ] Create `roninclaw-banking` tenant
- [ ] Implement bank-auditor workflow
- [ ] Test all 6 audit queries
- [ ] Validate cross-tenant isolation

### Phase 3: Additional Organizations
- [ ] Create `roninclaw-crm` tenant
- [ ] Create `roninclaw-faithmeats` tenant
- [ ] Implement CRM assistant workflow
- [ ] Implement Faith Meats operations

### Phase 4: Platform Governance
- [ ] Implement promotion workflow
- [ ] Set up HITL approval queues
- [ ] Create platform-level insights
- [ ] Train Curator agents

---

## Appendix A: Glossary

**Term** | **Definition**
---|---
`group_id` | Primary tenant identifier (format: `{platform}-{organization}`)
Tenant | An organization with isolated data access (e.g., Banking, CRM, Faith Meats)
Insight | Curated knowledge derived from observations (stored in Neo4j)
Event | Raw action/occurrence (stored in PostgreSQL)
Promotion | Moving insight from tenant-specific to platform-wide
HITL | Human-in-the-Loop (approval required for sensitive operations)
RK-01 | Risk ID for group_id enforcement failures
Steel Frame | Immutable versioning pattern (SUPERSEDES relationships)

---

## Appendix B: References

**Multi-Tenancy Patterns:**
- Neo4j Multi-Tenancy: https://community.neo4j.com/t/multi-tenancy-on-neo4j/10627
- TypeORM Multi-Tenancy: https://github.com/typeorm/typeorm/issues/4786
- Shared Schema Patterns: https://github.com/lucasvsme/poc-multi-tenancy-shared-schemas

**Audit Evidence Standards:**
- PCAOB AS1105: https://pcaobus.org/oversight/standards/auditing-standards/details/AS1105
- Audit Evidence Best Practices: https://www.scrut.io/post/audit-evidence-documentation-reporting

**Platform Architecture:**
- DNXT Multi-Tenant Features: https://www.dnxtsolutions.com/features/multi-tenant/
- Neo4j Multi-Tenancy Guide: https://graphaware.com/blog/multi-tenancy-neo4j/

---

**Status:** Ready for review  
**Next Steps:** Review with stakeholders, then implement RK-01 fix, create bank-auditor workflow
