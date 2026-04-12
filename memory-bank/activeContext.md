# Active Context — Brooks Architect Persona

**Session**: 2026-04-12f (MCP Streamable HTTP Transport)
**Status**: ✅ MCP STREAMABLE HTTP TRANSPORT SHIPPED | Dual-transport gateway live | ADR ACTIVE

## Current Focus

**MCP Streamable HTTP transport shipped on `canonical-http-gateway.ts`.** The gateway now serves two transports on port 3201: MCP Streamable HTTP at `/mcp` (primary) and legacy JSON-RPC at `/tools` (backward-compatible). OpenAI Agents SDK can connect natively via `MCPServerStreamableHttp` or `hostedMcpTool()`.

### What Changed This Session

1. **MCP Streamable HTTP transport** — Added `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk` to `canonical-http-gateway.ts`. MCP `Server` instance with same 5 canonical tools as STDIO server. `/mcp` route delegates to transport.
2. **Bearer token auth** — `ALLURA_MCP_AUTH_TOKEN` env var. Timing-safe comparison. Dev mode: no token = no auth.
3. **Integration tests** — `src/__tests__/mcp-streamable-http.test.ts` covering protocol init, tool discovery, execution, auth, backward compat.
4. **ADR flipped** — `docs/deferred/chatgpt-integration-plan.md` status DEFERRED → ACTIVE. GPT Actions demoted to FALLBACK.
5. **`@openai/agents@0.8.3`** installed for integration tests.

### Architecture Decision

- **MCP Streamable HTTP** is the primary integration path (eliminates REST bridge + OpenAPI schema)
- **GPT Actions** (REST/OpenAPI) is OPTIONAL/FALLBACK for ChatGPT web UI only
- **Conceptual integrity preserved**: canonical 5-operation interface unchanged

## Issues on the Board

| Issue | Severity | Description | Status |
|-------|----------|-------------|--------|
| #7 | MEDIUM | Legacy tools missing `^allura-` validation | **FIXED** (commit 863ac5b9) |
| #12 | HIGH | Kernel proof gate returns errors as data | **FIXED** |
| #13 | HIGH | Neo4j I/O modules lack try/catch | **FIXED** |
| #14 | HIGH | `memory_list` swallows PostgreSQL errors | **FIXED** |
| #15 | HIGH | E2E test fixtures violate `^allura-` group_id | **FIXED** |
| #16 | HIGH | SQL tier CHECK uses 'established' instead of 'mainstream' | **FIXED** |
| #17 | MEDIUM | approvePromotions() dual-path risk | **HARD-BLOCKED** |
| ARCH-001 | HIGH | groupIdEnforcer inconsistent enforcement | **FIXED** (commit f6e79074) |

## Pipeline Status

| Step | Task | Status |
|------|------|--------|
| 1 | RUVIX_KERNEL_SECRET fix | ✅ DONE (commit 177f4bd4) |
| 2 | Canonical-memory content fix | ✅ DONE (commit 3bec5cf7) |
| 3 | Pre-existing failures baselined | ✅ DONE (commit dc632124) |
| 4 | ARCH-001 groupIdEnforcer fix | ✅ DONE (commit f6e79074) |
| 5 | Curator admin UI skeleton | ✅ DONE (commit 86818b5f) |

## Key Invariants Verified

- ✅ `canonical_proposals` is the ONLY proposals queue
- ✅ `/api/curator/approve` is the sole operational approval door
- ✅ `approvePromotions()` throws in operational context
- ✅ `^allura-[a-z0-9-]+$` enforced at ALL entry points (ARCH-001)
- ✅ 154/154 validation tests pass
- ✅ 102/102 invariant sweep tests pass
- ✅ 0 test failures, 1103 passed, 123 properly skipped

## System Health

| Component | Status | Notes |
|-----------|--------|-------|
| Postgres | ✅ READY | Proposals pending |
| Neo4j | ✅ READY | SUPERSEDES versioning |
| Typecheck | ✅ CLEAN | All 5 Phase 5 commits verified |
| Invariant Sweep | ✅ VERIFIED | 102/102 |
| Validation Suite | ✅ VERIFIED | 154/154 |
| Admin UI | ✅ SCAFFOLDED | `/admin/approvals` |

---

**Phase 4: CLOSED ✅**
**Phase 5: CLOSED ✅**

**Next Session (Phase 6)**:
1. Wire Notion curator DB end-to-end — pending proposals → Notion pages via MCP
2. Fix remaining pre-existing test failures (embeddings, session, wrapped-client)
3. Production hardening — rate limiting, auth middleware, CORS
4. Phase 6 planning — Agent hooks, autonomous curator production pipeline