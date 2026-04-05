# Allura Memory UI

## Overview

Like `opencode-mem`, Allura provides a web UI for viewing and managing memories. However, Allura's UI is more sophisticated because it manages **two tiers of memory**:

1. **Raw Traces (PostgreSQL)** - All agent execution logs, unfiltered
2. **Promoted Insights (Neo4j)** - Curated knowledge with governance

## UI Components

### 1. Memory Timeline Tab

**Similar to opencode-mem's timeline, but:**
- Shows raw traces from PostgreSQL
- Type badges: `memory`, `decision`, `action`, `prompt`
- Agent attribution
- **"Promote" button** to propose promotion to Neo4j

```
┌─────────────────────────────────────────────────────────────┐
│ PostgreSQL Raw Traces                                       │
│ Append-only logs • 6-12 month retention                     │
├─────────────────────────────────────────────────────────────┤
│ [memory] [claude-agent] 2026-04-04 10:32                   │
│ "User prefers dark mode for UI"                            │
│                                       [Promote ▼]           │
├─────────────────────────────────────────────────────────────┤
│ [decision] [curator-agent] 2026-04-04 09:15                │
│ "Switched to PostgreSQL for traces due to append-only       │
│  requirements"                                              │
│                                       [Promote ▼]           │
└─────────────────────────────────────────────────────────────┘
```

### 2. Promoted Insights Tab

**Shows Neo4j curated knowledge:**
- Version badges (`v2`, `v3`)
- `SUPERSEDES` chain visualization
- Tag filtering
- ADR links

```
┌─────────────────────────────────────────────────────────────┐
│ Neo4j Promoted Insights                                     │
│ Curated knowledge • Steel Frame versioning                  │
├─────────────────────────────────────────────────────────────┤
│ [pattern] v3 [2 previous versions]                         │
│ "PostgreSQL for raw traces, Neo4j for promoted insights"    │
│ Tags: architecture, database, multi-tenant                 │
│                                                             │
│ ▼ View version history                                      │
│   Version 2: "Use Postgres for traces..." (superseded)     │
│   Version 1: "Store in SQLite..." (superseded)              │
│                                                             │
│ Promoted: 2026-04-04 • By: murat                            │
└─────────────────────────────────────────────────────────────┘
```

### 3. HITL Promotion Queue Tab

**Unique to Allura - not in opencode-mem:**
- Curator proposals awaiting approval
- Approve/Reject buttons
- Vote history
- Discussion threads

```
┌─────────────────────────────────────────────────────────────┐
│ Human-in-the-Loop Promotion Queue                           │
│ Review and approve knowledge promotions                      │
├─────────────────────────────────────────────────────────────┤
│ [Pending Approval] Proposed: 2026-04-04 10:45              │
│                                                             │
│ "User prefers to review code changes before merging.       │
│  This should be promoted as a workflow pattern."           │
│                                                             │
│ Proposed by: curator-agent                                  │
│                                                             │
│ ────────────────────────────────────────────────────────── │
│                                                             │
│ [Approve] [Reject]                                          │
│                                                             │
│ Votes:                                                       │
│   [approved] winston: "Good capture of user preference"    │
│   [approved] amelia: "Matches observed behavior"            │
└─────────────────────────────────────────────────────────────┘
```

### 4. Search Bar

**Cross-store search:**
- Queries both PostgreSQL (recent) and Neo4j (promoted)
- Shows which store each result came from
- Relevance ranking

## User Profile

Like `opencode-mem`, Allura learns user preferences:

```
┌─────────────────────────────────────────────────────────────┐
│ User Profile: ronin4life                                    │
│ Group: allura-default                                       │
├─────────────────────────────────────────────────────────────┤
│ Preferences Learned:                                        │
│ • Prefers dark mode UI                                      │
│ • Uses TypeScript strict mode                               │
│ • Reviews code before merging                               │
│ • Uses `bun` for scripts                                    │
│ • Documents architectural decisions                         │
│                                                             │
│ Behavior Patterns:                                          │
│ • Active 9am-6pm PST                                        │
│ • Prefers async communication                               │
│ • Values governance and audit trails                        │
└─────────────────────────────────────────────────────────────┘
```

## Accessing the UI

### Development

```bash
# Start the Next.js app
npm run dev

# Navigate to
open http://localhost:3000/memory
```

### Production

The UI is served by Next.js at `/memory` route:
- Accessible at `http://your-domain/memory`
- Requires authentication (if configured)
- Multi-tenant isolation via `group_id` query param

### API Endpoints

```
GET  /api/memory/traces      → List raw traces
POST /api/memory/traces      → Create new trace
GET  /api/memory/insights    → List promoted insights
GET  /api/memory/search       → Cross-store search
GET  /api/memory/promotions   → List pending promotions
POST /api/memory/promotions   → Propose promotion
POST /api/memory/promotions/:id/vote → Vote on proposal
```

## Comparison with OpenCode-Mem

| Feature | OpenCode-Mem | Allura Memory UI |
|---------|--------------|------------------|
| **Port** | 4747 | 3000 (or custom) |
| **Timeline View** | ✅ Single timeline | ✅ Dual timeline (traces + insights) |
| **User Profile** | ✅ Learned preferences | ✅ Group-scoped preferences |
| **Memory Add** | `memory({mode: "add"})` | `POST /api/memory/traces` |
| **Memory Search** | `memory({mode: "search"})` | `GET /api/memory/search` |
| **Web UI** | ✅ Built-in dashboard | ✅ Next.js page at `/memory` |
| **Governance** | ❌ None | ✅ HITL approval queue |
| **Versioning** | ❌ No versions | ✅ SUPERSEDES chain |
| **Multi-tenant** | ❌ Single user | ✅ `group_id` isolation |
| **Storage Backend** | SQLite + USearch | PostgreSQL + Neo4j |
| **Retention Policy** | Unlimited | 6-12 months (configurable) |

## Architecture Difference

```
OpenCode-Mem (Simple):
┌─────────────┐
│   Web UI    │
└──────┬──────┘
       │
┌──────▼──────┐
│   Plugin    │
│  memory()   │
└──────┬──────┘
       │
┌──────▼──────┐
│   SQLite    │
│  + USearch  │
└─────────────┘

Allura (Sophisticated):
┌─────────────┐
│   Web UI    │
│  /memory    │
└──────┬──────┘
       │
┌──────▼──────────────────────┐
│   Next.js API Routes        │
│   /api/memory/*            │
└──────┬──────────────┬───────┘
       │              │
┌──────▼─────┐  ┌─────▼───────┐
│ PostgreSQL │  │   Neo4j     │
│ Raw Traces  │  │  Insights   │
│ Append-only │  │  SUPERSEDES │
└────────────┘  └─────────────┘
                      │
              ┌───────▼───────┐
              │    Notion     │
              │  Human Review │
              │   HITL Gate   │
              └───────────────┘
```

## Key Differences

### 1. Two-Tier Storage
- **OpenCode-Mem**: Everything in SQLite (single tier)
- **Allura**: Raw traces → PostgreSQL, Promoted insights → Neo4j

### 2. Governance Layer
- **OpenCode-Mem**: Direct storage, no approval
- **Allura**: Curator proposes, Human approves (HITL)

### 3. Multi-Tenancy
- **OpenCode-Mem**: Single user, no isolation
- **Allura**: `group_id` enforced everywhere

### 4. Versioning
- **OpenCode-Mem**: No version control
- **Allura**: Steel Frame versioning with SUPERSEDES

### 5. Integration
- **OpenCode-Mem**: Standalone plugin
- **Allura**: Full Agent-OS integration (Paperclip, OpenClaw, agents)

## Usage in OpenCode CLI

If you want an `opencode-mem` compatible interface, create a plugin wrapper:

```typescript
// .opencode/plugins/allura-memory/index.ts
export default {
  name: 'allura-memory',
  
  tools: {
    // Compatible with opencode-mem's interface
    memory: async (params: { mode: string; content?: string; query?: string; group_id: string }) => {
      // Route to Allura's API
      return await fetch(`/api/memory/${params.mode}`, {
        method: 'POST',
        body: JSON.stringify(params)
      }).then(r => r.json());
    }
  }
};
```

This gives you:
- **opencode-mem compatible interface** - `memory({mode: "add"})`
- **Allura's sophisticated backend** - PostgreSQL + Neo4j + HITL
- **Allura's governance** - group_id enforcement, versioning, approval