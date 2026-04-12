# Session Handoff — Allura Integration Planning Complete

**Date:** 2026-04-08
**Status:** Planning phase complete. Ready for Phase 1 implementation (MCP server).

---

## What's Been Decided

### The Three Use Cases (One Codebase)
1. **Personal AI OS** — Paperclip (local) + OpenClaw + Allura memory
2. **HACCP Vertical** — Paperclip (cloud) + domain agent + Allura + curator agent
3. **Enterprise Allura** — REST API only (customers bring their own orchestration)

**Decision:** Build Personal OS first to validate the pattern. Defer curator agent, RAG, public API until HACCP/enterprise explicitly ask.

### Integration Architecture
**One MCP Server. Four One-Click Plugins.**

```
Allura MCP Server (src/mcp/allura-server.ts)
├─ Transport: stdio (local) + HTTP (remote)
├─ Tools: memory_retrieve, memory_write, memory_propose_insight
└─ Auth: JWT + optional OAuth 2.1

├─ OpenCode Plugin (@allura/opencode-plugin)
│  └─ npm install — auto-registers on load
│
├─ Claude Code Plugin
│  └─ claude plugin install github:ronin704/allura
│
├─ OpenClaw Plugin
│  └─ openclaw plugins install github:ronin704/allura
│
└─ OpenWork Plugin
   └─ config: { "plugins": { "allura": { "enabled": true } } }
```

**Rationale:** One truth (MCP server), four thin entry points. Bug fix applies to all tools.

---

## What's Been Created

### Documentation
- ✓ `docs/allura/PERSONAL-OS.md` — Full Personal OS architecture (Paperclip + OpenClaw + Allura)
- ✓ `docs/allura/CLAUDE-CODE-INTEGRATION.md` — MCP server + memory dashboard for Claude Code
- ✓ `docs/allura/INTEGRATION-PLAN.md` — 5-phase implementation roadmap with all plugin code
- ✓ `docs/allura/COMPETITIVE-ANALYSIS.md` — mem0 vs Allura (97.8% junk rate data)
- ✓ `docs/allura/SOLUTION-ARCHITECTURE.md` — (existing)
- ✓ `docs/allura/BLUEPRINT.md` — (existing)

### Plugins Created (Skeleton)
- ✓ `opencode-integration/package.json` — npm package manifest
- ✓ `opencode-integration/index.mjs` — Plugin auto-registers MCP server on load
- ✓ `opencode-integration/README.md` — One-click install guide

### Memory Logged
- Event: integration_architecture_decision (MCP + thin wrappers)
- Event: opencode_plugin_created (@allura/opencode-plugin)
- Insight: One server, four entry points (high confidence 0.96)
- Memory files: project_architecture_consensus_2026_04_08.md, project_integration_architecture_2026_04_08.md

---

## Immediate Next Steps (Phase 1)

### Build the MCP Server Core
```typescript
// src/mcp/allura-server.ts (~400 lines)

// Imports
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import postgres from './integrations/postgres.client.ts';
import neo4j from './integrations/neo4j.client.ts';

// Initialize server
const server = new Server({
  name: "Allura Memory",
  version: "1.0.0"
});

// Expose tools (ListToolsRequestSchema handler)
// - memory_retrieve(query, limit?)
// - memory_write(event, metadata?)
// - memory_propose_insight(title, statement, confidence?)

// Handle tool calls (CallToolRequestSchema handler)
// - Each tool queries Postgres + Neo4j, returns structured response

// Start with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Then: HTTP Wrapper
```typescript
// src/api/http-wrapper.ts (~100 lines)
// Wrap MCP server with Express
// POST /mcp → calls server tools
// GET /health → readiness check
// POST /auth/verify → JWT validation
```

### Testing
```bash
# Terminal 1
bun run api  # Start HTTP wrapper

# Terminal 2
curl http://localhost:3100/api/retrieve -d '{"query":"test"}'

# Terminal 3 (Claude Code)
claude mcp add --transport http http://localhost:3100/mcp
```

---

## Key Invariants (Don't Break These)

### Core Allura
1. **PostgreSQL is append-only** — never UPDATE/DELETE on events table
2. **Neo4j uses SUPERSEDES** — create new node version, link with SUPERSEDES, mark old deprecated
3. **group_id is mandatory** — schema-level CHECK constraint on every read/write
4. **Soft-deletes only** — append an event, never physically delete

### Integration
1. **One MCP server is the truth** — all tools query the same code path
2. **Plugins are stateless dispatchers** — they don't store state, don't cache
3. **Auth is centralized** — JWT validated once at server, not in plugins
4. **Transport is abstracted** — stdio for local, HTTP for remote; plugins don't care

---

## Files to Read First (Current Session)

```bash
# Current state
cat /home/ronin704/.claude/projects/-home-ronin704-Projects-allura-memory/memory/MEMORY.md

# Architecture decisions
cat docs/allura/INTEGRATION-PLAN.md
cat docs/allura/PERSONAL-OS.md

# What's built (review first)
cat .github/ARCHITECTURE.md
cat .github/API-REFERENCE.md
cat README.md
```

---

## What NOT to Do Yet

- ❌ Don't build curator agent (defer to HACCP)
- ❌ Don't build RAG/embedding layer (defer to enterprise)
- ❌ Don't build public API (defer until Claude Code needs it)
- ❌ Don't build multi-human approval (single user v1)
- ❌ Don't build Notion sync (optional view, not core)
- ❌ Don't build Hasura/policy layer (defer to multi-tenant)

**Focus:** MCP server (Phase 1) → validate with Personal OS (1 week) → then expand.

---

## Success Metrics (Phase 1)

✓ MCP server handles memory_retrieve, memory_write, memory_propose_insight
✓ PostgreSQL logs all events (episodic layer)
✓ Neo4j stores approved insights (semantic layer)
✓ Claude Code can connect and use tools
✓ OpenCode plugin installs with `npm install @allura/opencode-plugin`
✓ All tests pass: `bun test`

---

## Git Status

**Current branch:** new-main

**Uncommitted changes:**
- docs/allura/PERSONAL-OS.md (new)
- docs/allura/CLAUDE-CODE-INTEGRATION.md (new)
- docs/allura/INTEGRATION-PLAN.md (new, updated)
- docs/allura/COMPETITIVE-ANALYSIS.md (updated)
- README.md (updated with competitive links)
- opencode-integration/package.json (new)
- opencode-integration/index.mjs (new)
- opencode-integration/README.md (new)

**Commit message when ready:**
```
docs: add integration plan for MCP server + four-tool plugins; add OpenCode plugin skeleton

- INTEGRATION-PLAN.md: 5-phase roadmap (MCP server → Claude Code → OpenCode → OpenClaw → OpenWork)
- PERSONAL-OS.md: Full architecture (Paperclip + OpenClaw + Allura)
- CLAUDE-CODE-INTEGRATION.md: MCP guide for Claude Code users
- opencode-integration/: NPM package skeleton for one-click install
- README: Link to competitive analysis (mem0 97.8% junk rate)

Architecture: One MCP server (truth), four thin plugins (entry points). No fragmentation.
```

---

## Environment Setup

**Prerequisites already in place:**
- Node.js / Bun
- PostgreSQL (local or docker)
- Neo4j (local or docker)
- Claude SDK installed
- git

**To start Phase 1:**
```bash
cd /home/ronin704/Projects/allura\ memory
bun install  # Already done, but ensure fresh

# Start services
docker compose up -d  # Postgres + Neo4j

# Code the server
# Edit: src/mcp/allura-server.ts
# Edit: src/api/http-wrapper.ts

# Test
bun test
bun run api
curl http://localhost:3100/api/retrieve
```

---

## Questions for Next Session

If context is tight, ask yourself:

1. **Do we have the MCP server working?** (Can Claude Code call memory_retrieve?)
2. **Are events logging to PostgreSQL?** (Can we see them with `psql`?)
3. **Do approved facts go to Neo4j?** (Can we query them?)
4. **Can OpenCode plugin install?** (`npm install @allura/opencode-plugin`)

If all four are yes → Phase 1 done. Move to Phase 2 (Claude Code plugin).

---

## References

- **Allura Memory (this repo):** `/home/ronin704/Projects/allura memory`
- **Memory system:** `/home/ronin704/.claude/projects/-home-ronin704-Projects-allura-memory/memory/`
- **CLAUDE.md:** Session rules (Bun only, /brain files, HITL promotion)
- **mem0 research:** /tmp/mem0-analysis.md (97.8% junk, 49% benchmark vs 63%+ alternatives)
- **Reference: openclaw-mcp.cloud** — Same pattern (MCP server + thin wrappers)
- **Reference: Composio** — Similar approach (central service + per-tool dispatchers)

---

## Author Notes

This session established:
1. **One product, three shapes** — Allura core, Personal OS wrapper, HACCP vertical, Enterprise REST
2. **Integration via MCP** — All tools connect to one server, no fragmentation
3. **One-click installs** — Plugins auto-register; users don't edit config files
4. **Curator gate** — HITL approval before Neo4j promotion (high-confidence facts only)

The team (Jobs, Brooks, Sarah) aligned on building Personal OS first to validate the pattern before selling enterprise.

Next person: Build the server. Make it real.
