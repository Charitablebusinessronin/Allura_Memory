# Technical Context

> **Last Updated:** 2026-04-05

---

## Stack Overview

| Layer | Technology | Version |
|-------|------------|---------|
| Agent Framework | OpenCode | Latest |
| Language | TypeScript | 5.9 (strict) |
| Runtime | Bun | Latest |

> **Security:** Use Bun exclusively for all package operations. Never use `npm` or `npx`. This avoids supply chain attacks and improves performance.
| Framework | Next.js | 16 |
| UI | React | 19 |
| State | Zustand | Latest |
| Components | shadcn/ui | Latest |
| Styling | Tailwind | v4 |
| Raw Events | PostgreSQL | 16 |
| Knowledge Graph | Neo4j | 5.26 + APOC |
| Tool Protocol | MCP | Latest |
| Agent Protocol | A2A | Latest |
| CMS | Payload | Latest |

---

## Database Architecture

### PostgreSQL (Raw Events)

**Purpose:** Append-only trace storage.

**Pattern:** Never mutate historical rows.

**Schema Requirements:**
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  group_id TEXT NOT NULL,        -- Tenant isolation
  agent_id TEXT NOT NULL,
  workflow_id TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence_ref TEXT[],
  rule_version TEXT,
  human_override BOOLEAN NOT NULL DEFAULT false,
  override_actor TEXT
);
```

### Neo4j (Curated Knowledge)

**Purpose:** Promoted insights with versioning.

**Pattern:** Steel Frame versioning with `SUPERSEDES`.

**Node Requirements:**
```javascript
{
  group_id: String,      // Tenant isolation
  agent_id: String,
  workflow_id: String?,
  status: String,
  created_at: DateTime,
  updated_at: DateTime,
  rule_version: String,
  evidence_refs: [String]
}
```

**Versioning Pattern:**
```cypher
// Create new version
CREATE (v2:Insight {id: $id, version: 2, ...})
CREATE (v1:Insight {id: $id, version: 1, status: 'deprecated'})
CREATE (v2)-[:SUPERSEDES]->(v1)
```

---

## MCP Tool Architecture

### Primary Tools

| Tool | Purpose |
|------|---------|
| `MCP_DOCKER_mcp-find` | Find MCP servers in catalog |
| `MCP_DOCKER_mcp-add` | Add MCP server to session |
| `MCP_DOCKER_mcp-config-set` | Configure MCP server |
| `MCP_DOCKER_mcp-exec` | Execute MCP tool |
| `MCP_DOCKER_notion-*` | Notion integration |
| `MCP_DOCKER_tavily_*` | Web search, research |

### Preference

**Prefer premade MCP servers** from `MCP_DOCKER` catalog over custom wrappers.

---

## Environment Configuration

### Required Env Vars

```bash
# PostgreSQL
DATABASE_URL=postgresql://...

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=...

# Notion
NOTION_API_KEY=...

# Tavily
TAVILY_API_KEY=...
```

### Fail Fast Pattern

```typescript
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
```

---

## Verification Commands

```bash
# PostgreSQL
docker exec knowledge-postgres pg_isready -U ronin4life -d memory

# Neo4j
curl -s http://localhost:7474 | jq .neo4j_version

# Type checking
npm run typecheck

# Linting
npm run lint

# Tests
npm test

# MCP servers (use bunx, not npx)
bunx @modelcontextprotocol/server-memory --help
bunx @modelcontextprotocol/server-neo4j-cypher --help
bunx @modelcontextprotocol/server-postgres --help
```

> **Security:** Always use `bun` and `bunx` instead of `npm` and `npx`.

---

## Import Conventions

| Type | Pattern |
|------|---------|
| External packages | First block |
| `@/*` aliases | Second block (cross-feature) |
| Relative imports | Third block |

**Example:**
```typescript
import { useState } from 'react';
import { z } from 'zod';

import { useStore } from '@/stores';
import { formatDate } from '@/lib/utils';

import { localHelper } from './helper';
```

---

## Server Guard Pattern

```typescript
if (typeof window !== 'undefined') {
  throw new Error('This module can only be used server-side');
}
```

---

## Testing Patterns

### Unit Tests

```bash
# Single file
bun vitest run src/lib/postgres/connection.test.ts

# Single test by name
bun vitest run -t "should build connection config"
```

### Integration Tests

```bash
bun vitest run src/__tests__/agent-lifecycle-confidence.test.ts
RUN_E2E_TESTS=true npm test
```

### Test Commands

```bash
npm test
npm run test:watch
npm run test:e2e
```

---

## BMad Configuration

**File:** `_bmad/bmm/config.yaml`

```yaml
project_name: roninmemory
user_skill_level: intermediate
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
project_knowledge: "{project-root}/docs"

user_name: Sabir Asheed
communication_language: English
document_output_language: English
output_folder: "{project-root}/docs"
```

**Key Points:**
- BMad reads from `docs/` (parent of canon)
- BMad writes to `_bmad-output/planning-artifacts/`
- BMad writes stories to `_bmad-output/implementation-artifacts/`