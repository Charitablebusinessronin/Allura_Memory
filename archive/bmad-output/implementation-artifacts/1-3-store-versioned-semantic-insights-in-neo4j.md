# Story 1.3: store-versioned-semantic-insights-in-neo4j

Status: done

## Story

As an AI engineering team,
I want promoted insights stored as versioned graph knowledge,
so that agents can reason about current truth and historical truth.

## Acceptance Criteria

1. Given a promotable insight is approved, when it is written to Neo4j, then it is stored as a versioned Insight node.
2. Given versioned insights exist, when a new version is created, then supersession relationships preserve previous versions rather than mutating them in place.
3. Given an insight has multiple versions, when querying for current truth, then the system returns the latest non-superseded version.

## Tasks / Subtasks

- [x] Task 1: Design Neo4j Steel Frame schema for Insights (AC: 1, 2)
  - [x] Define `Insight` node labels and properties (id, version, content, confidence, created_at, group_id).
  - [x] Design version relationships: `[:VERSION_OF]`, `[:SUPERSEDES]`, `[:DEPRECATED]`, `[:REVERTED]`.
  - [x] Create Cypher schema definitions in `src/lib/neo4j/schema/insights.cypher`.
- [x] Task 2: Implement Neo4j connection layer (AC: 1)
  - [x] Add `src/lib/neo4j/connection.ts` with singleton driver pattern (similar to PostgreSQL).
  - [x] Configure connection from environment variables: `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`.
  - [x] Add connection pooling and error handling.
- [x] Task 3: Implement versioned insight insertion (AC: 1, 2)
  - [x] Add `src/lib/neo4j/queries/insert-insight.ts` with typed functions.
  - [x] Support creating new insights with auto-incrementing versions.
  - [x] Support creating supersession relationships when promoting new versions.
  - [x] Ensure immutability: never update existing nodes, only create new versions.
- [x] Task 4: Implement insight retrieval with version handling (AC: 3)
  - [x] Add query to get latest version of an insight by `insight_id`.
  - [x] Add query to get full version history for an insight.
  - [x] Filter out superseded/deprecated versions when querying for "current" truth.
- [x] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [x] Test insight creation with versioning.
  - [x] Test supersession relationships are created correctly.
  - [x] Test retrieval returns correct latest version.
  - [x] Test immutability: old versions unchanged after new version created.

## Dev Notes

- This is the first Neo4j story. The Steel Frame model requires careful schema design.
- Neo4j is a graph database - think in nodes and relationships, not tables.
- Versioning is critical: never mutate existing insights, always create new versions with relationships.
- The `trace_ref` field will link back to PostgreSQL evidence (Story 1.6).
- Consider using Neo4j's built-in `datetime()` for timestamps.
- Constraints and indexes should be defined in the schema Cypher file.

### Project Structure Notes

- Create `src/lib/neo4j/` directory structure similar to `src/lib/postgres/`.
- Follow the same patterns: connection singleton, typed queries, comprehensive tests.
- Schema files should be in Cypher format (`.cypher` extension).

### References

- Neo4j Python driver docs: https://neo4j.com/docs/python-manual/current/
- Steel Frame model: `_bmad-output/implementation-artifacts/tech-spec-unified-knowledge-system-core-schema-steel-frame.md`
- Epic 1 context: `_bmad-output/planning-artifacts/epics.md:199`
- Insight versioning requirements: `epics.md:210`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.1 (for trace_ref linking)
- Neo4j container: `knowledge-neo4j`
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [ ] Neo4j Steel Frame schema designed for Insights
- [ ] Neo4j connection layer implemented
- [ ] Versioned insight insertion working
- [ ] Insight retrieval with version handling functional
- [ ] All tests passing

### File List

- `src/lib/neo4j/connection.ts` - Neo4j driver singleton
- `src/lib/neo4j/connection.test.ts` - Connection tests
- `src/lib/neo4j/schema/insights.cypher` - Insight node schema
- `src/lib/neo4j/queries/insert-insight.ts` - Insight insertion functions
- `src/lib/neo4j/queries/insert-insight.test.ts` - Insertion tests
- `src/lib/neo4j/queries/get-insight.ts` - Insight retrieval functions
- `src/lib/neo4j/queries/get-insight.test.ts` - Retrieval tests
