# Active Context: Unified AI Knowledge System

## Current Agent Work

**BMad Master alignment - COMPLETED**

Status: `completed`

- Reframed `_bmad/core/agents/bmad-master.md` as a true orchestration agent
- Removed dev-agent execution assumptions from master startup and menu behavior
- Aligned workflow handling to repo-native `workflow.md` artifacts
- Updated BMAD config greeting identity to `Sabir`

## Current Focus

**Story 2.1: Implement Domain Evaluation Harness - COMPLETED**

Status: `completed`

The evaluation harness for ADAS (Automated Design of Agent Systems) pipeline is now complete. All acceptance criteria passed:
- AC1: Harness evaluates designs and returns structured scores ✅
- AC2: Metrics logged to PostgreSQL raw trace layer ✅
- AC3: Candidates ranked by composite score ✅

## Current Sprint Status

**Epic 1: Persistent Knowledge Capture and Tenant-Aware Memory**
- Status: `complete`
- Stories:
  - ✅ 1.1 Record Raw Execution Traces → `completed`
  - ✅ 1.2 Retrieve Episodic Memory from Trace History → `completed`
  - ✅ 1.3 Store Versioned Semantic Insights in Neo4j → `completed`
  - ✅ 1.4 Query Dual Context Memory → `completed`
  - ✅ 1.5 Enforce Tenant Isolation with Group IDs → `completed`
  - ✅ 1.6 Link Promoted Knowledge Back to Raw Evidence → `completed`
  - ✅ 1.7 Automated Knowledge Curation → `completed`

**Epic 2: ADAS Discovery and Design Promotion Pipeline**
- Status: `in-progress`
- Stories:
  - ✅ 2.1 Implement Domain Evaluation Harness → `completed`
  - ⏳ 2.2 Execute Meta Agent Search Loop → `backlog`
  - ⏳ 2.3 Integrate Sandboxed Execution for ADAS → `backlog`
  - ⏳ 2.4 Automate Design Promotion Logic → `backlog`
  - ⏳ 2.5 Synchronize Best Designs to Notion Registry → `backlog`

**Epics 3-4**: All in `backlog` status

## What We're Building Now

### Story 1.1 Tasks

1. **Create PostgreSQL connection layer** (`src/lib/postgres/connection.ts`)
   - Pool wrapper with connection config from environment
   - Pool safety settings (connectionTimeoutMillis, idleTimeoutMillis)
   - Error handling for background connection failures

2. **Define raw trace schema** (`src/lib/postgres/schema/traces.sql`)
   - `events` table for append-only trace logging
   - Surrogate primary key, group_id, timestamp, agent_id, workflow context
   - JSONB for structured metadata
   - Indexes on `(group_id, created_at)` for tenant-scoped reads

3. **Make schema application explicit**
   - Wire through `postgres-init/` or app-side initialization
   - Idempotent setup for local development

4. **Implement append-only trace insertion** (`src/lib/postgres/queries/insert-trace.ts`)
   - Typed insert function for events
   - Enforce group_id presence before insert

5. **Add verification coverage**
   - Verify table exists and accepts inserts
   - Verify required fields including group_id
   - Verify ordering and tenant-scoped retrieval

## Active Questions / Decisions Needed

1. **Package.json location**: Root manifest/build config visibility is incomplete in this checkout. Need to verify before claiming dependency installation or build success.

2. **Schema application path**: If SQL is only in `src/lib/postgres/schema/`, nothing in current setup applies it automatically. Need explicit execution path.

## Infrastructure Blockers

| Blocker | Status | Action Needed |
|---------|--------|---------------|
| TypeScript build config | ⚠️ Uncertain | Verify package.json/tsconfig.json exist |
| Test framework | ❌ Missing | Set up Vitest + Playwright |
| Schema application | ❌ No path | Create init script or app-side apply |

## Recent Changes

- [2026-03-15] Epic breakdown created with 4 epics, 24 stories
- [2026-03-15] Tech spec created for Unified Knowledge System Core Schema and Steel Frame
- [2026-03-15] Sprint status initialized with Story 1.1 ready for development
- [2026-03-15] Docker containers verified running (PostgreSQL, Neo4j)

## Next Steps After Story 1.1

1. **Story 1.2**: Retrieve Episodic Memory from Trace History
2. **Story 1.3**: Store Versioned Semantic Insights in Neo4j
3. Verify data flow: PostgreSQL traces → evidence for promotion

## Open Issues

1. **No project-context.md**: Planning context derived from epics.md and tech spec alone
2. **No prior story learnings**: First story in Epic 1
3. **Memory bank installation**: Being established with this session
