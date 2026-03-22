# Story 4.6: mirror-high-confidence-insights-to-notion

Status: backlog

## Story

As a project manager,
I want the system to automatically create Notion pages for winning insights,
so that we have a human-readable audit trail of the system's learning.

## Acceptance Criteria

1. Given an insight reaches a confidence score of 0.7 or higher and required approval, when the mirroring process triggers, then it creates a structured page in the Notion knowledge base.
2. Given a Notion page is created, when viewing it, then it includes the `trace_ref` pointing back to the source evidence in PostgreSQL.
3. Given mirroring completes, when checking sync status, then the system tracks which insights have been mirrored and their Notion page URLs.

## Tasks / Subtasks

- [ ] Task 1: Design Notion page template for insights (AC: 1)
  - [ ] Define page structure: title, confidence, description, evidence, usage guide.
  - [ ] Design database properties for insight registry.
  - [ ] Support rich content: code blocks, tables, callouts.
- [ ] Task 2: Implement insight mirroring (AC: 1)
  - [ ] Add `src/lib/sync/insight-mirror.ts` for Notion page creation.
  - [ ] Query Neo4j for high-confidence approved insights.
  - [ ] Generate human-readable content from insight data.
  - [ ] Create Notion pages via API.
- [ ] Task 3: Implement trace_ref linking (AC: 2)
  - [ ] Extract trace_ref from insight metadata.
  - [ ] Format as clickable link to PostgreSQL evidence.
  - [ ] Include context: event IDs, timestamps, agent info.
- [ ] Task 4: Implement sync tracking (AC: 3)
  - [ ] Add `src/lib/sync/sync-state.ts` for tracking mirrored insights.
  - [ ] Store Notion page URLs in Neo4j (back-reference).
  - [ ] Track sync timestamps for drift detection.
  - [ ] Support re-sync on insight updates.
- [ ] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [ ] Test pages created with correct structure.
  - [ ] Test trace_ref links are valid.
  - [ ] Test sync state tracked correctly.
  - [ ] Test re-sync updates existing pages.

## Dev Notes

- This is similar to Story 2.5 but specifically for insights (not just AgentDesigns).
- Confidence threshold of 0.7 aligns with FR4.
- Pages should be professional and useful for humans.
- Sync tracking enables drift detection (Story 4.5).

### Project Structure Notes

- Extend `src/lib/sync/` with insight mirroring.
- Reuse Notion client from Story 2.5.
- Sync state can be stored in Neo4j or PostgreSQL.

### References

- Notion integration: Story 2.5
- Neo4j insights: Story 1.3
- FR4: Confidence threshold: `epics.md:26`
- Epic 4 context: `_bmad-output/planning-artifacts/epics.md:485`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.3 (Neo4j), Story 1.6 (trace_ref), Story 2.5 (Notion)
- Neo4j container: `knowledge-neo4j`
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [ ] Notion page template designed
- [ ] Insight mirroring implemented
- [ ] trace_ref linking working
- [ ] Sync tracking functional
- [ ] All tests passing

### File List

- `src/lib/sync/insight-mirror.ts` - Insight mirroring
- `src/lib/sync/insight-mirror.test.ts` - Mirror tests
- `src/lib/sync/sync-state.ts` - Sync tracking
- `src/lib/sync/sync-state.test.ts` - State tests
- `config/notion-templates/insight.json` - Page template
