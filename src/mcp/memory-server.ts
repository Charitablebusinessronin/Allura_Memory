#!/usr/bin/env node
/**
 * Allura Memory MCP Server
 *
 * Exposes the dual-database memory engine to AI agents via MCP:
 * - PostgreSQL: Raw execution traces (episodic memory)
 * - Neo4j: Knowledge graph (semantic memory)
 *
 * Usage: bun run src/mcp/memory-server.ts
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { Pool } from "pg";
import neo4j, { Driver } from "neo4j-driver";
import { config } from "dotenv";
import { DUPLICATE_THRESHOLD } from "@/lib/dedup/insight-duplicate";

config();

// ============================================================================
// CANONICAL TAG GOVERNANCE
// ============================================================================
// CRITICAL ARCHITECTURE RULE:
// - canonical_tag = system slug (used in Neo4j, PostgreSQL, group_id)
// - display_tag = human label (used in Notion multi-select)
// 
// NEVER use spaces or display labels as group_id.
// ALWAYS derive display from canonical, not the other way around.
// ============================================================================

interface TagMapping {
  canonical: string;      // System slug: "difference-driven"
  display: string;        // Notion display: "Difference driven"
  project: string;        // Human name: "Difference Driven"
}

const TAG_MAPPINGS: TagMapping[] = [
  { canonical: "difference-driven", display: "Difference driven", project: "Difference Driven" },
  { canonical: "faith-meats", display: "Faith meats", project: "Faith Meats" },
  { canonical: "patriot-awning", display: "patriot-awning", project: "Patriot Awning" },
  { canonical: "global-coding-skills", display: "global-coding-skills", project: "Global Coding Skills" }
];

const CANONICAL_TAGS = TAG_MAPPINGS.map(t => t.canonical);
const DISPLAY_TAGS = TAG_MAPPINGS.map(t => t.display);

/**
 * Get canonical tag from any input format
 * Accepts: canonical, display, or project name
 */
function getCanonicalTag(input: string): string | null {
  const normalized = input.toLowerCase().replace(/\s+/g, "-").trim();
  
  // Check if it's already canonical
  const found = TAG_MAPPINGS.find(t => t.canonical === normalized);
  if (found) return found.canonical;
  
  // Check if it's a display tag
  const byDisplay = TAG_MAPPINGS.find(t => t.display.toLowerCase() === input.toLowerCase());
  if (byDisplay) return byDisplay.canonical;
  
  // Check if it's a project name
  const byProject = TAG_MAPPINGS.find(t => t.project.toLowerCase() === input.toLowerCase());
  if (byProject) return byProject.canonical;
  
  return null;
}

/**
 * Get display tag from canonical tag
 */
function getDisplayTag(canonical: string): string | null {
  const found = TAG_MAPPINGS.find(t => t.canonical === canonical);
  return found?.display || null;
}

/**
 * Normalize a tag to canonical form
 * Throws if invalid
 */
function normalizeTag(tag: string): string {
  const canonical = getCanonicalTag(tag);
  if (!canonical) {
    throw new Error(`Invalid tag: "${tag}". Allowed canonical tags: ${CANONICAL_TAGS.join(", ")}`);
  }
  return canonical;
}

/**
 * Normalize an array of tags, filtering out invalid ones (with warning)
 */
function normalizeTags(tags: string[]): string[] {
  const valid: string[] = [];
  
  for (const tag of tags) {
    try {
      valid.push(normalizeTag(tag));
    } catch (e) {
      console.warn(`[TAG WARNING] Invalid tag "${tag}" will be ignored. Allowed: ${CANONICAL_TAGS.join(", ")}`);
    }
  }
  
  return valid;
}

/**
 * Convert canonical tags to Notion display format
 */
function canonicalToDisplay(canonicalTags: string[]): string[] {
  return canonicalTags
    .map(t => getDisplayTag(t))
    .filter((t): t is string => t !== null);
}

/**
 * Validate that a group_id matches canonical tag format
 */
function validateGroupId(groupId: string): string {
  return normalizeTag(groupId);
}

// Insight Lifecycle Statuses
const INSIGHT_STATUSES = [
  "Proposed",           // New insight, not yet reviewed
  "Pending Review",     // Promoted to Notion, awaiting human review
  "Approved",           // Human approved, AI Accessible = true
  "Rejected",           // Human rejected, do not use
  "Superseded"          // Replaced by newer insight
] as const;

type InsightStatus = typeof INSIGHT_STATUSES[number];

// ============================================================================
// INSIGHT CURATOR RULES
// ============================================================================

/**
 * Check if an insight can be promoted
 */
function canPromoteInsight(insight: {
  confidence: number;
  status: string;
  summary?: string;
  canonical_tag?: string;
  promoted_to_notion?: boolean;
}): { canPromote: boolean; reason?: string } {
  // Must have confidence >= 0.7
  if (insight.confidence < 0.7) {
    return { canPromote: false, reason: `Confidence ${insight.confidence} below threshold 0.7` };
  }
  
  // Must have Proposed status
  if (insight.status !== "Proposed") {
    return { canPromote: false, reason: `Status "${insight.status}" is not "Proposed"` };
  }
  
  // Must have summary
  if (!insight.summary || insight.summary.length < 20) {
    return { canPromote: false, reason: "Summary is missing or too short" };
  }
  
  // Must have canonical_tag
  if (!insight.canonical_tag) {
    return { canPromote: false, reason: "Missing canonical_tag - promotion blocked" };
  }
  
  // Must not already be promoted
  if (insight.promoted_to_notion) {
    return { canPromote: false, reason: "Already promoted to Notion" };
  }
  
  return { canPromote: true };
}


// Connection pools
let pgPool: Pool | null = null;
let neo4jDriver: Driver | null = null;
async function initializeConnections() {
  if (!pgPool) {
    pgPool = new Pool({
      host: process.env.POSTGRES_HOST || "localhost",
      port: parseInt(process.env.POSTGRES_PORT || "5432"),
      database: process.env.POSTGRES_DB || "memory",
      user: process.env.POSTGRES_USER || "ronin4life",
      password: process.env.POSTGRES_PASSWORD,
      connectionTimeoutMillis: 10000,
      max: 10,
    });
  }

  if (!neo4jDriver) {
    neo4jDriver = neo4j.driver(
      process.env.NEO4J_URI || "bolt://localhost:7687",
      neo4j.auth.basic(
        process.env.NEO4J_USER || "neo4j",
        process.env.NEO4J_PASSWORD || "password"
      ),
      { maxConnectionPoolSize: 50 }
    );
  }

  return { pgPool, neo4jDriver };
}

// Server setup
const server = new Server(
  {
    name: "unified-memory",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // PostgreSQL tools
      {
        name: "search_events",
        description: "Search raw execution traces from PostgreSQL (episodic memory)",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (matches event_type, agent_id, or metadata)"
            },
            group_id: {
              type: "string",
              description: "Optional group ID to filter by"
            },
            limit: {
              type: "number",
              description: "Max results (default 10)"
            },
            offset: {
              type: "number",
              description: "Pagination offset"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "log_event",
        description: "Log an event to PostgreSQL (episodic memory)",
        inputSchema: {
          type: "object",
          properties: {
            group_id: {
              type: "string",
              description: "Group/session ID"
            },
            event_type: {
              type: "string",
              description: "Type of event (e.g., 'session_complete', 'decision_made')"
            },
            agent_id: {
              type: "string",
              description: "Agent that created the event"
            },
            workflow_id: {
              type: "string",
              description: "Optional workflow ID"
            },
            metadata: {
              type: "object",
              description: "Event metadata (JSON)"
            },
            status: {
              type: "string",
              description: "Status (e.g., 'completed', 'failed')"
            }
          },
          required: ["group_id", "event_type", "agent_id"]
        }
      },
      {
        name: "get_event",
        description: "Get a specific event by ID",
        inputSchema: {
          type: "object",
          properties: {
            event_id: {
              type: "string",
              description: "Event UUID"
            }
          },
          required: ["event_id"]
        }
      },
      
      // Neo4j tools
      {
        name: "search_insights",
        description: "Search the knowledge graph (Neo4j) for insights",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Natural language query"
            },
            entity_type: {
              type: "string",
              description: "Optional entity type filter (Insight, KnowledgeItem, AIAgent)"
            },
            min_confidence: {
              type: "number",
              description: "Minimum confidence score (0-1)"
            },
            limit: {
              type: "number",
              description: "Max results (default 10)"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "create_insight",
        description: "Create a new insight in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            group_id: {
              type: "string",
              description: "Group/session ID"
            },
            summary: {
              type: "string",
              description: "Insight summary"
            },
            confidence: {
              type: "number",
              description: "Confidence score (0-1)"
            },
            entities: {
              type: "array",
              items: { type: "string" },
              description: "Related entity names"
            },
            trace_ref: {
              type: "string",
              description: "Reference to PostgreSQL event (e.g., 'events:uuid')"
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tags for categorization"
            }
          },
          required: ["group_id", "summary", "confidence"]
        }
      },
      {
        name: "create_entity",
        description: "Create an entity in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description: "Entity type (AIAgent, KnowledgeItem, Insight)"
            },
            name: {
              type: "string",
              description: "Entity name"
            },
            properties: {
              type: "object",
              description: "Entity properties"
            }
          },
          required: ["type", "name"]
        }
      },
      {
        name: "create_relation",
        description: "Create a relationship between entities",
        inputSchema: {
          type: "object",
          properties: {
            from_entity: {
              type: "string",
              description: "Source entity name or ID"
            },
            relation_type: {
              type: "string",
              description: "Relationship type (e.g., 'KNOWS', 'CREATED', 'USED')"
            },
            to_entity: {
              type: "string",
              description: "Target entity name or ID"
            },
            properties: {
              type: "object",
              description: "Relationship properties"
            }
          },
          required: ["from_entity", "relation_type", "to_entity"]
        }
      },
      {
        name: "get_entity",
        description: "Get an entity by name or ID",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Entity name"
            },
            entity_id: {
              type: "string",
              description: "Entity UUID"
            }
          }
        }
      },
      
      // ADR tools
      {
        name: "log_decision",
        description: "Log an Agent Decision Record (ADR) with counterfactuals",
        inputSchema: {
          type: "object",
          properties: {
            group_id: {
              type: "string",
              description: "Group/session ID"
            },
            decision_id: {
              type: "string",
              description: "Unique decision ID"
            },
            action: {
              type: "string",
              description: "What was decided"
            },
            context: {
              type: "object",
              description: "Decision context"
            },
            reasoning_chain: {
              type: "array",
              items: { type: "object" },
              description: "Reasoning steps"
            },
            counterfactuals: {
              type: "array",
              items: { type: "object" },
              description: "Alternatives considered and why rejected"
            },
            decision_made: {
              type: "string",
              description: "The actual decision"
            },
            confidence: {
              type: "number",
              description: "Confidence score (0-1)"
            }
          },
          required: ["group_id", "decision_id", "action", "decision_made"]
        }
      },
      {
        name: "get_decision",
        description: "Get a decision record by ID",
        inputSchema: {
          type: "object",
          properties: {
            decision_id: {
              type: "string",
              description: "Decision UUID"
            }
          },
          required: ["decision_id"]
        }
      },
      {
        name: "search_decisions",
        description: "Search decision records",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query"
            },
            group_id: {
              type: "string",
              description: "Optional group ID filter"
            },
            limit: {
              type: "number",
              description: "Max results"
            }
          },
          required: ["query"]
        }
      },
      
      // Query tools
      {
        name: "query_dual_context",
        description: "Query both PostgreSQL (episodic) and Neo4j (semantic) memory together",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Natural language query"
            },
            group_id: {
              type: "string",
              description: "Optional group ID"
            },
            include_counterfactuals: {
              type: "boolean",
              description: "Include alternative decisions"
            },
            limit: {
              type: "number",
              description: "Max results per source"
            }
          },
          required: ["query"]
        }
      },
      
      // Health check
      {
        name: "health_check",
        description: "Check database connections and system health",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
    ]
  };
});

// Tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    const { pgPool, neo4jDriver } = await initializeConnections();
    
    switch (name) {
      // PostgreSQL operations
      case "search_events": {
        const { query, group_id, limit = 10, offset = 0 } = args as any;
        const searchTerm = `%${query}%`;
        
        let sql = `
          SELECT * FROM events 
          WHERE (event_type ILIKE $1 OR metadata::text ILIKE $1 OR agent_id ILIKE $1)
        `;
        const params: any[] = [searchTerm];
        
        if (group_id) {
          sql += ` AND group_id = $${params.length + 1}`;
          params.push(group_id);
        }
        
        sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        
        const result = await pgPool!.query(sql, params);
        return { content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }] };
      }
      
      case "log_event": {
        const { group_id, event_type, agent_id, workflow_id, metadata, status } = args as any;
        const result = await pgPool!.query(`
          INSERT INTO events (group_id, event_type, agent_id, workflow_id, metadata, status)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [group_id, event_type, agent_id, workflow_id || null, JSON.stringify(metadata || {}), status || 'completed']);
        
        return { content: [{ type: "text", text: JSON.stringify(result.rows[0], null, 2) }] };
      }
      
      case "get_event": {
        const { event_id } = args as any;
        const result = await pgPool!.query(`SELECT * FROM events WHERE id = $1`, [event_id]);
        
        if (result.rows.length === 0) {
          return { content: [{ type: "text", text: "Event not found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(result.rows[0], null, 2) }] };
      }
      
      // Neo4j operations
      case "search_insights": {
        const { query, entity_type, min_confidence = 0.5, limit = 10 } = args as any;
        const session = neo4jDriver!.session();
        
        try {
          let cypher = `
            MATCH (i:Insight)
            WHERE toLower(i.summary) CONTAINS toLower($query)
              AND coalesce(i.status, '') <> 'Revoked'
              AND (coalesce(i.ai_accessible, false) = true OR i.status = 'Approved')
          `;
          const params: any = { query };
          
          if (entity_type) {
            cypher += ` AND i.type = $entity_type`;
            params.entity_type = entity_type;
          }
          
          if (min_confidence) {
            cypher += ` AND i.confidence >= $min_confidence`;
            params.min_confidence = min_confidence;
          }
          
          cypher += ` RETURN i ORDER BY i.confidence DESC LIMIT $limit`;
          params.limit = neo4j.int(Math.trunc(limit));
          
          const result = await session.run(cypher, params);
          const insights = result.records.map((r: { get: (key: string) => { properties: Record<string, unknown> } }) => r.get('i').properties);
          
          return { content: [{ type: "text", text: JSON.stringify(insights, null, 2) }] };
        } finally {
          await session.close();
        }
      }
      
      case "create_insight": {
        const { group_id, summary, confidence, entities, trace_ref, tags } = args as any;
        const session = neo4jDriver!.session();
        
        try {
          const insight_id = `insight_${Date.now()}`;
          const result = await session.run(`
            CREATE (i:Insight:KnowledgeItem {
              insight_id: $insight_id,
              group_id: $group_id,
              summary: $summary,
              confidence: $confidence,
              trace_ref: $trace_ref,
              tags: $tags,
              created_at: datetime(),
              status: 'Proposed'
            })
            RETURN i
          `, {
            insight_id,
            group_id,
            summary,
            confidence,
            trace_ref: trace_ref || null,
            tags: tags || []
          });
          
          // Create entity relationships if provided
          if (entities && entities.length > 0) {
            for (const entityName of entities) {
              await session.run(`
                MATCH (i:Insight {insight_id: $insight_id})
                MERGE (e:Entity {name: $entityName})
                MERGE (i)-[:MENTIONS]->(e)
              `, { insight_id, entityName });
            }
          }
          
          return { content: [{ type: "text", text: JSON.stringify(result.records[0].get('i').properties, null, 2) }] };
        } finally {
          await session.close();
        }
      }
      
      case "create_entity": {
        const { type, name, properties } = args as any;
        const session = neo4jDriver!.session();
        
        try {
          const result = await session.run(`
            CREATE (e:${type} {
              entity_id: $entity_id,
              name: $name,
              created_at: datetime(),
              properties: $properties
            })
            RETURN e
          `, {
            entity_id: `${type.toLowerCase()}_${Date.now()}`,
            name,
            properties: JSON.stringify(properties || {})
          });
          
          return { content: [{ type: "text", text: JSON.stringify(result.records[0].get('e').properties, null, 2) }] };
        } finally {
          await session.close();
        }
      }
      
      case "create_relation": {
        const { from_entity, relation_type, to_entity, properties } = args as any;
        const session = neo4jDriver!.session();
        
        try {
          await session.run(`
            MATCH (from {name: $from_entity})
            MATCH (to {name: $to_entity})
            CREATE (from)-[r:${relation_type} {properties: $properties}]->(to)
            RETURN r
          `, { from_entity, to_entity, properties: JSON.stringify(properties || {}) });
          
          return { content: [{ type: "text", text: `Created relation: ${from_entity} -[${relation_type}]-> ${to_entity}` }] };
        } finally {
          await session.close();
        }
      }
      
      case "get_entity": {
        const { name, entity_id } = args as any;
        const session = neo4jDriver!.session();
        
        try {
          let cypher, params;
          if (entity_id) {
            cypher = `MATCH (e {entity_id: $entity_id}) RETURN e`;
            params = { entity_id };
          } else {
            cypher = `MATCH (e {name: $name}) RETURN e`;
            params = { name };
          }
          
          const result = await session.run(cypher, params);
          
          if (result.records.length === 0) {
            return { content: [{ type: "text", text: "Entity not found" }], isError: true };
          }
          
          return { content: [{ type: "text", text: JSON.stringify(result.records[0].get('e').properties, null, 2) }] };
        } finally {
          await session.close();
        }
      }
      
      // ADR operations
      case "log_decision": {
        const { group_id, decision_id, action, context, reasoning_chain, counterfactuals, decision_made, confidence } = args as any;
        
        // Log to PostgreSQL
        await pgPool!.query(`
          INSERT INTO events (group_id, event_type, agent_id, workflow_id, metadata, status)
          VALUES ($1, 'agent_decision_record', 'adr_system', $2, $3, 'completed')
        `, [
          group_id,
          decision_id,
          JSON.stringify({ action, context, reasoning_chain, counterfactuals, decision_made, confidence })
        ]);
        
        // Create ADR in Neo4j
        const session = neo4jDriver!.session();
        try {
          await session.run(`
            CREATE (adr:ADR {
              decision_id: $decision_id,
              action: $action,
              decision_made: $decision_made,
              confidence: $confidence,
              created_at: datetime()
            })
            WITH adr
            UNWIND $counterfactuals AS cf
            CREATE (c:Counterfactual {
              alternative: cf.alternative,
              rejected_because: cf.rejected_because,
              confidence_impact: cf.confidence_impact
            })
            CREATE (adr)-[:CONSIDERED]->(c)
          `, { decision_id, action, decision_made, confidence: confidence || 0.5, counterfactuals: counterfactuals || [] });
          
          return { content: [{ type: "text", text: `Decision ${decision_id} logged successfully` }] };
        } finally {
          await session.close();
        }
      }
      
      case "get_decision": {
        const { decision_id } = args as any;
        const session = neo4jDriver!.session();
        
        try {
          const result = await session.run(`
            MATCH (adr:ADR {decision_id: $decision_id})
            OPTIONAL MATCH (adr)-[:CONSIDERED]->(cf:Counterfactual)
            RETURN adr, collect(cf) as counterfactuals
          `, { decision_id });
          
          if (result.records.length === 0) {
            return { content: [{ type: "text", text: "Decision not found" }], isError: true };
          }
          
          const adr = result.records[0].get('adr').properties;
          const counterfactuals = result.records[0].get('counterfactuals').map((r: any) => r.properties);
          
          return { content: [{ type: "text", text: JSON.stringify({ ...adr, counterfactuals }, null, 2) }] };
        } finally {
          await session.close();
        }
      }
      
      case "search_decisions": {
        const { query, group_id, limit = 10 } = args as any;
        const session = neo4jDriver!.session();
        
        try {
          const result = await session.run(`
            MATCH (adr:ADR)
            WHERE toLower(adr.action) CONTAINS toLower($query)
               OR toLower(adr.decision_made) CONTAINS toLower($query)
            RETURN adr
            ORDER BY adr.created_at DESC
            LIMIT $limit
          `, { query, limit: neo4j.int(Math.trunc(limit)) });
          
          const decisions = result.records.map((r: { get: (key: string) => { properties: Record<string, unknown> } }) => r.get('adr').properties);
          return { content: [{ type: "text", text: JSON.stringify(decisions, null, 2) }] };
        } finally {
          await session.close();
        }
      }
      
      // Dual context query
      case "query_dual_context": {
        const { query, group_id, include_counterfactuals = false, limit = 5 } = args as any;
        
        // Search PostgreSQL
        const pgResult = await pgPool!.query(`
          SELECT * FROM events 
          WHERE metadata::text ILIKE $1
          ORDER BY created_at DESC 
          LIMIT $2
        `, [`%${query}%`, limit]);
        
        // Search Neo4j
        const session = neo4jDriver!.session();
        try {
          const neoResult = await session.run(`
            MATCH (i:Insight)
            WHERE toLower(i.summary) CONTAINS toLower($query)
              AND coalesce(i.status, '') <> 'Revoked'
              AND (coalesce(i.ai_accessible, false) = true OR i.status = 'Approved')
            RETURN i
            ORDER BY i.confidence DESC
            LIMIT $limit
          `, { query, limit: neo4j.int(Math.trunc(limit)) });
          
          const insights = neoResult.records.map(r => r.get('i').properties);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                episodic: pgResult.rows,
                semantic: insights
              }, null, 2)
            }]
          };
        } finally {
          await session.close();
        }
      }
      
      // Health check
      case "health_check": {
        const pgHealthy = await pgPool!.query('SELECT 1');
        let neoHealthy = false;
        try {
          await neo4jDriver!.verifyConnectivity();
          neoHealthy = true;
        } catch {
          neoHealthy = false;
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              postgresql: pgHealthy.rows.length === 1 ? 'healthy' : 'unhealthy',
              neo4j: neoHealthy ? 'healthy' : 'unhealthy',
              notion: 'connected_via_mcp_docker',
              note: 'Notion operations use mcp__MCP_DOCKER__notion-* tools directly',
              canonical_tags: CANONICAL_TAGS,
              insight_statuses: INSIGHT_STATUSES,
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        };
      }
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

// List resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "memory://schema",
        name: "Memory System Schema",
        description: "Database schema for the unified memory system",
        mimeType: "application/json"
      },
      {
        uri: "memory://health",
        name: "System Health",
        description: "Current health status of all memory components",
        mimeType: "application/json"
      },
      {
        uri: "memory://agents",
        name: "Agent Registry",
        description: "List of registered AI agents",
        mimeType: "application/json"
      },
      {
        uri: "memory://knowledge-base",
        name: "Knowledge Base Summary",
        description: "Summary of AI-accessible knowledge items",
        mimeType: "application/json"
      }
    ]
  };
});

// Read resources
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  if (uri === "memory://schema") {
    const { pgPool, neo4jDriver } = await initializeConnections();
    const pgTables = await pgPool!.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const session = neo4jDriver!.session();
    try {
      const neoLabels = await session.run(`CALL db.labels() YIELD label RETURN label`);
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            postgresql: { tables: pgTables.rows.map(r => r.table_name) },
            neo4j: { labels: neoLabels.records.map(r => r.get('label')) },
            notion: {
              databases: {
                knowledge_base: process.env.NOTION_KNOWLEDGE_DB_ID || 'not configured',
                insights: process.env.NOTION_INSIGHTS_DB_ID || 'not configured',
                agents: process.env.NOTION_AGENTS_DB_ID || 'not configured'
              }
            }
          }, null, 2)
        }]
      };
    } finally {
      await session.close();
    }
  }
  
  if (uri === "memory://health") {
    const { pgPool, neo4jDriver } = await initializeConnections();
    const pgHealth = await pgPool!.query('SELECT 1');
    const neoHealth = await neo4jDriver!.verifyConnectivity();
    
    let notionHealth = 'not_configured';
    if (process.env.NOTION_API_KEY) {
      try {
        const notionResponse = await fetch('https://api.notion.com/v1/users/me', {
          headers: {
            'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
            'Notion-Version': '2022-06-28'
          }
        });
        notionHealth = notionResponse.ok ? 'healthy' : 'error';
      } catch (e) {
        notionHealth = 'error';
      }
    }
    
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify({
          postgresql: { connected: pgHealth.rows.length === 1 },
          neo4j: { connected: neoHealth !== null },
          notion: { status: notionHealth },
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  }
  
  if (uri === "memory://agents") {
    const { neo4jDriver } = await initializeConnections();
    const session = neo4jDriver!.session();
    try {
      const result = await session.run(`MATCH (a:AIAgent) RETURN a ORDER BY a.created_at DESC`);
      const agents = result.records.map((r: { get: (key: string) => { properties: Record<string, unknown> } }) => r.get('a').properties);
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            count: agents.length,
            agents: agents.map((a: Record<string, unknown>) => ({
              id: a.id,
              name: a.name,
              status: a.status,
              role: a.role
            }))
          }, null, 2)
        }]
      };
    } finally {
      await session.close();
    }
  }
  
  if (uri === "memory://knowledge-base") {
    const { neo4jDriver } = await initializeConnections();
    const session = neo4jDriver!.session();
    try {
      const result = await session.run(`
        MATCH (k:KnowledgeItem)
        WHERE k.ai_accessible = true
        RETURN k.id as id, k.title as title, k.category as category, k.confidence as confidence
        ORDER BY k.confidence DESC
        LIMIT 50
      `);
      const items = result.records.map((r: { get: (key: string) => unknown }) => ({
        id: r.get('id'),
        title: r.get('title'),
        category: r.get('category'),
        confidence: r.get('confidence')
      }));
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            count: items.length,
            items
          }, null, 2)
        }]
      };
    } finally {
      await session.close();
    }
  }
  
  throw new Error(`Unknown resource: ${uri}`);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Unified Memory MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
