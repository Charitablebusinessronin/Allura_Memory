# ADR-001 Implementation Status

**Date:** 2026-04-21  
**ADR:** `docs/allura/ADR-001.md`  
**Status:** Phase 1 Complete, Phase 2 In Progress

---

## Completed Tasks

### Phase 1: Freeze Custom MCP ✅

- [x] Add `// FROZEN: no new capabilities` comment to `mcp-entrypoint.sh`
- [x] Add `// FROZEN: no new capabilities` comment to `Dockerfile.mcp`
- [x] Add `// FROZEN: no new capabilities` comment to `Dockerfile.mcp-server`

### Phase 2: Extract Skill Containers 🔄 (In Progress)

#### skill-neo4j-memory ✅
- [x] Create `.opencode/skills/skill-neo4j-memory/` scaffold
- [x] Create `package.json` with dependencies
- [x] Create `tsconfig.json` with compiler options
- [x] Create `Dockerfile` for containerization
- [x] Create `src/index.ts` with MCP server implementation
- [x] Create `build.ts` for build process
- [x] Create `__tests__/index.test.ts` for smoke tests
- [x] Create `README.md` with documentation

#### skill-cypher-query ✅
- [x] Create `.opencode/skills/skill-cypher-query/` scaffold
- [x] Create `package.json` with dependencies
- [x] Create `tsconfig.json` with compiler options
- [x] Create `Dockerfile` for containerization
- [x] Create `src/index.ts` with MCP server implementation
- [x] Create `build.ts` for build process
- [x] Create `README.md` with documentation

#### skill-database ✅
- [x] Create `.opencode/skills/skill-database/` scaffold
- [x] Create `package.json` with dependencies
- [x] Create `tsconfig.json` with compiler options
- [x] Create `Dockerfile` for containerization
- [x] Create `src/index.ts` with MCP server implementation
- [x] Create `build.ts` for build process
- [x] Create `README.md` with documentation

### Documentation ✅

- [x] Create `docs/allura/ADR-001.md` with full ADR
- [x] Create `docs/allura/MIGRATION-AUDIT.md` with detailed audit
- [x] Create `.github/ISSUE_TEMPLATE/adr-001-migration.md` for tracking

---

## Next Steps

### Phase 2: Extract Skill Containers (Continued)

- [ ] Implement actual skill logic (replace placeholder code)
- [ ] Add smoke tests for each skill
- [ ] Build and test each skill container locally
- [ ] Configure via `MCP_DOCKER_mcp-config-set`

### Phase 3: Wire Team RAM Orchestration

- [ ] Create Team RAM orchestrator in `src/team-ram/orchestrator.ts`
- [ ] Implement skill selection logic
- [ ] Implement parallel dispatch with subagents
- [ ] Implement context assembly from skill results
- [ ] Add retry logic with circuit breaker per skill

### Phase 4: Strip Allura MCP

- [ ] Remove routing logic from custom MCP
- [ ] Remove session management from custom MCP
- [ ] Remove direct DB calls from custom MCP
- [ ] Keep only policy validation, ADR writes, Insight promotion trigger
- [ ] Move stripped MCP to `archive/` directory

---

## Files Created/Modified

### Modified Files
- `mcp-entrypoint.sh` - Added freeze comment
- `Dockerfile.mcp` - Added freeze comment
- `Dockerfile.mcp-server` - Added freeze comment

### New Files Created

#### Documentation
- `docs/allura/ADR-001.md` - Full ADR with decision, context, and migration plan
- `docs/allura/MIGRATION-AUDIT.md` - Detailed audit of docker-compose.yml services
- `.github/ISSUE_TEMPLATE/adr-001-migration.md` - GitHub issue template for tracking

#### Skill Containers
- `.opencode/skills/skill-neo4j-memory/` - Neo4j memory skill container
  - `package.json`
  - `tsconfig.json`
  - `Dockerfile`
  - `src/index.ts`
  - `build.ts`
  - `__tests__/index.test.ts`
  - `README.md`

- `.opencode/skills/skill-cypher-query/` - Cypher query skill container
  - `package.json`
  - `tsconfig.json`
  - `Dockerfile`
  - `src/index.ts`
  - `build.ts`
  - `README.md`

- `.opencode/skills/skill-database/` - Database skill container
  - `package.json`
  - `tsconfig.json`
  - `Dockerfile`
  - `src/index.ts`
  - `build.ts`
  - `README.md`

---

## Architecture Summary

### Before (Current State)
```
┌─────────────────────────────────────┐
│    Custom Allura MCP Server         │
│  (Dockerfile.mcp, Dockerfile.mcp-  │
│   server, mcp-entrypoint.sh)        │
│                                     │
│  - Transport                        │
│  - Routing                          │
│  - Memory Recall                    │
│  - Session Management               │
│  - Graph Queries                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  PostgreSQL + Neo4j (Allura Brain) │
└─────────────────────────────────────┘
```

### After (Target State)
```
┌─────────────────────────────────────┐
│           Allura Core               │
│  (Policy engine · ADR log · Insight │
│   promotion)                        │
│  (thinks, governs — does NOT        │
│   execute)                          │
└──────────────┬──────────────────────┘
               │ task dispatch
               ▼
┌─────────────────────────────────────┐
│        Team RAM Orchestrator        │
│  (Parallel agents + subagents)      │
│  (Skill selection · context         │
│   assembly)                         │
└──────┬───────┬───────┬──────────────┘
       │       │       │
       ▼       ▼       ▼
┌────────┐ ┌───────┐ ┌────────┐
│Neo4j   │ │Cypher │ │Database│
│Memory  │ │Query  │ │Skill   │
│Skill   │ │Skill  │ │        │
└────────┘ └───────┘ └────────┘
```

---

## Next Actions

1. **Implement actual skill logic** - Replace placeholder code in `src/index.ts` files with real Neo4j/PostgreSQL operations
2. **Add smoke tests** - Create comprehensive tests for each skill
3. **Build and test locally** - Verify each skill container works independently
4. **Configure via MCP_DOCKER** - Set up skill configuration using `MCP_DOCKER_mcp-config-set`
5. **Create Team RAM orchestrator** - Implement parallel dispatch and context assembly
6. **Strip custom MCP** - Remove routing, session management, and direct DB calls from custom MCP

---

## Notes

- **No data loss expected** - Allura Brain (Postgres + Neo4j) remains the source of truth
- **No breaking changes** - Skills are additive, not replacements, during migration
- **Gradual migration** - Can run old and new systems in parallel during transition
- **Health checks** - Update to use skill-specific endpoints after migration
- **Read-only by policy** - Skills only read from databases; writes go through approval API only