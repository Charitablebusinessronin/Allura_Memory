# Story 4.2: perform-semantic-lifting-via-normalized-mapping

Status: backlog

## Story

As a knowledge architect,
I want heterogeneous trace data mapped into a standardized semantic schema,
so that the knowledge graph remains consistent across providers and workflows.

## Acceptance Criteria

1. Given raw trace data exists, when the mapping process transforms the input, then it produces standardized nodes and relationships.
2. Given mapping completes, when storing in Neo4j, then the output aligns with canonical Neo4j labels such as `KnowledgeItem`, `AIAgent`, and `Insight`.
3. Given heterogeneous sources, when mapping, then the system handles different event types and normalizes them to the common schema.

## Tasks / Subtasks

- [ ] Task 1: Design semantic mapping schema (AC: 1, 2)
  - [ ] Define canonical node labels: KnowledgeItem, AIAgent, Insight, Event, Outcome.
  - [ ] Define relationship types: DERIVED_FROM, CAUSED, LEADS_TO, PART_OF.
  - [ ] Design property mappings: PostgreSQL columns -> Neo4j properties.
- [ ] Task 2: Implement mapping rules engine (AC: 1, 3)
  - [ ] Add `src/lib/import/mapper.ts` with transformation logic.
  - [ ] Support event type-specific mappings.
  - [ ] Handle missing/null fields gracefully.
  - [ ] Support custom mappings for new event types.
- [ ] Task 3: Implement Neo4j node creation (AC: 2)
  - [ ] Add `src/lib/import/neo4j-loader.ts` for graph writes.
  - [ ] Create nodes with canonical labels and properties.
  - [ ] Create relationships between nodes.
  - [ ] Handle idempotency (don't duplicate nodes).
- [ ] Task 4: Implement validation and quality checks (AC: 1, 2)
  - [ ] Add `src/lib/import/validator.ts` for mapping validation.
  - [ ] Verify required properties are present.
  - [ ] Check relationship integrity.
  - [ ] Report mapping errors for manual review.
- [ ] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [ ] Test mapping produces correct node labels.
  - [ ] Test relationships are created correctly.
  - [ ] Test heterogeneous sources normalize correctly.
  - [ ] Test validation catches mapping errors.

## Dev Notes

- This is the "T" in ETL - transformation to semantic knowledge.
- The Steel Frame model defines the target schema.
- Mapping rules should be configurable (YAML/JSON) for flexibility.
- Validation ensures data quality before it enters the graph.

### Project Structure Notes

- Extend `src/lib/import/` with mapping and loading modules.
- Mapping rules can be in `config/mappings/` directory.
- Reuse Neo4j connection from Story 1.3.

### References

- Steel Frame model: `_bmad-output/implementation-artifacts/tech-spec-unified-knowledge-system-core-schema-steel-frame.md`
- Neo4j schema: Story 1.3
- Epic 4 context: `_bmad-output/planning-artifacts/epics.md:433`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.1 (PostgreSQL), Story 1.3 (Neo4j), Story 4.1 (Import Manager)
- PostgreSQL container: `knowledge-postgres`
- Neo4j container: `knowledge-neo4j`
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [ ] Semantic mapping schema designed
- [ ] Mapping rules engine implemented
- [ ] Neo4j node creation working
- [ ] Validation and quality checks functional
- [ ] All tests passing

### File List

- `src/lib/import/mapper.ts` - Semantic mapping engine
- `src/lib/import/mapper.test.ts` - Mapper tests
- `src/lib/import/neo4j-loader.ts` - Neo4j loading
- `src/lib/import/neo4j-loader.test.ts` - Loader tests
- `src/lib/import/validator.ts` - Mapping validation
- `src/lib/import/validator.test.ts` - Validator tests
- `config/mappings/default.yaml` - Default mapping rules
