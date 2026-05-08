# Embedding Contract Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove embedding and tenant contract drift so the Docker runtime, docs, verification path, and backfill tooling all match the current Allura Brain contract.

**Architecture:** Keep the existing RuVector/Ollama embedding path. This is a contract-hardening slice: update defaults and documentation, guard stale tooling, and verify the running containers without printing secrets.

**Tech Stack:** Docker Compose, Bun/TypeScript, Ollama `/v1/embeddings`, RuVector/PostgreSQL, Allura Brain memory tools.

---

## Files to Modify

- `docker-compose.yml` — set active service group defaults to `allura-system`.
- `.env.example` — document `RUVECTOR_EMBEDDING_BASE_URL` as the runtime embedding URL contract.
- `README.md` — align setup instructions with `RUVECTOR_EMBEDDING_BASE_URL` and 1024d `/v1/embeddings` behavior.
- `scripts/backfill-embeddings-4096.ts` — quarantine or update the stale 4096d `/api/embed` backfill path.
- `src/lib/memory/config.ts` — align runtime config and generated `.env.local` template with `allura-system` and `RUVECTOR_EMBEDDING_BASE_URL`, preserving `EMBEDDING_BASE_URL` as a compatibility alias.
- `src/lib/memory/writer.ts` — replace fallback `allura-roninmemory` with `allura-system` for relationship writes.

## Validation Commands

- `bun test src/lib/ruvector/embedding-service.test.ts`
- `bun test src/team-ram/mcp-skill-executor.test.ts src/team-ram/e2e-smoke.test.ts src/team-ram/orchestration-tracing.test.ts`
- `docker compose config >/tmp/allura-compose.config`
- `docker exec allura-memory-mcp getent hosts host.docker.internal`
- `docker exec allura-memory-mcp bun -e "fetch('http://host.docker.internal:11434/v1/embeddings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'qwen3-embedding:8b',input:'health check',dimensions:1024})}).then(async r=>{const j=await r.json().catch(()=>({}));const n=j.data?.[0]?.embedding?.length||0;console.log('embedding_status='+r.status+' dimensions='+n);process.exit(r.ok&&n===1024?0:1)}).catch(e=>{console.log('embedding_error='+e.name);process.exit(1)})"`

---

### Task 1: Tenant Defaults

**Files:**
- Modify: `docker-compose.yml`
- Modify: `src/lib/memory/writer.ts`

- [ ] Replace active compose defaults for `DEFAULT_GROUP_ID` and `ALLURA_DEV_AUTH_GROUP_ID` from `allura-roninmemory` to `allura-system`.
- [ ] Replace `process.env.DEFAULT_GROUP_ID ?? "allura-roninmemory"` with `process.env.DEFAULT_GROUP_ID ?? "allura-system"` in `src/lib/memory/writer.ts`.
- [ ] Run `docker compose config >/tmp/allura-compose.config` and expect exit 0.

### Task 2: Embedding Environment Contract Documentation

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

- [ ] Document `RUVECTOR_EMBEDDING_BASE_URL=http://localhost:11434` as the runtime embedding URL contract.
- [ ] Preserve `EMBEDDING_MODEL=qwen3-embedding:8b`.
- [ ] Explain Docker services use `http://host.docker.internal:11434` with `extra_hosts`.
- [ ] Search for active `EMBEDDING_BASE_URL` references and leave only backups or explicit legacy notes.

### Task 3: Backfill Script Safety

**Files:**
- Modify: `scripts/backfill-embeddings-4096.ts`

- [ ] Add an early guard requiring `ALLOW_LEGACY_4096_BACKFILL=true`.
- [ ] Prefer `RUVECTOR_EMBEDDING_BASE_URL` and fall back to `EMBEDDING_BASE_URL` only as a legacy alias.
- [ ] Update the header comment to say this script is legacy-only and current production uses 1024d `/v1/embeddings`.
- [ ] Run `bunx tsc --noEmit --pretty false` if available and verify no new errors from this script.

### Task 4: Runtime Verification

**Files:**
- No source edits.

- [ ] Run `docker exec allura-memory-mcp getent hosts host.docker.internal` and expect an IP address.
- [ ] Run the safe `/v1/embeddings` endpoint check and expect `embedding_status=200 dimensions=1024`.

### Task 5: Architecture Memory

**Files:**
- No source edits.

- [ ] Record outcome under `allura-system` as `brooks-architect` with validation evidence.
- [ ] Do not promote automatically; leave promotion to curator/HITL review.
