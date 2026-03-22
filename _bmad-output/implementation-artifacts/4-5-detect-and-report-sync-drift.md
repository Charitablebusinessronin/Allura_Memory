# Story 4.5: detect-and-report-sync-drift

Status: backlog

## Story

As an administrator,
I want the system to detect when Notion and Neo4j have fallen out of sync,
so that the human-managed source of truth stays aligned with agent memory.

## Acceptance Criteria

1. Given the knowledge base in Notion and the graph in Neo4j exist, when the drift detection query runs, then it flags nodes missing from either system.
2. Given drift is detected, when analyzing, then it lists stale nodes where the Notion update timestamp is newer than the Neo4j version.
3. Given a drift report exists, when reviewing, then the system provides actionable recommendations for reconciliation.

## Tasks / Subtasks

- [ ] Task 1: Design drift detection strategy (AC: 1, 2)
  - [ ] Define sync keys: unique identifiers linking Notion and Neo4j entities.
  - [ ] Design comparison strategy: full scan vs incremental checks.
  - [ ] Define drift types: missing, stale, conflicting.
- [ ] Task 2: Implement Notion data extraction (AC: 1)
  - [ ] Add `src/lib/sync/notion-extractor.ts` to read Notion pages.
  - [ ] Query database for AgentDesign registry entries.
  - [ ] Extract sync keys and timestamps.
  - [ ] Handle Notion API pagination and rate limits.
- [ ] Task 3: Implement Neo4j data extraction (AC: 1)
  - [ ] Add `src/lib/sync/neo4j-extractor.ts` to read graph nodes.
  - [ ] Query for mirrored entities with sync keys.
  - [ ] Extract timestamps and version info.
- [ ] Task 4: Implement drift analysis (AC: 1, 2, 3)
  - [ ] Add `src/lib/sync/drift-analyzer.ts` for comparison logic.
  - [ ] Identify missing entities in either system.
  - [ ] Detect stale entities (timestamp mismatches).
  - [ ] Generate reconciliation recommendations.
- [ ] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [ ] Test drift detection finds missing entities.
  - [ ] Test stale detection identifies timestamp mismatches.
  - [ ] Test recommendations are actionable.
  - [ ] Test handles large datasets efficiently.

## Dev Notes

- Sync drift is inevitable in distributed systems - detection is key.
- Notion API has rate limits (3 requests per second) - implement backoff.
- Sync keys should be stable: use Neo4j node IDs or custom UUIDs.
- Recommendations should suggest direction: Notion -> Neo4j or vice versa.

### Project Structure Notes

- Create `src/lib/sync/` directory for synchronization logic.
- Drift detection can run periodically (cron) or on-demand.
- Reports can be stored in PostgreSQL or sent via notifications.

### References

- Notion API: Story 2.5
- Neo4j queries: Story 1.3
- Epic 4 context: `_bmad-output/planning-artifacts/epics.md:472`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.3 (Neo4j), Story 2.5 (Notion integration)
- Neo4j container: `knowledge-neo4j`
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [ ] Drift detection strategy designed
- [ ] Notion data extraction implemented
- [ ] Neo4j data extraction working
- [ ] Drift analysis functional
- [ ] All tests passing

### File List

- `src/lib/sync/notion-extractor.ts` - Notion data extraction
- `src/lib/sync/notion-extractor.test.ts` - Extractor tests
- `src/lib/sync/neo4j-extractor.ts` - Neo4j data extraction
- `src/lib/sync/neo4j-extractor.test.ts` - Extractor tests
- `src/lib/sync/drift-analyzer.ts` - Drift analysis
- `src/lib/sync/drift-analyzer.test.ts` - Analyzer tests
- `src/lib/sync/types.ts` - Sync types
