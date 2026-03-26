# Agent Coding Guide

## Build Commands

```bash
# Development
npm run dev                    # Start Next.js dev server
npm run build                  # Production build
npm run start                  # Start production server

# Type Checking & Linting
npm run typecheck             # TypeScript check (strict, noEmit)
npm run lint                  # Next.js lint

# Testing (Vitest + Bun)
npm test                       # Run all tests once
npm run test:watch             # Watch mode

# Run single test
npx vitest run src/lib/postgres/connection.test.ts
npx vitest run -t "should build connection config"

# E2E Tests (requires databases)
npm run test:e2e              # Full system integration
RUN_E2E_TESTS=true npm test   # Behavioral stress tests

# MCP Server
npm run mcp                   # Start MCP server
npm run mcp:dev               # MCP server with watch mode

# Curator Operations
npm run curator:run           # Run knowledge promotion pipeline
npm run curator:approve         # Approve pending insights
npm run curator:reject        # Reject pending insights
```

## TypeScript Standards

Strict TypeScript with `strict: true`, `noEmit: true`, ES2022 target.

```typescript
// Explicit types for all functions
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

Use `@` path alias for all project imports:

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

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Framework | Next.js | ^16.0.0 | App Router, Server Actions |
| Language | TypeScript | ^5.9.2 | Strict mode, noEmit |
| Runtime | Node.js | 20-alpine | Docker runtime |
| UI | React | ^19.2.0 | Server/Client Components |
| Styling | Tailwind CSS | v4 | `tailwind-merge` + `clsx` (`cn` utility) |
| State | Zustand | ^5.0.6 | Client state (vanilla stores) |
| Validation | Zod | ^4.1.5 | Runtime type validation |
| Raw Traces | PostgreSQL | 16 (`pg` ^8.16.3) | Append-only event storage |
| Knowledge Graph | Neo4j | 5.26 + APOC (`neo4j-driver` ^6.0.1) | Versioned insights |
| Testing | Vitest | ^2.1.9 | Unit + integration tests |
| MCP Protocol | @modelcontextprotocol/sdk | ^1.27.1 | Tool interfaces |

## Critical Architecture Rules

**⚠️ These rules can break the system if violated.**

### Database Architecture

**PostgreSQL — Raw Traces Layer:**
| Rule | Reason |
|------|--------|
| APPEND-ONLY | Never mutate existing records — audit trail integrity |
| `group_id` required | All tables need `group_id` for tenant isolation |
| Connection pooling | Use singleton `getPool()` pattern |

**Neo4j — Knowledge Graph:**
| Rule | Reason |
|------|--------|
| SUPERSEDES versioning | Never edit Insight nodes — create new version with `SUPERSEDES` edge |
| `group_id` on every node | Schema constraint enforces tenant isolation |
| Query both scopes | `WHERE i.group_id = $project_id OR i.group_id = 'global'` |

**Steel Frame Versioning Pattern:**
```cypher
// Create new version (never edit old)
CREATE (v2:Insight { id: $id, group_id: $group_id, status: 'active', confidence: 0.85 })
WITH v2
MATCH (v1:Insight {id: $old_id})
CREATE (v2)-[:SUPERSEDES]->(v1)
SET v1.status = 'deprecated'
```

### Notion Integration — Approval UX

**⚠️ Two separate fields serve different purposes:**

| Field | Purpose | Values |
|-------|---------|--------|
| `Status` | Agent lifecycle | `Proposed` / `Pending Review` / `Approved` / `Rejected` / `Superseded` |
| `Review Status` | **Approval workflow** | `Pending` / `In Progress` / `Completed` / `Updated` |
| `AI Accessible` | **Runtime approval flag** | Checkbox (`true`/`false`) |

**Code MUST check:**
```typescript
// ✅ CORRECT: Use Review Status for approval workflow
if (page.properties["Review Status"].select.name === "Completed" && 
    page.properties["AI Accessible"].checkbox === true) {
  // Agent/design is approved for use
}
```

### Anti-Patterns to Avoid

| ❌ Anti-Pattern | ✅ Correct Pattern |
|----------------|-------------------|
| Mutating PostgreSQL traces | Append new records only |
| Editing Neo4j Insight nodes | Create new version with `SUPERSEDES` |
| Cross-group queries | ALWAYS filter by `group_id` |
| Autonomous knowledge promotion | Human approval required (HITL gate) |
| Storing secrets in memory bank | Use environment variables |
| Using `Status` for approval | Use `Review Status` for approval |
| Importing DB modules in client | Use `"use client"` only when needed |

### Security Rules

- NEVER import database modules in client components
- ALWAYS use server-only guard at top of database files:
```typescript
if (typeof window !== "undefined") {
  throw new Error("This module can only be used server-side");
}
```
- Environment variables with passwords are REQUIRED at startup
- Validate all external data with Zod before use

## Memory Bank Integration

Read at session start:
1. `memory-bank/activeContext.md` - Current task
2. `memory-bank/progress.md` - Completed items
3. `memory-bank/systemPatterns.md` - Architecture
4. `memory-bank/techContext.md` - Stack

## Documentation Structure

The `docs/` directory contains project documentation artifacts organized by project or feature folder, following template-based documentation standards.

### Project Folder Structure

Each project or feature gets its own folder under `docs/<project-name>/`.

| Document | Purpose | Template |
|----------|---------|----------|
| `<project-name>/PROJECT.md` | Single cohesive master doc containing Blueprint, Architecture, Tasks and Requirements | `templates/PROJECT.template.md` |

### Example

Use `docs/Carlos_plan_framework/` as the historical reference structure, but for new projects, consolidate documentation into the single `PROJECT.md` file.

### Documentation Rules

- Start from `PROJECT.template.md` in `templates/` directory - never from scratch
- Use Requirement IDs: B1, B2 (Business), F1, F2 (Functional), AD-01 (Decision), RK-01 (Risk)
- Include Mermaid diagrams for component, data flow, and sequence diagrams inside the doc
- Cross-reference related documents with explicit links
- Keep each project folder flat - no nested `plans/`, `drafts/`, or `adas/` directories inside project documentation folders

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
