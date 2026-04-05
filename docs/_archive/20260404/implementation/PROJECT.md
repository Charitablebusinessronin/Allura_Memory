# roninmemory Project Overview

**Purpose:** Shared memory substrate for Allura / Agent-OS runtimes.

## Current Architecture

- **OpenCode** and **OpenClaw** are runtime clients.
- **roninmemory / Allura** is the shared memory service.
- **MCP** is the stable contract between runtimes and memory tools.
- **PostgreSQL** stores raw append-only traces.
- **Neo4j** stores curated knowledge and relationships.
- **Notion** is the human-facing governance surface.

## What Is Working

- Next.js app shell and dashboard routes.
- MCP memory server.
- OpenClaw gateway.
- Curator pipeline and validation modules.
- Agent registry and health monitor.

## What Is Not Yet Fully Working

- Typecheck fails in several existing files.
- `src/lib/runtime/groupIdEnforcer.ts` is unfinished.
- Some tests need updated mocks.
- The unified adapter flow is still being specified and implemented.

## Initial Focus

1. Define the shared MCP memory contract.
2. Build thin adapters for OpenCode and OpenClaw.
3. Enforce `group_id` consistently.
4. Add runtime alignment validation.
