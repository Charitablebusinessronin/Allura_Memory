// Neo4j Optimization for Allura Brain
// Fixes data quality issues and adds performance indexes

// ============================================
// Fix NULL agent_id values
// ============================================

// Update agents with NULL agent_id using name
MATCH (a:Agent)
WHERE a.agent_id IS NULL AND a.name IS NOT NULL
SET a.agent_id = toLower(replace(a.name, " ", "-"))
RETURN count(a) as fixed_count;

// ============================================
// Create Constraints and Indexes
// ============================================

// Unique constraint on agent_id
CREATE CONSTRAINT agent_id_unique IF NOT EXISTS
FOR (a:Agent)
REQUIRE a.agent_id IS UNIQUE;

// Index for agent lookups
CREATE INDEX agent_name_idx IF NOT EXISTS
FOR (a:Agent)
ON (a.name);

// Index for platform queries
CREATE INDEX agent_platform_idx IF NOT EXISTS
FOR (a:Agent)
ON (a.platform);

// Index for status queries
CREATE INDEX agent_status_idx IF NOT EXISTS
FOR (a:Agent)
ON (a.status);

// Composite index for common queries
CREATE INDEX agent_platform_status_idx IF NOT EXISTS
FOR (a:Agent)
ON (a.platform, a.status);

// ============================================
// Create Full-Text Search Index
// ============================================

CREATE FULLTEXT INDEX agentSearch IF NOT EXISTS
FOR (a:Agent) ON EACH [a.name, a.description];

// ============================================
// Optimized Query Examples
// ============================================

// Fast agent lookup by ID
// MATCH (a:Agent {agent_id: 'memory-orchestrator'}) RETURN a;

// Fast agent search by name
// MATCH (a:Agent) WHERE a.name CONTAINS 'Memory' RETURN a;

// Full-text search
// CALL db.index.fulltext.queryNodes('agentSearch', 'orchestrator') YIELD node RETURN node;

// Get agent with relationships
// MATCH (a:Agent {agent_id: 'memory-orchestrator'})-[r]-(related)
// RETURN a, r, related;

// ============================================
// Data Quality Check
// ============================================

// Count agents with missing fields
MATCH (a:Agent)
WHERE a.agent_id IS NULL OR a.name IS NULL
RETURN count(a) as incomplete_agents;

// List all agents with complete data
MATCH (a:Agent)
WHERE a.agent_id IS NOT NULL AND a.name IS NOT NULL
RETURN a.agent_id, a.name, a.platform, a.status
ORDER BY a.name;
