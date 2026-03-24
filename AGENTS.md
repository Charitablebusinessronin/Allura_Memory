# Agent Coding Guide - Memory Project

This file provides guidance for AI coding agents working on the Memory project. It supplements the Memory Bank system documented in `.github/copilot-instructions.md`.

## Build Commands

```bash
# Development
npm run dev                    # Start Next.js dev server
npm run build                  # Production build
npm run start                  # Start production server

# Type Checking & Linting
npm run typecheck             # Run TypeScript type checking (noEmit)
npm run lint                  # Run Next.js lint

# Testing
npm test                       # Run all tests once (vitest run)
npm run test:watch             # Run tests in watch mode

# Run a single test file
npx vitest run src/lib/postgres/connection.test.ts
npx vitest run src/lib/postgres/queries/insert-trace.test.ts

# Run a single test by name
npx vitest run -t "should build connection config"

# E2E Tests (requires databases)
npm run test:e2e              # Full system integration tests
RUN_E2E_TESTS=true npm test   # Behavioral stress tests

# MCP Server
npm run mcp                   # Start MCP server for OpenClaw integration
npm run mcp:dev               # MCP server with watch mode

# Curator Operations
npm run curator:run           # Run knowledge promotion pipeline
npm run curator:approve       # Approve pending insights
npm run curator:reject        # Reject pending insights
```

## Code Style Guidelines

### TypeScript

This project uses **strict TypeScript**. All compiler options enforce strict type checking:

```json
{
  "strict": true,
  "noEmit": true,
  "isolatedModules": true,
  "target": "ES2022"
}
```

- **Always use explicit types** for function parameters and return types
- **Use Zod** for runtime validation of external data (API responses, form inputs, config)
- **Avoid `any`** - use `unknown` if type is truly unknown
- **Use `type` imports** for types only, `import` for values

```typescript
// Good - type-only import
import type { ConnectionConfig } from "./connection";

// Good - value import
import { getPool } from "./connection";

// Good - both together
import { getPool, type ConnectionConfig } from "./connection";
```

### Import Conventions

Use the `@` path alias for project imports:

```typescript
// Good
import { Button } from "@/components/ui/button";
import { getPool } from "@/lib/postgres/connection";
import type { ConnectionConfig } from "@/lib/postgres/connection";

// Avoid
import { Button } from "../../components/ui/button";
```

**Import order:**
1. External packages (React, Next.js, third-party)
2. Internal aliases (`@/`)
3. Relative imports (`./`, `../`)

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `connection.test.ts` |
| Components | PascalCase | `Button.tsx` |
| Hooks | camelCase with `use` prefix | `useMobile.ts` |
| Types/Interfaces | PascalCase | `ConnectionConfig` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_POOL_CONFIG` |
| Database tables | snake_case | `traces.sql` |

### React/Next.js Patterns

**Server Components**: Default for `src/app/` files  
**Client Components**: Add `"use client"` directive at the top

```typescript
// Client component
"use client";
import { useState } from "react";
```

### Server Actions

Use Next.js server actions for state persistence:

```typescript
"use server";
import { cookies } from "next/headers";

export async function setValueToCookie(
  key: string,
  value: string,
  options: { path?: string; maxAge?: number } = {},
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(key, value, {
    path: options.path ?? "/",
    maxAge: options.maxAge ?? 60 * 60 * 24 * 7,
  });
}
```

### Server-Only Pattern

Database modules must check for browser environment:

```typescript
if (typeof window !== "undefined") {
  throw new Error("PostgreSQL connection module can only be used server-side");
}
```

Always import database modules only in server contexts.

### Error Handling

- **Database errors**: Log with context, return gracefully, don't crash the process
- **Missing env vars**: Throw early with clear error messages
- **Validation errors**: Use Zod's `.parse()` or `.safeParse()` for runtime validation

```typescript
// Good: Early validation with clear message
if (!password) {
  throw new Error("POSTGRES_PASSWORD environment variable is required");
}

// Good: Graceful database error handling
pool.on("error", (err: Error) => {
  console.error("[PostgreSQL Pool] Unexpected error on idle client:", err.message);
});
```

## Testing Patterns

### Test Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("Feature Name", () => {
  beforeAll(async () => {
    // Setup: environment, database connections
    process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "testpassword";
  });

  afterAll(async () => {
    // Cleanup: close connections, reset state
    await closePool();
  });

  describe("functionName", () => {
    it("should describe expected behavior", () => {
      const result = functionUnderTest(input);
      expect(result).toBe(expectedOutput);
    });
  });
});
```

### Database Test Setup

```typescript
// beforeAll: Initialize schema and connections
beforeAll(async () => {
  const pool = getPool();
  await initializeSchema(pool);
});

// afterAll: Clean up connections
afterAll(async () => {
  await closePool();
});
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and layouts
│   ├── (main)/            # Main app routes (authenticated)
│   └── (external)/        # Public routes
├── components/ui/          # shadcn/ui component library
├── lib/
│   ├── postgres/           # PostgreSQL connection and queries (server-only)
│   │   ├── connection.ts        # Pool management, server-only check
│   │   └── queries/             # Event/outcome CRUD
│   ├── neo4j/              # Neo4j queries and semantic memory
│   │   └── queries/             # Insight versioning, SUPERSEDES edges
│   ├── ralph/              # Self-correcting execution loops
│   ├── circuit-breaker/    # Cascade failure prevention
│   ├── adas/               # Automated Design of Agent Systems
│   ├── agents/             # Agent lifecycle, lineage, discovery
│   ├── sync/               # Notion sync and drift detection
│   ├── lifecycle/          # Insight state machine
│   ├── policy/             # RBAC, allow/deny rules
│   └── validation/         # Input validation, group governance
├── curator/                # Knowledge promotion pipeline, HITL curation
├── mcp/                    # MCP server (memory tools for OpenClaw)
├── server/                 # Next.js server actions
├── stores/                 # Zustand stores for client state
└── hooks/                  # Custom React hooks
```

## Database Patterns

### PostgreSQL (Raw Memory)

- **Append-only** for traces - never mutate existing records
- Use connection pooling (pg Pool)
- Always include `group_id` for tenant isolation

```typescript
// Example: Insert event with group_id
await insertEvent({
  group_id: 'project_alpha',
  event_type: 'agent_action',
  agent_id: 'code_assistant',
  metadata: { action: 'created_file' },
  status: 'completed'
});
```

### Neo4j (Semantic Memory)

- **SUPERSEDES** pattern for versioning Insights (immutable)
- Every node MUST have a `group_id` property
- Use `.toNumber()` on Neo4j Integer fields (they're objects, not numbers)
- Use `neo4jInt()` for LIMIT/SKIP parameters

```typescript
// Good: Convert Neo4j Integers
const count = result.records[0].get("count").toNumber();

// Good: Version an insight
(:Insight {version: 2})-[:SUPERSEDES]->(:Insight {version: 1, status: "deprecated"})
```

## Key Design Principles

| Principle | Implementation |
|-----------|----------------|
| group_id | Every database operation must include group_id for tenant isolation |
| Append-only | PostgreSQL traces are immutable - never UPDATE or DELETE |
| SUPERSEDES | Neo4j insights use versioning - new versions link to old |
| HITL | Agents require human approval before behavior-changing actions |
| ADR | Every architectural decision logged with 5-layer audit trail |

## BMAD Workflow Orchestration

### Plan First
Write plan to `tasks/todo.md` with checkable items before starting implementation. Verify plan before beginning.

### Subagent Strategy
Use subagents liberally to keep main context window clean. Offload research, exploration, and parallel analysis. One task per subagent for focused execution.

### Verification Before Done
Never mark a task complete without proving it works. Run tests, check logs, demonstrate correctness.

### Autonomous Bug Fixing
When given a bug report: just fix it. Point at logs, errors, failing tests — then resolve them. Zero hand-holding required.

### Self-Improvement Loop
After any correction from the user: update `tasks/lessons.md` with the pattern. Write rules to prevent the same mistake.

## Memory Bank Integration

Read files in this order at session start:

1. `memory-bank/activeContext.md` - Current task and blockers
2. `memory-bank/progress.md` - What's been done
3. `memory-bank/systemPatterns.md` - Architecture and patterns
4. `memory-bank/techContext.md` - Stack and dependencies

After completing work:
- Update `progress.md` with completed items
- Update `activeContext.md` if starting new work

## Verification Commands

```bash
# Check PostgreSQL
docker exec knowledge-postgres pg_isready -U ronin4life -d memory

# Check Neo4j
curl -s http://localhost:7474 | jq .neo4j_version

# Test Neo4j Cypher
docker exec knowledge-neo4j cypher-shell -u neo4j -p 'Kamina2025*' "RETURN 1 AS test"

# Run typecheck
npm run typecheck

# Run all tests
npm test

# Run specific test file
npx vitest run src/lib/postgres/connection.test.ts
```

## Project-Specific Rules

1. Use **Zustand** for client state management
2. Use **shadcn/ui** for UI components
3. Use **server actions** for state persistence
4. Use **group_id** in all database operations for tenant isolation
5. Use **append-only** for PostgreSQL traces - never mutate
6. Use **SUPERSEDES** for Neo4j versioning - never edit Insights
7. Write **tests first** (TDD) for new functionality
8. All code goes through **Ralph Loop** pattern for complex operations