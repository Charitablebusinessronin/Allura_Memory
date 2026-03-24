# Agent Coding Guide

## Build Commands

```bash
# Development
npm run dev                    # Start Next.js dev server
npm run build                  # Production build
npm run start                  # Start production server

# Type Checking & Linting
npm run typecheck             # Run TypeScript type checking (noEmit)
npm run lint                  # Run Next.js lint

# Testing (uses bun/vitest)
npm test                       # Run all tests once
npm run test:watch             # Run tests in watch mode

# Run a single test file
npx vitest run src/lib/postgres/connection.test.ts
npx vitest run -t "should build connection config"

# E2E Tests (requires databases)
npm run test:e2e              # Full system integration tests
RUN_E2E_TESTS=true npm test   # Behavioral stress tests

# MCP Server
npm run mcp                   # Start MCP server for OpenClaw
npm run mcp:dev               # MCP server with watch mode

# Curator Operations
npm run curator:run           # Run knowledge promotion pipeline
npm run curator:approve       # Approve pending insights
npm run curator:reject        # Reject pending insights
```

## TypeScript Standards

This project uses **strict TypeScript** (ES2022 target, `strict: true`, `noEmit: true`).

```typescript
// Explicit types for parameters and return values
export function getPool(): Pool { ... }

// Use Zod for runtime validation
import { z } from "zod";
const configSchema = z.object({ host: z.string() });

// Type-only imports
import type { ConnectionConfig } from "./connection";
import { getPool, type ConnectionConfig } from "./connection";

// Never use `any`, use `unknown` if needed
function parseData(input: unknown): DataType { ... }
```

## Import Conventions

Use the `@` path alias for all project imports:

```typescript
// Good
import { Button } from "@/components/ui/button";
import { getPool } from "@/lib/postgres/connection";

// Avoid relative paths like ../../components/...
```

**Order:** External packages → Internal aliases (`@/`) → Relative imports (`./`, `../`)

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `connection.test.ts` |
| Components | PascalCase | `Button.tsx` |
| Hooks | camelCase with `use` | `useMobile.ts` |
| Types/Interfaces | PascalCase | `ConnectionConfig` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_POOL_CONFIG` |
| Database tables | snake_case | `traces.sql` |

## React/Next.js Patterns

**Server Components:** Default for `src/app/` files  
**Client Components:** Add `"use client"` at the top

```typescript
"use client";
import { useState } from "react";
```

**Server Actions:** Use for state persistence

```typescript
"use server";
export async function setValueToCookie(key: string, value: string): Promise<void> { ... }
```

**Server-Only Pattern:** Database modules must check for browser:

```typescript
if (typeof window !== "undefined") {
  throw new Error("PostgreSQL module can only be used server-side");
}
```

## Error Handling

- **Database errors:** Log with context, return gracefully
- **Missing env vars:** Throw early with clear messages
- **Validation:** Use Zod's `.parse()` or `.safeParse()`

```typescript
// Early validation
if (!password) {
  throw new Error("POSTGRES_PASSWORD environment variable is required");
}

// Graceful error handling
pool.on("error", (err: Error) => {
  console.error("[PostgreSQL Pool] Error:", err.message);
});
```

## Testing Patterns

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("Feature Name", () => {
  beforeAll(async () => {
    process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "test";
  });

  afterAll(async () => {
    await closePool();
  });

  it("should describe expected behavior", () => {
    expect(result).toBe(expected);
  });
});
```

## Key Design Principles

| Principle | Implementation |
|-----------|----------------|
| group_id | Every DB operation must include group_id for tenant isolation |
| Append-only | PostgreSQL traces are immutable - never UPDATE/DELETE |
| SUPERSEDES | Neo4j insights use versioning: new versions link to old |
| HITL | Human approval required before behavior-changing actions |
| ADR | Every architectural decision logged with 5-layer audit trail |

## Project Structure

```
src/
├── app/                    # Next.js App Router
├── components/ui/          # shadcn/ui components
├── lib/
│   ├── postgres/           # PostgreSQL connection (server-only)
│   ├── neo4j/              # Neo4j semantic memory queries
│   ├── ralph/              # Self-correcting execution loops
│   ├── circuit-breaker/    # Cascade failure prevention
│   ├── adas/               # Agent evaluation (backend library)
│   └── policy/             # RBAC, allow/deny rules
├── curator/                # Knowledge promotion pipeline
├── mcp/                    # MCP server for OpenClaw
├── server/                 # Next.js server actions
└── stores/                 # Zustand client state
```

## Memory Bank Integration

Read at session start:
1. `memory-bank/activeContext.md` - Current task
2. `memory-bank/progress.md` - Completed items
3. `memory-bank/systemPatterns.md` - Architecture
4. `memory-bank/techContext.md` - Stack

## Toolchain Context

```
opencode (CLI) → OpenClaw (MCP reasoner) → ronin-memory MCP → PostgreSQL + Neo4j
```

`src/lib/adas/` is internal backend logic — NOT an external CLI runner.

## Copilot Rules Reference

See `.github/copilot-instructions.md` for:
- Memory Bank workflow
- Steel Frame Versioning: `(v2-insight)-[:SUPERSEDES]->(v1-insight:deprecated)`
- HITL Knowledge Promotion requirements
- ADR 5-Layer Framework (Action, Context, Reasoning, Alternatives, Oversight)

## Verification Commands

```bash
# Database health checks
docker exec knowledge-postgres pg_isready -U ronin4life -d memory
curl -s http://localhost:7474 | jq .neo4j_version

# Quality checks
npm run typecheck
npm test
```
