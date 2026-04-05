# roninmemory Restore Runbook

## Purpose

Quarterly rehearsal for restoring both stores:
- PostgreSQL (raw traces)
- Neo4j (curated graph)

## Preconditions

- Backup artifacts available and checksummed
- Target environment isolated from production
- Credentials available via secure secret manager

## Restore Procedure

### 1) PostgreSQL Restore
1. Stop writers
2. Restore backup to target database
3. Run integrity checks (row counts, critical tables)

### 2) Neo4j Restore
1. Stop graph writers
2. Restore graph backup
3. Validate constraints/indexes
4. Run sample lineage query (`:SUPERSEDES` chain)

### 3) Cross-Store Consistency Check
1. Compare promoted run IDs in Postgres vs corresponding Neo4j nodes
2. Verify tenant-scoped sample queries for `group_id='roninmemory'`

## Validation Checklist

- [ ] Postgres connectivity healthy
- [ ] Neo4j connectivity healthy
- [ ] Critical query suite passes
- [ ] Session hydration still <30s p95 target in sample runs
- [ ] Recovery timestamp logged in operations notes

## Evidence to Record

- Backup IDs restored
- Start/end timestamps
- Operator name/team
- Verification query outputs
- Any deviations and mitigations
