/**
 * Neo4j Client Barrel Export
 *
 * Re-exports Neo4j query functions for use in API routes and application code.
 *
 * @example
 * import { searchInsights, getInsightById } from '@/lib/neo4j/client';
 *
 * const insights = await searchInsights("architecture", { group_id: "roninmemory" });
 */

// Connection utilities
export {
  getDriver,
  getSession,
  closeDriver,
  isDriverHealthy,
  verifyConnectivity,
  readTransaction,
  writeTransaction,
  getConnectionConfig,
  type Neo4jConnectionConfig,
  type ManagedTransaction,
} from "./connection";

// Insight queries
export {
  listInsights,
  getInsightVersion,
  getInsightHistory,
  searchInsights,
  getInsightById,
  type InsightQueryParams,
  type PaginatedInsights,
  type VersionHistoryEntry,
  type QueryError,
} from "./queries/get-insight";

// Insight mutations
export {
  createInsight,
  createInsightVersion,
  deprecateInsight,
  revertInsightVersion,
  type InsightRecord,
  type InsightStatus,
  type InsightSourceType,
  type InsightInsert,
  type InsightHeadRecord,
  type InsightValidationError,
  type InsightConflictError,
} from "./queries/insert-insight";

// Dual-context queries
export {
  getDualContextSemanticMemory,
  getMergedDualContextInsights,
  getDualContextWorkingMemory,
  isGlobalContext,
  validateCrossGroupAccess,
  searchDualContextInsights,
  GLOBAL_GROUP_ID,
  type ContextScope,
  type ScopedInsight,
  type DualInsightQueryParams,
  type DualContextSemanticResult,
  type DualInsightQueryError,
} from "./queries/get-dual-context";

// Schema operations
export {
  initializeSchema,
  healthCheck,
  isSchemaVersionApplied,
  recordSchemaVersion,
  applyInsightsSchema,
  type SchemaVersion,
} from "./schema";

// Agent memory operations
export {
  createAgentNode,
  getAgentNode,
  listAgentNodes,
  updateAgentNode,
  createAgentGroup,
  linkAgentToGroup,
  initializeDefaultAgents,
  verifyAgentNodes,
  type AgentNode,
  type AgentInsert,
  type AgentQueryParams,
  type AgentStatus,
  AgentValidationError,
  AgentConflictError,
  AgentQueryError,
} from "./agent-nodes";