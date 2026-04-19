<!-- Context: development/infrastructure | Priority: critical | Version: 2.0 | Updated: 2026-04-19 -->

# Infrastructure Navigation

**Purpose**: DevOps and deployment patterns for Allura Memory

**Status**: ✅ Active - Docker, CI/CD, monitoring

---

## Docker Architecture

| Service | Container | Ports | Purpose |
|---------|-----------|-------|---------|
| **PostgreSQL** | knowledge-postgres | 5432 | Episodic memory |
| **Neo4j** | knowledge-neo4j | 7474, 7687 | Knowledge graph |
| **RuVector** | ruvector-pg | 5433 | Vector embeddings |
| **App** | paperclip | 3100 | Next.js application |
| **MCP Gateway** | openclaw | 3200 | MCP HTTP gateway |

---

## Quick Commands

```bash
# Start all services
bun run docker:up

# Database health (use MCP_DOCKER, never docker exec)
mcp__MCP_DOCKER__execute_sql --sql_query "SELECT version()"

# Neo4j health
mcp__MCP_DOCKER__read_neo4j_cypher --query "RETURN 1 AS test"
```

---

## Deployment Patterns

- **Development**: `docker-compose.yml` (local)
- **Production**: `docker/docker-compose.enterprise.yml`
- **Environment**: `.env.local` for secrets (never commit)

---

## CI/CD

| Check | Command | Location |
|-------|---------|----------|
| **Type check** | `bun run typecheck` | `tsconfig.json` |
| **Lint** | `bun run lint` | `eslint.config.mjs` |
| **Tests** | `bun test` | `vitest.config.ts` |
| **E2E** | `bun run test:e2e` | Requires postgres + neo4j |

---

## Structure

```
infrastructure/
├── navigation.md              # This file
├── docker/                    # Dockerfile patterns
└── ci-cd/                     # GitHub Actions, pipelines
```

---

## Related Context

- **Core Standards** → `../../core/standards/code-quality.md`
- **Testing** → `../../core/standards/test-coverage.md`
- **Integration** → `../integration/navigation.md`
