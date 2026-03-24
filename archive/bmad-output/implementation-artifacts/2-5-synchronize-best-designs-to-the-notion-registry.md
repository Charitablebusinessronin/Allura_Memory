# Story 2.5: synchronize-best-designs-to-the-notion-registry

Status: completed

## Story

As a developer,
I want the best current design and its rationale mirrored to the Notion AI Agents Registry,
so that I have a human-readable library of best practices for building agents.

## Acceptance Criteria

1. Given a promoted AgentDesign has high confidence of 0.7 or higher and required approval, when the insight is finalized in Neo4j, then a summary and how-to-run-it guide are mirrored to the Notion knowledge base.
2. Given a design is mirrored to Notion, when viewing the page, then it contains a link back to the source evidence in PostgreSQL.
3. Given sync to Notion occurs, when the operation completes, then the system detects and handles any sync drift between systems.

## Tasks / Subtasks

- [x] Task 1: Design Notion page structure (AC: 1)
  - [x] Define page template: title, description, code blocks, metrics, usage guide.
  - [x] Design database schema in Notion for AgentDesign registry.
  - [x] Define property mappings: Neo4j fields -> Notion properties.
- [x] Task 2: Implement Notion API integration (AC: 1)
  - [x] Add `src/lib/notion/client.ts` with Notion API client.
  - [x] Support authentication via Notion integration token.
  - [x] Implement page creation and update operations.
- [x] Task 3: Implement design mirroring (AC: 1, 2)
  - [x] Add `src/lib/notion/design-sync.ts` to sync AgentDesign nodes.
  - [x] Generate human-readable summary from design code.
  - [x] Create how-to-run-it guide from evaluation metadata.
  - [x] Add trace_ref link to PostgreSQL evidence.
- [x] Task 4: Implement sync drift detection (AC: 3)
  - [x] Add `src/lib/notion/sync-monitor.ts` for drift detection.
  - [x] Compare Neo4j and Notion timestamps.
  - [x] Flag designs that are out of sync.
  - [x] Support bidirectional sync (Notion -> Neo4j for manual edits).
- [x] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [x] Test Notion pages created with correct structure.
  - [x] Test trace_ref links are valid and clickable.
  - [x] Test drift detection finds mismatched records.
  - [x] Test sync updates existing pages correctly.

## Dev Notes

- FR4 requires mirroring to Notion for human-readable registry.
- Notion API has rate limits - implement backoff and retry.
- Page templates should be consistent and professional.
- The "how-to-run-it" guide is critical for usability.
- Consider using Notion's database API for structured queries.

### Project Structure Notes

- Create `src/lib/notion/` directory for Notion integration.
- Notion API requires integration token (environment variable).
- Sync can be triggered on promotion or run periodically.

### References

- Notion API docs: https://developers.notion.com/
- Neo4j AgentDesign nodes: Story 2.4
- PostgreSQL trace_ref: Story 1.6
- FR4: Notion mirroring: `epics.md:26`
- Epic 2 context: `_bmad-output/planning-artifacts/epics.md:321`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.6 (trace_ref), Story 2.4 (Promotion)
- Notion API requires valid integration token
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [x] Notion page structure designed
- [x] Notion API integration implemented
- [x] Design mirroring working
- [x] Sync drift detection functional
- [x] All tests passing

### File List

- `src/lib/notion/client.ts` - Notion API client
- `src/lib/notion/client.test.ts` - Client tests
- `src/lib/notion/design-sync.ts` - Design synchronization
- `src/lib/notion/design-sync.test.ts` - Sync tests
- `src/lib/notion/sync-monitor.ts` - Drift detection
- `src/lib/notion/sync-monitor.test.ts` - Monitor tests
- `src/lib/notion/templates.ts` - Page templates
- `src/lib/notion/templates.test.ts` - Template tests
- `src/lib/notion/index.ts` - Module exports
