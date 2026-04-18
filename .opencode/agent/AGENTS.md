# Allura Memory — agent notes

- `AGENTS.md` at repo root is a symlink to `.opencode/AGENTS.md`; update this target, not the symlink.
- **Bun only.** Use `bun ...` everywhere. Repo guidance explicitly bans `npm`/`npx` even though `.opencode/package-lock.json` exists.
- Prefer executable truth over docs. Some docs still mention legacy `src/mcp/memory-server.ts`; the canonical server is `src/mcp/memory-server-canonical.ts` via `bun run mcp` / `bun run mcp:canonical`.

## Fast start

- Install: `bun install`
- App dev server: `bun run dev` (Next.js, `PAPERCLIP_PORT`, default `3100`)
- MCP stdio server: `bun run mcp`
- MCP HTTP gateway: `bun run mcp:http` (`ALLURA_MCP_HTTP_PORT`, fallback default `3201`)
- Preferred session bootstrap: `bun run session:start`

## Verification

- `bun run typecheck` — real TS check
- `bun run lint` — **alias for typecheck**, not ESLint
- `bun test` — unit tests via Vitest
- Single test file: `bun vitest run path/to/test.ts`
- Test by name: `bun vitest run -t "name"`
- Full repo check: `bun run test:all` (`typecheck -> lint/typecheck -> unit -> e2e -> MCP browser`)
- E2E needs PostgreSQL + Neo4j: `bun run test:e2e`
- DB integration smoke in CI: `bun test src/kernel/__tests__/mutate-events.test.ts` with `RUN_DB_INTEGRATION=true`
- Browser MCP snapshots: `bun run test:mcp:browser` (`--update` to refresh fixtures)

## Boundaries that matter

- Main product is a Next.js app in `src/app/**`; health aliases `/healthz`, `/api/healthz`, `/health`, `/ping` all rewrite to `/api/health/live`.
- Canonical MCP surface lives in `src/mcp/**`.
- Curator / HITL promotion flow lives in `src/curator/**`.
- Hybrid/vector retrieval lives in `src/lib/ruvector/**`.
- `packages/sdk` is its own publishable package; if you touch it, run commands there too (`bun test`, `bun run build`).

## Hard invariants

- **Never use `docker exec` for DB work.** Use `MCP_DOCKER` DB tools only. See `.claude/rules/mcp-integration.md`.
- Every DB read/write needs `group_id`, and valid tenant IDs are `allura-*`.
- PostgreSQL trace/event history is append-only: do not `UPDATE`/`DELETE` historical rows.
- Neo4j changes are versioned with `SUPERSEDES`; do not mutate old nodes in place.
- Promotion to semantic memory is HITL-gated; do not bypass curator flow.

## Runtime quirks

- Local/dev auth is on by default (`ALLURA_DEV_AUTH_ENABLED=true`), default role `admin`, default group `allura-roninmemory`.
- Vitest loads `.env` through `dotenv`, so local test behavior depends on your env file.
- RuVector uses PostgreSQL on port `5433` plus Ollama embeddings (`nomic-embed-text`, 768d).
- Real hybrid search is in `src/lib/ruvector/bridge.ts`; do **not** call `ruvector_hybrid_search()` or related extension learning helpers because repo docs mark them as stubs.

## Docs to trust

- Highest priority: Notion / Control Center, then `docs/allura/` canonical docs, then other `docs/`, then `docs/archive/`.
- Treat `docs/archive/**` planning handoffs as historical context only unless confirmed by code/config.
- If docs and scripts disagree, trust `package.json`, workflow files, and the source under `src/`.
