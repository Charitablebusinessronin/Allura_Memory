# roninmemory Testing Guide

6-phase testing protocol for the roninmemory knowledge system. Each phase builds on the previous, with Phase 0 (read-only) always safe to run on production graphs.

## Quick Reference

| Phase | What It Tests | Safe on Live Graph? | Command |
|-------|---------------|---------------------|---------|
| **Phase 0** | Graph discovery via `inspect-graph.cypher` | Always safe | `docker exec knowledge-neo4j cypher-shell ...` |
| **Phase 1** | Service health — all 5 containers, schema, tenants | Read-only | `./scripts/health-check.sh` |
| **Phase 2** | Full promotion pipeline smoke test | Includes cleanup | `./scripts/smoke-test.sh` |
| **Phase 3** | Dual-context query verification | Read-only | `./scripts/test-dual-context.sh` |
| **Phase 4** | ADAS sandbox — discovery cycle | Requires `--profile adas` | `docker compose --profile adas run --rm adas` |
| **Phase 5** | Heartbeat verification | Read-only | `./scripts/test-heartbeat.sh` |

---

## Phase 0: Graph Discovery (inspect-graph)

**Purpose:** Discover the current state of the Neo4j graph without writing anything.

**Safety:** Always safe. Read-only queries.

**When to run:**
- First step on any new or existing graph
- Before schema migrations
- After data imports
- When documenting the system

**Command:**
```bash
docker compose exec neo4j cypher-shell \
  -u neo4j -p $NEO4J_PASSWORD \
  --format verbose \
  -f /var/lib/neo4j/import/inspect-graph.cypher
```

**Expected output:**
- List of all node labels
- List of all relationship types
- Property keys by node type
- Sample nodes with their data

**Next step:** Use output to fill `DATA-DICTIONARY.md` Section 2.

---

## Phase 1: Service Health Check

**Purpose:** Verify all 5 services are running and accessible.

**Services verified:**
1. PostgreSQL (knowledge-postgres)
2. Neo4j (knowledge-neo4j)
3. Curator (cron job status)
4. ADAS Orchestrator (if profile active)
5. Notion sync webhook

**Command:**
```bash
# Check Docker containers
docker ps | grep knowledge

# Verify PostgreSQL
docker exec knowledge-postgres pg_isready -U $POSTGRES_USER -d $POSTGRES_DB

# Verify Neo4j
curl -s http://localhost:7474 | jq .neo4j_version

# Check connection pools
npm run test:connection
```

**Success criteria:**
- All containers show `Up (healthy)`
- PostgreSQL responds with `accepting connections`
- Neo4j returns version JSON
- No connection errors

---

## Phase 2: Promotion Pipeline Smoke Test

**Purpose:** Test the full Curator promotion pipeline end-to-end.

**What happens:**
1. Inserts one test row into `adas_runs` with:
   - `source: smoke-test`
   - `fitness_score: 0.85`
   - `status: succeeded`
   - `promoted: false`
2. Waits for `trg_auto_enqueue_curator` trigger to fire
3. Curator polls and picks up the entry
4. Phase 1: Writes Neo4j node
5. Phase 2: Sets `promoted = true` in Postgres
6. **Cleanup:** Removes test data from both Postgres and Neo4j

**Safety:** Includes automatic cleanup. Live data untouched.

**Command:**
```bash
npm run test:smoke
# or
./scripts/smoke-test.sh
```

**Expected output:**
```
✓ Test row inserted (id: <uuid>)
✓ Auto-enqueue trigger fired
✓ Curator picked up entry
✓ Phase 1: Neo4j node created (id: <node-id>)
✓ Phase 2: Postgres promoted=true
✓ Cleanup: Neo4j node removed
✓ Cleanup: Postgres row removed
✓ Smoke test PASSED
```

---

## Phase 3: Dual-Context Query

**Purpose:** Verify agents receive memory on session start with correct priority.

**What it tests:**
- Tenant-specific insights load
- Global insights load
- Priority ordering (tenant before global)
- Confidence threshold filtering

**Command:**
```bash
./scripts/test-dual-context.sh --tenant faith-meats
```

**Expected query pattern:**
```cypher
MATCH (i:Insight)
WHERE (i.groupId = $tenant_id OR i.groupId = 'global')
  AND i.status = 'active'
  AND i.confidence >= 0.7
RETURN i
ORDER BY 
  CASE i.groupId WHEN $tenant_id THEN 0 ELSE 1 END,
  i.confidence DESC
```

**Success criteria:**
- Returns insights from both tenant and global
- Tenant insights appear first in results
- Only active insights with confidence >= 0.7
- Query completes in < 100ms

---

## Phase 4: ADAS Discovery Cycle

**Purpose:** Run one full ADAS discovery cycle in sandboxed environment.

**⚠️ Requires `--profile adas`**

**What happens:**
1. ADAS meta-agent generates candidate designs
2. Each candidate runs in DinD sandbox:
   - `--network=none`
   - `--cap-drop=ALL`
   - `--memory=256m`
   - `--pids-limit=64`
   - `--read-only`
3. Fitness scoring via Anthropic API
4. Results written to `adas_runs`
5. High-scoring candidates auto-enqueued for Curator

**Command:**
```bash
docker compose --profile adas run --rm adas \
  --domain math \
  --iterations 1 \
  --population 2
```

**Safety:** All execution in isolated containers. No blast radius.

**Expected output:**
- 2 candidates generated
- Each evaluated against ground truth
- Scores written to Postgres
- If score >= 0.7, entry appears in `v_curator_pending`

---

## Phase 5: Heartbeat Verification

**Purpose:** Confirm `after_tool_call` writes to `agents` table.

**What it tests:**
- Hook fires after every tool execution
- Agent heartbeat upserts correctly
- Token cost accumulation
- Task counter increments

**Command:**
```bash
./scripts/test-heartbeat.sh --agent test-agent-001
```

**Expected database state:**
```sql
SELECT 
  name,
  last_heartbeat,
  token_cost_usd,
  tasks_completed,
  tasks_failed
FROM agents
WHERE name = 'test-agent-001';
```

**Success criteria:**
- `last_heartbeat` updated to current timestamp
- `token_cost_usd` incremented by tool call cost
- `tasks_completed` incremented

---

## Common Failure Modes

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| `Connection refused` on Neo4j | Container not started | `docker compose up -d neo4j` |
| `Authentication failure` | Wrong NEO4J_PASSWORD | Check `.env` file |
| `Permission denied` on cypher file | File not in import dir | Copy to `/var/lib/neo4j/import/` |
| Phase 2: `promoted` never true | Curator not running | Check `docker logs knowledge-curator` |
| Phase 2: `neo4j_written` false | Phase 1 failed | Check Neo4j connection |
| Phase 4: `Sandbox timeout` | Resource limits too tight | Increase memory limit in compose |
| Phase 5: `agent row missing` | Hook not firing | Check OpenClaw plugin loaded |

---

## Test Data Locations

| Phase | Postgres Table | Neo4j Nodes | Cleanup |
|-------|---------------|-------------|---------|
| Phase 0 | — | — | N/A |
| Phase 1 | — | — | N/A |
| Phase 2 | `adas_runs` | `Insight` | Automatic |
| Phase 3 | — | — | N/A |
| Phase 4 | `adas_runs`, `adas_trace_events` | — | Manual cleanup script |
| Phase 5 | `agents` | — | Manual (or keep for monitoring) |

---

## Environment Variables Required

```bash
# Required for all phases
NEO4J_PASSWORD=your-password
POSTGRES_PASSWORD=your-password
POSTGRES_USER=ronin4life
POSTGRES_DB=memory

# Required for Phase 4
ANTHROPIC_API_KEY=your-key
ADAS_MAX_ITERATIONS=5

# Required for Phase 2 (Notion mirror)
NOTION_API_KEY=your-key
NOTION_DATABASE_ID=your-db-id
```

---

## CI/CD Integration

Run phases in CI pipeline:

```yaml
# .github/workflows/test.yml
test:
  steps:
    - name: Phase 0-1 (Safe)
      run: |
        docker compose up -d
        ./scripts/phase0-inspect.sh
        ./scripts/phase1-health.sh
    
    - name: Phase 2 (Smoke)
      run: ./scripts/phase2-smoke.sh
    
    - name: Phase 3 (Dual-context)
      run: ./scripts/phase3-dual-context.sh --tenant ci-test
    
    - name: Phase 5 (Heartbeat)
      run: ./scripts/phase5-heartbeat.sh
    
    # Phase 4 requires --profile adas, run separately
```

---

## Next Steps After Testing

1. **Phase 0 output** → Fill `DATA-DICTIONARY.md` Section 2
2. **Phase 2 success** → Curator pipeline is operational
3. **Phase 3 success** → Context loading is working
4. **Phase 4 success** → ADAS discovery is functional
5. **Phase 5 success** → Observability pipeline is healthy

**Full system ready when all phases pass.**
