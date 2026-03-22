# Agent Coding Guide - Memory Project

This file provides guidance for AI coding agents working on the Memory project. It supplements the Memory Bank system documented in `.github/copilot-instructions.md`.

## Build Commands

```bash
# Development
npm run dev                    # Start Next.js dev server

# Build & Run
npm run build                  # Production build
npm run start                  # Start production server

# Type Checking
npm run typecheck             # Run TypeScript type checking (noEmit)

# Testing
npm test                       # Run all tests once (vitest run)
npm run test:watch             # Run tests in watch mode

# Run a single test file
npx vitest run src/lib/postgres/connection.test.ts
npx vitest run src/lib/postgres/queries/insert-trace.test.ts

# Run a single test by name
npx vitest run -t "should build connection config"
```

## Project Structure

- `src/app/` - Next.js App Router pages and layouts
- `src/components/ui/` - shadcn/ui component library
- `src/lib/` - Shared utilities, database connections, preferences
- `src/stores/` - Zustand stores for client state
- `src/server/` - Server actions (Next.js)
- `src/hooks/` - Custom React hooks

## Code Style Guidelines

### TypeScript

This project uses **strict TypeScript**. All compiler options enforce strict type checking:

```json
{
  "strict": true,
  "noEmit": true,
  "isolatedModules": true
}
```

- **Always use explicit types** for function parameters and return types
- **Use Zod** for runtime validation of external data (API responses, form inputs, config)
- **Avoid `any`** - use `unknown` if type is truly unknown

### Import Conventions

Use the `@` path alias for project imports:

```typescript
// Good
import { Button } from "@/components/ui/button";
import { getPool } from "@/lib/postgres/connection";
import type { ThemeMode } from "@/lib/preferences/theme";

// Avoid
import { Button } from "../../components/ui/button";
```

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
// src/server/server-actions.ts
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
// connection.ts
if (typeof window !== "undefined") {
  throw new Error("PostgreSQL connection module can only be used server-side");
}
```

Always import database modules only in server contexts.

### State Management

Use **Zustand** for client state:

```typescript
// stores/preferences/preferences-store.ts
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

### UI Components

Use **shadcn/ui** components from `src/components/ui/`. These are built on Radix UI primitives with Tailwind CSS.

```typescript
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";  // twMerge + clsx utility
```

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
  // Don't exit - let application handle recovery
});
```

### Testing

Tests use **Vitest** with the following patterns:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("PostgreSQL Connection Layer", () => {
  beforeAll(async () => {
    // Setup test environment
  });

  afterAll(async () => {
    // Cleanup
  });

  it("should description", async () => {
    expect(actual).toBe(expected);
  });
});
```

- Test files: `*.test.ts` in the same directory as the code being tested
- Environment: Set `process.env` variables in `beforeAll`

## Database Patterns

### PostgreSQL

- **Append-only** for traces - never mutate existing records
- Use connection pooling (pg Pool)
- Always include `group_id` for tenant isolation

### Neo4j (future)

- **SUPERSEDES** pattern for versioning Insights (immutable)
- Every node MUST have a `group_id` property

## Memory Bank Integration

Before starting work, read these files in order:

1. `memory-bank/activeContext.md` - Current task and blockers
2. `memory-bank/progress.md` - What's been done
3. `memory-bank/systemPatterns.md` - Architecture and patterns
4. `memory-bank/techContext.md` - Stack and dependencies

After completing work:
- Update `progress.md` with completed items
- Update `activeContext.md` if starting new work

## Important Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | PostgreSQL and Neo4j containers |
| `_bmad-output/planning-artifacts/epics.md` | Story definitions |
| `_bmad-output/implementation-artifacts/tech-spec-*.md` | Technical specifications |

## Verification Commands

```bash
# Check PostgreSQL
docker exec knowledge-postgres pg_isready -U ronin4life -d memory

# Check Neo4j
curl -s http://localhost:7474 | jq .neo4j_version

# Run typecheck
npm run typecheck

# Run all tests
npm test
```

## Project-Specific Rules

1. Use **Zustand** for client state management
2. Use **shadcn/ui** for UI components
3. Use **server actions** for state persistence
4. Use **group_id** in all database operations for tenant isolation
5. Use **append-only** for PostgreSQL traces - never mutate
6. Use **SUPERSEDES** for Neo4j versioning - never edit Insights