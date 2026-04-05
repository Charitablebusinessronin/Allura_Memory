---
name: roninmemory-hive-mind
description: Auto-hydrate session context from PostgreSQL events + Neo4j knowledge + memory-bank. Use at session start for full context awareness.
---

# RoninMemory Hive Mind

**Purpose:** Automatic context hydration from dual-memory architecture (PostgreSQL + Neo4j) + filesystem (memory-bank).

**When to Use:** 
- At the start of EVERY session
- After context loss or session reset
- Before making architectural decisions
- When "butter smooth" handoff is needed

---

## Session Initialization Protocol

### Step 0: Memory Bootstrap

**Auto-execute on session start:**

```typescript
// 1. Check ARCH-001 status (groupIdEnforcer)
const arch001Status = await checkArch001();

// 2. Query PostgreSQL (Event Chronicle)
const events = await queryPostgres({
  filter: ['bmad', 'template', 'documentation', 'architecture'],
  limit: 100,
  order: 'desc'
});

// 3. Query Neo4j (Curated Knowledge)
const insights = await queryNeo4j({
  match: '(n)',
  where: [
    'n.name CONTAINS "bmad"',
    'n.name CONTAINS "template"', 
    'n.name CONTAINS "documentation"',
    'n.name CONTAINS "standardization"'
  ],
  limit: 50
});

// 4. Read memory-bank
const memoryBank = await readMemoryBank([
  'activeContext.md',
  'progress.md',
  'systemPatterns.md',
  'techContext.md'
]);

// 5. Merge context
const unifiedContext = mergeContext(events, insights, memoryBank);

// 6. Log session start
await logToPostgres('session_start', { context: unifiedContext });
await logToNeo4j('Session', { context: unifiedContext });

return unifiedContext;
```

---

## Context Sources

### Source 1: PostgreSQL (Raw Events)

**Tables to Query:**

| Table | Purpose | Query Pattern |
|-------|---------|---------------|
| `events` | All system events | `SELECT * FROM events WHERE context ILIKE '%bmad%' ORDER BY timestamp DESC LIMIT 100` |
| `sessions` | Session history | `SELECT * FROM sessions WHERE agent_id = 'memory-orchestrator' ORDER BY created_at DESC LIMIT 20` |
| `traces` | Execution traces | `SELECT * FROM traces WHERE group_id = 'allura-*' ORDER BY created_at DESC LIMIT 50` |
| `agents` | Agent registry | `SELECT * FROM agents WHERE status = 'active'` |

### Source 2: Neo4j (Curated Knowledge)

**Node Types to Query:**

```cypher
// Decisions
MATCH (d:Decision) RETURN d

// Insights  
MATCH (i:Insight) RETURN i

// Agents
MATCH (a:Agent) RETURN a

// Sessions with relationships
MATCH (s:Session)-[:CONTRIBUTED]->(i:Insight)
RETURN s, i
```

### Source 3: Memory-Bank (Session Context)

**Files to Read:**

1. **activeContext.md** - Current focus and blockers
2. **progress.md** - What's been done
3. **systemPatterns.md** - Architecture patterns
4. **techContext.md** - Tech stack details

---

## Unified Context Output

### Context Bundle Structure

```typescript
interface HiveMindContext {
  // Session info
  sessionId: string;
  timestamp: string;
  agentId: string;
  
  // Blockers
  criticalBlockers: {
    arch001: {
      status: 'fixed' | 'open' | 'in-progress';
      description: string;
      impact: string;
    }[];
  };
  
  // Recent events (from PostgreSQL)
  recentEvents: {
    type: string;
    context: string;
    timestamp: string;
    agent: string;
  }[];
  
  // Curated insights (from Neo4j)
  insights: {
    name: string;
    type: 'Decision' | 'Insight' | 'Pattern';
    observations: string[];
    relationships: string[];
  }[];
  
  // Active context (from memory-bank)
  activeFocus: string;
  recentAccomplishments: string[];
  workspaces: string[];
  
  // Canon references
  sourceOfTruth: string;
  documentHierarchy: string[];
}
```

---

## Auto-Improvement Protocol

### Learning Loop

**After each session:**

1. **Extract patterns** from session events
2. **Identify failures** and root causes
3. **Update skills** with new patterns
4. **Log to Neo4j** as promoted insights
5. **Update memory-bank** for next session

### Skill Evolution

```typescript
// Auto-update skills based on session outcomes
async function evolveSkills(session: Session) {
  const patterns = extractPatterns(session.events);
  const failures = extractFailures(session.events);
  
  // Update skill templates
  await updateSkill('roninmemory-hive-mind', {
    patterns: patterns,
    antiPatterns: failures
  });
  
  // Create new skills for repeated tasks
  if (isRepeatedTask(session, 3)) {
    await createSkillFromPattern(patterns);
  }
}
```

---

## Butter Smooth Handoff

### Next Session Auto-Load

**When a new session starts:**

1. **Auto-invoke** this skill
2. **Load** unified context from all sources
3. **Display** "Butter smooth - full context loaded"
4. **Continue** from where previous session left off

**Expected Output:**

```
🧠 Hive Mind Connected

✅ PostgreSQL: 127 events loaded
✅ Neo4j: 23 insights loaded  
✅ Memory-Bank: 4 files loaded
✅ Unified Context: READY

Butter smooth. Full context. Ready to build.

Critical Blockers:
- ARCH-001: ✅ FIXED (groupIdEnforcer wired)

Current Focus:
- Template standardization for BMad
- Hive mind skill creation

Recent Accomplishments:
- ✅ Created 7 Agent nodes in Neo4j
- ✅ Synced to PostgreSQL
- ✅ Established KNOWS relationships

Ready to execute.
```

---

## Integration with BMad

### BMad Skill Enhancement

**Update all BMad skills to:**

1. **Auto-invoke** hive-mind at start
2. **Check** for prior attempts before executing
3. **Log** outcomes to both databases
4. **Update** skills based on results

### Example: bmad-create-prd

```typescript
// Updated workflow
async function bmadCreatePrd() {
  // Step 0: Hive mind
  const context = await invokeSkill('roninmemory-hive-mind');
  
  // Check if PRD already exists
  if (context.insights.find(i => i.name.includes('PRD'))) {
    // Load existing instead of creating new
    return await loadExistingPrd();
  }
  
  // Execute with full context
  const prd = await createPrd(context);
  
  // Log to both databases
  await logToPostgres('prd_created', { prd });
  await logToNeo4j('PRD', { prd });
  
  return prd;
}
```

---

## Commands

### Manual Invocation

```bash
# Load full context
/opencode invoke roninmemory-hive-mind

# Check context status
/opencode invoke roninmemory-hive-mind --status

# Force refresh
/opencode invoke roninmemory-hive-mind --refresh
```

---

## Success Metrics

- [ ] Context loaded from all 3 sources
- [ ] No duplicate work from prior sessions
- [ ] Critical blockers identified upfront
- [ ] "Butter smooth" handoff to next session
- [ ] Skills auto-update from learnings

---

**Next Session:** Automatic context hydration. Butter smooth.
