# Simple Self-Contained Architecture (No Notion, No ADAS)

**Status:** Clean, minimal, production-ready  
**Dependencies:** PostgreSQL + Neo4j + Dashboard UI (that's it)

---

## The Idea

**Everything stays inside the system.** No external tools. No complex loops.

```
┌─────────────────────────────────────────────────────────────┐
│                      ALLURA MEMORY                          │
│              (Self-contained, no dependencies)              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Agents                                                     │
│  ├─ Amelia (code)                                          │
│  ├─ Mary (analysis)                                        │
│  ├─ Scout (research)                                       │
│  └─ etc.                                                   │
│         ↓                                                   │
│  ┌──────────────────────────────────────────────────┐     │
│  │  Memory Gateway (GraphQL/REST)                   │     │
│  │  + RAG retrieval + Policy layer                  │     │
│  └──────────────────────────────────────────────────┘     │
│         ↓              ↓                                   │
│  ┌──────────────┐  ┌──────────────┐                       │
│  │ PostgreSQL   │  │   Neo4j      │                       │
│  │ (Hot traces) │  │  (Knowledge) │                       │
│  │ (30 days)    │  │  (versioned) │                       │
│  └──────────────┘  └──────────────┘                       │
│     ↑  ↓                ↑                                  │
│     │  └────────┬───────┘                                 │
│     │           ↓                                         │
│     │  ┌────────────────────────┐                        │
│     │  │ Periodic Curator       │                        │
│     │  │ (Daily batch job)      │                        │
│     │  │ Proposes insights      │                        │
│     │  └────────────────────────┘                        │
│     │           ↓                                         │
│     │  ┌────────────────────────┐                        │
│     └─→│ Proposal Queue (Postgres)                       │
│        │ (Status: pending/approved/rejected)             │
│        └────────────────────────┘                        │
│                   ↓                                       │
│        ┌──────────────────────────┐                      │
│        │  Dashboard UI            │                      │
│        │  (Humans approve here)   │                      │
│        │  Tab: HITL Approval      │                      │
│        └──────────────────────────┘                      │
│                   ↓                                       │
│        On approve: Proposal → Neo4j                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. **Agents Run** → Traces Land in PostgreSQL

```sql
-- PostgreSQL `events` table
INSERT INTO events (group_id, agent_id, type, content, created_at)
VALUES ('allura-default', 'memory-scout', 'decision', 
        'Market analysis: 3 competitors, growing 15% YoY', NOW());
```

### 2. **Periodic Curator Runs** (Daily at 2 AM)

```typescript
// Every 24 hours
async function runPeriodicCurator(groupId: string) {
  // Fetch last 24h traces
  const traces = await db.query(
    `SELECT * FROM events 
     WHERE group_id = $1 
     AND created_at > NOW() - INTERVAL '24 hours'`,
    [groupId]
  );

  // Group into patterns (simple rules)
  const patterns = groupTraces(traces);
  // [
  //   { name: 'market_growth', confidence: 0.92, sample: '...' },
  //   { name: 'competitor_threat', confidence: 0.78, sample: '...' }
  // ]

  // Propose high-confidence ones
  for (const p of patterns) {
    if (p.confidence >= 0.8) {
      await db.insert('proposal_queue', {
        group_id: groupId,
        content: p.sample,
        pattern: p.name,
        confidence: p.confidence,
        origin: 'periodic-curator',
        status: 'pending',
        proposed_at: new Date(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });
    }
  }

  // Archive old traces to S3 (if you want cold storage)
  // Or just delete them after 30 days
  await db.delete('events', {
    group_id: groupId,
    created_at: { '<': 'NOW() - INTERVAL 30 days' }
  });

  return { proposals_created: patterns.length };
}

// Schedule: cron job
// CURATOR_SCHEDULE=0 2 * * *  (2 AM daily)
```

### 3. **Human Reviews in Dashboard**

```typescript
// src/app/memory/page.tsx (already exists!)
// Tab: "HITL Queue"
// Shows: Pending proposals
// Actions: [Approve] [Reject]

interface ProposalQueue {
  id: string;
  group_id: string;
  content: string;
  pattern: string;
  confidence: number;
  origin: string;  // 'periodic-curator' or 'manual'
  status: 'pending' | 'approved' | 'rejected';
  proposed_at: Date;
  approved_at?: Date;
  approved_by?: string;
  rejection_reason?: string;
}
```

### 4. **Human Clicks [Approve]**

```typescript
// User clicks button in dashboard
async function approveProposal(proposalId: string, userId: string) {
  // 1. Update proposal status
  await db.update('proposal_queue', {
    status: 'approved',
    approved_at: new Date(),
    approved_by: userId
  }, { id: proposalId });

  // 2. Promote to Neo4j
  const proposal = await db.query(
    'SELECT * FROM proposal_queue WHERE id = $1',
    [proposalId]
  );

  await neo4j.run(`
    CREATE (i:Insight {
      id: randomUUID(),
      group_id: $groupId,
      content: $content,
      pattern: $pattern,
      confidence: $confidence,
      version: 1,
      status: 'current',
      created_at: timestamp(),
      promoted_at: timestamp(),
      promoted_by: $userId
    })
  `, {
    groupId: proposal.group_id,
    content: proposal.content,
    pattern: proposal.pattern,
    confidence: proposal.confidence,
    userId
  });

  // 3. Log to audit trail
  await auditLog.record({
    action: 'insight_promoted',
    proposal_id: proposalId,
    user_id: userId,
    timestamp: new Date()
  });
}
```

### 5. **Agents Query Knowledge** via Gateway

```typescript
// Agent asks: "What do we know about market growth?"
const insights = await memoryGateway.searchInsights({
  query: "market growth",
  groupId: "allura-default",
  agentId: "memory-scout"
});

// Returns:
// [
//   {
//     content: "Market growing 15% YoY (3 competitors analyzed)",
//     confidence: 0.92,
//     promoted_at: "2026-04-08T02:15:00Z",
//     status: "current"
//   }
// ]

// Scout now knows this: it can reference it in next decision
```

---

## Data Schema (PostgreSQL Only)

### Tables

```sql
-- Raw traces (append-only)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'decision', 'action', 'memory', etc.
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_group CHECK (group_id ~ '^allura-'),
  INDEX idx_group_created (group_id, created_at DESC)
);

-- Proposal queue (HITL approval gate)
CREATE TABLE proposal_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL,
  content TEXT NOT NULL,
  pattern TEXT,  -- 'market_growth', 'competitor_threat', etc.
  confidence NUMERIC(3,2),  -- 0.00 - 1.00
  origin TEXT NOT NULL,  -- 'periodic-curator' or 'manual'
  status TEXT NOT NULL DEFAULT 'pending',  -- pending/approved/rejected
  
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- Auto-expire after 7 days
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  rejection_reason TEXT,
  
  INDEX idx_pending (group_id, status) WHERE status = 'pending'
);

-- Audit trail
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  user_id TEXT,
  agent_id TEXT,
  resource TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_user (user_id, created_at DESC)
);
```

### Neo4j Nodes

```cypher
// Insight node
(:Insight {
  id: '550e8400-e29b-41d4-a716-446655440000',
  group_id: 'allura-default',
  content: 'Market growing 15% YoY based on 3 competitors',
  pattern: 'market_growth',
  confidence: 0.92,
  version: 1,
  status: 'current',  // or 'deprecated', 'reverted'
  created_at: 2026-04-08T02:15:00Z,
  promoted_at: 2026-04-08T10:30:00Z,
  promoted_by: 'user@example.com'
})

// Version relationships
(i2:Insight {version: 2, status: 'current'})
  -[:SUPERSEDES {reason: 'newer finding', confidence_delta: 0.05}]->
(i1:Insight {version: 1, status: 'deprecated'})
```

---

## Components (What Exists Already)

### ✅ Already Built

- **Dashboard UI** (`src/app/memory/page.tsx`)
  - Tab 1: Raw traces (read from PostgreSQL)
  - Tab 2: Promoted insights (read from Neo4j)
  - Tab 3: HITL queue (read/write to PostgreSQL, approve to Neo4j)

- **PostgreSQL connection** (`src/lib/postgres/`)
  - Connection pooling
  - Query builders

- **Neo4j connection** (`src/lib/neo4j/`)
  - Driver setup
  - Query builders

### 🔨 Need to Build

1. **Periodic Curator**
   - File: `src/curator/periodic-curator.ts`
   - Scheduler: cron job or AWS Lambda or K8s CronJob
   - Input: Last 24h traces from PostgreSQL
   - Output: Proposals queued to PostgreSQL
   - Cost: One LLM call per day (not 50+)

2. **Memory Gateway** (RAG + Policy)
   - File: `src/integrations/memory-gateway.ts`
   - GraphQL endpoint: `/api/memory/graphql`
   - Features:
     - Search + rank by relevance (embeddings)
     - Policy layer: filter by group_id
     - Audit logging: every read logged

3. **Scheduler**
   - Option A: Node cron (`npm install node-cron`)
   - Option B: AWS Lambda (triggered daily)
   - Option C: K8s CronJob (if containerized)

---

## Database Migrations

```sql
-- 1. Create proposal_queue table
CREATE TABLE proposal_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL,
  content TEXT NOT NULL,
  pattern TEXT,
  confidence NUMERIC(3,2),
  origin TEXT NOT NULL DEFAULT 'periodic-curator',
  status TEXT NOT NULL DEFAULT 'pending',
  
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  rejection_reason TEXT,
  
  CONSTRAINT fk_group CHECK (group_id ~ '^allura-'),
  INDEX idx_pending (status, proposed_at DESC)
);

-- 2. Create audit_log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  user_id TEXT,
  agent_id TEXT,
  resource TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_action (action, created_at DESC)
);

-- 3. Drop ADAS tables (if they exist)
DROP TABLE IF EXISTS adas_runs;
DROP TABLE IF EXISTS adas_proposals;
DROP TABLE IF EXISTS curator_queue;

-- 4. Update events table to add retention policy
-- (Already has created_at, just add index if missing)
CREATE INDEX IF NOT EXISTS idx_events_created (group_id, created_at DESC);
```

---

## Scheduler Implementation

### Option 1: Node Cron (Simplest)

```typescript
// src/scheduler/curator-scheduler.ts
import cron from 'node-cron';
import { runPeriodicCurator } from '@/curator/periodic-curator';

export function initCuratorScheduler() {
  // Run every day at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[Curator] Starting scheduled run');
    try {
      const result = await runPeriodicCurator('allura-default');
      console.log('[Curator] Success:', result);
    } catch (error) {
      console.error('[Curator] Failed:', error);
      // Send alert/log
    }
  });
}

// In src/app/layout.tsx or server startup:
if (process.env.CURATOR_ENABLED === 'true') {
  initCuratorScheduler();
}
```

### Option 2: Separate Service

```bash
# Run curator as standalone service
# In package.json
"curator": "node --loader tsx src/curator/curator-service.ts"

# In curator-service.ts
import cron from 'node-cron';
import { runPeriodicCurator } from './periodic-curator';

async function main() {
  console.log('[Curator Service] Starting');
  
  cron.schedule('0 2 * * *', async () => {
    const result = await runPeriodicCurator('allura-default');
    console.log('[Curator] Batch complete:', result);
  });
  
  // Keep service alive
  await new Promise(() => {});
}

main().catch(console.error);
```

---

## Deployment

### Single Server (Simple)

```bash
# 1. Start main Next.js app (includes curator scheduler)
bun next dev

# Or production:
bun next build
bun next start

# Curator runs automatically at 2 AM
```

### Separate Services (Scalable)

```bash
# Terminal 1: Main app
bun next start

# Terminal 2: Curator service (runs independently)
bun run curator

# Both talk to same PostgreSQL + Neo4j
```

### Docker

```dockerfile
# Dockerfile.curator
FROM oven/bun:latest
WORKDIR /app
COPY . .
RUN bun install
CMD ["bun", "run", "curator"]
```

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: memory
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  
  neo4j:
    image: neo4j:5.26
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD}
  
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres/memory
      NEO4J_URI: bolt://neo4j:7687
  
  curator:
    build:
      dockerfile: Dockerfile.curator
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres/memory
      NEO4J_URI: bolt://neo4j:7687
      CURATOR_ENABLED: "true"
```

---

## Cost Comparison

| Item | Before (Notion+ADAS) | Now (Self-contained) |
|------|----------------------|----------------------|
| Notion API calls | 100s/day | $0 |
| ADAS LLM calls | 50/day (stuck) | 1/day (curator) |
| External dependencies | 3 (Notion, MCP, Ollama) | 1 (Ollama for embeddings) |
| **Monthly cost** | ~$250-400 | ~$50-80 |
| **Complexity** | High | Low |

---

## What Gets Deleted

```bash
# Remove these files/folders
rm -rf src/lib/adas/          # ADAS logic
rm -rf src/curator/ # (keep, but refactor)
rm scripts/curator-run
rm src/mcp/tools.ts (remove ADAS functions)

# Drop these tables
DROP TABLE IF EXISTS adas_runs;
DROP TABLE IF EXISTS adas_proposals;
DROP TABLE IF EXISTS curator_queue;

# Remove from .env
# NOTION_API_KEY
# NOTION_DATABASE_ID
```

---

## What Gets Added

```bash
# Add these files
src/curator/periodic-curator.ts       (batch job)
src/scheduler/curator-scheduler.ts    (cron)
src/integrations/memory-gateway.ts    (RAG + policy)
scripts/migrations/003-add-queues.sql (DB schema)
```

---

## Success Criteria

- [ ] Dashboard HITL queue works (Tab 3)
- [ ] Curator runs daily, generates 3-5 proposals
- [ ] Humans approve via dashboard (not external tool)
- [ ] Approved proposals land in Neo4j
- [ ] Agents query via memory gateway (not raw DB)
- [ ] Audit log captures all reads/writes
- [ ] No ADAS processes
- [ ] No Notion integration
- [ ] System fully self-contained

---

## References

- Dashboard: `src/app/memory/page.tsx` (already exists)
- PostgreSQL: `src/lib/postgres/`
- Neo4j: `src/lib/neo4j/`
- Node cron: https://github.com/kelektiv/node-cron

---

## Timeline

| Week | Task |
|------|------|
| **1** | Delete ADAS, Notion integrations. Run migrations. |
| **2** | Build periodic curator. Test with manual proposals. |
| **3** | Build memory gateway (RAG + policy layer). |
| **4** | Deploy scheduler. Test end-to-end. |

