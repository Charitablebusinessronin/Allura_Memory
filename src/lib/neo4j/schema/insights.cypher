// ============================================================================
// Insights Schema for Unified Knowledge System
// Story: 1.3 - Store Versioned Semantic Insights in Neo4j
// Design: Versioned insight nodes with supersession relationships
// ============================================================================

// ============================================================================
// Insight Node Labels and Properties
// ============================================================================
// Insight nodes store promoted knowledge extracted from raw traces
// Each version is immutable - new versions create new nodes with relationships
// 
// Properties:
//   - insight_id: Stable identifier across all versions (indexed)
//   - version: Auto-incrementing version number for this insight_id
//   - content: The actual insight text/knowledge
//   - confidence: Confidence score (0.0 to 1.0)
//   - group_id: Tenant isolation (matches PostgreSQL group_id)
//   - source_type: Where this insight came from (trace, manual, promotion)
//   - source_ref: Reference to source (e.g., trace ID, event ID)
//   - created_at: Creation timestamp
//   - created_by: Agent or system that created this insight
//   - status: active, deprecated, reverted
//   - metadata: Additional structured data (JSON string)
// ============================================================================

// Create Insight label with constraints
// Note: Neo4j doesn't support CHECK constraints - validation is in application code

// Unique constraint on id (surrogate key)
CREATE CONSTRAINT insight_id_unique IF NOT EXISTS
FOR (i:Insight) REQUIRE i.id IS UNIQUE;

// Index on insight_id for version lookups (one insight_id has many versions)
CREATE INDEX insight_insight_id_idx IF NOT EXISTS
FOR (i:Insight) ON (i.insight_id);

// Index on group_id for tenant isolation
CREATE INDEX insight_group_id_idx IF NOT EXISTS
FOR (i:Insight) ON (i.group_id);

// Index on (insight_id, version) for getting specific version
CREATE INDEX insight_id_version_idx IF NOT EXISTS
FOR (i:Insight) ON (i.insight_id, i.version);

// Index on (insight_id, status) for getting current active version
CREATE INDEX insight_id_status_idx IF NOT EXISTS
FOR (i:Insight) ON (i.insight_id, i.status);

// Index on created_at for time-based queries
CREATE INDEX insight_created_at_idx IF NOT EXISTS
FOR (i:Insight) ON (i.created_at);

// Index on status for filtering deprecated/reverted
CREATE INDEX insight_status_idx IF NOT EXISTS
FOR (i:Insight) ON (i.status);

// ============================================================================
// Version Relationships
// ============================================================================
// Relationships between insight versions to maintain history
// 
// VERSION_OF: Links all versions to a stable InsightHead node
//   (:Insight)-[:VERSION_OF]->(:InsightHead)
//   InsightHead has insight_id and tracks the latest version
//
// SUPERSEDES: Links a new version to the previous version
//   (:Insight)-[:SUPERSEDES]->(:Insight)
//   Created when a new version replaces an old one
//
// DEPRECATED: Marks a version as deprecated (not superseded, just invalid)
//   (:Insight)-[:DEPRECATED]->(:Insight)
//   Created when manual deprecation occurs
//
// REVERTED: Marks a version as reverted (rolled back)
//   (:Insight)-[:REVERTED]->(:Insight)
//   Created when rolling back to a previous version
//
// DERIVED_FROM: Links insight to its source evidence in PostgreSQL
//   (:Insight)-[:DERIVED_FROM]->(:Trace)
//   Note: Trace nodes are virtual - source_ref contains PostgreSQL IDs
// ============================================================================

// InsightHead node for tracking the current version of each insight
// This is the stable reference point for version lookups
CREATE CONSTRAINT insight_head_id_unique IF NOT EXISTS
FOR (h:InsightHead) REQUIRE h.insight_id IS UNIQUE;

CREATE INDEX insight_head_group_id_idx IF NOT EXISTS
FOR (h:InsightHead) ON (h.group_id);

CREATE INDEX insight_head_current_version_idx IF NOT EXISTS
FOR (h:InsightHead) ON (h.current_version);

// ============================================================================
// InsightHead Node Structure
// ============================================================================
// InsightHead tracks metadata about the insight across all versions:
//   - insight_id: Stable identifier (same for all versions)
//   - group_id: Tenant isolation
//   - current_version: The latest non-superseded version number
//   - current_id: The ID of the current active Insight node
//   - created_at: When the insight was first created
//   - updated_at: When the current version was created
// ============================================================================

// ============================================================================
// Evidence Reference Tracking
// ============================================================================
// Insights are derived from traces in PostgreSQL
// The source_ref field contains the PostgreSQL event ID or trace reference
// The DERIVED_FROM relationship is virtual - we use source_ref for linking
// ============================================================================

// Schema version tracking
CREATE CONSTRAINT schema_version_pk IF NOT EXISTS
FOR (v:SchemaVersion) REQUIRE v.version IS UNIQUE;

MERGE (v:SchemaVersion {version: '1.0.0-insights'})
ON CREATE SET v.applied_at = datetime(), v.description = 'Initial insight versioning schema'
ON MATCH SET v.updated_at = datetime();

// ============================================================================
// Example Queries
// ============================================================================
// 
// Create new insight (version 1):
//   CREATE (i:Insight {
//     id: randomUUID(),
//     insight_id: $insight_id,
//     version: 1,
//     content: $content,
//     confidence: $confidence,
//     group_id: $group_id,
//     source_type: $source_type,
//     source_ref: $source_ref,
//     created_at: datetime(),
//     created_by: $created_by,
//     status: 'active',
//     metadata: $metadata
//   })
//   WITH i
//   MERGE (h:InsightHead {insight_id: $insight_id})
//   ON CREATE SET h.group_id = $group_id, h.created_at = datetime()
//   SET h.current_version = 1, h.current_id = i.id, h.updated_at = datetime()
//   CREATE (i)-[:VERSION_OF]->(h)
//   RETURN i
//
// Create new version (supersede previous):
//   MATCH (h:InsightHead {insight_id: $insight_id})
//   MATCH (prev:Insight {id: h.current_id})
//   CREATE (new:Insight {
//     id: randomUUID(),
//     insight_id: $insight_id,
//     version: h.current_version + 1,
//     content: $content,
//     confidence: $confidence,
//     group_id: $group_id,
//     source_type: $source_type,
//     source_ref: $source_ref,
//     created_at: datetime(),
//     created_by: $created_by,
//     status: 'active',
//     metadata: $metadata
//   })
//   CREATE (new)-[:VERSION_OF]->(h)
//   CREATE (new)-[:SUPERSEDES]->(prev)
//   SET h.current_version = new.version, h.current_id = new.id, h.updated_at = datetime()
//   SET prev.status = 'superseded'
//   RETURN new
//
// Get current version:
//   MATCH (h:InsightHead {insight_id: $insight_id, group_id: $group_id})
//   MATCH (i:Insight {id: h.current_id})
//   RETURN i
//
// Get version history:
//   MATCH (h:InsightHead {insight_id: $insight_id})
//   MATCH (i:Insight)-[:VERSION_OF]->(h)
//   OPTIONAL MATCH (i)-[s:SUPERSEDES]->(prev:Insight)
//   RETURN i, prev
//   ORDER BY i.version DESC
//
// Get all active insights for a group:
//   MATCH (h:InsightHead {group_id: $group_id})
//   MATCH (i:Insight {id: h.current_id, status: 'active'})
//   RETURN i
//   ORDER BY i.created_at DESC
// ============================================================================