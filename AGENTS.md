# Agent Coding Guide

## Allura's Memory

**Allura's Memory** is a **self-improving AI knowledge system** — a persistent memory for AI agents that:

1. **Separates noise from signal** - Raw traces in PostgreSQL, curated knowledge in Neo4j
2. **Learns continuously** - A "knowledge curator" periodically promotes insights from raw traces to semantic memory
3. **Self-corrects** - Ralph loops enable bounded self-improvement
4. **Human-in-the-loop** - Critical changes require human approval (HITL)
5. **Powers AI agents** - Provides persistent memory for OhMyOpenCode and OpenClaw agents

**Architecture:**
```
Agent Layer (OhMyOpenCode, OpenClaw)
    ↓ uses MCP_DOCKER commands
MCP_DOCKER CLI (mcp-add, mcp-exec, etc.)
    ↓ pulls from Docker Hub MCP registry
MCP Servers (ronin-memory, notion-mcp, github-mcp, etc.)
    ↓ connect to
Data Sources (PostgreSQL, Neo4j, Notion, GitHub)
```

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

## Technology Stack & Versions

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Framework | Next.js | ^16.0.0 | App Router, Server Actions |
| Language | TypeScript | ^5.9.2 | Strict mode (`strict: true`, `noEmit: true`) |
| Runtime | Node.js | 20-alpine | Docker runtime |
| UI | React | ^19.2.0 | Server/Client Components |
| Styling | Tailwind CSS | v4 | `tailwind-merge` + `clsx` (`cn` utility) |
| State | Zustand | ^5.0.6 | Client state (vanilla stores) |
| Validation | Zod | ^4.1.5 | Runtime type validation |
| Raw Traces | PostgreSQL | 16 (`pg` ^8.16.3) | Append-only event storage |
| Knowledge Graph | Neo4j | 5.26 + APOC (`neo4j-driver` ^6.0.1) | Versioned insights |
| Human Workspace | Notion API | 2022-06-28 | Approval workflows |
| MCP Protocol | @modelcontextprotocol/sdk | ^1.27.1 | Tool interfaces |
| Docker Execution | dockerode | ^4.0.9 | Sandboxed code execution |
| Testing | Vitest | ^2.1.9 | Unit + integration tests |
| Embeddings | Qwen3-Embedding-8B | local | Semantic similarity |

### Version Constraints

- **TypeScript**: Must use `strict: true`. All function parameters and return types must be explicit.
- **Neo4j**: Requires APOC plugin for advanced operations.
- **Node.js**: 20-alpine for consistent Docker builds.

## Key Design Principles

| Principle | Implementation |
|-----------|----------------|
| group_id | Every DB operation must include group_id for tenant isolation |
| Append-only | PostgreSQL traces are immutable - never UPDATE/DELETE |
| SUPERSEDES | Neo4j insights use versioning: new versions link to old |
| HITL | Human approval required before behavior-changing actions |
| ADR | Every architectural decision logged with 5-layer audit trail |

## Critical Architecture Rules (DON'T MISS)

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
CREATE (v2:Insight {
  id: $id,
  group_id: $group_id,
  status: 'active',
  confidence: 0.85
})
WITH v2
MATCH (v1:Insight {id: $old_id})
CREATE (v2)-[:SUPERSEDES]->(v1)
SET v1.status = 'deprecated'
```

### Notion Integration — Approval UX (CRITICAL)

**⚠️ Two separate fields serve different purposes:**

| Field | Purpose | Values |
|-------|---------|--------|
| `Status` | Agent lifecycle | `Proposed` / `Pending Review` / `Approved` / `Rejected` / `Superseded` |
| `Review Status` | **Approval workflow** | `Pending` / `In Progress` / `Completed` / `Updated` |
| `AI Accessible` | **Runtime approval flag** | Checkbox (`true`/`false`) |

**Approval Flow:**
1. New insight/design → `Status = Proposed`, `Review Status = Pending`, `AI Accessible = false`
2. Under review → `Review Status = In Progress`
3. **Approved** → `Status = Approved`, `Review Status = Completed`, `AI Accessible = true`

**Code MUST check:**
```typescript
// ✅ CORRECT: Use Review Status for approval workflow
if (page.properties["Review Status"].select.name === "Completed" && 
    page.properties["AI Accessible"].checkbox === true) {
  // Agent/design is approved for use
}

// ✅ CORRECT: Use Status for lifecycle state
if (page.properties.Status.select.name === "Active") {
  // Agent is active and can run
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

## MCP_DOCKER Architecture

```
Agent Layer (OhMyOpenCode, OpenClaw, etc.)
    ↓ use MCP_DOCKER commands
MCP_DOCKER CLI (mcp-add, mcp-exec, mcp-find, etc.)
    ↓ pulls from Docker Hub MCP registry
MCP Servers (ronin-memory, notion-mcp, github-mcp, tavily-mcp, etc.)
    ↓ connect to
Data Sources (PostgreSQL, Neo4j, Notion, GitHub, Web, etc.)
```

**MCP_DOCKER Commands:**
- `MCP_DOCKER_mcp-find` - Search Docker Hub MCP registry for available servers
- `MCP_DOCKER_mcp-add` - Add an MCP server to the session
- `MCP_DOCKER_mcp-exec` - Execute a tool on an MCP server
- `MCP_DOCKER_mcp-config-set` - Configure an MCP server
- `MCP_DOCKER_mcp-remove` - Remove an MCP server from the session

**Benefits:**
- Pre-built MCP servers from Docker Hub save context window
- No inline tool definitions needed
- Containerized execution for isolation
- Easy to add/remove servers dynamically

**Allura's Memory MCP Server**

Allura's Memory (`src/mcp/memory-server.ts`) is the **custom MCP server** that provides memory tools. It's containerized in `Dockerfile.mcp`:

```bash
# Build the MCP server image
docker build -f Dockerfile.mcp -t allura-memory-mcp:latest .

# Add to MCP_DOCKER
MCP_DOCKER_mcp-add allura-memory-mcp
```

**Why custom vs Docker Hub?**
- Docker Hub MCP servers are pre-built for common tools (GitHub, Notion, etc.)
- Allura's Memory is custom because it connects to YOUR PostgreSQL/Neo4j instances
- It provides project-specific tools like `search_memories`, `create_insight`, `promote_knowledge`

## ADAS Module is NOT a CLI Runner

**IMPORTANT:** The `src/lib/adas/` module is a **backend runtime library** for agent evaluation, promotion detection, and sandboxed testing. It is **NOT** an external CLI runner or agent orchestrator.

**Component Types:**
- **Agents**: OhMyOpenCode, OpenClaw - AI agents that execute tasks
- **MCP_DOCKER**: CLI tool for managing MCP servers from Docker Hub
- **MCP Servers**: ronin-memory, notion-mcp, etc. - Provide tools to agents
- **Backend Library**: ADAS (`src/lib/adas/`) - Internal logic only, not a CLI tool

Do not confuse the ADAS library with the outer agent layer. ADAS code runs as part of the Next.js application, consumed by the memory system's internal processes.

## Group ID Strategy

Groups are dynamically discoverable from Neo4j. Known groups include (but are not limited to):

| Group ID | Description |
|----------|-------------|
| `faith-meats` | Jerky business |
| `difference-driven` | Non-profit organization |
| `patriot-awning` | Freelance account |
| `global` | Cross-project shared knowledge |

**Rules:**
- Every node MUST have a `group_id` property
- Schema constraint rejects nodes without `group_id`
- Queries use dual-context pattern: project-specific + global insights

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
├── mcp/                    # Allura's Memory MCP server
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
opencode (CLI) → OpenClaw (MCP reasoner) → Allura's Memory MCP → PostgreSQL + Neo4j
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
