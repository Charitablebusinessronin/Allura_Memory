/**
 * Memory Module
 * 
 * Unified memory system for AI agents with:
 * - Neo4j graph storage for insights and knowledge
 * - PostgreSQL trace storage for raw events
 * - Multi-tenant isolation via group_id
 */

// Types
export * from "./types";

// Operations
export { searchMemories, getMemoriesByType, searchAgents } from "./search";
export { storeMemory, promoteMemory, deprecateMemory, archiveMemory } from "./store";
export { getMemory, getCurrentMemory, getMemoryHistory, memoryExists } from "./get";

// Knowledge Promotion (HITL governance)
export {
  type KnowledgeInsight,
  type ApprovalQueueItem,
  type PromotionResult,
  queryApprovedInsights,
  queryKnowledgeHubBySourceId,
  promoteToNeo4j,
  linkInsightToAgent,
  updateNotionWithNeo4jId,
  updateApprovalQueueItem,
  logPromotionEvent,
  processApprovedInsights,
  promoteSingleInsight,
  validateInsightForPromotion,
} from "./knowledge-promotion";

// MCP Wrapper (Story 1.7)
export {
  memory,
  type Entity,
  type Relationship,
  type QueryResult,
  type SearchResult,
} from "./mcp-wrapper";

// Convenience re-exports
export {
  buildTopicKey,
  parseTopicKey,
  TOPIC_KEY_PREFIXES,
  RESERVED_GROUP_IDS,
  PROJECT_GROUP_IDS,
} from "./types";