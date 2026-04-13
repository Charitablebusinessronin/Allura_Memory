# Memory API — Canonical 5-Operation Interface

**Source**: AD-001 (Approved), Requirements Matrix B1/F1-F5

## What

Allura's memory surface is a canonical 5-operation API matching mem0 UX:

1. **`memory_add(content, userId, metadata?)`** — Add a memory. Episodic write to Postgres events table. Conditionally promote to Neo4j knowledge graph via Curator queue.
2. **`memory_search(query, userId, limit?)`** — Federated search across Postgres (raw traces) + Neo4j (curated knowledge). Phase 3 adds vector search.
3. **`memory_get(memoryId)`** — Fetch a single memory by ID.
4. **`memory_list(userId)`** — List all memories for a user.
5. **`memory_delete(memoryId)`** — Soft-delete with versioning. INSERT event into Postgres (append-only), set `deprecated=true` in Neo4j via SUPERSEDES.

## Acceptance Criteria

- TypeScript interfaces defined in `src/lib/memory/canonical-contracts.ts`
- All 5 operations exposed via MCP tools in `src/mcp/canonical-tools.ts`
- REST endpoints at `/api/memory` and `/api/memory/[id]`
- `group_id` CHECK constraint enforced at DB level (Postgres)
- Append-only invariant on `events` table (INSERT only, no UPDATE/DELETE)
- Promotion path: score → Curator queue → human approval (SOC2 mode) → Neo4j MERGE
- `bun run typecheck` passes with zero errors
- `bun test` passes for critical paths

## Key Files

- `src/lib/memory/canonical-contracts.ts` — TypeScript interfaces
- `src/mcp/canonical-tools.ts` — MCP tool implementations
- `src/mcp/memory-server-canonical.ts` — Canonical MCP server
- `src/app/api/memory/route.ts` — REST endpoints
- `src/app/api/memory/[id]/route.ts` — Individual memory operations

## Constraints

- bun only — never npm, npx, or node directly
- MCP_DOCKER tools for all DB operations — never docker exec
- group_id format: `^allura-[a-z0-9-]+$`
- witness_hash field defined for audit trail (SHAKE-256)