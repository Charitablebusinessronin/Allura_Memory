/**
 * Memory MCP Wrapper
 * Story 1.7: TypeScript wrapper for MCP Docker tools
 * 
 * Provides a simplified TypeScript interface with automatic group_id injection
 * and tenant isolation enforcement using RK-01 error code.
 */

import { validateTenantGroupId, TENANT_ERROR_CODE } from "../validation/tenant-group-id";
import { GroupIdValidationError } from "../validation/group-id";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Memory entity in the knowledge graph
 */
export interface Entity {
  name: string;
  type: string;
  group_id: string;
  observations?: string[];
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Memory relationship in the knowledge graph
 */
export interface Relationship {
  source: string;
  target: string;
  relationType: string;
  group_id: string;
  props?: Record<string, unknown>;
}

/**
 * Result from a Cypher query
 */
export interface QueryResult {
  records: Record<string, unknown>[];
  query_time_ms: number;
}

/**
 * Search result from memory queries
 */
export interface SearchResult {
  name: string;
  type: string;
  group_id: string;
  observations?: string[];
  metadata?: Record<string, unknown>;
}

// ============================================================================
// MCP TOOL EXECUTOR
// ============================================================================

/**
 * Call an MCP Docker tool
 * 
 * In agent context, MCP tools are available as global functions.
 * This helper wraps the call pattern consistently.
 */
async function callMcpTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown>
): Promise<T> {
  const globalScope = globalThis as any;
  
  // Try direct global function first
  const globalFuncName = `MCP_DOCKER_${toolName}`;
  if (typeof globalScope[globalFuncName] === 'function') {
    return await globalScope[globalFuncName](args);
  }
  
  // Fallback to mcp-exec
  if (typeof globalScope.MCP_DOCKER_mcp_exec === 'function') {
    return await globalScope.MCP_DOCKER_mcp_exec({ name: toolName, arguments: args });
  }
  
  throw new Error(
    `MCP tool ${toolName} not available. Ensure MCP_DOCKER tools are loaded in the runtime context.`
  );
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Create a tenant isolation error with RK-01 error code
 */
function createTenantError(groupId: unknown, operation: string): GroupIdValidationError {
  const validWorkspaces = [
    "allura-faith-meats",
    "allura-creative",
    "allura-personal",
    "allura-nonprofit",
    "allura-audits",
    "allura-haccp",
    "allura-default",
  ];

  return new GroupIdValidationError(
    `[${TENANT_ERROR_CODE}] Tenant isolation violation during ${operation}. ` +
    `Invalid group_id: "${groupId}". ` +
    `Tenant group_ids must match pattern: allura-{org}. ` +
    `Valid workspaces: ${validWorkspaces.join(", ")}. ` +
    `Example: allura-faith-meats`
  );
}

/**
 * Wrap a function with group_id validation
 */
function withTenantValidation<T>(
  groupId: unknown,
  operation: string,
  fn: (validatedGroupId: string) => Promise<T>
): Promise<T> {
  try {
    const validated = validateTenantGroupId(groupId);
    return fn(validated);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      // Re-throw with RK-01 error code and operation context
      throw createTenantError(groupId, operation);
    }
    throw error;
  }
}

// ============================================================================
// MEMORY WRAPPER
// ============================================================================

/**
 * Memory wrapper for MCP Docker tools
 * 
 * Usage:
 * ```typescript
 * import { memory } from "@/lib/memory/mcp-wrapper";
 * 
 * // Create an entity with automatic group_id injection
 * const entity = await memory.createEntity("Insight", {
 *   name: "My Insight",
 *   description: "Important knowledge"
 * }, "allura-faith-meats");
 * 
 * // Create a relationship
 * await memory.createRelationship(
 *   "EntityA",
 *   "EntityB",
 *   "RELATES_TO",
 *   { confidence: 0.95 },
 *   "allura-faith-meats"
 * );
 * ```
 */
export const memory = {
  /**
   * Create an entity in the knowledge graph
   * 
   * @param type - Entity type (e.g., "Insight", "Decision", "Pattern")
   * @param data - Entity data (group_id will be automatically added)
   * @param groupId - Tenant group ID (must match allura-{org} pattern)
   * @returns Created entity
   * @throws GroupIdValidationError with RK-01 code if group_id is invalid
   */
  async createEntity(
    type: string,
    data: Record<string, unknown>,
    groupId: string
  ): Promise<Entity> {
    return withTenantError(groupId, "createEntity", async () => {
      const validatedGroupId = validateTenantGroupId(groupId);
      
      // Entity with forced group_id
      const entity: Entity = {
        name: data.name as string,
        type,
        group_id: validatedGroupId,
        ...data,
        created_at: data.created_at || new Date().toISOString(),
      };

      // Call MCP Docker tool
      const result = await callMcpTool<{ entities: Entity[] }>("create_entities", {
        entities: [entity],
      });

      // Return the created entity
      const created = result.entities[0];
      return {
        name: created.name,
        type: created.type,
        group_id: validatedGroupId,
        observations: created.observations || [],
        created_at: created.created_at,
        metadata: created as Record<string, unknown>,
      };
    });
  },

  /**
   * Create a relationship between entities
   * 
   * @param from - Source entity name
   * @param to - Target entity name
   * @param type - Relationship type (e.g., "RELATES_TO", "SUPERSEDES")
   * @param props - Optional relationship properties
   * @param groupId - Tenant group ID (must match allura-{org} pattern)
   * @returns Created relationship
   * @throws GroupIdValidationError with RK-01 code if group_id is invalid
   */
  async createRelationship(
    from: string,
    to: string,
    type: string,
    props: Record<string, unknown> | undefined,
    groupId: string
  ): Promise<Relationship> {
    return withTenantError(groupId, "createRelationship", async () => {
      const validatedGroupId = validateTenantGroupId(groupId);
      
      // Relationship with forced group_id
      const relationship: Relationship = {
        source: from,
        target: to,
        relationType: type,
        group_id: validatedGroupId,
        props: props || {},
      };

      // Call MCP Docker tool
      const result = await callMcpTool<{ relations: Relationship[] }>("create_relations", {
        relations: [relationship],
      });

      // Return the created relationship
      const created = result.relations[0];
      return {
        source: created.source,
        target: created.target,
        relationType: created.relationType,
        group_id: validatedGroupId,
        props: created.props,
      };
    });
  },

  /**
   * Execute a Cypher query with group_id filtering
   * 
   * @param cypher - Cypher query string
   * @param params - Query parameters
   * @param groupId - Tenant group ID (must match allura-{org} pattern)
   * @returns Query results with timing
   * @throws GroupIdValidationError with RK-01 code if group_id is invalid
   */
  async query(
    cypher: string,
    params: Record<string, unknown>,
    groupId: string
  ): Promise<QueryResult> {
    return withTenantError(groupId, "query", async () => {
      const validatedGroupId = validateTenantGroupId(groupId);
      
      // Inject group_id into WHERE clause if not present
      const enrichedCypher = injectGroupIdIntoQuery(cypher, validatedGroupId);
      
      // Call MCP Docker tool
      const startTime = performance.now();
      const result = await callMcpTool<{ records: Record<string, unknown>[] }>("execute_sql", {
        sql_query: enrichedCypher,
        ...params,
      });
      const endTime = performance.now();

      return {
        records: result.records || [],
        query_time_ms: endTime - startTime,
      };
    });
  },

  /**
   * Search memories by query
   * 
   * @param query - Search query
   * @param groupId - Tenant group ID (must match allura-{org} pattern)
   * @returns Matching entities filtered by group_id
   * @throws GroupIdValidationError with RK-01 code if group_id is invalid
   */
  async search(query: string, groupId: string): Promise<SearchResult[]> {
    return withTenantError(groupId, "search", async () => {
      const validatedGroupId = validateTenantGroupId(groupId);
      
      // Call MCP Docker tool
      const result = await callMcpTool<{ entities: any[] }>("read_graph", {
        query,
      });

      // Filter results by group_id
      const entities = (result.entities || [])
        .filter((entity: any) => {
          // Check if entity has group_id in observations
          const observations = entity.observations || [];
          const hasGroupId = observations.some(
            (obs: string) =>
              obs.includes(`group_id: ${validatedGroupId}`) ||
              obs === `group_id: ${validatedGroupId}`
          );
          return hasGroupId;
        })
        .map((entity: any) => ({
          name: entity.name,
          type: entity.type,
          group_id: validatedGroupId,
          observations: entity.observations,
          metadata: entity,
        }));

      return entities;
    });
  },

  /**
   * Find entity by name with group_id validation
   * 
   * @param name - Entity name
   * @param groupId - Tenant group ID (must match allura-{org} pattern)
   * @returns Entity if found and matching group_id, null otherwise
   * @throws GroupIdValidationError with RK-01 code if group_id is invalid
   */
  async findById(name: string, groupId: string): Promise<Entity | null> {
    return withTenantError(groupId, "findById", async () => {
      const validatedGroupId = validateTenantGroupId(groupId);
      
      // Call MCP Docker tool
      const result = await callMcpTool<{ entities: any[] }>("find_memories_by_name", {
        names: [name],
      });

      // Check if entity exists
      if (!result.entities || result.entities.length === 0) {
        return null;
      }

      const entity = result.entities[0];

      // Check if entity belongs to correct tenant
      const observations = entity.observations || [];
      const entityGroupId = observations.find(
        (obs: string) => typeof obs === "string" && obs.startsWith("group_id:")
      );

      if (entityGroupId) {
        const extractedGroupId = entityGroupId.replace(/^group_id:\s*/, "").trim();
        if (extractedGroupId !== validatedGroupId) {
          // Entity exists but belongs to different tenant
          return null;
        }
      }

      // Return entity if group_id matches
      return {
        name: entity.name,
        type: entity.type || "Unknown",
        group_id: validatedGroupId,
        observations: entity.observations,
        metadata: entity,
      };
    });
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Inject group_id into Cypher query WHERE clause
 * 
 * Ensures all queries are filtered by tenant group_id for isolation.
 */
function injectGroupIdIntoQuery(cypher: string, groupId: string): string {
  // If query already contains group_id filter, use as-is
  if (cypher.includes("group_id")) {
    return cypher;
  }

  // Add group_id to WHERE clause if query has one
  if (cypher.match(/WHERE/i)) {
    return cypher.replace(/WHERE/i, `WHERE n.group_id = "${groupId}" AND`);
  }

  // Add WHERE clause with group_id before RETURN
  if (cypher.match(/RETURN/i)) {
    return cypher.replace(/(MATCH.*?)(RETURN)/i, `$1WHERE n.group_id = "${groupId}" $2`);
  }

  // If no WHERE or RETURN, just append filter
  return `${cypher} WHERE n.group_id = "${groupId}"`;
}

/**
 * Extract entity from graph result
 */
function extractEntityFromResult(raw: any, groupId: string): Entity | null {
  if (!raw || !raw.name) {
    return null;
  }

  return {
    name: raw.name,
    type: raw.type || "Unknown",
    group_id: groupId,
    observations: raw.observations || [],
    metadata: raw,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default memory;