---
project_name: 'memory'
user_name: 'Ronin704'
date: '2026-03-24'
sections_completed:
  - technology_stack
  - language_rules
  - framework_rules
  - testing_rules
  - code_quality_rules
  - workflow_rules
  - architecture_rules
status: 'complete'
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobsolet details that agents might otherwise miss._

## The Memory Card Vision

This project implements a **self-improving AI knowledge system** (the "Memory Card") that:

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
Agent Layer (OhMyOpenCode, OpenClaw)
    ↓ uses memory via
MCP_DOCKER (MCP tool runtime)
    ↓ connects to
ronin-memory MCP Server
    ↓ reads/writes
PostgreSQL (Layer 1 - Raw Traces) + Neo4j (Layer 2/3/4)

---

## Technology Stack & Versions

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Framework | Next.js | ^16.0.0 | App Router, Server Actions |
| Language | TypeScript | ^5.9.2 | Strict mode (`strict: true`, `noEmit: true`, `isolatedModules: true`) |
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

### Version Constraints

- **TypeScript**: Must use `strict: true`. All function parameters and return types must be explicit.
- **Neo4j**: Requires APOC plugin for advanced operations.
- **Node.js**: 20-alpine for consistent Docker builds.

---

## Critical Implementation Rules

### TypeScript / Language Rules

**Compiler Settings (tsconfig.json):**
- `strict: true` — All code must pass strict type checking
- `noEmit: true` — TypeScript only for type checking, not emission
- `isolatedModules: true` — Each file must be independently transpilable
- `moduleResolution: "bundler"` — Use bundler resolution for Next.js

### Import Rules

| Pattern | Status | Example |
|---------|--------|---------|
| `@/` path alias | ✅ Required | `import { getPool } from "@/lib/postgres/connection"` |
| Relative imports | ❌ Avoid | Never use `../../../lib/connection` |
| Stable paths | ✅ Preferred | Use consistent, readable import paths |

### Server Module Rules

**"use server" Directive:**
- Add at top of server action files: `"use server"`
- Required for any file exporting server actions

**Server-Only Guard (CRITICAL):**
```typescript
// Required at top of database/server-only modules
if (typeof window !== "undefined") {
  throw new Error("This module can only be used server-side");
}
```

### Validation Rules

| Zod Method | Use Case |
|------------|----------|
| `.parse()` | Fail fast on invalid input |
| `.safeParse()` | Graceful handling, check `.success` |

**Pattern:**
```typescript
import { z } from "zod";

const MySchema = z.object({
  group_id: z.string(),
  timestamp: z.date().optional(),
});

// Fail fast
const parsed = MySchema.parse(input);

// Or graceful
const result = MySchema.safeParse(input);
if (!result.success) {
  // Handle validation error
}
```

### Error Handling Rules

**Database Errors:**
- Log with context (operation, query hint, error message)
- Return gracefully — don't crash the process
- Use structured logging, not ad-hoc `console.log`

**Environment Variables:**
- Throw early with clear error messages if missing
- Pattern: `if (!password) throw new Error("POSTGRES_PASSWORD is required")`

**Logging Pattern (Production):**
```typescript
// ✅ Use structured logging
console.error("[PostgreSQL Pool] Unexpected error:", err.message);

// ❌ Avoid ad-hoc console.log in production paths
// Create a shared logger utility for database/MCP operations
```

### Async / Connection Rules

**Singleton Connection Pools:**
```typescript
let poolInstance: Pool | null = null;

export function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool({ /* config */ });
    // Attach error handler BEFORE any queries
    poolInstance.on("error", (err) => {
      console.error("[PostgreSQL Pool] Error:", err.message);
    });
  }
  return poolInstance;
}
```

**Consistent async/await:**
- Always use `async/await` — never raw Promises with `.then()`
- Close connections in graceful shutdown: `await closePool()`

### Codebase Guidance

- Preserve TypeScript strictness and server/client separation
- New modules follow same import, validation, and error-handling conventions
- Use shared logger utility instead of ad-hoc `console.log` in production

### Next.js / App Router Rules

**Server Components (Default):**
- All `src/app/` files are Server Components by default
- Database modules (`postgres`, `neo4j`, `notion`) ONLY importable in:
  - Server Components
  - Server Actions (`"use server"` files)

**Client Components Pattern:**
```typescript
"use client";

import { useState } from "react";
import { usePreferencesStore } from "@/stores/preferences/preferences-store";

export function MyComponent() {
  const themeMode = usePreferencesStore((state) => state.themeMode);
  // ...
}
```

**When "use client" is Required:**
| Use Case | Directive |
|----------|----------|
| `useState`, `useEffect`, `useRef` | `"use client"` |
| Event handlers (`onClick`, etc.) | `"use client"` |
| Zustand store hooks | `"use client"` |
| Browser APIs (`window`, `localStorage`) | `"use client"` |
| Data fetching in components | Server Component (no directive) |

### Server Actions Pattern

```typescript
// src/server/server-actions.ts
"use server";

import { cookies } from "next/headers";

export async function getPreference<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T
): Promise<T> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(key);
  const value = cookie ? cookie.value.trim() : undefined;
  return allowed.includes(value as T) ? (value as T) : fallback;
}
```

**Server Action Rules:**
- Always `await cookies()` (it's async in Next.js 16)
- Use for state persistence, not for data fetching (use React Server Components)

### Zustand Store Pattern

```typescript
// src/stores/preferences/preferences-store.ts
import { createStore } from "zustand/vanilla";

export type PreferencesState = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

export const createPreferencesStore = (init?: Partial<PreferencesState>) =>
  createStore<PreferencesState>()((set) => ({
    themeMode: init?.themeMode ?? "system",
    setThemeMode: (mode) => set({ themeMode: mode }),
  }));
```

**Zustand Rules:**
- Use `createStore` from `zustand/vanilla` for server-compatible stores
- Use `create` from `zustand` for client-only stores with React hooks
- Type the state explicitly with `type StoreState = { ... }`

### shadcn/ui Components

**Usage:**
```typescript
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Use cn() for className merging
<div className={cn("base-class", isActive && "active-class")} />
```

**Component Location:**
- Pre-built components: `src/components/ui/`
- Built on Radix UI primitives for accessibility
- Do NOT modify `src/components/ui/` files — extend with `cn()` instead

### Tailwind CSS v4 Rules

- Use `tailwind-merge` + `clsx` via `cn()` utility
- Prefer Tailwind utility classes over custom CSS
- `cn()` handles conditional and merged classes correctly

### Testing Rules (Vitest)

**Test File Location:**
| Source File | Test File |
|-------------|-----------|
| `src/lib/postgres/connection.ts` | `src/lib/postgres/connection.test.ts` |
| `src/lib/neo4j/connection.ts` | `src/lib/neo4j/connection.test.ts` |
| Integration tests | `src/__tests__/e2e-integration.test.ts` |

**Test Pattern (AAA):**
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("Module Name", () => {
  beforeAll(async () => {
    // Setup: Set env vars, initialize connections
    process.env.POSTGRES_PASSWORD = "test_password";
  });

  afterAll(async () => {
    // Cleanup: Close pools, reset state
    await closePool();
  });

  it("should description", async () => {
    // Arrange
    const input = { group_id: "test" };
    
    // Act
    const result = await functionUnderTest(input);
    
    // Assert
    expect(result).toBeDefined();
    expect(result.id).toBe("expected");
  });
});
```

**Database Test Setup:**
```typescript
beforeAll(async () => {
  // Set required env vars for database connections
  process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
  process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "test_password";
  process.env.NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "test_password";
});

afterAll(async () => {
  // ALWAYS close pools to prevent connection leaks
  await closePool();
  await closeDriver();
});
```

**Test Commands:**
| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npx vitest run src/lib/postgres/connection.test.ts` | Run single file |
| `npx vitest run -t "should build connection config"` | Run single test by name |

**Testing Rules:**
- ALWAYS use `describe()` for grouping related tests
- ALWAYS clean up resources in `afterAll()`
- NEVER skip `beforeAll` setup for database tests
- Use `expect().toBe()` for primitives, `expect().toEqual()` for objects
- Test both success and error paths

### Code Quality & Style Rules

**Naming Conventions:**

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `connection.test.ts` |
| Components | PascalCase | `Button.tsx` |
| Functions | camelCase | `getConnectionConfig()` |
| Types/Interfaces | PascalCase | `ConnectionConfig` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_POOL_CONFIG` |
| Database tables | snake_case | `events`, `traces` |

**File Organization:**
```
src/
├── app/                    # Next.js App Router pages
│   ├── (main)/            # Route group for authenticated routes
│   └── (external)/        # Route group for public routes
├── components/ui/         # shadcn/ui components (do not modify)
├── lib/                   # Core libraries
│   ├── postgres/         # PostgreSQL client and queries
│   ├── neo4j/            # Neo4j client and queries
│   ├── notion/           # Notion API client
│   ├── adas/             # ADAS runtime library (NOT a CLI runner - internal backend logic only)
│   ├── policy/           # Policy gateway
│   ├── validation/       # Validation utilities (group_id, trace_ref)
│   ├── budget/           # Budget enforcement
│   ├── lifecycle/        # Insight lifecycle state machine
│   ├── circuit-breaker/  # Circuit breaker pattern
│   └── utils.ts          # Shared utilities (cn, formatCurrency)
├── stores/               # Zustand stores
└── server/               # Server actions
```

**Documentation Rules:**
- JSDoc comments for public functions: `/** Description */`
- Inline comments for complex logic only
- No redundant comments that repeat code
- Update memory bank after completing work

### Development Workflow Rules

**Build Commands:**
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`) |
| `npm test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | ESLint |

**Docker Infrastructure:**
```bash
# Verify PostgreSQL
docker exec knowledge-postgres pg_isready -U ronin4life -d memory

# Verify Neo4j
curl -s http://localhost:7474 | jq .neo4j_version

# Test Neo4j Cypher
docker exec knowledge-neo4j cypher-shell -u neo4j -p 'KaminaTHC*' "RETURN 1 AS test"
```

**Environment Variables:**
| Variable | Required | Purpose |
|----------|----------|---------|
| `POSTGRES_HOST` | No (default: localhost) | PostgreSQL host |
| `POSTGRES_PASSWORD` | **Yes** | PostgreSQL password |
| `POSTGRES_DB` | No (default: memory) | Database name |
| `NEO4J_URI` | No (default: bolt://localhost:7687) | Neo4j bolt URI |
| `NEO4J_PASSWORD` | **Yes** | Neo4j password |
| `NOTION_API_KEY` | For Notion sync | Notion integration key |

**Memory Bank Updates:**
- Update `memory-bank/activeContext.md` when starting new work
- Update `memory-bank/progress.md` when completing stories
- Update `memory-bank/systemPatterns.md` when making architectural decisions

### Critical Architecture Rules (DON'T MISS)

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

**Property Schema (Updated 2026-03-17):**
```typescript
// Insights Database
interface InsightNotionProperties {
  Name: { title: [{ text: { content: string } }] };
  "Canonical Tag": { rich_text: [{ text: { content: string } }] };
  "Display Tags": { multi_select: [{ name: string }] };
  "Source Project": { rich_text: [{ text: { content: string } }] };
  "Source Insight ID": { rich_text: [{ text: { content: string } }] };
  Confidence: { number: number };
  Status: { select: { name: "Proposed" | "Pending Review" | "Approved" | "Rejected" | "Superseded" } };
  "Review Status": { select: { name: "Pending" | "In Progress" | "Completed" | "Updated" } };
  "AI Accessible": { checkbox: boolean };
  "Promoted At": { date: { start: string } };
  "Approved By": { rich_text: [{ text: { content: string } }] };
  "Approved At": { date: { start: string } };
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

**MCP_DOCKER Architecture**

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

**ronin-memory MCP Server**

ronin-memory (`src/mcp/memory-server.ts`) is our **custom MCP server** that provides memory tools. It's containerized in `Dockerfile.mcp`:

```bash
# Build the MCP server image
docker build -f Dockerfile.mcp -t ronin-memory-mcp:latest .

# Add to MCP_DOCKER
MCP_DOCKER_mcp-add ronin-memory-mcp
```

**Dockerfile.mcp structure:**
- Multi-stage build (builder + runner)
- Runs TypeScript directly with tsx
- Security: runs as non-root user
- Health checks enabled
- Includes all memory system dependencies (`src/lib/`, `src/integrations/`, `src/curator/`)

**Why custom vs Docker Hub?**
- Docker Hub MCP servers are pre-built for common tools (GitHub, Notion, etc.)
- ronin-memory is custom because it connects to YOUR PostgreSQL/Neo4j instances
- It provides project-specific tools like `search_memories`, `create_insight`, `promote_knowledge`

### Key Project Files

| File | Purpose |
|------|---------|
| `memory-bank/activeContext.md` | Current task and blockers |
| `memory-bank/progress.md` | Completed work log |
| `memory-bank/systemPatterns.md` | Architecture decisions |
| `memory-bank/techContext.md` | Stack and dependencies |
| `_bmad-output/planning-artifacts/epics.md` | Story definitions |
| `docker-compose.yml` | PostgreSQL + Neo4j containers |

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update memory-bank files after completing work

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

**Last Updated:** 2026-03-24

---

## Critical Clarifications

### MCP_DOCKER Architecture

**IMPORTANT:** This project uses MCP_DOCKER to manage MCP servers from [Docker Hub MCP](https://hub.docker.com/mcp).

**Architecture:**
```
Agent Layer (OhMyOpenCode, OpenClaw, etc.)
    ↓ use MCP_DOCKER commands
MCP_DOCKER CLI (mcp-add, mcp-exec, mcp-find, etc.)
    ↓ pull from Docker Hub MCP registry
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

**ronin-memory** (`src/mcp/memory-server.ts`) is our custom MCP server that provides memory tools to agents. It's accessed via MCP_DOCKER like any other MCP server.

### ADAS Module is NOT a CLI Runner

**IMPORTANT:** The `src/lib/adas/` module is a **backend runtime library** for agent evaluation, promotion detection, and sandboxed testing. It is **NOT** an external CLI runner or agent orchestrator.

**Component Types:**
- **Agents**: OhMyOpenCode, OpenClaw - AI agents that execute tasks
- **MCP_DOCKER**: CLI tool for managing MCP servers from Docker Hub
- **MCP Servers**: ronin-memory, notion-mcp, etc. - Provide tools to agents
- **Backend Library**: ADAS (`src/lib/adas/`) - Internal logic only, not a CLI tool

Do not confuse the ADAS library with the outer agent layer. ADAS code runs as part of the Next.js application, consumed by the memory system's internal processes.