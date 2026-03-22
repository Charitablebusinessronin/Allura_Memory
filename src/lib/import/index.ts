/**
 * Import Pipeline Module
 * 
 * ETL pipeline for orchestrating data flows from PostgreSQL to Neo4j.
 * 
 * @module lib/import
 */

// Types
export type * from './types'

// Extractor
export { PostgresExtractor, createExtractor } from './extractor'
export type { ExtractorConfig, PostgresClient } from './extractor'

// Orchestrator
export { PipelineOrchestrator, createOrchestrator } from './orchestrator'

// Observability
export {
  PipelineLogger,
  MetricsCollector,
  AlertManager,
  createObservability,
} from './observability'
export type { Observability } from './observability'

// Semantic Mapper
export { SemanticMapper, createMapper } from './mapper'
export type {
  CanonicalNodeLabel,
  CanonicalRelationshipType,
  Severity,
  EventTypeMapping,
  OutcomeTypeMapping,
  RelationshipMapping,
  PropertyMapping,
  MappingValidationError,
  MappingResult,
} from './mapper'

// Neo4j Loader
export { Neo4jLoader, createLoader } from './neo4j-loader'
export type {
  Neo4jClient,
  Neo4jSession,
  LoaderConfig,
} from './neo4j-loader'

// Mapping Validator
export { MappingValidator, createValidator } from './validator'
export type {
  ValidationSeverity,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationStats,
  ValidationRules,
} from './validator'

// Default export - orchestrator factory
export { createOrchestrator as default } from './orchestrator'