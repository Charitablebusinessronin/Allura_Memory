# Story 4.3: resolve-entity-duplicates-and-graph-chaos

Status: backlog

## Story

As a system owner,
I want an automated process to identify and reconcile duplicate nodes representing the same entity,
so that the graph maintains structural integrity and prevents redundant paths.

## Acceptance Criteria

1. Given the lifting pipeline identifies new nodes, when potential duplicates are found using embedding similarity and Levenshtein distance, then the system proposes or performs canonical merge operations with audit controls.
2. Given duplicates are detected, when merging, then existing relationships are updated to point to the canonical entity.
3. Given a merge occurs, when reviewing the audit trail, then the system preserves history of the merge decision and maintains data lineage.

## Tasks / Subtasks

- [ ] Task 1: Design duplicate detection algorithm (AC: 1)
  - [ ] Define similarity thresholds: embedding cosine similarity, Levenshtein distance.
  - [ ] Design detection strategy: pairwise comparison vs clustering.
  - [ ] Support different entity types: agents, insights, knowledge items.
- [ ] Task 2: Implement embedding-based similarity (AC: 1)
  - [ ] Add `src/lib/dedup/embeddings.ts` for text embedding generation.
  - [ ] Integrate with embedding model (OpenAI, local, etc.).
  - [ ] Compute cosine similarity between entity embeddings.
  - [ ] Cache embeddings for performance.
- [ ] Task 3: Implement text-based similarity (AC: 1)
  - [ ] Add `src/lib/dedup/text-similarity.ts` for string comparison.
  - [ ] Implement Levenshtein distance calculation.
  - [ ] Support name/title matching with fuzzy logic.
  - [ ] Handle abbreviations and synonyms.
- [ ] Task 4: Implement merge operations (AC: 2, 3)
  - [ ] Add `src/lib/dedup/merger.ts` for canonical merge.
  - [ ] Select canonical entity (oldest, most connected, etc.).
  - [ ] Update relationships to point to canonical entity.
  - [ ] Preserve merged entity data as metadata.
- [ ] Task 5: Add verification coverage (AC: 1, 2, 3)
  - [ ] Test duplicate detection finds actual duplicates.
  - [ ] Test similarity scores are accurate.
  - [ ] Test merge updates relationships correctly.
  - [ ] Test audit trail captures merge decisions.

## Dev Notes

- FR9 requires deduplication via embeddings and word-distance.
- Deduplication is critical for graph health - prevents fragmentation.
- Embeddings capture semantic similarity, text similarity captures typos.
- Merges should be reversible or at least auditable.
- Consider manual approval for high-confidence merges.

### Project Structure Notes

- Create `src/lib/dedup/` directory for deduplication logic.
- Embeddings may require external API calls (rate limiting needed).
- Merge operations use Neo4j Cypher for atomic updates.

### References

- FR9: Entity deduplication: `epics.md:36`
- Neo4j queries: Story 1.3
- Epic 4 context: `_bmad-output/planning-artifacts/epics.md:446`

## Dev Agent Record

### Agent Model Used

ollama-cloud/glm-5

### Debug Log References

- Depends on: Story 1.3 (Neo4j), Story 4.2 (Semantic Mapping)
- Neo4j container: `knowledge-neo4j`
- Status file: `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Completion Notes List

- [ ] Duplicate detection algorithm designed
- [ ] Embedding-based similarity implemented
- [ ] Text-based similarity working
- [ ] Merge operations functional
- [ ] All tests passing

### File List

- `src/lib/dedup/embeddings.ts` - Embedding generation
- `src/lib/dedup/embeddings.test.ts` - Embedding tests
- `src/lib/dedup/text-similarity.ts` - String similarity
- `src/lib/dedup/text-similarity.test.ts` - Similarity tests
- `src/lib/dedup/detector.ts` - Duplicate detection
- `src/lib/dedup/detector.test.ts` - Detector tests
- `src/lib/dedup/merger.ts` - Canonical merge
- `src/lib/dedup/merger.test.ts` - Merger tests
