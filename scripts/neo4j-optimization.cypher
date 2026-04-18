// Neo4j Optimization for Allura Brain — DDL ONLY
// Idempotent index and constraint creation for production init
// Data mutation queries moved to scripts/neo4j-data-fixes.cypher

// ============================================================================
// Agent Constraints and Indexes
// ============================================================================

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

// ============================================================================
// InsightHead Indexes
// ============================================================================

// Composite index on InsightHead for (insight_id, group_id)
// Every insight operation starts with InsightHead lookup by these two properties:
//   insert-insight.ts:229   — existence check before create
//   insert-insight.ts:331   — version creation head lookup
//   insert-insight.ts:412   — deprecation head lookup
//   insert-insight.ts:487   — revert head lookup
//   get-insight.ts:204      — getCurrentInsight
//   get-insight.ts:280      — getInsightHistory
//   get-insight.ts:363-385  — listInsights count + data queries
//   get-dual-context.ts:196  — dual-context per-group queries
//   group-governance.ts:159  — governance stats
// Without this index, all InsightHead traversals fall back to AllNodesScan.
CREATE INDEX insight_head_insight_id_group_id_idx IF NOT EXISTS
FOR (h:InsightHead)
ON (h.insight_id, h.group_id);

// Index on InsightHead.id for direct-ID lookups
// Used in insert-insight.ts:261 (MERGE on InsightHead with group_id)
// and get-insight.ts:206 (MATCH Insight by h.current_id)
// Redundant with composite above for (insight_id, group_id) queries,
// but provides a dedicated index for the planner when queries filter
// only on h.id (rare but possible in admin/debug paths).
CREATE INDEX insight_head_id_idx IF NOT EXISTS
FOR (h:InsightHead)
ON (h.id);

// ============================================================================
// AgentGroup Indexes
// ============================================================================

// Index on AgentGroup.group_id for tenant-isolated lookups
// Used in agent-nodes.ts:554 — existence check before create
// Used in agent-nodes.ts:607 — linkAgentToGroup resolution
// Low cardinality (one node per tenant) but prevents AllNodesScan
// on the existence check which runs before every agent group creation.
CREATE INDEX agent_group_group_id_idx IF NOT EXISTS
FOR (g:AgentGroup)
ON (g.group_id);

// ============================================================================
// Full-Text Search Index
// ============================================================================

CREATE FULLTEXT INDEX agentSearch IF NOT EXISTS
FOR (a:Agent) ON EACH [a.name, a.description];

// ============================================================================
// Verification Query (run manually after init):
//
// SHOW INDEXES
// WHERE name IN [
//   'agent_id_unique',
//   'agent_name_idx',
//   'agent_platform_idx',
//   'agent_status_idx',
//   'agent_platform_status_idx',
//   'insight_head_insight_id_group_id_idx',
//   'insight_head_id_idx',
//   'agent_group_group_id_idx',
//   'agentSearch'
// ];