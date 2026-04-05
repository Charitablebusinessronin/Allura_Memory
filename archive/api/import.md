# import

> API documentation for `import` module.

## Functions

### `createExtractor`

Create a PostgreSQL extractor

---

### `agentId`

Create a relationship from mapping

---

### `createMapper`

Create a semantic mapper

---

### `createLoader`

Create a Neo4j loader

---

### `createObservability`

Create observability components

---

### `createOrchestrator`

Create a pipeline orchestrator

---

### `createValidator`

Create a mapping validator

---

## Classes

### `PostgresExtractor`

PostgreSQL Event-Outcome Extractor  Extracts Event -> Outcome pairs from PostgreSQL for ETL pipeline. Supports incremental extraction, pagination, and watermarking.

---

### `SemanticMapper`

Semantic Mapper  Transforms raw Event-Outcome pairs into normalized Neo4j graph structures. Supports configurable mappings, property transformations, and relationship generation.

---

### `Neo4jLoader`

Neo4j Loader  Loads normalized events and outcomes into Neo4j knowledge graph. Uses MERGE for idempotency (create if not exists, match if exists).

---

### `PipelineLogger`

Pipeline Logger  Provides structured logging for pipeline events.

---

### `MetricsCollector`

Metrics Collector  Collects and aggregates pipeline metrics.

---

### `AlertManager`

Alert Manager  Monitors pipeline metrics and triggers alerts when thresholds are exceeded.

---

### `PipelineOrchestrator`

Pipeline Orchestrator  Coordinates the ETL pipeline stages: 1. Extract: Read Event-Outcome pairs from PostgreSQL 2. Transform: Normalize data for Neo4j 3. Load: Write to Neo4j knowledge graph  Features: - Stage coordination - Retry logic with exponential backoff - Checkpointing for resume capability - Observability (logging, metrics)

---

### `MappingValidator`

Mapping Validator  Validates normalized events, outcomes, and relationships before loading into Neo4j. Ensures data quality and schema compliance.

---

## Interfaces

### `PostgresClient`

PostgreSQL client interface This will be replaced with actual Prisma/raw SQL connection

---

### `ExtractorConfig`

Extractor configuration

---

### `EventTypeMapping`

Mapping configuration for an event type

---

### `OutcomeTypeMapping`

Mapping configuration for an outcome type

---

### `RelationshipMapping`

Relationship mapping definition

---

### `PropertyMapping`

Property mapping configuration

---

### `MappingValidationError`

Validation error

---

### `MappingResult`

Mapping result

---

### `Neo4jClient`

Neo4j driver interface This will be replaced with actual Neo4j driver connection

---

### `Neo4jSession`

Neo4j session interface

---

### `LoaderConfig`

Loader configuration

---

### `Observability`

Observability components

---

### `EventRecord`

Event record from PostgreSQL Represents an execution trace event

---

### `OutcomeRecord`

Outcome record from PostgreSQL Represents a result or finding from an event

---

### `EventOutcomePair`

Event-Outcome pair for extraction This is the primary unit of data moved through the pipeline

---

### `ExtractionOptions`

Extraction options

---

### `ExtractionResult`

Extraction result

---

### `ExtractionError`

Extraction error

---

### `ExtractionState`

Extraction state / watermark Tracks progress for incremental extraction

---

### `TransformInput`

Transformation input (from extraction)

---

### `NormalizedEvent`

Normalized event for Neo4j

---

### `NormalizedOutcome`

Normalized outcome for Neo4j

---

### `NormalizedRelationship`

Normalized relationship between event and outcome

---

### `TransformResult`

Transformation result

---

### `TransformError`

Transformation error

---

### `LoadInput`

Load input (from transformation)

---

### `LoadResult`

Load result

---

### `LoadError`

Load error

---

### `PipelineConfig`

Pipeline configuration

---

### `PipelineRun`

Pipeline run state

---

### `StageState`

Stage state

---

### `StageError`

Stage error

---

### `PipelineCheckpoint`

Pipeline checkpoint for resume capability

---

### `PipelineResult`

Pipeline result

---

### `PipelineError`

Pipeline error

---

### `PipelineLogEvent`

Pipeline event for logging

---

### `PipelineMetrics`

Pipeline metrics

---

### `StageMetrics`

Stage metrics

---

### `AlertConfig`

Alert configuration

---

### `AlertEvent`

Alert event

---

### `ValidationResult`

Validation result

---

### `ValidationError`

Validation error

---

### `ValidationWarning`

Validation warning

---

### `ValidationStats`

Validation statistics

---

### `ValidationRules`

Validation rules configuration

---

## Type Definitions

### `CanonicalNodeLabel`

Canonical node labels in the Steel Frame model

---

### `CanonicalRelationshipType`

Canonical relationship types

---

### `Severity`

Severity levels

---

### `PipelineStage`

Pipeline stage names

---

### `PipelineStatus`

Pipeline status for a run

---

### `StageStatus`

Stage-level status

---

### `LogLevel`

Log level for pipeline events

---

### `AlertChannel`

Alert channel

---

### `ValidationSeverity`

Validation severity

---

### `format`

Validate a single event

---

### `format`

Validate a single outcome

---

### `string`

Validate type format

---
