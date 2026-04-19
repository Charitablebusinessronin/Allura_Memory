<!-- Context: development/integration | Priority: critical | Version: 2.0 | Updated: 2026-04-19 -->

# Integration Navigation

**Purpose**: Connecting systems and services in Allura Memory

**Status**: ✅ Active - MCP servers, external APIs, package management

---

## Package Management

**Bun only** - Zero-trust supply chain policy
- ❌ npm/npx are banned
- ✅ `bun install` for dependencies
- ✅ `bun run <script>` for commands

---

## MCP Integration

**Pattern**: On-demand MCP server discovery and activation

| Server | Purpose | Trigger |
|--------|---------|---------|
| **neo4j-memory** | Default safe graph memory surface | On-demand |
| **neo4j-cypher** | Restricted raw graph maintenance | Privileged on-demand |
| **tavily** | Web search/research | On-demand |
| **exa** | Neural search | On-demand |
| **hyperbrowser** | Browser automation | On-demand |
| **context7** | Live library docs | On-demand |
| **notion** | Documentation sync | On-demand |

**Workflow**:
1. `mcp-find("keyword")` - Discover servers
2. `mcp-config-set` - Configure credentials
3. `mcp-add` - Activate server
4. `mcp-exec` - Execute tools

---

## External APIs

| Service | Integration | Location |
|---------|-------------|----------|
| **Clerk** | Auth/RBAC | `src/lib/auth/`, `src/middleware.ts` |
| **Ollama** | LLM/Embeddings | `src/lib/ollama/` |
| **PostgreSQL** | Primary database | `src/lib/postgres/` |
| **Neo4j** | Knowledge graph | `src/integrations/neo4j.client.ts` |

---

## API Integration Patterns

- **Error handling**: Structured errors with context
- **Retry strategies**: Exponential backoff, circuit breakers
- **Rate limiting**: Token bucket per service
- **Authentication**: Environment-based credentials

---

## Structure

```
integration/
├── navigation.md              # This file
├── package-management/          # Bun patterns
├── api-integration/             # REST clients, retries
└── third-party-services/        # Service-specific guides
```

---

## Related Context

- **Backend** → `../backend/navigation.md`
- **Data Layer** → `../data/navigation.md`
- **API Design** → `../principles/api-design.md`
