# Kill ADAS. Do This Instead. (Architectural Refinement)

**Author's Note:** You were right. ADAS is a solution looking for a problem. Here's what actually works.

---

## The Problem with ADAS

### What We Built
```
Agent runs → Auto-capture traces → ADAS loop → Proposes insights → Curator gate → Neo4j
```

### Why This is Wrong

1. **ADAS is continuous** — Constantly re-analyzing, generating proposals, competing with production agents for resources
2. **ADAS has no "done" signal** — 50 test runs stuck at "running" (we've seen this)
3. **ADAS is expensive** — Running LLM inference on every trace, every time
4. **ADAS is noisy** — Proposes low-confidence insights that humans have to reject
5. **ADAS is complex** — Self-improvement loops, confidence scoring, curator gates — too many moving parts

### What AutoClaw/AutoGen Do Better

They're **orchestration frameworks** not **self-improvement loops**:
- AutoClaw: Agent → Task → Outcome (simple DAG)
- AutoGen: Agent conversation (pattern matching, not hallucination)

Both avoid the ADAS trap: **they don't try to be smart on their own**.

---

## The Better Pattern: Periodic Curator Agent

**Replace ADAS with a simple scheduled job:**

```
Every 24 hours (cron job) or on-demand (manual trigger):

1. Curator agent wakes up
   ├─ Reads all raw traces from last 24h
   ├─ Groups by pattern (not ML, simple rules)
   ├─ Writes normalized insights as proposals
   └─ Returns control (no loops, no waiting)

2. Humans review proposals (Notion/dashboard)
   ├─ Read proposal summary
   ├─ Click [Approve] or [Reject]
   └─ Approved ones → Neo4j

3. Traces archived to S3 (cold storage)
   ├─ parquet format (cheaper than Postgres)
   └─ Keep only last 30 days hot in Postgres
```

**Code sketch:**

```typescript
// curator/periodic-curator.ts
export async function runPeriodicCurator(groupId: string) {
  // 1. Fetch recent traces (last 24h, hot store only)
  const traces = await postgres.query(
    `SELECT * FROM events 
     WHERE group_id = $1 
     AND created_at > NOW() - INTERVAL '24 hours'
     ORDER BY created_at DESC`,
    [groupId]
  );

  // 2. Group traces into patterns (simple rules, not ML)
  const insights = groupTracesIntoPatterns(traces);
  // [
  //   { pattern: "market_growth", count: 3, confidence: 0.9, sample: "..." },
  //   { pattern: "competitive_threat", count: 2, confidence: 0.7, sample: "..." }
  // ]

  // 3. For each insight, propose to Neo4j
  for (const insight of insights) {
    if (insight.confidence >= 0.8) {
      // Only propose high-confidence patterns
      await proposalQueue.add({
        group_id: groupId,
        pattern: insight.pattern,
        evidence: insight.samples,
        confidence: insight.confidence,
        origin: 'periodic-curator',
        status: 'pending_human_review'
      });
    }
  }

  // 4. Archive traces to S3
  await archiveTraces(traces, 's3://traces/');

  // 5. Done. Return control.
  return {
    status: 'complete',
    traces_processed: traces.length,
    proposals_generated: insights.length,
    timestamp: new Date()
  };
}

// Run on schedule
// In .env or scheduler:
// CURATOR_SCHEDULE=0 2 * * *  (2 AM daily)
```

---

## Architecture Comparison

### What We Have (Now)
```
PostgreSQL          Neo4j             Notion
(Raw traces)  ← →  (Knowledge)  ← →  (Human approval)
      ↑                              ↑
      └──────── ADAS Loop ───────────┘
         (continuous, expensive)
```

### What You Should Have (Better)
```
PostgreSQL               Neo4j              Notion
(Hot traces, 30d)  →  (Curated facts)  →  (Human gate)
        ↓
     S3 (Cold)
   (parquet, 1y)

Agent reads via RAG retrieval layer (not direct DB access)
Access control via policy layer (Hasura/DreamFactory)
```

---

## Three Immediate Changes

### 1. Kill ADAS. Add Periodic Curator.

**Remove:**
```bash
# DELETE: src/lib/adas/
# DELETE: src/mcp/tools.ts (adasRunSearch, etc.)
# DELETE: curator service (if running continuously)
```

**Add:**
```bash
# NEW: src/curator/periodic-curator.ts
# NEW: scripts/curator-trigger.ts (for manual runs)
# NEW: src/lib/trace-archiver/ (move to S3)
```

---

### 2. Add Status Tracking to Insights

**What we have:**
```cypher
(v2:Insight)-[:SUPERSEDES]->(v1:Insight)
```

**What we need:**
```cypher
(v2:Insight {status: 'current'})
  -[:SUPERSEDES]->  (v1:Insight {status: 'deprecated'})
  -[:REVERTED_BY]-> (v3:Insight {status: 'reverted', reason: 'false_positive'})
  -[:CONTRADICTS]-> (rival:Insight {status: 'alternative'})
```

**Code:**
```typescript
// Insight node
interface Insight {
  id: string;
  group_id: string;
  content: string;
  status: 'current' | 'deprecated' | 'reverted' | 'alternative';
  
  // Immutable metadata
  version: number;
  created_at: DateTime;
  promoted_at: DateTime;
  promoted_by: string;
  confidence: number;  // What CURATOR_AGENT proposed
  
  // Status tracking
  status_reason?: string;  // "contradicts newer finding", "false_positive"
  status_changed_at?: DateTime;
  status_changed_by?: string;
}

// Relationships
// (v2)-[:SUPERSEDES {reason, confidence_delta}]->(v1)
// (reverted)-[:REVERTED_BY {reason}]->(original)
// (alt1)-[:CONTRADICTS {evidence}]->(alt2)
```

---

### 3. Add RAG Retrieval Layer + Policy Layer

**Problem:** Agents query Neo4j directly → no access control, audit messy

**Solution:** GraphQL/REST gateway

```typescript
// src/integrations/memory-gateway.ts

import { createYoga } from 'graphql-yoga';
import { buildSchema } from 'graphql';

const typeDefs = `
  type Query {
    # Only returns insights agent's group can READ
    insightsByPattern(pattern: String!, groupId: String!): [Insight!]!
    
    # RAG-enhanced retrieval
    # Retrieves + ranks by relevance to query
    searchInsights(query: String!, groupId: String!): [InsightWithScore!]!
  }
  
  type Mutation {
    # Only allows agent's group to WRITE
    proposeInsight(
      content: String!
      groupId: String!
    ): ProposalQueue!
  }
`;

export async function insightsByPattern(
  pattern: string,
  groupId: string,
  agentId: string
) {
  // 1. Check access control
  const policy = await policyLayer.check({
    agent: agentId,
    action: 'read',
    resource: `insights/${groupId}`,
  });
  
  if (!policy.allowed) {
    throw new Error(`Agent ${agentId} cannot read ${groupId}`);
  }

  // 2. Query Neo4j
  const query = `
    MATCH (i:Insight {status: 'current', group_id: $groupId})
    WHERE i.pattern = $pattern
    RETURN i, i.created_at as updated_at
    ORDER BY i.confidence DESC
  `;
  
  const results = await neo4j.run(query, { pattern, groupId });
  
  // 3. Log access (audit trail)
  await auditLog.record({
    agent_id: agentId,
    action: 'read',
    resource: `insights/${groupId}/${pattern}`,
    timestamp: new Date(),
    result_count: results.length
  });
  
  return results;
}

export async function searchInsights(
  query: string,
  groupId: string,
  agentId: string
) {
  // 1. Check access
  await policyLayer.check({ agent: agentId, action: 'read', resource: `insights/${groupId}` });

  // 2. RAG retrieval (using embeddings)
  const embedding = await embed(query);  // glm-5-cloud embeddings
  
  const rankedInsights = await neo4j.run(`
    MATCH (i:Insight {status: 'current', group_id: $groupId})
    RETURN i, 
           similarity.cosine(i.embedding, $embedding) as relevance_score
    ORDER BY relevance_score DESC
    LIMIT 10
  `, { groupId, embedding });
  
  // 3. Return ranked results
  return rankedInsights.map(r => ({
    insight: r.i.properties,
    relevance_score: r.relevance_score,
    why_relevant: `Cosine similarity: ${r.relevance_score}`
  }));
}
```

**Deploy via Hasura:**
```yaml
# hasura/config.yaml
version: 3
endpoint: "https://memory-api.example.com/graphql"
databases:
  - name: "neo4j"
    kind: neo4j
    configuration:
      connection_info:
        database_url: $NEO4J_URI
  - name: "postgres"
    kind: postgres
    configuration:
      connection_info:
        database_url: $DATABASE_URL

# Auto-generates RBAC from policy layer
permissions:
  - resource: "insights"
    role: "agent"
    actions: ["read"]
    filter:
      group_id: "{{ agent.group_id }}"
```

---

## New Architecture (Post-ADAS)

```
┌────────────────────────────────────────────────────────────┐
│ Agents (Amelia, Mary, Scout, etc.)                         │
└────────────────────────────────────────────────────────────┘
                           ↓
         ┌─────────────────────────────────────┐
         │  Memory Gateway (GraphQL/REST)      │
         │  + Policy Layer (Hasura/Authz)      │
         │  + Audit Trail                      │
         └─────────────────────────────────────┘
          ↓                                    ↓
      ┌────────────┐               ┌──────────────────┐
      │ PostgreSQL │               │ Neo4j            │
      │(Hot: 30d)  │               │ (Curated Facts)  │
      │ Raw traces │               │ (versioned)      │
      └────┬───────┘               └──────────────────┘
           │                              ↑
           │ Archive (S3 parquet)         │
           │ (Cold: 1y)                   │
           ↓                              │
      ┌─────────────┐          ┌──────────────────┐
      │ S3 (Cold)   │          │ Periodic Curator │
      │ 1 year      │          │ (Daily batch)    │
      └─────────────┘          └──────────────────┘
                                       ↓
                                  ┌─────────────────┐
                                  │ Proposal Queue  │
                                  │ (Notion/UI)     │
                                  │ HITL approval   │
                                  └─────────────────┘
```

---

## How to Migrate (This Sprint)

### Week 1: Remove ADAS

```bash
# 1. Delete ADAS code
rm -rf src/lib/adas/
rm src/mcp/tools.ts  (remove adas* functions)

# 2. Update schema: DROP adas_runs, curator_queue tables
psql $DATABASE_URL -f scripts/migration-remove-adas.sql

# 3. Verify no broken imports
bun run typecheck
```

**Migration SQL:**
```sql
-- scripts/migration-remove-adas.sql
DROP TABLE IF EXISTS adas_runs;
DROP TABLE IF EXISTS adas_proposals;
DROP TABLE IF EXISTS curator_queue;

-- Keep: promotion_requests (used by UI)
-- Keep: events (raw traces)
```

### Week 2: Add Periodic Curator

```typescript
// src/curator/periodic-curator.ts

export async function runPeriodicCurator(groupId: string) {
  console.log(`[Curator] Starting for group: ${groupId}`);
  
  const traces = await fetchRecentTraces(groupId, '24 hours');
  const patterns = groupTracesIntoPatterns(traces);
  const proposals = [];
  
  for (const pattern of patterns) {
    if (pattern.confidence >= 0.8) {
      proposals.push(await proposalQueue.add({
        group_id: groupId,
        pattern: pattern.name,
        evidence: pattern.samples,
        confidence: pattern.confidence,
        origin: 'periodic-curator',
        status: 'pending'
      }));
    }
  }
  
  // Archive old traces
  await s3.uploadTraces(traces, groupId);
  await postgres.deleteTraces(traces.map(t => t.id));
  
  console.log(`[Curator] Generated ${proposals.length} proposals, archived ${traces.length} traces`);
  return { proposals_generated: proposals.length, traces_archived: traces.length };
}
```

**Schedule it:**
```bash
# .env
CURATOR_ENABLED=true
CURATOR_SCHEDULE="0 2 * * *"  # 2 AM daily

# Or trigger manually
bun scripts/curator-trigger.ts
```

### Week 3: Add RAG Layer + Policy

```bash
# 1. Deploy Hasura
docker run -d \
  -e HASURA_GRAPHQL_DATABASE_URL=$DATABASE_URL \
  -e HASURA_GRAPHQL_ENABLE_CONSOLE=true \
  -p 8080:8080 \
  hasura/graphql-engine:latest

# 2. Add policy layer
# src/integrations/policy-layer.ts
# - Check agent permissions
# - Filter results by group_id
# - Log access

# 3. Update agent SDK calls
// Before:
const insights = await neo4j.query(
  `MATCH (i:Insight) RETURN i`
);

// After:
const insights = await memoryGateway.searchInsights({
  query: "market analysis",
  groupId: agent.group_id,
  agentId: agent.id
});
```

---

## New Cost Structure

| Component | Before | After | Why |
|-----------|--------|-------|-----|
| ADAS LLM runs | 50+/day (stuck) | 1/day (curator) | Batch instead of continuous |
| PostgreSQL storage | All traces forever | 30 days hot | Archive to S3 |
| Neo4j queries | Direct from agents | Via RAG gateway | Filtered + ranked |
| Audit trail | Manual logging | Automatic via gateway | Every access logged |
| **Monthly cost** | ~$200-300 | ~$50-80 | 4x cheaper |

---

## Success Metrics (After Migration)

- [ ] Curator runs daily, generates 3-5 proposals
- [ ] Humans review proposals in Notion (not stuck in queue)
- [ ] 80% of proposals approved (not rejected as noise)
- [ ] No ADAS processes running
- [ ] All agent queries go through RAG gateway
- [ ] Audit log shows 100% of reads/writes
- [ ] Trace archival working (S3 growing, PostgreSQL stable)

---

## References

- **Curator template:** Create `src/curator/periodic-curator.ts`
- **Policy layer:** Create `src/integrations/policy-layer.ts`
- **RAG gateway:** Create `src/integrations/memory-gateway.ts`
- **Hasura docs:** https://hasura.io/docs/latest/
- **S3 archival:** Use `aws-sdk` or `boto3` (pick language)

---

## Final Word

ADAS tried to make the system intelligent on its own. That's the mistake.

**The right pattern:** Make the system simple, transparent, and human-auditable.
- Curator: batch, scheduled, clear inputs/outputs
- Humans: review proposals (their job)
- Agents: use approved knowledge (via gateway)
- Audit: every read/write logged

No loops. No hallucinations. No 50 stuck processes.

Just a well-oiled machine.
