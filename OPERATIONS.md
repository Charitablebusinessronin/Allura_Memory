# OPERATIONS.md — Allura Memory System Runbook

> **Purpose:** Complete operational reference so any new team member can execute any procedure without tribal knowledge.
> **Last updated:** 2026-05-01
> **Scope:** Allura Memory docker-compose stack (PostgreSQL, Neo4j, Next.js app, MCP gateway)

---

## Table of Contents

- [1. Service Architecture](#1-service-architecture)
- [2. Container Management](#2-container-management)
- [3. Health Checks](#3-health-checks)
- [4. Budget Enforcer Operations](#4-budget-enforcer-operations)
- [5. Re-Embedding Procedure](#5-re-embedding-procedure)
- [6. Backup & Recovery](#6-backup--recovery)
- [7. Retention Policy](#7-retention-policy)
- [8. Common Failure Modes & Remediation](#8-common-failure-modes--remediation)
- [9. Emergency Procedures](#9-emergency-procedures)
- [10. Configuration Reference](#10-configuration-reference)

---

## 1. Service Architecture

### Service Map

| Service | Container Name | Port | Dependencies | Data Volume |
|---------|---------------|------|-------------|-------------|
| PostgreSQL 16 | `allura-postgres` | 5432 | None | `pgdata` |
| Neo4j 5.26 | `allura-neo4j` | 7474 (HTTP), 7687 (Bolt) | None | `neo4j-data` |
| Next.js App | `allura-app` | 3000 | PostgreSQL, Neo4j | None |
| MCP HTTP Gateway | `allura-mcp-gateway` | 3100 | PostgreSQL, Neo4j | None |

### Data Flow

```
Agent → MCP Tools → canonical-http-gateway (3100)
                     ↓
              Memory Engine → PostgreSQL (episodic)
                     ↓ (if score ≥ threshold)
              Neo4j (semantic, via curator)

Dashboard → Next.js App (3000) → PostgreSQL + Neo4j
```

---

## 2. Container Management

### Start All Services

```bash
cd /home/ronin704/Projects/allura\ memory/docker
docker compose up -d
```

**Expected:** All 4 services show `Up` status within 60 seconds. PostgreSQL needs ~10s for first-run init; Neo4j needs ~15s.

```bash
docker compose ps
```

### Stop All Services

```bash
docker compose down
```

**Note:** This stops containers but preserves data volumes. Data survives `down`.

### Remove Data Volumes (DESTRUCTIVE)

```bash
docker compose down -v
```

⚠️ **This permanently deletes all PostgreSQL and Neo4j data.** Only use after confirmed backup.

### Restart a Single Service

```bash
# PostgreSQL
docker compose restart postgres

# Neo4j
docker compose restart neo4j

# Next.js App
docker compose restart app

# MCP Gateway
docker compose restart mcp-gateway
```

### Restart All Services

```bash
docker compose restart
```

**Expected downtime:** ~30 seconds. Connections drain, containers restart, health checks pass.

### View Logs

```bash
# All services
docker compose logs -f --tail=100

# Single service
docker compose logs -f --tail=100 postgres
docker compose logs -f --tail=100 neo4j
docker compose logs -f --tail=100 app
docker compose logs -f --tail=100 mcp-gateway

# Filter by time
docker compose logs --since="2026-05-01T10:00:00" postgres
```

### Scale/Resource Issues

```bash
# Check resource usage
docker stats --no-stream

# Check disk usage
docker system df
```

---

## 3. Health Checks

### Quick Health Check

```bash
curl -s http://localhost:3100/api/health | jq .
```

**Healthy response:**
```json
{
  "status": "healthy",
  "dependencies": {
    "postgres": { "status": "up" },
    "neo4j": { "status": "up" }
  }
}
```

### Detailed Health Check

```bash
curl -s "http://localhost:3100/api/health?detailed=true" | jq .
```

Returns per-component latency and status. Use when diagnosing specific issues.

### Degraded Mode

If Neo4j is down, the system enters **degraded mode**:

```json
{
  "status": "degraded",
  "degraded": {
    "enabled": true,
    "reason": "Neo4j unavailable",
    "capabilities_lost": ["semantic_search", "promotion"]
  }
}
```

**What works in degraded mode:**
- Episodic reads (PostgreSQL)
- Memory writes (PostgreSQL only, no promotion)
- Search (PostgreSQL full-text only, no semantic ranking)
- Dashboard (partial data)

**What doesn't work:**
- Semantic search across promoted knowledge
- Memory promotion to Neo4j
- Knowledge graph visualization

### Metrics Dashboard

```bash
curl -s http://localhost:3100/api/health/metrics | jq .
```

Returns: queue depth, recall latency, storage stats, degraded component count.

---

## 4. Budget Enforcer Operations

### How Budget Enforcement Works

The budget enforcer tracks per-session resource consumption (tokens, tool calls, time, cost, steps). When a session exceeds any limit, it is **halted**. Halted sessions auto-expire after `haltTtlMs` (default: 1 hour). Admins can reset manually.

### Check Halted Sessions

Halted sessions are logged to the console. Check via:

```bash
docker compose logs mcp-gateway 2>&1 | grep -i "budget\|halted"
```

### Reset Halted Sessions (Per Group)

```bash
curl -X POST http://localhost:3100/api/admin/reset-budget \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{"group_id": "allura-system"}'
```

**Response:**
```json
{
  "cleared": 3,
  "before": 5,
  "after": 2
}
```

### Reset All Halted Sessions (Global)

```bash
curl -X POST http://localhost:3100/api/admin/reset-budget \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{}'
```

⚠️ **Warning:** Global reset affects all tenants. Use with caution in multi-tenant deployments.

### Verify Budget Reset

After resetting, verify via the health metrics endpoint:

```bash
curl -s http://localhost:3100/api/health/metrics | jq '.degraded'
```

### TTL Auto-Expiry Configuration

Default: 1 hour (`DEFAULT_HALT_TTL_MS = 3600000`). To change, set the environment variable:

```bash
# In docker-compose.yml or .env
HALT_TTL_MS=7200000  # 2 hours
```

Restart the MCP gateway after changing:

```bash
docker compose restart mcp-gateway
```

---

## 5. Re-Embedding Procedure

**When to re-embed:**
- Changing embedding model (e.g., qwen3-embedding:8b → text-embedding-3-small)
- Changing embedding dimensions (e.g., 768d → 1024d → 4096d)
- After model corruption or drift

### Step 1: Verify Current Embedding State

```bash
# Check current model
echo $EMBEDDING_MODEL
echo $RUVECTOR_EMBEDDING_MODEL

# Count rows needing re-embedding
docker compose exec postgres psql -U ronin4life -d memory -c \
  "SELECT COUNT(*) FROM allura_memories WHERE embedding IS NOT NULL AND embedding_1024 IS NULL;"
```

### Step 2: Set New Embedding Model

```bash
# In .env or docker-compose.yml
EMBEDDING_MODEL=qwen3-embedding:8b
RUVECTOR_EMBEDDING_MODEL=qwen3-embedding:8b
OLLAMA_BASE_URL=http://localhost:11434
```

### Step 3: Run Re-Embedding Script

**For 1024d dimensions (current standard):**
```bash
cd /home/ronin704/Projects/allura\ memory
npx tsx scripts/re-embed-to-1024d.ts
```

**For 4096d dimensions (full Qwen3):**
```bash
cd /home/ronin704/Projects/allura\ memory
npx tsx scripts/backfill-embeddings-4096.ts
```

### Step 4: Verify Re-Embedding

```bash
# Check that all rows have embeddings
docker compose exec postgres psql -U ronin4life -d memory -c \
  "SELECT COUNT(*) AS total,
          COUNT(embedding) AS has_768d,
          COUNT(embedding_1024) AS has_1024d
   FROM allura_memories;"
```

### Step 5: Verify Search Quality

```bash
# Test search with new embeddings
curl -s -X POST http://localhost:3100/api/memory/retrieval \
  -H "Content-Type: application/json" \
  -d '{"query": "test query", "group_id": "allura-system", "user_id": "admin"}'
```

**Expected:** Results returned with relevance scores. Compare against baseline if available.

### Troubleshooting Re-Embedding

| Issue | Fix |
|-------|-----|
| Ollama connection refused | Ensure Ollama is running: `ollama serve` |
| Model not found | Pull the model: `ollama pull qwen3-embedding:8b` |
| Batch failures | Reduce `BATCH_SIZE` in the script (default: 5–10) |
| Slow progress | Increase `BATCH_DELAY_MS` if hitting rate limits |
| Partial completion | Script is idempotent — re-run to continue from last checkpoint |

---

## 6. Backup & Recovery

### Full Backup

```bash
export NEO4J_PASSWORD='<password>'
bash scripts/backup.sh
```

Backup includes:
- PostgreSQL `pg_dump` (all tables, schemas, data)
- Neo4j cypher export (all nodes and relationships)
- Configuration files (.env, docker-compose.yml)

### Restore

```bash
export NEO4J_PASSWORD='<password>'
bash scripts/restore.sh /path/to/backup-dir
```

### RTO (Recovery Time Objective)

**Measured RTO: ~2 minutes** (from drill conducted 2026-05-01)

| Phase | Time |
|-------|------|
| PostgreSQL pg_dump | ~2s |
| Neo4j cypher export | ~60s |
| Config copy | ~1s |
| PG restore (pg_restore) | ~10s |
| Neo4j restore | ~30s |
| Container restart | ~15s |
| Verification | ~5s |

**Target: < 10 minutes** ✓

### Data Integrity Verification

After restore, verify counts match:

```sql
SELECT 'allura_memories' AS t, COUNT(*) AS total,
       COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active FROM allura_memories
UNION ALL SELECT 'events', COUNT(*), NULL FROM events
UNION ALL SELECT 'canonical_proposals', COUNT(*), NULL FROM canonical_proposals;
```

### Known Backup Issues

1. **TS backup system** (`scripts/backup.ts`): Has ENOBUFS on large PG dumps. Use shell scripts (`backup.sh`/`restore.sh`) instead.
2. **Neo4j offline dump**: Requires stopping Neo4j. Cypher-shell export is online but less complete.
3. **Collation mismatch**: After OS updates, run `ALTER DATABASE template1 REFRESH COLLATION VERSION;` before restoring.

---

## 7. Retention Policy

### Episodic Retention (PostgreSQL)

- **Default TTL:** 90 days (configurable via `RETENTION_TTL_DAYS`)
- **Soft-delete:** Rows past TTL get `deleted_at` set (NOT hard-deleted)
- **Recovery window:** 30 days after soft-delete
- **Scope:** Only `memory_type='episodic'` rows. Semantic/procedural rows are NEVER touched.

### Running Retention

```bash
# Dry run (preview only)
bun scripts/retention-worker.ts --dry-run allura-system

# Live run
bun scripts/retention-worker.ts allura-system

# Custom TTL
RETENTION_TTL_DAYS=30 bun scripts/retention-worker.ts allura-system
```

### Semantic/Canonical Retention (Neo4j)

- **NO automatic TTL** — canonical memories require explicit `memory_delete`
- `memory_update` creates SUPERSEDES chain; old versions retained for audit
- Only `memory_delete` (with human approval) removes canonical nodes

---

## 8. Common Failure Modes & Remediation

### Failure Mode Reference Table

| # | Failure Mode | Symptoms | Root Cause | Remediation | Time to Fix |
|---|---|---|---|---|---|
| F1 | Neo4j unavailable | Health check returns `degraded`; search returns episodic-only results; graph tab empty | Neo4j container stopped, OOM killed, or Bolt port unreachable | 1. `docker compose restart neo4j` 2. Check logs: `docker compose logs neo4j` 3. If OOM: increase `NEO4J_dbms_memory_heap_max__size` in .env | ~2 min |
| F2 | PostgreSQL unavailable | Health check returns `unhealthy` (503); all operations fail; dashboard blank | PG container stopped, disk full, or connection pool exhausted | 1. `docker compose restart postgres` 2. Check disk: `df -h` 3. Check connections: `docker compose exec postgres psql -c "SELECT count(*) FROM pg_stat_activity;"` 4. If pool exhausted: restart app | ~2 min |
| F3 | Budget enforcer halt | Agent writes return 429 or budget error; sessions show halted | Session exceeded token/tool call/step/cost limits | 1. Check halted sessions via logs 2. `POST /api/admin/reset-budget` 3. If recurring: increase budget limits in config | ~1 min |
| F4 | Embedding provider down | New memories stored but search quality drops; no semantic results | Ollama process not running or model not pulled | 1. `ollama serve` 2. `ollama pull qwen3-embedding:8b` 3. Re-embed if gap exists: see [§5](#5-re-embedding-procedure) | ~5 min |
| F5 | Neo4j promotion failure | Memories stored in PG but not promoted; `promotion_failed` events in audit log | Network timeout to Neo4j, concurrent write conflict, or schema mismatch | 1. Check Neo4j health 2. Retry promotion: `POST /api/curator/approve` for pending proposals 3. If schema drift: check health endpoint for version mismatch | ~3 min |
| F6 | Curator re-scoring duplicates | Multiple proposals for the same trace; proposal queue growing | Events not marked as `promoted` after proposal creation (AD-20 violation) | 1. Check `events` table for `status='promoted'` 2. Manually update: `UPDATE events SET status='promoted' WHERE id IN (...)` 3. Deduplicate proposals | ~10 min |
| F7 | Disk full | Services crash; writes fail; pg_dump fails | Unbounded `events` table growth or log accumulation | 1. Run retention worker: `bun scripts/retention-worker.ts allura-system` 2. Clean Docker logs: `truncate -s 0 $(docker inspect --format='{{.LogPath}}' allura-postgres)` 3. Add `TRACE_RETENTION_DAYS` to .env | ~5 min |
| F8 | Cross-tenant query attempt | Security alert in logs; middleware blocks request | Agent or client providing wrong `group_id` | 1. Verify `group_id` format matches `^allura-` 2. Check client configuration 3. No data fix needed — CHECK constraint prevents | ~1 min |
| F9 | Circuit breaker trip | Repeated operation failures; cascading service degradation | Downstream service (PG or Neo4j) returning errors repeatedly | 1. Check health endpoint 2. Identify failing service 3. Restart failing service 4. Circuit breaker auto-resets after `CIRCUIT_BREAKER_RESET_TIMEOUT` (default: 30s) | ~1 min |
| F10 | Dashboard shows stale data | Dashboard data doesn't match Brain query results | Browser cache or API response caching | 1. Hard refresh (Ctrl+Shift+R) 2. Clear browser cache 3. Check API directly: `GET /api/health/metrics` | ~1 min |
| F11 | Soft-delete recovery expired | `memory_restore` returns error; memory not found | More than 30 days since soft-delete | **Cannot recover.** The memory is permanently gone. Check backup if critical. | N/A |
| F12 | Docker compose up fails | Containers exit immediately; port conflicts | Port already in use (5432, 7474, 7687, 3000, 3100) | 1. Find process: `lsof -i :5432` 2. Stop conflicting service or change port in docker-compose.yml 3. `docker compose up -d` | ~3 min |

---

## 9. Emergency Procedures

### Total System Recovery (from Backup)

1. Stop all services: `docker compose down`
2. Remove corrupted data: `docker compose down -v` (⚠️ DESTRUCTIVE — only after confirming backup exists)
3. Start fresh: `docker compose up -d`
4. Wait for PostgreSQL to initialize (~10s)
5. Run restore: `bash scripts/restore.sh /path/to/latest-backup`
6. Verify: `curl -s http://localhost:3100/api/health?detailed=true | jq .`
7. Verify data counts: see [§6](#6-backup--recovery)

### Neo4j Full Rebuild (from Seed Script)

If Neo4j data is corrupted but PostgreSQL is intact:

1. Stop Neo4j: `docker compose stop neo4j`
2. Remove Neo4j data: `docker volume rm docker_neo4j-data` (or equivalent volume name)
3. Start Neo4j: `docker compose start neo4j`
4. Run seed script: `docker compose exec neo4j cypher-shell -u neo4j -p "$NEO4J_PASSWORD" < scripts/neo4j-seed-agents.cypher`
5. Verify nodes: `docker compose exec neo4j cypher-shell -u neo4j -p "$NEO4J_PASSWORD" "MATCH (n) RETURN labels(n), count(*)"`
6. Re-promote approved proposals via curator approve flow

### PostgreSQL Data Corruption

1. Stop app and gateway: `docker compose stop app mcp-gateway`
2. Keep PG running: `docker compose exec postgres psql -c "SELECT pg_is_in_recovery();"` (should return `f`)
3. If corruption detected: restore from backup (see [§6](#6-backup--recovery))
4. Restart services: `docker compose start app mcp-gateway`
5. Verify: run health check and data integrity query

---

## 10. Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_PASSWORD` | (required) | PostgreSQL superuser password |
| `POSTGRES_HOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_DB` | `memory` | PostgreSQL database name |
| `POSTGRES_USER` | `ronin4life` | PostgreSQL user |
| `NEO4J_PASSWORD` | (required) | Neo4j password |
| `PROMOTION_MODE` | `soc2` | `soc2` (human-gated) or `auto` (threshold-based) |
| `AUTO_APPROVAL_THRESHOLD` | `0.85` | Score threshold for auto-promotion |
| `BUDGET_ENABLED` | `true` | Enable/disable budget enforcement |
| `BUDGET_MAX_RPM` | `60` | Maximum requests per minute |
| `BUDGET_MAX_TOKENS_PER_HOUR` | `100000` | Maximum LLM tokens per hour |
| `HALT_TTL_MS` | `3600000` | Budget halt auto-expiry (1 hour) |
| `CIRCUIT_BREAKER_FAILURE_THRESHOLD` | `5` | Failures before circuit trips |
| `CIRCUIT_BREAKER_RESET_TIMEOUT` | `30000` | Circuit breaker recovery (30s) |
| `RETENTION_TTL_DAYS` | `90` | Episodic memory retention period |
| `EMBEDDING_MODEL` | `qwen3-embedding:8b` | Ollama embedding model |
| `RUVECTOR_EMBEDDING_MODEL` | `qwen3-embedding:8b` | RuVector embedding model |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint |
| `TRACE_RETENTION_DAYS` | (none) | Override for trace retention |
| `CURATOR_ENGINE_URL` | (none) | External curator engine URL (Vercel deploy) |

### Key File Locations

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Service definitions and volumes |
| `docker/.env` | Environment variables for Docker stack |
| `scripts/backup.sh` | Full backup (PG + Neo4j + config) |
| `scripts/restore.sh` | Restore from backup |
| `scripts/retention-worker.ts` | Episodic memory TTL enforcement |
| `scripts/re-embed-to-1024d.ts` | Re-embed memories to 1024 dimensions |
| `scripts/backfill-embeddings-4096.ts` | Re-embed memories to 4096 dimensions |
| `scripts/neo4j-seed-agents.cypher` | Idempotent seed script for Agent/Team/Project nodes |
| `postgres-init/` | PostgreSQL schema SQL (first-run) |
| `docker/neo4j-init/00-schema.cypher` | Neo4j schema (first-run) |
| `src/mcp/canonical-http-gateway.ts` | MCP HTTP gateway (port 3100) |
| `src/lib/budget/enforcer.ts` | Budget enforcement logic |
| `src/lib/retrieval/contract.ts` | Retrieval gateway typed contract |
| `src/lib/graph-adapter/sync-contract-mappings.ts` | Sync contract mapping tables |

### Port Reference

| Port | Service | Protocol |
|------|---------|----------|
| 5432 | PostgreSQL | TCP (psql) |
| 7474 | Neo4j HTTP | HTTP |
| 7687 | Neo4j Bolt | Bolt (cypher-shell) |
| 3000 | Next.js App | HTTP |
| 3100 | MCP HTTP Gateway | HTTP |

---

*This runbook was compiled 2026-05-01. Update when services, procedures, or configuration change.*