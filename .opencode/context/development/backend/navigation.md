<!-- Context: development/backend | Priority: critical | Version: 2.0 | Updated: 2026-04-19 -->

# Backend Development Navigation

**Purpose**: Server-side development patterns for Allura Memory

**Status**: ✅ Active - Referenced by agent routing system

---

## Quick Access

| Pattern | Location | Load When |
|---------|----------|-----------|
| **API Design** | `../principles/api-design.md` | Designing endpoints |
| **Clean Code** | `../principles/clean-code.md` | Writing any code |
| **PostgreSQL** | `../data/navigation.md` | Database operations |
| **Integration** | `../integration/navigation.md` | Third-party services |

---

## Allura-Specific Backend Patterns

### MCP Server Architecture
- **Location**: `src/mcp/`
- **Patterns**: Stdio transport, tool registration, error handling
- **Key Files**: `memory-server-canonical.ts`, `legacy/`

### Database Layer
- **PostgreSQL**: Append-only events, parameterized queries
- **Neo4j**: SUPERSEDES versioning, Cypher patterns
- **Connection**: `src/lib/postgres/connection.ts`

### Server Actions (Next.js)
- **Location**: `src/server/`
- **Pattern**: Server-only modules with window check
- **Security**: group_id enforcement on all queries

---

## Structure

```
backend/
├── navigation.md              # This file
├── api-patterns/              # REST, GraphQL, gRPC patterns
├── nodejs/                    # Node.js specific patterns
├── authentication/            # JWT, OAuth, sessions
└── middleware/                # Logging, rate-limiting, CORS
```

---

## Related Context

- **Frontend** → `../frontend/navigation.md`
- **Data Layer** → `../data/navigation.md`
- **Principles** → `../principles/navigation.md`
- **Core Standards** → `../../core/standards/code-quality.md`

---

## Related Context

- **Backend Navigation** → `../backend-navigation.md`
- **API Design Principles** → `../principles/api-design.md`
- **Core Standards** → `../../core/standards/code-quality.md`
