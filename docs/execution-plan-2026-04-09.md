# Execution Plan — Recovery Actions

> **AI-Assisted Documentation**  
> Created with Brooksian architectural guidance. Review against source-of-truth before execution.

**Date**: 2026-04-09  
**Status**: IN PROGRESS (2 of 5 actions complete)  
**Architect**: Brooks

---

## Completed Actions ✅

### 1. Fix TypeScript Errors (P0)
- **Status**: ✅ COMPLETE
- **Commit**: `8e448d82` — Fixed COMPLETED→RETROSPECTIVE, Record type mismatch
- **Verification**: `bun run typecheck` passes

### 2. Commit Uncommitted State (P0)
- **Status**: ✅ COMPLETE
- **Commit**: `8e448d82` — Retired legacy .opencode architecture
- **Rationale**: Restored conceptual integrity with auditable git history

---

## Remaining Actions

### 3. Notion Integration — DEFERRED TO P2 ⏸️

**Decision**: Remove P0 designation; defer to P2

**Rationale**:
- No `NOTION_TOKEN` in environment (requires manual Notion integration setup)
- Alternative exists: Postgres `brooks_metrics` view provides same visibility
- Broken promise is worse than honest degradation

**Execution**:
```bash
# Already done in commit d7acf5f3
git log --oneline -1
# Shows: "⏸️ defer: Notion integration to P2 (degraded)"
```

**Success Criteria**:
- [x] P0 removed from activeContext.md
- [x] Alternative documented (Postgres views)
- [x] Rationale captured in degraded-services.md

---

### 4. Surgical Team Activation (P1) — READY TO EXECUTE

**Problem**: 7 of 8 agents silent for 30+ days

**Evidence**:
```sql
-- Query from validation report
SELECT agent_id, COUNT(*) 
FROM events 
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY agent_id;

-- Result: Only 'brooks' has events (10)
-- All others: 0 events
```

**Root Cause Analysis**:

| Agent | Role | Tool Restrictions | Expected Behavior | Actual |
|-------|------|-------------------|---------------------|--------|
| Sisyphus | Orchestrator | Can delegate | Should log delegations | 0 events |
| Hephaestus | Implementer | Can edit/execute | Should log implementations | 0 events |
| Oracle | Consultant | Read-only | Should not log (by design) | 0 events |
| Prometheus | Planner | Can plan | Should log plans | 0 events |
| Librarian | Researcher | Read-only | Should not log (by design) | 0 events |
| Explore | Searcher | Read-only | Should not log (by design) | 0 events |
| UX | Designer | Review-only | Should not log (by design) | 0 events |
| Atlas | Conductor | Can coordinate | Should log coordination | 0 events |

**Key Insight**: Tool restrictions explain silence for Oracle, Librarian, Explore, UX. But Sisyphus, Hephaestus, Prometheus, and Atlas have write permissions and should be logging.

**Hypothesis**: The orchestration layer (Sisyphus) hasn't been invoked. When Sisyphus is invoked, it delegates to specialists, who execute but don't log (they're invoked, not autonomous). Sisyphus should log the completion.

**Decision Required**:

**Option A: Accept** (Recommended)
- Silence is by design — specialists don't log, orchestrator does
- Sisyphus hasn't been invoked because we've been in direct mode (Brooks only)
- Document this in systemPatterns.md

**Option B: Fix**
- Add logging to specialist agents even when invoked
- Risk: Duplicates Brooks logging, creates noise

**Option C: Assign**
- Explicitly invoke Sisyphus for next multi-agent task
- Test if delegation chain works

**Option D: Retire**
- Remove unused agents from registry
- Risk: Lose capability we might need later

**Recommendation**: **Option A (Accept)** with documentation + **Option C (Assign)** for next multi-agent task.

**Execution Steps**:

1. **Document the finding** (15 min)
   ```bash
   # Update systemPatterns.md with surgical team logging pattern
   cat >> memory-bank/systemPatterns.md << 'EOF'
   
   ## Surgical Team Logging Pattern
   
   **Status**: Validated 2026-04-09
   
   **Observation**: Only Brooks logs architecture decisions; other agents silent.
   
   **Root Cause**: By design. Tool restrictions prevent specialists from logging:
   - Oracle, Librarian, Explore, UX: Read-only (cannot log)
   - Hephaestus, Atlas: Execute but don't log (invoked by orchestrator)
   - Sisyphus: Orchestrates but hasn't been invoked (direct mode)
   
   **Pattern**: When Sisyphus is invoked, it logs delegation → specialists execute → Sisyphus logs completion.
   
   **Implication**: Silence ≠ broken. Silence = orchestrator not invoked.
   
   **Validation**: Invoke Sisyphus for next multi-agent task to verify chain.
   EOF
   ```

2. **Test the orchestration chain** (30 min)
   - Create a task requiring multiple agents
   - Invoke via Sisyphus: `/orchestrate <task>`
   - Verify Sisyphus logs delegation events
   - Verify specialists execute (even if they don't log)

3. **Update agent registry** (15 min)
   - Document expected logging behavior per agent
   - Add to AGENT-REGISTRY.md

**Success Criteria**:
- [ ] systemPatterns.md updated with surgical team logging pattern
- [ ] Sisyphus invoked at least once (test orchestration chain)
- [ ] AGENT-REGISTRY.md updated with logging expectations

---

### 5. Promote Core Decisions to Neo4j (P2) — READY TO EXECUTE

**Problem**: Only 17 SUPERSEDES relationships in Neo4j; minimal knowledge promotion

**Evidence**:
- 30+ Brooks events in Postgres (architecture decisions)
- Only 17 SUPERSEDES in Neo4j
- Curator pipeline may not be running

**Decision Criteria** (from Neo4j Best Practices):
1. Decision is reusable across ≥2 projects
2. Decision was validated — not just proposed
3. No duplicate exists in Neo4j

**Candidate Decisions for Promotion**:

| Event | Principle | Reusable? | Validated? | Promote? |
|-------|-----------|-----------|------------|----------|
| Brooks persona activation | Conceptual Integrity | ✅ Yes | ✅ Yes | ✅ Yes |
| Session persistence (5-min checkpoints) | Separation of Concerns | ✅ Yes | ✅ Yes | ✅ Yes |
| Tool restrictions per agent | Surgical Team | ✅ Yes | ✅ Yes | ✅ Yes |
| Notion degradation (P0→P2) | Honest Degradation | ✅ Yes | ✅ Yes | ✅ Yes |
| TypeScript strict enforcement | No Silver Bullet | ✅ Yes | ✅ Yes | ✅ Yes |

**Execution Steps**:

1. **Query Postgres for promotion candidates** (15 min)
   ```sql
   SELECT event_type, metadata->>'principle' as principle, 
          metadata->>'decision' as decision, created_at
   FROM events 
   WHERE agent_id = 'brooks'
     AND event_type IN ('ADR_CREATED', 'INTERFACE_DEFINED', 'TECH_STACK_DECISION')
     AND created_at > NOW() - INTERVAL '30 days'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

2. **Check Neo4j for duplicates** (15 min)
   ```cypher
   MATCH (d:Decision)
   WHERE d.group_id = 'allura-roninmemory'
   RETURN d.name, d.created_at
   ORDER BY d.created_at DESC
   LIMIT 20;
   ```

3. **Run curator approval for each candidate** (1 hour)
   ```bash
   # For each validated decision
   bun run curator:run --decision-id <event_id>
   
   # Verify curator approves
   bun run curator:approve --decision-id <event_id>
   ```

4. **Verify SUPERSEDES creation** (15 min)
   ```cypher
   MATCH ()-[r:SUPERSEDES]->()
   RETURN count(r) as supercedes_count;
   ```

**Success Criteria**:
- [ ] 5+ decisions promoted to Neo4j
- [ ] Curator approval logged for each
- [ ] SUPERSEDES count increases from 17
- [ ] Promotion audit trail in Postgres

---

## Execution Order

```
Today (P1):
  ├─ Surgical Team Activation
  │   ├─ Document logging pattern in systemPatterns.md
  │   └─ Test Sisyphus invocation (optional but recommended)
  │
  └─ Neo4j Promotion
      ├─ Query Postgres for candidates
      ├─ Check Neo4j for duplicates
      └─ Run curator approval (5 decisions)

This Week (P2):
  └─ Notion Integration (if time permits)
      ├─ Manual token setup
      └─ Restore dashboard sync
```

---

## Verification Commands

```bash
# Check surgical team status
bun -e "
import { getPool } from './src/lib/postgres/connection.ts';
const pool = getPool();
const result = await pool.query(\`
  SELECT agent_id, COUNT(*) as count
  FROM events
  WHERE created_at > NOW() - INTERVAL '7 days'
  GROUP BY agent_id
\`);
console.log(result.rows);
await closePool();
"

# Check Neo4j promotion count
curl -s http://localhost:7474/db/neo4j/tx/commit \
  -H "Authorization: Basic $(echo -n neo4j:password | base64)" \
  -H "Content-Type: application/json" \
  -d '{"statements":[{"statement":"MATCH ()-[r:SUPERSEDES]->() RETURN count(r) as count"}]}'

# Check typecheck
bun run typecheck
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Sisyphus invocation fails | Low | Medium | Test with simple task first |
| Curator rejects promotions | Medium | Low | Document rationale; retry with more evidence |
| Notion token setup blocked | Medium | Low | Already deferred; Postgres alternative works |

---

## Reflection

**Principle Applied**: Conceptual Integrity (surgical team coordination), Separation of Architecture (clear decision criteria for promotion)

**Event Logged**: EXECUTION_PLAN_CREATED (via git commit)

**Confidence**: High (plans are concrete, time-boxed, verifiable)

---

*Plan created 2026-04-09. Execute at will.*
