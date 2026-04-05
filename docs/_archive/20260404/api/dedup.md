# dedup

> API documentation for `dedup` module.

## Functions

### `createDetector`

Create a duplicate detector

---

### `createDetectorForTypes`

Create a duplicate detector for specific entity types

---

### `threshold`

Compute similarity between two entities

---

### `threshold`

Batch compute similarities

---

### `createMockEmbeddingManager`

Create an embedding manager with mock generator (for testing)

---

### `createOpenAIEmbeddingManager`

Create an embedding manager with OpenAI generator

---

### `createEmbeddingManager`

Create an embedding manager with custom generator

---

### `incomingCount`

Merge with Neo4j

---

### `createMerger`

Create a merge manager

---

### `createMergerWithStrategy`

Create a merge manager for specific strategy

---

### `normalizeString`

Normalize a string for comparison

---

### `expandAbbreviations`

Expand abbreviations in text

---

### `tokenize`

Tokenize text into words

---

### `getNgrams`

Get n-grams from text

---

### `levenshteinDistance`

Compute Levenshtein distance between two strings

---

### `levenshteinSimilarity`

Compute Levenshtein similarity (0-1)

---

### `jaroSimilarity`

Compute Jaro similarity between two strings

---

### `jaroWinklerSimilarity`

Compute Jaro-Winkler similarity (0-1)

---

### `createLevenshteinManager`

Create a text similarity manager with Levenshtein algorithm

---

### `createJaroWinklerManager`

Create a text similarity manager with Jaro-Winkler algorithm

---

### `createHybridTextManager`

Create a text similarity manager with hybrid algorithm

---

### `createTextManager`

Create a text similarity manager

---

## Classes

### `DuplicateDetector`

Duplicate Detector  Identifies potential duplicate entities using hybrid similarity scoring.

---

### `EmbeddingCache`

In-memory embedding cache

---

### `MockEmbeddingGenerator`

Mock embedding generator for testing

---

### `OpenAIEmbeddingGenerator`

OpenAI embedding generator

---

### `EmbeddingManager`

Embedding Manager  Manages embedding generation, caching, and similarity computation.

---

### `MergeManager`

Merge Manager  Handles canonical merge operations with audit trail support.

---

### `TextSimilarityManager`

Text Similarity Manager  Computes text similarity using various algorithms.

---

## Interfaces

### `EmbeddingGenerator`

Embedding generator interface

---

### `Neo4jClient`

Neo4j client interface for merge operations

---

### `DedupEntity`

Base entity for deduplication

---

### `SimilarityResult`

Similarity result between two entities

---

### `DuplicatePair`

Duplicate pair detected by the system

---

### `MergeRequest`

Merge request

---

### `MergeStrategy`

Merge strategy

---

### `MergeResult`

Merge result

---

### `MergeAuditEntry`

Audit trail entry for merge operations

---

### `DetectionConfig`

Detection configuration

---

### `DetectionResult`

Detection result

---

### `CachedEmbedding`

Cached embedding

---

### `EmbeddingOptions`

Embedding generation options

---

### `TextSimilarityOptions`

Text similarity options

---

### `TextSimilarityResult`

Text similarity result

---

## Type Definitions

### `for`

Build text for embedding

---

### `EntityType`

Entity types that can be deduplicated

---

### `EmbeddingVector`

Embedding vector

---
