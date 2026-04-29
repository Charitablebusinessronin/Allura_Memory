# BRIEF: Backup Automation (FR-3, FR-4, FR-7, FR-8, FR-9, NFR-1, NFR-2)

## Objective
Build an encrypted, automated backup system that captures the full operational surface: PostgreSQL data, Neo4j graph, configuration files, OpenClaw workspace memory, cron jobs, agent skills, and session history. Includes scheduled runs, restore with dry-run mode, preflight validation, backup listing, and selective restore.

## Current State
- Manual bash scripts exist: `scripts/backup-postgres.sh` (plaintext SQL, no encryption), `scripts/backup-neo4j.sh` (offline dump, no encryption)
- No backup scheduling
- No restore automation
- No config/workspace/skill backup
- No retention policy
- No audit events for backup/restore

## Architecture Decisions
1. **One backup worker** (`src/lib/backup/worker.ts`) that orchestrates all backup tasks
2. **Modular backup modules** — PG backup, Neo4j backup, Config backup, Workspace backup, Skill backup
3. **Encryption** via `gpg` or `openssl` symmetric AES-256 — key from env var `BACKUP_ENCRYPTION_KEY`
4. **Storage** — local `backups/` directory with date-stamped subdirs, gzipped + encrypted
5. **Scheduling** — cron job via `cron` tool (daily at 2 AM)
6. **Restore** — `scripts/restore.ts` with `--dry-run` flag and preflight validation
7. **Listing** — `scripts/list-backups.ts` with retention policy display
8. **Audit** — every backup/restore emits an `allura_events` row with schema_version=1

## Implementation Plan

### Step 1: Core Backup Types Module
Create `src/lib/backup/types.ts`:
- `BackupType = 'postgres' | 'neo4j' | 'config' | 'workspace' | 'skills' | 'full'`
- `BackupManifest` — timestamp, types, sizes, schema_version, checksums
- `RestoreOptions` — dryRun, targetDir, types, force
- `BackupResult` — success, path, size, duration, checksum

### Step 2: Individual Backup Modules
Create `src/lib/backup/` directory with:

#### `postgres.ts`
- Uses existing `scripts/backup-postgres.sh` logic but:
  - Creates consistent snapshot (no offline stop — `pg_dump` is already consistent)
  - Gzip compresses the output
  - Encrypts with AES-256 via openssl
  - Generates SHA-256 checksum
  - Stores in `backups/YYYYMMDD/postgres-*.sql.gz.enc`

#### `neo4j.ts`
- Uses existing `scripts/backup-neo4j.sh` logic but:
  - Uses `neo4j-admin database dump` (already handles consistency)
  - Gzip compresses
  - Encrypts with AES-256
  - Generates SHA-256 checksum
  - Stores in `backups/YYYYMMDD/neo4j-*.dump.gz.enc`

#### `config.ts`
- Backs up: `.env`, `.env.local`, `openclaw.json`, `docker-compose.yml`, `vitest.config.ts`, all config files
- Assembles into a tar.gz
- Encrypts
- Stores in `backups/YYYYMMDD/config-*.tar.gz.enc`

#### `workspace.ts`
- Backs up OpenClaw workspace memory: `~/.openclaw/workspace/memory/`, `MEMORY.md`, `SOUL.md`, `USER.md`, `AGENTS.md`, `TOOLS.md`, `HEARTBEAT.md`
- Assembles into tar.gz
- Encrypts
- Stores in `backups/YYYYMMDD/workspace-*.tar.gz.enc`

#### `skills.ts`
- Backs up ClawHub skills: `~/.openclaw/workspace/skills/` and `~/.agents/skills/`
- Assembles into tar.gz
- Encrypts
- Stores in `backups/YYYYMMDD/skills-*.tar.gz.enc`

### Step 3: Backup Worker
`src/lib/backup/worker.ts`:
- Orchestrates all backup modules based on `BackupType`
- Emits audit event to `allura_events` on start, success, failure
- Creates `BackupManifest.json` in backup directory
- Validates backup integrity after creation
- Handles secrets safely (never logs encryption key, redacts from output)

### Step 4: Restore Worker
`src/lib/backup/restore.ts`:
- `--dry-run` mode — lists what would be restored, validates manifests, checks disk space
- `--type` filter — selective restore (e.g., only postgres, only config)
- Preflight validation:
  - Verify manifest exists and is valid JSON
  - Verify all checksums match
  - Verify schema_version compatibility (must be >= MIN_SUPPORTED_VERSION)
  - Verify target containers are running
  - Verify disk space
- Actual restore: decrypt → verify checksum → apply
- Emits audit event

### Step 5: Backup Listing
`scripts/list-backups.ts`:
- Scans `backups/` directory
- Reads each `BackupManifest.json`
- Displays: date, types, sizes, schema_version, retention status
- Applies retention policy: keep last 7 daily, 4 weekly, 12 monthly
- Marks expired backups for deletion (but doesn't auto-delete — operator confirms)

### Step 6: Cron Scheduling
- `cron` tool: daily backup at 2:00 AM EST
- Payload: runs `scripts/backup.ts --type full`
- Delivery: announce to webchat on success/failure

### Step 7: Tests
`src/__tests__/backup-automation.test.ts`:
- Backup worker creates encrypted backups with valid manifests
- Restore dry-run validates without modifying state
- Restore actual restore works (with mocked file system and mocked docker)
- Backup listing returns correct inventory
- Retention policy correctly identifies expired backups
- Audit events emitted for all operations
- Secrets are redacted in logs

## Files to Create
- `src/lib/backup/types.ts`
- `src/lib/backup/postgres.ts`
- `src/lib/backup/neo4j.ts`
- `src/lib/backup/config.ts`
- `src/lib/backup/workspace.ts`
- `src/lib/backup/skills.ts`
- `src/lib/backup/worker.ts`
- `src/lib/backup/restore.ts`
- `scripts/backup.ts` (CLI entry point)
- `scripts/restore.ts` (CLI entry point)
- `scripts/list-backups.ts` (CLI entry point)
- `src/__tests__/backup-automation.test.ts`

## Files to Modify
- `vitest.config.ts` — add new test file
- `scripts/backup-postgres.sh` — deprecated, add deprecation warning
- `scripts/backup-neo4j.sh` — deprecated, add deprecation warning

## Verification Steps
1. `npx tsc --noEmit` — zero type errors
2. `npx vitest run src/__tests__/backup-automation.test.ts` — all tests pass
3. `bun run scripts/backup.ts --type postgres` — creates encrypted backup with manifest
4. `bun run scripts/restore.ts --dry-run --date 20260429` — validates without modifying state
5. `bun run scripts/list-backups.ts` — shows backup inventory with retention status
6. Verify backup file exists: `ls backups/YYYYMMDD/` — contains manifest + encrypted files
7. Verify audit event: `SELECT COUNT(*) FROM allura_events WHERE event_type LIKE 'backup.%'` — > 0
8. `pnpm test` — all existing tests pass (no regressions)

## Definition of Done
- Full backup creates encrypted snapshot of all operational data
- Restore dry-run validates without modifying state
- Backup listing with retention policy
- Scheduled cron job runs daily
- All operations emit audit events
- Zero TypeScript errors, all tests pass
- No regressions in existing test suite