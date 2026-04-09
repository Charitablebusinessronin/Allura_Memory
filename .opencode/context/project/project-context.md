# Project Context — Allura Memory (allura memory)

## Stack
- **Runtime**: Bun | **Framework**: Next.js 16 + React 19 | **Language**: TypeScript 5.9 (strict)
- **DB**: PostgreSQL 16 (append-only traces) + Neo4j 5.26 (curated knowledge)
- **UI**: Zustand + shadcn/ui + Tailwind v4
- **Agent Framework**: OpenCode
- **MCP**: `allura-memory` server at `src/mcp/memory-server.ts`

## File Conventions
| Type | Convention |
|------|-----------|
| Files | `kebab-case` |
| Components | `PascalCase` |
| Hooks | `use` prefix |
| Constants | `SCREAMING_SNAKE_CASE` |
| DB | `snake_case` |
| Tests | `should ... when ...` |

## Architecture Layers
```
L5: Paperclip + OpenClaw (Human interfaces)
L4: Workflow / DAGs / A2A Bus
L3: Agent Runtime (OpenCode)
L2: PostgreSQL + Neo4j
L1: RuVix Kernel (proof-gated mutation)
```

## Key Entry Points
- API: `src/app/api/`
- MCP Server: `src/mcp/memory-server.ts`
- Traces: `src/lib/postgres/`
- Knowledge: `src/lib/neo4j/`

## Test Commands
```bash
bun vitest run              # all unit tests
bun vitest run -t "..."     # single test by name
npm run typecheck           # TS validation
npm run lint                # ESLint
```
