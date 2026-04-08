# Minimal Self-Contained Architecture

**No Notion. No external tools. Custom Next.js only.**

---

## The System (Complete)

```
┌────────────────────────────────────────────────────┐
│ AGENTS (Amelia, Mary, Scout, etc.)                │
│ └─ Run autonomously                               │
└────────────────────────────────────────────────────┘
           ↓ (write traces)
┌────────────────────────────────────────────────────┐
│ POSTGRESQL (Raw Traces)                           │
│ Table: events                                      │
│ └─ Append-only execution logs                      │
└────────────────────────────────────────────────────┘
           ↓ (curator reads)
┌────────────────────────────────────────────────────┐
│ PERIODIC CURATOR (Scheduled Job)                  │
│ └─ Runs daily 2 AM                                │
│ └─ Reads traces, proposes insights                │
└────────────────────────────────────────────────────┘
           ↓ (write proposals)
┌────────────────────────────────────────────────────┐
│ POSTGRESQL (Proposal Queue)                       │
│ Table: proposal_queue                             │
│ └─ Pending human approval                         │
└────────────────────────────────────────────────────┘
           ↓ (display)
┌────────────────────────────────────────────────────┐
│ DASHBOARD (Custom Next.js)                        │
│ src/app/memory/page.tsx                           │
│ ├─ Tab 1: Raw Traces (PostgreSQL)                │
│ ├─ Tab 2: Promoted Insights (Neo4j)              │
│ └─ Tab 3: HITL Queue (PostgreSQL)                │
│                                                   │
│ HITL Queue Actions:                              │
│ ├─ [Approve] → Insight → Neo4j                   │
│ └─ [Reject] → Mark rejected, log reason          │
└────────────────────────────────────────────────────┘
           ↓ (approved insights)
┌────────────────────────────────────────────────────┐
│ NEO4J (Knowledge Graph)                           │
│ ├─ Current insights (status: 'current')           │
│ ├─ Deprecated insights (status: 'deprecated')     │
│ └─ Version relationships (SUPERSEDES)             │
└────────────────────────────────────────────────────┘
           ↓ (agents query)
┌────────────────────────────────────────────────────┐
│ MEMORY GATEWAY (API Layer)                        │
│ src/integrations/memory-gateway.ts                │
│ ├─ GraphQL endpoint                              │
│ ├─ RAG retrieval (rank by relevance)             │
│ ├─ Policy layer (filter by group_id)             │
│ └─ Audit logging (every read/write)              │
└────────────────────────────────────────────────────┘
           ↓ (agents query via gateway)
┌────────────────────────────────────────────────────┐
│ AGENTS (Next iteration)                           │
│ └─ Use approved knowledge                         │
└────────────────────────────────────────────────────┘
```

---

## What Exists

### ✅ Dashboard (Already Built)

**File:** `src/app/memory/page.tsx` (285 lines)

```typescript
export default function MemoryDashboardPage() {
  // Tab 1: Raw Traces
  const fetchTraces = async () => {
    const response = await fetch(`/api/memory/traces?group_id=${group_id}`);
    setTraces(response.json());
  };

  // Tab 2: Promoted Insights
  const fetchInsights = async () => {
    const response = await fetch(`/api/memory/insights?group_id=${group_id}`);
    setInsights(response.json());
  };

  // Tab 3: Proposals (HITL)
  const fetchProposals = async () => {
    const response = await fetch(`/api/memory/promotions?status=pending`);
    setProposals(response.json());
  };

  // Actions
  const proposePromotion = async (traceId: string) => {
    await fetch('/api/memory/promotions', {
      method: 'POST',
      body: JSON.stringify({ trace_id: traceId })
    });
  };

  const voteOnProposal = async (proposalId: string, vote: 'approve' | 'reject') => {
    await fetch(`/api/memory/promotions/${proposalId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ vote })
    });
  };

  // UI: 3 tabs
  return (
    <Tabs>
      <Tab1 traces={traces} onPromote={proposePromotion} />
      <Tab2 insights={insights} />
      <Tab3 proposals={proposals} onVote={voteOnProposal} />
    </Tabs>
  );
}
```

**Features:**
- ✅ Fetch traces from PostgreSQL
- ✅ Fetch insights from Neo4j
- ✅ Display proposal queue
- ✅ Approve/reject button handlers
- ✅ Real-time refresh

---

## What Needs to Exist

### 1. Database Layer

**PostgreSQL Tables:**

```sql
-- Raw traces
CREATE TABLE events (
  id UUID PRIMARY KEY,
  group_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  type TEXT,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Proposal queue (for dashboard to read)
CREATE TABLE proposal_queue (
  id UUID PRIMARY KEY,
  group_id TEXT NOT NULL,
  content TEXT NOT NULL,
  pattern TEXT,
  confidence NUMERIC(3,2),
  status TEXT DEFAULT 'pending',  -- pending/approved/rejected
  proposed_at TIMESTAMP,
  approved_at TIMESTAMP,
  approved_by TEXT,
  rejection_reason TEXT
);

-- Audit trail
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  action TEXT,
  user_id TEXT,
  resource TEXT,
  created_at TIMESTAMP
);
```

**Neo4j Nodes:**

```cypher
// Insight nodes (only curated, approved ones)
(i:Insight {
  id: UUID,
  group_id: 'allura-default',
  content: 'Market growing 15% YoY',
  pattern: 'market_growth',
  confidence: 0.92,
  version: 1,
  status: 'current',
  promoted_at: timestamp(),
  promoted_by: 'user@example.com'
})

// Relationships
(i2)-[:SUPERSEDES]->(i1)
```

---

### 2. API Endpoints

**What the dashboard calls:**

```
GET  /api/memory/traces?group_id=allura-default&limit=50
GET  /api/memory/insights?group_id=allura-default&limit=50
GET  /api/memory/promotions?group_id=allura-default&status=pending
POST /api/memory/promotions (create new proposal)
POST /api/memory/promotions/{id}/vote (approve/reject)
```

**Files to create:**

```
src/app/api/memory/traces/route.ts
src/app/api/memory/insights/route.ts
src/app/api/memory/promotions/route.ts
src/app/api/memory/promotions/[id]/vote/route.ts
```

**Example:**

```typescript
// src/app/api/memory/traces/route.ts
import { getPool } from '@/lib/postgres/connection';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const groupId = request.nextUrl.searchParams.get('group_id');
  const limit = request.nextUrl.searchParams.get('limit') || '50';

  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM events 
     WHERE group_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2`,
    [groupId, limit]
  );

  return NextResponse.json({ traces: result.rows });
}
```

---

### 3. Periodic Curator (Scheduled Job)

**Not a UI. Just a service that runs daily.**

```typescript
// src/curator/periodic-curator.ts
import { getPool } from '@/lib/postgres/connection';

export async function runPeriodicCurator(groupId: string) {
  const pool = getPool();

  // 1. Fetch last 24h traces
  const traces = await pool.query(
    `SELECT * FROM events 
     WHERE group_id = $1 
     AND created_at > NOW() - INTERVAL '24 hours'`,
    [groupId]
  );

  // 2. Group into patterns (simple rules)
  const patterns = groupTracesIntoPatterns(traces.rows);

  // 3. Propose high-confidence ones
  for (const p of patterns) {
    if (p.confidence >= 0.8) {
      await pool.query(
        `INSERT INTO proposal_queue 
         (id, group_id, content, pattern, confidence, status, proposed_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          generateUUID(),
          groupId,
          p.sample,
          p.name,
          p.confidence,
          'pending'
        ]
      );
    }
  }

  // 4. Archive old traces (optional, or just leave them)
  await pool.query(
    `DELETE FROM events 
     WHERE group_id = $1 
     AND created_at < NOW() - INTERVAL '30 days'`,
    [groupId]
  );

  return { proposals_created: patterns.length };
}

function groupTracesIntoPatterns(traces: any[]) {
  // Simple rules-based grouping
  // E.g., count "market" mentions, count "competitor" mentions
  // Return: [{ name: 'market_growth', confidence: 0.92, sample: '...' }]
  
  const patterns: Record<string, any> = {};
  
  for (const trace of traces) {
    if (trace.content.includes('market') && trace.content.includes('grow')) {
      patterns['market_growth'] ??= { count: 0, samples: [] };
      patterns['market_growth'].count++;
      patterns['market_growth'].samples.push(trace.content);
    }
    if (trace.content.includes('compet') && trace.content.includes('threat')) {
      patterns['competitor_threat'] ??= { count: 0, samples: [] };
      patterns['competitor_threat'].count++;
      patterns['competitor_threat'].samples.push(trace.content);
    }
  }

  return Object.entries(patterns).map(([name, data]) => ({
    name,
    confidence: Math.min(data.count / traces.length, 1.0),  // 0-1
    sample: data.samples[0],
    count: data.count
  }));
}
```

**Schedule it:**

```typescript
// src/scheduler/curator-scheduler.ts
import cron from 'node-cron';
import { runPeriodicCurator } from '@/curator/periodic-curator';

export function initCuratorScheduler() {
  // Run daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[Curator] Starting scheduled run');
    try {
      const result = await runPeriodicCurator('allura-default');
      console.log('[Curator] Success:', result);
    } catch (error) {
      console.error('[Curator] Failed:', error);
    }
  });
}

// In src/app/layout.tsx (server component):
import { initCuratorScheduler } from '@/scheduler/curator-scheduler';

if (process.env.CURATOR_ENABLED === 'true') {
  initCuratorScheduler();
}
```

---

### 4. Memory Gateway (API Layer)

**Agents query via this. Not direct DB access.**

```typescript
// src/integrations/memory-gateway.ts
import { Driver } from 'neo4j-driver';
import { getPool } from '@/lib/postgres/connection';

export async function searchInsights(
  query: string,
  groupId: string,
  agentId: string
) {
  // 1. Check policy (agent allowed to read this group?)
  const allowed = await checkPolicy(agentId, 'read', groupId);
  if (!allowed) throw new Error('Access denied');

  // 2. Embed query
  const embedding = await embed(query);  // Using sentence-transformers or OpenAI

  // 3. Query Neo4j with embedding similarity
  const neo4j = getNeo4jDriver();
  const result = await neo4j.executeQuery(`
    MATCH (i:Insight {status: 'current', group_id: $groupId})
    WHERE i.embedding IS NOT NULL
    RETURN i, 
           gds.similarity.cosine(i.embedding, $embedding) as score
    ORDER BY score DESC
    LIMIT 10
  `, { groupId, embedding });

  // 4. Log access
  await auditLog({
    action: 'read_insights',
    agent_id: agentId,
    group_id: groupId,
    result_count: result.records.length
  });

  return result.records.map(r => ({
    content: r.get('i').properties.content,
    confidence: r.get('i').properties.confidence,
    relevance: r.get('score'),
    promoted_at: r.get('i').properties.promoted_at
  }));
}
```

**Expose as REST endpoint:**

```typescript
// src/app/api/memory/search/route.ts
export async function POST(request: Request) {
  const { query, groupId, agentId } = await request.json();
  
  const results = await searchInsights(query, groupId, agentId);
  
  return Response.json({ results });
}
```

**Agents call it:**

```typescript
// In agent code
const knowledge = await fetch('http://localhost:3000/api/memory/search', {
  method: 'POST',
  body: JSON.stringify({
    query: 'What do we know about market trends?',
    groupId: 'allura-default',
    agentId: 'memory-scout'
  })
});
```

---

## What Gets Deleted

```bash
# ADAS
rm -rf src/lib/adas/
rm src/mcp/tools.ts  # remove adas* functions

# Notion
rm .env entries: NOTION_API_KEY, NOTION_DATABASE_ID
rm src/integrations/notion*

# Tables
DROP TABLE adas_runs;
DROP TABLE adas_proposals;
DROP TABLE curator_queue;
```

---

## What Gets Added

```bash
# Database schema
scripts/migrations/001-add-proposal-queue.sql
scripts/migrations/002-add-audit-log.sql

# Backend
src/app/api/memory/traces/route.ts
src/app/api/memory/insights/route.ts
src/app/api/memory/promotions/route.ts
src/app/api/memory/promotions/[id]/vote/route.ts

src/curator/periodic-curator.ts
src/scheduler/curator-scheduler.ts

src/integrations/memory-gateway.ts
src/integrations/policy-layer.ts
src/integrations/audit-log.ts

# Config
.env: CURATOR_ENABLED=true

# Package
package.json: add "node-cron"
```

---

## Deployment

### Development

```bash
# All in one process
bun next dev

# Curator scheduler runs automatically at 2 AM
```

### Production

```bash
# Build
bun next build

# Start
bun next start

# Curator runs on schedule
```

---

## Request Flow (Complete)

### 1. Agent runs
```
Scout executes analysis → trace logged to PostgreSQL
```

### 2. Curator wakes up (daily 2 AM)
```
Reads: SELECT * FROM events WHERE created_at > NOW() - 24h
Groups: 'market_growth' (0.92 confidence), 'competitor_threat' (0.78)
Writes: INSERT INTO proposal_queue (status: 'pending')
```

### 3. Human opens dashboard
```
Tab 1: Queries GET /api/memory/traces
Tab 3: Queries GET /api/memory/promotions?status=pending
  Shows: 2 proposals waiting for approval
```

### 4. Human clicks [Approve]
```
Dashboard: POST /api/memory/promotions/{id}/vote
Backend:
  1. UPDATE proposal_queue SET status='approved'
  2. CREATE (i:Insight) in Neo4j
  3. INSERT INTO audit_log
```

### 5. Next agent run
```
Scout queries: POST /api/memory/search?query="market trends"
Memory gateway:
  1. Check policy (Scout can read allura-default? Yes)
  2. Embed query
  3. Query Neo4j (match current insights)
  4. Log access
  5. Return ranked results
Scout gets: "Market growing 15% YoY (promoted by user@, 0.92 confidence)"
Scout references it in decision: "Given market trends are up..."
```

---

## Files to Modify

### src/app/layout.tsx
```typescript
// Add curator scheduler
import { initCuratorScheduler } from '@/scheduler/curator-scheduler';

if (process.env.CURATOR_ENABLED === 'true') {
  initCuratorScheduler();
}
```

### .env
```bash
# Add
CURATOR_ENABLED=true
CURATOR_SCHEDULE=0 2 * * *
```

### package.json
```json
{
  "dependencies": {
    "node-cron": "^3.0.0"
  }
}
```

---

## Timeline (2 Weeks)

| Day | Task |
|-----|------|
| 1-2 | Delete ADAS, Notion. Add proposal_queue, audit_log tables. |
| 3-4 | Implement curator, scheduler. Manual test. |
| 5-6 | Implement memory gateway, policy layer, audit logging. |
| 7-8 | Test end-to-end: trace → proposal → approval → Neo4j → search |
| 9-10 | Deploy. Monitor. |

---

## Success

When this is complete:

```
✅ No Notion
✅ No ADAS
✅ No external dependencies (except Ollama for embeddings)
✅ All logic self-contained in Next.js
✅ Dashboard is the only UI
✅ One cron job (curator)
✅ One API layer (gateway)
✅ Clear audit trail
✅ $50-80/mo (down from $300+)
```

