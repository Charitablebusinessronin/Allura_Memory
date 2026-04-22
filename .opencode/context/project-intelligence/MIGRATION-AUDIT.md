# Migration Audit: docker-compose.yml Services to Skill Containers

**Date:** 2026-04-21  
**ADR:** ADR-001  
**Status:** Phase 1 Complete - Freeze Applied; Phase 2 Scaffold Moved to `.opencode/skills/`

---

## Current docker-compose.yml Services

| Service | Image/Build | Current Role | Target Skill | Migration Path |
|---------|-------------|--------------|--------------|----------------|
| `postgres` | `pgvector/pgvector:0.7.0-pg16` | Primary database | **None** (external) | Keep as-is - raw trace store |
| `neo4j` | `neo4j:5.26.0-community` | Knowledge graph | **skill-neo4j-memory** | Replace with skill container |
| `neo4j-init` | `neo4j:5.26.0-community` | Schema initialization | **None** (one-time) | Keep as-is, remove after migration |
| `web` | `Dockerfile` (root) | Next.js frontend | **None** (application) | Keep as-is |
| `dozzle` | `amir20/dozzle:latest` | Log aggregation | **None** (observability) | Keep as-is |
| `mcp` | `Dockerfile.mcp` | Custom MCP server | **skill-neo4j-memory** | Replace with skill container |
| `http-gateway` | `Dockerfile.mcp` | HTTP gateway | **skill-database** | Replace with skill container |

---

## Skill Container Mapping

### 1. skill-neo4j-memory
**Source Services:**
- `mcp` (Dockerfile.mcp) - Primary source for memory recall operations
- `neo4j` (neo4j:5.26.0-community) - Database backend

**Tools to Expose:**
- `recall_insight` - Recall approved Insights by ID or query
- `list_insights` - List approved Insights with filtering

**Environment Variables to Migrate:**
- `NEO4J_URI` → Skill container config
- `NEO4J_USER` → Skill container config
- `NEO4J_PASSWORD` → Skill container config
- `DEFAULT_GROUP_ID` → Skill container config

**Migration Steps:**
1. Use the skill container at `.opencode/skills/skill-neo4j-memory/`
2. Configure Neo4j connection via `MCP_DOCKER_mcp-config-set`
3. Replace `mcp` service in docker-compose.yml
4. Update healthcheck to use skill-specific endpoint
5. Test recall and list operations

---

### 2. skill-cypher-query
**Source Services:**
- `mcp` (Dockerfile.mcp) - Cypher execution logic
- `http-gateway` (Dockerfile.mcp) - Query routing

**Tools to Expose:**
- `execute_cypher` - Execute read-only Cypher queries
- `get_schema_info` - Get Neo4j schema information

**Environment Variables to Migrate:**
- `NEO4J_URI` → Skill container config
- `NEO4J_USER` → Skill container config
- `NEO4J_PASSWORD` → Skill container config

**Migration Steps:**
1. Use the skill container at `.opencode/skills/skill-cypher-query/`
2. Configure Neo4j connection via `MCP_DOCKER_mcp-config-set`
3. Add to docker-compose.yml as new service
4. Update any direct Cypher calls to use skill
5. Test query execution and result shaping

---

### 3. skill-database
**Source Services:**
- `http-gateway` (Dockerfile.mcp) - SQL execution logic
- `postgres` (pgvector/pgvector:0.7.0-pg16) - Database backend

**Tools to Expose:**
- `execute_sql` - Execute SQL queries (read-only)
- `insert_trace` - Insert trace rows (append-only)
- `query_traces` - Query trace events

**Environment Variables to Migrate:**
- `POSTGRES_HOST` → Skill container config
- `POSTGRES_PORT` → Skill container config
- `POSTGRES_DB` → Skill container config
- `POSTGRES_USER` → Skill container config
- `POSTGRES_PASSWORD` → Skill container config
- `RUVECTOR_HOST` → Skill container config
- `RUVECTOR_PORT` → Skill container config
- `RUVECTOR_USER` → Skill container config
- `RUVECTOR_PASSWORD` → Skill container config
- `RUVECTOR_DB` → Skill container config

**Migration Steps:**
1. Use the skill container at `.opencode/skills/skill-database/`
2. Configure PostgreSQL connection via `MCP_DOCKER_mcp-config-set`
3. Add to docker-compose.yml as new service
4. Update any direct SQL calls to use skill
5. Test trace insertion and query operations

---

## docker-compose.yml Migration Plan

### Phase 1: Freeze (COMPLETE)
- [x] Add `// FROZEN: no new capabilities` comment to `mcp-entrypoint.sh`
- [x] Add `// FROZEN: no new capabilities` comment to `Dockerfile.mcp`
- [x] Add `// FROZEN: no new capabilities` comment to `Dockerfile.mcp-server`

### Phase 2: Extract Skill Containers (IN PROGRESS)
- [x] Create `.opencode/skills/skill-neo4j-memory/` scaffold
- [x] Create `.opencode/skills/skill-cypher-query/` scaffold
- [x] Create `.opencode/skills/skill-database/` scaffold
- [ ] Implement actual skill logic (replace placeholder code)
- [ ] Add smoke tests for each skill
- [ ] Build and test each skill container locally

### Phase 3: Wire Team RAM Orchestration
- [ ] Create Team RAM orchestrator in `src/team-ram/orchestrator.ts`
- [ ] Implement skill selection logic
- [ ] Implement parallel dispatch with Team RAM parallel agents and subagents
- [ ] Implement context assembly from skill results
- [ ] Add retry logic with circuit breaker per skill

### Phase 4: Strip Allura MCP
- [ ] Remove routing logic from custom MCP
- [ ] Remove session management from custom MCP
- [ ] Remove direct DB calls from custom MCP
- [ ] Keep only policy validation, ADR writes, Insight promotion trigger
- [ ] Move stripped MCP to `archive/` directory

---

## Environment Variable Mapping

### Neo4j Skill
```yaml
# Before (mcp service)
environment:
  NEO4J_URI: bolt://neo4j:7687
  NEO4J_USER: ${NEO4J_USER}
  NEO4J_PASSWORD: ${NEO4J_PASSWORD}

# After (skill-neo4j-memory service)
environment:
  # No environment variables needed - configure with MCP_DOCKER_mcp-config-set
```

### Database Skill
```yaml
# Before (http-gateway service)
environment:
  POSTGRES_HOST: postgres
  POSTGRES_PORT: 5432
  POSTGRES_DB: ${POSTGRES_DB}
  POSTGRES_USER: ${POSTGRES_USER}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  RUVECTOR_HOST: postgres
  RUVECTOR_PORT: 5432
  RUVECTOR_USER: ${POSTGRES_USER}
  RUVECTOR_PASSWORD: ${POSTGRES_PASSWORD}
  RUVECTOR_DB: ${POSTGRES_DB}

# After (skill-database service)
environment:
  # No environment variables needed - configure with MCP_DOCKER_mcp-config-set
```

---

## Testing Strategy

### Smoke Test Matrix
| Test | Skill Targeted | Pass Condition |
|------|----------------|----------------|
| `smoke:memory-recall` | Neo4j Memory Skill | Returns ≥1 approved Insight |
| `smoke:cypher-exec` | Cypher Query Skill | Query executes, result shaped correctly |
| `smoke:db-write` | Database Skill | Trace row inserted, retrievable |
| `smoke:team-ram-parallel` | Team RAM | All required parallel agents and subagents complete, context assembled |
| `smoke:allura-policy` | Allura Core | ADR written, Insight queued for approval |

### Test Commands
```bash
# Test skill-neo4j-memory
cd .opencode/skills/skill-neo4j-memory
bun test

# Test skill-cypher-query
cd .opencode/skills/skill-cypher-query
bun test

# Test skill-database
cd .opencode/skills/skill-database
bun test

# Test full stack
docker compose up -d
docker compose logs -f
```

---

## Rollback Plan

If migration fails:
1. Revert `docker-compose.yml` to previous version
2. Keep custom MCP in place
3. Use `archive/` directory for stripped MCP if needed
4. Revert any code changes in Team RAM orchestrator

---

## Notes

- **No data loss expected** - Allura Brain (Postgres + Neo4j) remains the source of truth
- **No breaking changes** - Skills are additive, not replacements, during migration
- **Gradual migration** - Can run old and new systems in parallel during transition
- **Health checks** - Update to use skill-specific endpoints after migration
- **Canonical memory surface** - Use first-party `allura-brain_*` tools first; use `MCP_DOCKER` for governed configuration and lower-level access
- **Tenant isolation** - Every operation must carry explicit `group_id` matching `^allura-[a-z0-9-]+$`
