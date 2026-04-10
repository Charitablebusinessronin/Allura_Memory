// Neo4j Indexes for Allura Memory v1
// Canonical memory search optimization
// Reference: docs/allura/BLUEPRINT.md

// ============================================================================
// MEMORY NODE INDEXES
// ============================================================================

// Unique constraint on memory ID
CREATE CONSTRAINT memory_id_unique IF NOT EXISTS
FOR (m:Memory)
REQUIRE m.id IS UNIQUE;

// Index for group_id queries (tenant isolation)
CREATE INDEX memory_group_id_idx IF NOT EXISTS
FOR (m:Memory)
ON (m.group_id);

// Index for user_id queries
CREATE INDEX memory_user_id_idx IF NOT EXISTS
FOR (m:Memory)
ON (m.user_id);

// Index for created_at queries (sorting)
CREATE INDEX memory_created_at_idx IF NOT EXISTS
FOR (m:Memory)
ON (m.created_at);

// Index for deprecated queries (filter active memories)
CREATE INDEX memory_deprecated_idx IF NOT EXISTS
FOR (m:Memory)
ON (m.deprecated);

// Composite index for common queries
CREATE INDEX memory_group_user_idx IF NOT EXISTS
FOR (m:Memory)
ON (m.group_id, m.user_id, m.deprecated);

// ============================================================================
// FULL-TEXT SEARCH INDEX
// ============================================================================

// Full-text search on memory content
// Usage: CALL db.index.fulltext.queryNodes('memory_search_index', 'query')
CREATE FULLTEXT INDEX memory_search_index IF NOT EXISTS
FOR (m:Memory) ON EACH [m.content, m.summary, m.title];

// ============================================================================
// SUPERSEDES RELATIONSHIP INDEXES
// ============================================================================

// Index for finding deprecated memories
CREATE INDEX memory_superseded_idx IF NOT EXISTS
FOR (m:Memory)
ON (m.deprecated);

// Index for SUPERSEDES relationships
CREATE INDEX relationship_supersedes_idx IF NOT EXISTS
FOR ()-[r:SUPERSEDES]-()
ON (r.created_at);

// ============================================================================
// USAGE TRACKING INDEXES
// ============================================================================

// Index for usage_count queries (popular memories)
CREATE INDEX memory_usage_count_idx IF NOT EXISTS
FOR (m:Memory)
ON (m.usage_count);

// ============================================================================
// VERIFICATION QUERIES
// ============================================================================

// Verify all indexes exist
// Run this after creating indexes:
//
// SHOW INDEXES
// WHERE name IN [
//   'memory_id_unique',
//   'memory_group_id_idx',
//   'memory_user_id_idx',
//   'memory_created_at_idx',
//   'memory_deprecated_idx',
//   'memory_group_user_idx',
//   'memory_search_index',
//   'memory_superseded_idx',
//   'relationship_supersedes_idx',
//   'memory_usage_count_idx'
// ];

// ============================================================================
// SAMPLE QUERIES
// ============================================================================

// Search memories by content
// CALL db.index.fulltext.queryNodes('memory_search_index', 'dark mode')
// YIELD node AS m, score
// WHERE m.group_id = 'allura-myproject' AND NOT (m)<-[:SUPERSEDES]-()
// RETURN m.id, m.content, m.score, score AS relevance
// ORDER BY relevance DESC, m.score DESC
// LIMIT 10;

// Get all memories for a user
// MATCH (m:Memory)
// WHERE m.group_id = 'allura-myproject'
//   AND m.user_id = 'user-1'
//   AND NOT (m)<-[:SUPERSEDES]-()
// RETURN m.id, m.content, m.created_at
// ORDER BY m.created_at DESC
// LIMIT 50;

// Get memory by ID
// MATCH (m:Memory)
// WHERE m.id = 'memory-uuid'
//   AND m.group_id = 'allura-myproject'
//   AND NOT (m)<-[:SUPERSEDES]-()
// RETURN m;

// Soft delete (mark as deprecated)
// MATCH (m:Memory)
// WHERE m.id = 'memory-uuid'
//   AND m.group_id = 'allura-myproject'
// SET m.deprecated = true,
//     m.deleted_at = datetime()
// RETURN m;

// Create new version with SUPERSEDES
// MATCH (old:Memory {id: 'old-memory-id'})
// CREATE (new:Memory {
//   id: 'new-memory-id',
//   group_id: old.group_id,
//   user_id: old.user_id,
//   content: 'updated content',
//   score: 0.95,
//   created_at: datetime(),
//   deprecated: false
// })
// CREATE (new)-[:SUPERSEDES]->(old)
// SET old.deprecated = true
// RETURN new;