# OPERATIONS.md — Allura Memory System

## FR-4: Retention Policy

### Episodic Retention (PostgreSQL)
- **Default TTL**: 90 days (configurable via `RETENTION_TTL_DAYS` env var)
- **Enforcement**: Run `bun scripts/retention-worker.ts` daily
- **Soft-delete**: Rows past TTL get `deleted_at` set (NOT hard-deleted)
- **Recovery window**: 30 days after soft-delete, rows can be restored via `memory_restore`
- **Hard-delete**: After recovery window expires, rows are permanently removed
- **Scope**: Only `memory_type='episodic'` rows are affected. Semantic/procedural rows are NEVER touched.

### Semantic/Canonical Retention (Neo4j)
- **NO automatic TTL** — canonical memories require explicit `memory_delete`
- `memory_update` creates SUPERSEDES chain; old versions retained for audit
- Only `memory_delete` (with human approval) removes canonical nodes

### Running Retention
```bash
# Dry run (preview only)
bun scripts/retention-worker.ts --dry-run allura-system

# Live run
bun scripts/retention-worker.ts allura-system

# Custom TTL
RETENTION_TTL_DAYS=30 bun scripts/retention-worker.ts allura-system
```

## FR-5: Backup & Recovery

### Backup
```bash
# Full backup (PG + Neo4j + Config)
export NEO4J_PASSWORD='<password>'
bash scripts/backup.sh

# Backup to specific directory
bash scripts/backup.sh /path/to/output
```

### Restore
```bash
# Restore from backup directory
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
| **Total estimated** | **~2 min** |

**Target: < 10 minutes** ✓

### Data Integrity Verification
After restore, verify counts match:
```sql
SELECT 'allura_memories' AS t, COUNT(*) AS total,
       COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active FROM allura_memories
UNION ALL SELECT 'events', COUNT(*), NULL FROM events
UNION ALL SELECT 'canonical_proposals', COUNT(*), NULL FROM canonical_proposals;
```

### Known Issues
1. **TS backup system** (`scripts/backup.ts`): Has ENOBUFS on large PG dumps, openssl enc issues, Neo4j stop/start problems. Shell scripts (`backup.sh`/`restore.sh`) are the reliable path.
2. **Neo4j offline dump**: Requires stopping Neo4j. Cypher-shell export is online but less complete.
3. **Collation mismatch**: PostgreSQL container may have collation version drift after OS updates. Run `ALTER DATABASE template1 REFRESH COLLATION VERSION;` before creating restore databases.
4. **MCP-stored memories**: The `memory_add` MCP API stores to both PG and Neo4j. Backup captures PG rows via pg_dump; Neo4j nodes via cypher export.

### Backup Drill Results (2026-05-01)
- PostgreSQL: 527 allura_memories, 51551 events, 409 canonical_proposals — **MATCH**
- Neo4j: 117 Memory, 42 InsightHead, 37 Insight, 10 Agent nodes — **MATCH**
- Test memory (ID: 2411681a-55b2-40f1-8f73-a7472363358e) — **ACCESSIBLE**
- RTO: **~2 minutes** — WITHIN TARGET