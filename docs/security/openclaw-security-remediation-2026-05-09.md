# Security Remediation Report: OpenClaw Config (ronin704)
**Date:** 2026-05-09
**Status:** CONFIG-SECRETS CLEARED (P0) | CLAENUP REQUIRED (P1/P2)

---

## P0 — IMMEDIATE FIXES (Completed)

### 1. Hardcoded Secrets Removed from `openclaw.json`
| Location | Before | After |
|---|---|---|
| `gateway.auth.token` | `d8dd283539850eaf958b4d40182079f31c7ae494df4514b6` | `${OPENCLAW_GATEWAY_TOKEN}` |
| `allura-brain` NEO4J_PASS | `Kamina2026*` | `${NEO4J_PASSWORD}` |
| `allura-brain` PG_PASS | `KaminaDabs*` | `${POSTGRES_PASSWORD}` |
| `allura-brain` RUVECTOR_PASS | `KaminaDabs*` | `${POSTGRES_PASSWORD}` |
| `allura-brain` POSTGRES_URL | `postgres://ronin4life:KaminaDabs*@...` | `postgres://ronin4life:${POSTGRES_PASSWORD}@...` |
| `skill-cypher-query` NEO4J_PASS | `Kamina2026*` | `${NEO4J_PASSWORD}` |
| `skill-cypher-query` PG_PASS | `KaminaDabs*` | `${POSTGRES_PASSWORD}` |
| `skill-database` NEO4J_PASS | `Kamina2026*` | `${NEO4J_PASSWORD}` |
| `skill-database` PG_PASS | `KaminaDabs*` | `${POSTGRES_PASSWORD}` |
| `skill-neo4j-memory` NEO4J_PASS | `Kamina2026*` | `${NEO4J_PASSWORD}` |
| `skills.entries.notion` apiKey | `ntn_A79481010434EZNIEmTSfvnWEUrGLsnj1gUpos0CjTTf7T` | `${NOTION_API_KEY}` |

### 2. Security Flags Hardened
- `gateway.controlUi.allowInsecureAuth`: `true` → `false`
- `channels.discord.dmPolicy`: missing → `"pairing"`
- `channels.discord.groupPolicy`: missing → `"allowlist"`

### 3. Files Created
- `/home/ronin704/.openclaw/.env` — Active secrets (gitignored)
- `/home/ronin704/.openclaw/.env.example` — Template with placeholders
- `/home/ronin704/.openclaw/.gitignore` — Excludes .env, sessions, runs, etc.

---

## P1 — REMAINING HARDENING (Action Required)

### Secrets Still Embedded in Workspace
The following files in `~/.openclaw/workspace/` contain hardcoded credentials or fallback defaults:

1. `workspace/hooks/allura-gateway-startup/handler.ts`
   - Lines 17, 62: `const neo4jPass = process.env.NEO4J_PASSWORD || "Kamina2026*";`
   - Lines 62: `const pgPass = process.env.POSTGRES_PASSWORD || "KaminaDabs*";`
   - **Risk:** Fallback defaults if env vars missing. Remove defaults.

2. `workspace/scripts/neo4j-index-healthcheck.sh`
   - Line 8: `NEO4J_PASSWORD="${NEO4J_PASSWORD:-Kamina2026*}"`
   - **Risk:** Default fallback. Change to fail-fast without env var.

3. `workspace/scripts/test-neo4j-backup-restore.ts`
   - Line 19: `const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "Kamina2026*";`

4. `workspace/scripts/re-embed-to-1024d.mjs`
   - Line 15: `const PG_CONN = process.env.DATABASE_URL || 'postgresql://ronin4life:KaminaDabs*@...'`

5. `workspace/scripts/backfill-embeddings-4096.ts`
   - Line 10: `const PG_URL = ... process.env.POSTGRES_PASSWORD || 'KaminaDabs*' ...`

6. `workspace/.opencode/skills/allura-memory-skill/references/allura-troubleshooting.md`
   - Line 57: `cypher-shell -u neo4j -p 'Kamina2026*'`

7. `workspace/.opencode/skills/allura-memory-skill/scripts/smoke-test-memory.sh`
   - Line 16: `cypher-shell -u neo4j -p 'Kamina2026*'`

### Historical Secret Exposure (Git History)
The following backup/clobbered files in Git history contain exposed secrets:
- `openclaw.json.clobbered.2026-04-19T21-07-31-104Z`
- `openclaw.json.clobbered.2026-04-19T21-54-39-699Z`
- `openclaw.json.clobbered.2026-04-19T22-04-41-199Z`
- `openclaw.json.clobbered.2026-04-19T22-04-41-876Z`

**Recommendation:** These should be purged from Git history via `git-filter-repo` or BFG. The repo may be public or shared.

### Notion API Key Rotation
The Notion integration token `ntn_A79481010434EZNIEmTSfvnWEUrGLsnj1gUpos0CjTTf7T` was exposed in:
- Git history (clobbered JSON files)
- Your current terminal output (this conversation)

**Recommendation:** Revoke this token at https://www.notion.so/my-integrations and regenerate.

---

## P2 — ENHANCEMENTS

### Secrets Manager Integration
Consider migrating from `.env` to a proper secrets manager:
- Option A: **1Password CLI** (`op read`) — Skills available, but currently `enabled: false`
- Option B: **Bitwarden** 
- Option C: ** systemd EnvironmentFile** for the OpenClaw service

### Double Memory System Conflict
Both `memory-core` (OpenClaw native) and `allura-brain` (MCP server) are running:
- `plugins.memory-core.enabled: true` (with `dreaming: true`)
- MCP server `allura-brain` pointing to PG+Neo4j

These will store duplicate memories. Recommend disabling `memory-core` or configuring it to delegate to Allura.

### Channel Security Audit
- WhatsApp: `dmPolicy: allowlist` with one number — good
- Discord: now `dmPolicy: pairing` — good, but verify `allowFrom` list not needed

---

## Recommended Next Actions

1. **[P0]** Rotate Notion API key immediately
2. **[P1]** Run `openclaw security audit --deep` and review all findings
3. **[P1]** Remove fallback defaults from workspace scripts (fail-fast instead)
4. **[P1]** Purge Git history of clobbered files (or delete the repo and re-clone)
5. **[P2]** Decide on memory unification (OpenClaw vs Allura)
6. **[P2]** Enable sandbox mode for subagents (currently defaults to `off`)

---

*Report generated by brooks-architect. Memory event logged to allura-system.*
