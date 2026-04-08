# UX + ADAS Integration (Current & New Plans)

**Current Date:** 2026-04-08  
**Status:** Partially integrated — UX is ready, ADAS stuck at "running"

---

## The Flow (How It Works Today)

```
┌─────────────────────────────────────────────────────────────┐
│                    MEMORY DASHBOARD UI                      │
│              (src/app/memory/page.tsx)                       │
└─────────────────────────────────────────────────────────────┘

         ↓

┌──────────────────────────────────────────────────────────────┐
│ TAB 1: Raw Traces (PostgreSQL)                               │
│ ─────────────────────────────────────────────────────────────│
│ Shows execution logs from agents running                     │
│                                                              │
│ Agent: memory-scout                                          │
│ Type: trace.decision                                         │
│ Content: "Analyzed 3 competitors, market growing 15% YoY"   │
│                                                              │
│ [Promote] ← User/ADAS clicks here to propose →──┐          │
└──────────────────────────────────────────────────┼──────────┘
                                                   ↓

┌──────────────────────────────────────────────────────────────┐
│ TAB 3: HITL Queue (Promotion Proposals)                      │
│ ─────────────────────────────────────────────────────────────│
│ Shows what ADAS/users want to promote to knowledge           │
│                                                              │
│ Status: Pending Approval                                    │
│ Content: "Analyzed 3 competitors, market growing 15% YoY"   │
│ Proposed by: memory-scout (or manual)                       │
│                                                              │
│ [Approve] [Reject]  ← Human reviews & votes                 │
└──────────────────────────────────────────────────────────────┘
                                                   ↓

┌──────────────────────────────────────────────────────────────┐
│ TAB 2: Promoted Insights (Neo4j Knowledge Graph)             │
│ ─────────────────────────────────────────────────────────────│
│ Shows approved knowledge with version history                │
│                                                              │
│ Type: pattern                                                │
│ Version: 2 (1 previous version)                              │
│ Content: "Analyzed 3 competitors, market growing 15% YoY"   │
│ Promoted: 2026-04-08                                         │
│                                                              │
│ [View version history]                                       │
│ ├─ Version 1: "Market growing ~12% YoY" (superseded)       │
│ └─ Version 2: "Market growing 15% YoY" (current)            │
└──────────────────────────────────────────────────────────────┘

         ↓ (Future: Agents read from here)

Next time Scout runs, it can reference approved knowledge:
"I already know the market is growing 15% YoY, so let me
focus on differentiation..."
```

---

## Current Implementation (What's Built)

### The Memory Dashboard (`src/app/memory/page.tsx`)

**3 Tabs:**

#### 1. **Raw Traces**
```typescript
interface Trace {
  id: string;
  group_id: string;
  type: 'memory' | 'decision' | 'action' | 'prompt';
  content: string;
  agent: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

// Sources: PostgreSQL `events` table
// Retention: 365 days (append-only)
// Manual action: User clicks [Promote] to propose
```

#### 2. **HITL Queue (Promotions)**
```typescript
interface PromotionProposal {
  id: string;
  group_id: string;
  trace_id: string;
  content: string;
  proposed_by: string;           // "memory-scout" or user
  proposed_at: string;
  status: 'pending' | 'approved' | 'rejected';
  votes: {                        // Vote history
    approver: string;
    vote: 'approve' | 'reject';
    reason: string;
  }[];
}

// Sources: PostgreSQL `promotion_requests` table
// Approval: User clicks [Approve] or [Reject]
// Audit: All votes logged
```

#### 3. **Promoted Insights**
```typescript
interface Insight {
  id: string;
  group_id: string;
  type: 'pattern' | 'decision' | 'adr' | 'best-practice';
  content: string;
  version: number;
  previous_versions: string[];   // Steel Frame versioning
  created_at: string;
  promoted_at: string;
  promoted_by: string;
  tags: string[];
}

// Sources: Neo4j knowledge graph
// Versioning: (v2)-[:SUPERSEDES]->(v1:deprecated)
// Audit: promoted_by, promoted_at logged
```

---

## The ADAS Connection (Today)

### Where Proposals Come From

**Option 1: User Manual Proposal**
```typescript
// User clicks [Promote] on a trace
await fetch('/api/memory/promotions', {
  method: 'POST',
  body: { group_id, trace_id }  // Trace → Proposal
});
```

**Option 2: ADAS Auto-Proposal** ❌ **NOT HAPPENING**
```typescript
// ADAS should run and generate proposals
// File: src/mcp/tools.ts

export async function adasRunSearch(args: unknown) {
  const parsed = ADASRunSearchRequest.parse(args);
  
  // Placeholder - would integrate with ADAS search loop
  return {
    status: "not_implemented",
    message: "ADAS search integration pending",
    domain: parsed.domain,
    group_id: parsed.group_id,
  };
}
```

**Problem:** ADAS test runs never complete. Proposals never queue.

---

## New Plans (How to Wire ADAS → UX)

### Plan A: Auto-Proposal from ADAS (Recommended)

**Timeline:** 1-2 sprints

**What happens:**

```typescript
// 1. ADAS runs (curator service)
const adasResult = await runADAS({
  traces: executionTraces,
  models: ['glm-5-cloud', 'kimi-k2.5'],
  objective: 'identify patterns and generate insights'
});

// 2. ADAS generates proposals with confidence scores
const proposals = adasResult.proposals;
// [
//   { insight: "...", confidence: 0.92, origin: "pattern-analysis" },
//   { insight: "...", confidence: 0.78, origin: "decision-trace" },
// ]

// 3. Filter by confidence threshold
const autoProposal = proposals.filter(p => p.confidence >= 0.85);

// 4. Queue them to PostgreSQL
for (const prop of autoProposal) {
  await db.insert('promotion_requests', {
    group_id: 'allura-default',
    trace_id: prop.trace_id,
    content: prop.insight,
    proposed_by: 'memory-adas',  // ← Identifies as ADAS-proposed
    status: 'pending',
    confidence: prop.confidence,
  });
}

// 5. Signal completion (unblock UI)
await workflowState.mark('adas_complete');
```

**UX Impact:**
- HITL Queue populates automatically
- User sees **[ADAS Proposal]** badge (vs. Manual)
- User can filter: "Show only high-confidence ADAS proposals"

---

### Plan B: Real-time Streaming (Ambitious)

**Timeline:** 2-3 sprints

**What happens:**

```
ADAS running in background
        ↓
Real-time WebSocket to UI
        ↓
HITL Queue updates live:
  "Scout just proposed: Market analysis..."
  [High Confidence: 92%]
        ↓
User approves immediately
        ↓
Insight lands in Neo4j before ADAS finishes
```

**Example UI Change:**
```tsx
// Add real-time listener
useEffect(() => {
  const ws = new WebSocket('ws://localhost/memory/proposals');
  
  ws.onmessage = (event) => {
    const newProposal = JSON.parse(event.data);
    setProposals(prev => [newProposal, ...prev]);
    
    // Optional: toast notification
    toast(`ADAS: ${newProposal.content.substring(0, 50)}...`);
  };
}, []);
```

---

### Plan C: Approval Workflow (Current State)

**Timeline:** ✅ Already built (Epic 3-2)

**What's implemented:**
- Manual promotion (user clicks [Promote])
- Vote history + multi-approver support
- Audit trail (who approved, when, why)
- Automatic Neo4j promotion on approval

**What's missing:**
- ADAS proposals feeding into it
- Confidence score visibility
- Auto-approve for high-confidence (threshold-based)

---

## The Problem: Why ADAS Queue is Empty

### Current State
```
┌────────────────────────┐
│ ADAS Test Runs (50+)   │
│ Status: "running"      │
│ Never complete         │ ← Missing workflow completion signal
└────────────────────────┘
           ↓ (should flow down)
┌────────────────────────┐
│ Promotion Queue        │
│ Empty                  │ ← No proposals to review
└────────────────────────┘
           ↓ (should flow down)
┌────────────────────────┐
│ HITL Dashboard         │
│ "No pending approvals" │ ← User sees nothing to do
└────────────────────────┘
```

### Root Cause

```typescript
// src/mcp/tools.ts (lines 98-108)
export async function adasRunSearch(args: unknown) {
  const parsed = ADASRunSearchRequest.parse(args);
  
  // ❌ MISSING: Actual search implementation
  // ❌ MISSING: Proposal generation
  // ❌ MISSING: Workflow completion signal
  
  return {
    status: "not_implemented",
    message: "ADAS search integration pending",
    domain: parsed.domain,
    group_id: parsed.group_id,
  };
}
```

### One-Line Fix
```typescript
await workflowState.transition({
  from: 'adas_running',
  to: 'adas_complete',
  timestamp: new Date(),
  signal: 'ready_for_promotion_queue'
});
```

---

## New Plans: Phased Rollout

### Phase 1: Unblock Current UX (Week of 2026-04-08)

**Goal:** Get proposals flowing through HITL Queue

**Steps:**
1. Fix ADAS completion signal (1 line)
2. Manually queue 3 ADAS proposals to test
3. User approves via dashboard
4. Verify insight appears in Neo4j tab

**Success:** "ADAS → UX → Neo4j loop works"

---

### Phase 2: Auto-Promotion (2-3 weeks)

**Goal:** ADAS auto-queues high-confidence proposals

**Steps:**
1. Modify `adasRunSearch()` to generate proposals
2. Filter by confidence threshold (0.85+)
3. Insert into `promotion_requests` table
4. Signal workflow complete

**UX Changes:**
- Badge: **[ADAS]** (vs. Manual)
- Column: Confidence score visible
- Filter: "Show ADAS proposals only"

---

### Phase 3: Real-time Streaming (Next Sprint)

**Goal:** Live HITL Queue updates as ADAS runs

**Steps:**
1. Add WebSocket handler to MCP server
2. Stream proposals as they're generated
3. Update dashboard in real-time
4. Allow instant approval/rejection

**UX Changes:**
- Toast notifications: "Scout proposes..."
- Real-time counter: "3 new proposals waiting"
- Instant feedback on approval

---

### Phase 4: Smart Auto-Approval (Polish)

**Goal:** Auto-approve low-risk proposals

**Steps:**
1. Define approval rules per agent type
2. Auto-approve if: confidence ≥ 0.95 AND not contradicts existing
3. Log auto-approvals for audit
4. User can still override

**UX Changes:**
- Filter: "Auto-approved by system"
- Reason: "Confidence: 98%, matches pattern"

---

## Integration Checklist

- [x] Memory Dashboard UI built (3 tabs)
- [x] Trace fetching from PostgreSQL
- [x] Proposal voting mechanism
- [x] Insight display with versioning
- [ ] ADAS proposal generation (NOT DONE)
- [ ] Workflow completion signal (NOT DONE)
- [ ] Real-time WebSocket updates (NOT DONE)
- [ ] Confidence score visualization (NOT DONE)
- [ ] Auto-approval logic (NOT DONE)

---

## How to Test Today

### 1. Manually propose a promotion
```bash
# Start the dashboard
cd /home/ronin704/Projects/allura\ memory
bun next dev

# Visit http://localhost:3000/memory
# Tab 1: Raw Traces
# Click any [Promote] button
```

### 2. Approve it
```
# Tab 3: HITL Queue
# See your proposal
# Click [Approve]
```

### 3. Verify it appeared in Neo4j
```
# Tab 2: Promoted Insights
# Should see your approved insight with v1
```

---

## References

- **Dashboard:** `src/app/memory/page.tsx`
- **ADAS:** `src/mcp/tools.ts` (lines 28-108)
- **Workflow:** `src/lib/session/workflow.ts` (if exists)
- **DB:** PostgreSQL `promotion_requests`, Neo4j insights nodes
- **Progress:** `memory-bank/progress.md` (Epic 3 status)
