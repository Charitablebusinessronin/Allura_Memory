# Roadmap: Letta-Inspired Memory Enhancements

> **Goal**: Make roninmemory a standalone, developer-ready memory system with self-editing capabilities, reflection, and private journaling.

## Current State

roninmemory provides:
- ✅ PostgreSQL: Raw append-only traces
- ✅ Neo4j: Versioned curated insights (SUPERSEDES lineage)
- ✅ HITL: Human approval gates
- ✅ MCP: 30+ tools for memory operations

## Target: Developer-Ready Package

### 1. Self-Editing Memory Layer (MemFS-Style)

**What**: Git-backed markdown memory files agents can edit via bash tools

```
~/.roninmemory/agents/{agent-id}/
├── system/                    # Pinned to context window
│   ├── persona.md            # Agent identity & values
│   ├── workflow.md           # Working conventions
│   └── humans/               # User preferences
│       └── {user}.md
├── reflections/              # Private journal (not pinned)
│   ├── 2026-03-28-session.md
│   └── insights.md
└── context/                  # Project-specific memory
    └── {project}/
        └── decisions.md
```

**Memory File Format**:
```markdown
---
description: "Working style and conventions for TypeScript projects"
limit: 50000
created: "2026-03-28"
last_modified: "2026-03-28"
---

## Preferences
- Use strict TypeScript with explicit return types
- Prefer immutable patterns
- Quote style: double quotes
```

**Implementation**:
- New module: `src/lib/memfs/`
- Bash tools for agents to read/write memory files
- Git versioning with automatic commits
- Sync to Neo4j insights on promotion

### 2. Private Reflection Channel

**What**: Agents write to private journal before surfacing curated insights

**Flow**:
1. Session ends → Agent writes reflection to `system/reflections/{timestamp}.md`
2. Reflection subagent (background job) consolidates raw events
3. Curator reviews → Promotes to Neo4j insight
4. Private reflections archived or kept based on retention policy

**API**:
```typescript
// Private journal entry
await logReflection({
  agent_id: "openclaw-dev",
  group_id: "myproject",
  content: "User seemed frustrated with slow response times...",
  category: "observation", // observation, decision, feeling, idea
  session_id: "sess-123"
});

// Trigger consolidation
await runReflectionJob({
  agent_id: "openclaw-dev",
  window: "24h",
  target: "insights"
});
```

### 3. Sleep-Time Reflection Jobs

**What**: Background jobs that consolidate memory (like Letta's sleep-time)

**Implementation**:
- New module: `src/lib/reflection/`
- Cron-based or event-triggered
- Configurable triggers:
  - Step count (every N events)
  - Compaction event (context window full)
  - Scheduled (daily/weekly)

**Reflection Types**:
- **Consolidation**: Merge redundant memories
- **Distillation**: Summarize long sessions
- **Pattern Detection**: Find recurring issues
- **Defragmentation**: Clean stale memories

### 4. Clear Integration Hooks

**For OpenClaw**:
```typescript
// In OpenClaw agent
import { MemFSClient } from '@roninmemory/memfs';

const memory = new MemFSClient({
  agent_id: process.env.AGENT_ID,
  group_id: process.env.GROUP_ID,
});

// Load system context
const context = await memory.loadSystemContext();

// After task completion, auto-reflect
await memory.reflect({
  session_events: [...],
  outcome: "success",
});
```

**For Other Projects**:
```typescript
// Standalone usage
import { RoninMemory } from 'roninmemory';

const memory = new RoninMemory({
  postgres: { /* config */ },
  neo4j: { /* config */ },
});

// Log event
await memory.logEvent({
  group_id: "myapp",
  event_type: "user.action",
  metadata: { action: "purchase" }
});

// Query insights
const insights = await memory.searchInsights({
  query: "user purchasing patterns",
  group_id: "myapp"
});
```

### 5. Developer Experience

**Quick Start**:
```bash
bun add roninmemory

# Initialize
bunx roninmemory init

# Start databases
docker compose up -d

# Run reflection job
bunx roninmemory reflect --agent myagent --window 24h
```

**Configuration** (`roninmemory.config.js`):
```javascript
module.exports = {
  agent: {
    id: "my-agent",
    persona: "You are a helpful coding assistant...",
    reflection: {
      enabled: true,
      trigger: "step_count",
      interval: 10,
    }
  },
  storage: {
    postgres: { /* ... */ },
    neo4j: { /* ... */ },
  }
};
```

## Implementation Phases

### Phase 1: MemFS Foundation (Week 1-2)
- [ ] Create `src/lib/memfs/` module
- [ ] Git-backed file operations
- [ ] Memory file schema (frontmatter + content)
- [ ] CLI: `roninmemory memory write/read`

### Phase 2: Reflection Pipeline (Week 3-4)
- [ ] Private journal logging
- [ ] Reflection job runner
- [ ] Pattern detection from raw events
- [ ] CLI: `roninmemory reflect`

### Phase 3: Integration Layer (Week 5-6)
- [ ] MCP tools for memory editing
- [ ] OpenClaw integration example
- [ ] SDK package (`@roninmemory/sdk`)
- [ ] Documentation + tutorials

### Phase 4: Polish (Week 7-8)
- [ ] Defragmentation jobs
- [ ] Memory visualization
- [ ] Performance optimization
- [ ] Community examples

## Key Differentiators from Letta

1. **Multi-tenant by design**: Built-in `group_id` isolation
2. **HITL governance**: Human approval before promotion (not just auto-promotion)
3. **Dual persistence**: Raw traces (Postgres) + curated (Neo4j)
4. **MCP-native**: Works with Claude, OpenCode, any MCP client
5. **Open source**: No hosted service lock-in

## Next Steps

1. **Review this roadmap** - Does it match your vision?
2. **Prioritize features** - Which to build first?
3. **Start Phase 1** - I can begin implementing MemFS foundation

Ready to proceed?