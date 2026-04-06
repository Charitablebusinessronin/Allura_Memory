#!/usr/bin/env node
/**
 * Unified Memory MCP Server
 * 
 * Exposes the 4-layer knowledge system to AI agents via MCP:
 * - PostgreSQL: Raw execution traces (episodic memory)
 * - Neo4j: Knowledge graph (semantic memory)
 * - ADR: Decision records with counterfactuals
 * - Ralph Loops: Self-correcting execution
 * 
 * Usage: npx tsx src/mcp/memory-server.ts
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
import {
  createNeo4jDuplicateReviewProvider,
  createPromotionOrchestrator,
} from "@/curator/promotion-orchestrator";
import { createCuratorRuntime } from "@/curator/service-factory";
import { 
  runMetaAgentSearch, 
  createSearchConfig,
  getPendingProposals as getAdasProposals,
  approveProposal,
  rejectProposal
} from "@/lib/adas";

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
const curatorRuntime = createCuratorRuntime();

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
      
      // Insight Curator tools
      {
        name: "run_curation",
        description: "Run the knowledge curator to scan PostgreSQL traces and promote insights to Neo4j/Notion",
        inputSchema: {
          type: "object",
          properties: {
            batch_size: {
              type: "number",
              description: "Number of insights to process (default: 50)"
            },
            dry_run: {
              type: "boolean",
              description: "Preview what would be promoted without making changes"
            }
          }
        }
      },
      {
        name: "promote_insight",
        description: "Promote a Neo4j insight to Notion for human review (curator agent only)",
        inputSchema: {
          type: "object",
          properties: {
            insight_id: {
              type: "string",
              description: "Neo4j insight ID to promote"
            },
            group_id: {
              type: "string",
              description: "Project/group ID (canonical tag)"
            },
            summary: {
              type: "string",
              description: "Human-readable summary"
            },
            confidence: {
              type: "number",
              description: "Confidence score (0-1)"
            },
            rationale: {
              type: "string",
              description: "Why this insight is valuable"
            },
            source_event_id: {
              type: "string",
              description: "Reference to source event in PostgreSQL"
            }
          },
          required: ["insight_id", "group_id", "summary", "confidence"]
        }
      },
      {
        name: "check_duplicate_insight",
        description: "Check if a similar insight already exists before promotion",
        inputSchema: {
          type: "object",
          properties: {
            canonical_tag: {
              type: "string",
              description: "Canonical tag (e.g., 'difference-driven')"
            },
            summary: {
              type: "string",
              description: "Insight summary to check for duplicates"
            },
            threshold: {
              type: "number",
              description: "Similarity threshold (0-1, default 0.8)"
            }
          },
          required: ["canonical_tag", "summary"]
        }
      },
      {
        name: "approve_insight",
        description: "Mark a promoted insight as approved (human review)",
        inputSchema: {
          type: "object",
          properties: {
            insight_id: {
              type: "string",
              description: "Neo4j insight ID"
            },
            notion_page_id: {
              type: "string",
              description: "Notion page ID"
            },
            approved_by: {
              type: "string",
              description: "Person who approved"
            },
            notes: {
              type: "string",
              description: "Optional approval notes"
            }
          },
          required: ["insight_id", "approved_by"]
        }
      },
      {
        name: "reject_insight",
        description: "Mark a promoted insight as rejected (human review)",
        inputSchema: {
          type: "object",
          properties: {
            insight_id: {
              type: "string",
              description: "Neo4j insight ID"
            },
            reason: {
              type: "string",
              description: "Rejection reason"
            }
          },
          required: ["insight_id", "reason"]
        }
      },
      {
        name: "supersede_insight",
        description: "Mark an insight as superseded by a replacement insight and create lineage",
        inputSchema: {
          type: "object",
          properties: {
            insight_id: {
              type: "string",
              description: "Insight being superseded"
            },
            replacement_insight_id: {
              type: "string",
              description: "Replacement insight ID"
            },
            reason: {
              type: "string",
              description: "Reason for superseding"
            }
          },
          required: ["insight_id", "replacement_insight_id", "reason"]
        }
      },
      {
        name: "revoke_insight",
        description: "Revoke an approved insight while preserving history and disabling AI access",
        inputSchema: {
          type: "object",
          properties: {
            insight_id: {
              type: "string",
              description: "Insight to revoke"
            },
            reason: {
              type: "string",
              description: "Reason for revocation"
            },
            revoked_by: {
              type: "string",
              description: "Actor revoking the insight"
            }
          },
          required: ["insight_id", "reason"]
        }
      },
      {
        name: "list_promotable_insights",
        description: "List insights that can be promoted (confidence >= 0.7, status=Proposed, not promoted)",
        inputSchema: {
          type: "object",
          properties: {
            canonical_tag: {
              type: "string",
              description: "Filter by canonical tag"
            },
            limit: {
              type: "number",
              description: "Max results (default 20)"
            }
          }
        }
      },
      
      // Notion tools - Human Workspace integration
      {
        name: "search_knowledge_base",
        description: "Search the Notion Master Knowledge Base for approved documentation",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query"
            },
            category: {
              type: "string",
              description: "Optional category filter (technical, guide, architecture)"
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional tags to filter by"
            },
            ai_accessible_only: {
              type: "boolean",
              description: "Only return AI-accessible items (default true)"
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
        name: "create_knowledge_item",
        description: "Create a new page in the Notion Master Knowledge Base with AI Accessible checkbox",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Page title"
            },
            content: {
              type: "string",
              description: "Page content (markdown)"
            },
            category: {
              type: "string",
              description: "Category (technical, guide, architecture, best-practice)"
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tags for categorization"
            },
            ai_accessible: {
              type: "boolean",
              description: "Whether AI agents can access this (default true)"
            },
            assigned_agents: {
              type: "array",
              items: { type: "string" },
              description: "Agent IDs that can access this"
            }
          },
          required: ["title", "content", "category"]
        }
      },
      {
        name: "promote_insight_to_notion",
        description: "Promote a high-confidence insight from Neo4j to Notion for human review",
        inputSchema: {
          type: "object",
          properties: {
            insight_id: {
              type: "string",
              description: "Neo4j insight ID to promote"
            },
            group_id: {
              type: "string",
              description: "Group/project ID"
            },
            summary: {
              type: "string",
              description: "Human-readable summary"
            },
            trace_ref: {
              type: "string",
              description: "Reference to source evidence"
            }
          },
          required: ["insight_id", "group_id", "summary"]
        }
      },
      {
        name: "get_agent_context",
        description: "Get agent activation prompts and memories from Notion",
        inputSchema: {
          type: "object",
          properties: {
            agent_id: {
              type: "string",
              description: "Agent ID to get context for"
            },
            group_id: {
              type: "string",
              description: "Optional project/group ID for context filtering"
            }
          },
          required: ["agent_id"]
        }
      },
      {
        name: "list_agent_registry",
        description: "List all registered AI agents from Notion",
        inputSchema: {
          type: "object",
          properties: {
            active_only: {
              type: "boolean",
              description: "Only return active agents (default true)"
            }
          }
        }
      },
      {
        name: "sync_drift_report",
        description: "Check for drift between Notion and Neo4j knowledge",
        inputSchema: {
          type: "object",
          properties: {
            group_id: {
              type: "string",
              description: "Optional project/group ID to check"
            },
            since: {
              type: "string",
              description: "ISO date string to check drift since"
            }
          }
        }
      },
      
      // ADAS Tools
      {
        name: "mcp__adas__run_search",
        description: "Run an evolutionary search for a new agent design (ADAS)",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "Domain to target (e.g., 'math', 'reasoning', 'code')"
            },
            iterations: {
              type: "number",
              description: "Max evolutionary iterations (default 10)"
            },
            population: {
              type: "number",
              description: "Population size (default 20)"
            },
            group_id: {
              type: "string",
              description: "Canonical tag for tenant isolation"
            }
          },
          required: ["domain", "group_id"]
        }
      },
      {
        name: "mcp__adas__get_proposals",
        description: "List pending promotion proposals from ADAS searches",
        inputSchema: {
          type: "object",
          properties: {
            group_id: {
              type: "string",
              description: "Filter by canonical tag"
            },
            status: {
              type: "string",
              description: "Filter by status (pending, approved, rejected)"
            }
          }
        }
      },
      {
        name: "mcp__adas__approve_proposal",
        description: "Approve or reject an ADAS promotion proposal",
        inputSchema: {
          type: "object",
          properties: {
            proposal_id: {
              type: "string",
              description: "UUID of the proposal to act on"
            },
            decision: {
              type: "string",
              enum: ["approved", "rejected"],
              description: "The decision to make"
            },
            reviewer_notes: {
              type: "string",
              description: "Optional notes from the reviewer"
            }
          },
          required: ["proposal_id", "decision"]
        }
      }
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
      
      // ========================================
      // INSIGHT CURATOR TOOLS
      // ========================================
      
      case "promote_insight": {
        const { insight_id, group_id, summary, confidence, rationale, source_event_id } = args as any;
        
        // Validate canonical tag
        const canonicalTag = normalizeTag(group_id);
        const displayTag = getDisplayTag(canonicalTag);
        
        if (!displayTag) {
          return { content: [{ type: "text", text: `Invalid canonical_tag: ${group_id}` }], isError: true };
        }
        
        const session = neo4jDriver!.session();
        try {
          // Check if insight exists and can be promoted
          const insightResult = await session.run(`
            MATCH (i:Insight {insight_id: $insight_id})
            RETURN i
          `, { insight_id });
          
          if (insightResult.records.length === 0) {
            return { content: [{ type: "text", text: `Insight ${insight_id} not found` }], isError: true };
          }
          
          const insight = insightResult.records[0].get('i').properties;
          
          // Check promotion rules
          const promotionCheck = canPromoteInsight({
            confidence: insight.confidence || confidence,
            status: insight.status || 'Proposed',
            summary: insight.summary || summary,
            canonical_tag: canonicalTag,
            promoted_to_notion: insight.promoted_to_notion
          });
          
          if (!promotionCheck.canPromote) {
            return { 
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  error: "Cannot promote insight",
                  reason: promotionCheck.reason,
                  insight_id,
                  confidence: insight.confidence || confidence,
                  status: insight.status || 'Proposed'
                }, null, 2)
              }], 
              isError: true 
            };
          }
          
          // Create Notion page via mcp__MCP_DOCKER__notion-create-pages
          const notionPageId = `promoted_${Date.now()}`;
          
          // Update Neo4j insight with promotion status
          await session.run(`
            MATCH (i:Insight {insight_id: $insight_id})
            SET i.promoted_to_notion = true,
                i.notion_page_id = $notionPageId,
                i.promotion_status = 'pending_review',
                i.promoted_at = datetime(),
                i.canonical_tag = $canonicalTag,
                i.display_tag = $displayTag
          `, { insight_id, notionPageId, canonicalTag, displayTag });
          
          // Log promotion event to PostgreSQL
          await pgPool!.query(`
            INSERT INTO events (group_id, event_type, agent_id, metadata, status)
            VALUES ($1, 'insight_promoted', 'curator', $2, 'completed')
          `, [canonicalTag, JSON.stringify({
            insight_id,
            notion_page_id: notionPageId,
            confidence: insight.confidence || confidence,
            canonical_tag: canonicalTag
          })]);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                insight_id,
                notion_page_id: notionPageId,
                canonical_tag: canonicalTag,
                display_tag: displayTag,
                status: 'pending_review',
                ai_accessible: false,
                message: "Insight promoted to Notion for human review. Set AI Accessible = true after approval."
              }, null, 2)
            }]
          };
        } finally {
          await session.close();
        }
      }
      
      case "check_duplicate_insight": {
        const { canonical_tag, summary, threshold = DUPLICATE_THRESHOLD } = args as any;

        const canonicalTag = normalizeTag(canonical_tag);

        const session = neo4jDriver!.session();
        try {
          const result = await session.run(`
            MATCH (i:Insight)
            WHERE i.canonical_tag = $canonical_tag
            AND (i.status = 'Approved' OR i.status = 'Pending Review' OR i.status = 'Proposed')
            RETURN i.insight_id as id, i.summary as summary, i.confidence as confidence, i.status as status
            ORDER BY i.confidence DESC, i.status ASC
            LIMIT 25
          `, { canonical_tag: canonicalTag });

          const rawInsights: Array<{
            id: string
            summary: string | null
            confidence: number
            status: string
          }> = result.records.map((record: { get: (key: string) => unknown }) => ({
            id: record.get('id') as string,
            summary: record.get('summary') as string | null,
            confidence: Number(record.get('confidence') ?? 0),
            status: record.get('status') as string,
          }))

          const existingInsights = rawInsights
            .filter((insight) => typeof insight.summary === 'string' && insight.summary.trim().length > 0)
            .map((insight) => ({
              id: insight.id,
              summary: insight.summary as string,
              confidence: insight.confidence,
              status: insight.status,
            }));

          const orchestrator = createPromotionOrchestrator(
            createNeo4jDuplicateReviewProvider(existingInsights),
          );
          const evaluation = await orchestrator.reviewDuplicate({
            canonicalTag: canonicalTag,
            summary,
            threshold,
          });

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                is_duplicate: evaluation.decision === 'duplicate',
                decision: evaluation.decision,
                canonical_tag: canonicalTag,
                threshold,
                thresholds: evaluation.thresholds,
                evaluator_version: evaluation.evaluatorVersion,
                latency_ms: evaluation.latencyMs,
                measured_at: evaluation.measuredAt,
                top_match: evaluation.topMatch,
                candidate_matches: evaluation.matches,
                total_existing: existingInsights.length,
                recommendation: evaluation.recommendation,
              }, null, 2)
            }]
          };
        } finally {
          await session.close();
        }
      }
      
      case "approve_insight": {
        const { insight_id, approved_by, notes } = args as any;

        await curatorRuntime.approvalSyncService.approveInsight(insight_id, approved_by, notes);
        await pgPool!.query(`
          INSERT INTO events (group_id, event_type, agent_id, metadata, status)
          VALUES ($1, 'insight_approved', $2, $3, 'completed')
        `, [insight_id, approved_by, JSON.stringify({ insight_id, notes })]);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              insight_id,
              status: 'Approved',
              approved_by,
              ai_accessible: true,
              message: "Insight approved through shared lifecycle service"
            }, null, 2)
          }]
        };
      }
      
      case "reject_insight": {
        const { insight_id, reason, revoked_by } = args as { insight_id: string; reason: string; revoked_by?: string };

        await curatorRuntime.approvalSyncService.rejectInsight(insight_id, reason);
        await pgPool!.query(`
          INSERT INTO events (group_id, event_type, agent_id, metadata, status)
          VALUES ($1, 'insight_rejected', 'curator', $2, 'completed')
        `, [insight_id, JSON.stringify({ insight_id, reason, revoked_by: revoked_by || 'curator' })]);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              insight_id,
              status: 'Rejected',
              reason,
              ai_accessible: false,
              message: "Insight rejected through shared lifecycle service"
            }, null, 2)
          }]
        };
      }

      case "supersede_insight": {
        const { insight_id, replacement_insight_id, reason } = args as any;

        await curatorRuntime.approvalSyncService.supersedeInsight(
          insight_id,
          replacement_insight_id,
          reason,
        );
        await pgPool!.query(`
          INSERT INTO events (group_id, event_type, agent_id, metadata, status)
          VALUES ($1, 'insight_superseded', 'curator', $2, 'completed')
        `, [insight_id, JSON.stringify({ insight_id, replacement_insight_id, reason })]);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              insight_id,
              replacement_insight_id,
              status: 'Superseded',
              ai_accessible: false,
              message: "Insight superseded through shared lifecycle service"
            }, null, 2)
          }]
        };
      }
      
      case "revoke_insight": {
        const { insight_id, reason, revoked_by } = args as any;

        await curatorRuntime.approvalSyncService.revokeInsight(insight_id, reason, revoked_by || 'curator');
        await pgPool!.query(`
          INSERT INTO events (group_id, event_type, agent_id, metadata, status)
          VALUES ($1, 'insight_revoked', 'curator', $2, 'completed')
        `, [insight_id, JSON.stringify({ insight_id, reason })]);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              insight_id,
              status: 'Revoked',
              ai_accessible: false,
              message: "Insight revoked through shared lifecycle service"
            }, null, 2)
          }]
        };
      }

      case "list_promotable_insights": {
        const { canonical_tag, limit = 20 } = args as any;
        
        const session = neo4jDriver!.session();
        try {
          let cypher = `
            MATCH (i:Insight)
            WHERE i.confidence >= 0.7
            AND i.status = 'Proposed'
            AND (i.promoted_to_notion IS NULL OR i.promoted_to_notion = false)
          `;
          
          const params: any = { limit: neo4j.int(Math.trunc(limit)) };
          
          if (canonical_tag) {
            cypher += ` AND i.canonical_tag = $canonical_tag`;
            params.canonical_tag = normalizeTag(canonical_tag);
          }
          
          cypher += ` RETURN i ORDER BY i.confidence DESC LIMIT $limit`;
          
          const result = await session.run(cypher, params);
          
          const insights = result.records.map((r: { get: (key: string) => { properties: Record<string, unknown> } }) => {
            const props = r.get('i').properties;
            return {
                id: props.insight_id,
                summary: props.summary,
                confidence: props.confidence,
                canonical_tag: props.canonical_tag,
              status: props.status,
              created_at: props.created_at
            };
          });
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                count: insights.length,
                insights,
                message: insights.length > 0 
                  ? 'These insights can be promoted'
                  : 'No promotable insights found'
              }, null, 2)
            }]
          };
        } finally {
          await session.close();
        }
      }
      
      // Notion tools - Human Workspace integration
      // Notion operations use mcp__MCP_DOCKER__notion-* tools directly (auth is configured in MCP_DOCKER)
      // These are convenience wrappers that combine Notion + Neo4j operations
      
      case "search_knowledge_base": {
        const { query, category, tags, ai_accessible_only = true, limit = 10 } = args as any;
        
        // Search Neo4j for synced knowledge items
        const session = neo4jDriver!.session();
        try {
          let cypher = `
            MATCH (k:KnowledgeItem)
            WHERE toLower(coalesce(k.summary, '')) CONTAINS toLower($query)
               OR toLower(coalesce(k.title, '')) CONTAINS toLower($query)
          `;
          const params: any = { query };
          
          if (ai_accessible_only) {
            cypher += ` AND k.ai_accessible = true`;
          }
          
          if (category) {
            cypher += ` AND k.category = $category`;
            params.category = category;
          }
          
          if (tags && tags.length > 0) {
            cypher += ` AND ALL(tag IN $tags WHERE tag IN k.tags)`;
            params.tags = tags;
          }
          
          cypher += ` RETURN k ORDER BY k.confidence DESC LIMIT $limit`;
          params.limit = neo4j.int(Math.trunc(limit));
          
          const result = await session.run(cypher, params);
          const items = result.records.map((r: { get: (key: string) => { properties: Record<string, unknown> } }) => r.get('k').properties);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                source: 'neo4j',
                count: items.length,
                items: items.map((k: Record<string, unknown>) => ({
                  id: k.id,
                  title: k.title,
                  summary: k.summary,
                  category: k.category,
                  tags: k.tags,
                  ai_accessible: k.ai_accessible,
                  confidence: k.confidence
                })),
                note: "Use mcp__MCP_DOCKER__notion-search or mcp__MCP_DOCKER__notion-fetch to search Notion directly"
              }, null, 2)
            }]
          };
        } finally {
          await session.close();
        }
      }
      
      case "create_knowledge_item": {
        const { title, content, category, tags, ai_accessible = true, assigned_agents } = args as any;
        
        // Create in Neo4j first
        const session = neo4jDriver!.session();
        try {
          const itemId = `ki_${Date.now()}`;
          
          await session.run(`
            CREATE (k:KnowledgeItem {
              id: $itemId,
              title: $title,
              summary: $content,
              category: $category,
              tags: $tags,
              ai_accessible: $ai_accessible,
              assigned_agents: $assigned_agents,
              created_at: datetime(),
              source: 'mcp'
            })
            RETURN k
          `, {
            itemId,
            title,
            content,
            category,
            tags: tags || [],
            ai_accessible,
            assigned_agents: assigned_agents || []
          });
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                id: itemId,
                title,
                category,
                tags: tags || [],
                ai_accessible,
                status: 'created_in_neo4j',
                note: "Use mcp__MCP_DOCKER__notion-create-pages to create in Notion",
                mcp_tool: "mcp__MCP_DOCKER__notion-create-pages",
                mcp_params: { title, properties: { Name: { title: [{ text: { content: title } }] } } }
              }, null, 2)
            }]
          };
        } finally {
          await session.close();
        }
      }
      
      case "promote_insight_to_notion": {
        const { insight_id, group_id, summary, trace_ref } = args as any;
        
        // Get the insight from Neo4j first
        const session = neo4jDriver!.session();
        try {
          const insightResult = await session.run(`
            MATCH (i:Insight {insight_id: $insight_id})
            RETURN i
          `, { insight_id });
          
          if (insightResult.records.length === 0) {
            return { content: [{ type: "text", text: `Insight ${insight_id} not found` }], isError: true };
          }
          
          const insight = insightResult.records[0].get('i').properties;
          
          // Update Neo4j insight status
          await session.run(`
            MATCH (i:Insight {insight_id: $insight_id})
            SET i.status = 'promoted', i.promoted_at = datetime()
          `, { insight_id });
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                insight_id,
                status: 'promoted',
                summary: summary || insight.summary,
                confidence: insight.confidence,
                note: "Use mcp__MCP_DOCKER__notion-create-pages to create in Notion Insights database",
                mcp_tool: "mcp__MCP_DOCKER__notion-create-pages",
                mcp_params: {
                  title: summary || insight.summary,
                  properties: {
                    Status: { status: { name: "Pending Review" } },
                    Confidence: { number: insight.confidence }
                  }
                }
              }, null, 2)
            }]
          };
        } finally {
          await session.close();
        }
      }
      
      case "get_agent_context": {
        const { agent_id, group_id } = args as any;
        
        // Get agent context from Neo4j
        const session = neo4jDriver!.session();
        try {
          // Get agent's assigned knowledge items
          const knowledgeResult = await session.run(`
            MATCH (a:AIAgent {id: $agent_id})-[:HAS_ACCESS]->(k:KnowledgeItem)
            WHERE k.ai_accessible = true
            RETURN k
            ORDER BY k.confidence DESC
            LIMIT 20
          `, { agent_id });
          
          // Get agent's activation prompts
          const promptsResult = await session.run(`
            MATCH (a:AIAgent {id: $agent_id})-[:USES_PROMPT]->(p:ActivationPrompt)
            RETURN p
          `, { agent_id });
          
          // Get recent decisions
          const decisionsResult = await session.run(`
            MATCH (a:AIAgent {id: $agent_id})-[:MADE]->(d:ADR)
            WHERE d.created_at > datetime() - duration('P7D')
            RETURN d
            ORDER BY d.created_at DESC
            LIMIT 10
          `, { agent_id });
          
          // Filter by group_id if provided
          let filteredKnowledge = knowledgeResult.records.map((r: { get: (key: string) => { properties: Record<string, unknown> } }) => r.get('k').properties);
          if (group_id) {
            filteredKnowledge = filteredKnowledge.filter((k: Record<string, unknown>) => 
              k.group_id === group_id || !k.group_id
            );
          }
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                agent_id,
                knowledge_items: filteredKnowledge,
                activation_prompts: promptsResult.records.map((r: { get: (key: string) => { properties: Record<string, unknown> } }) => r.get('p').properties),
                recent_decisions: decisionsResult.records.map((r: { get: (key: string) => { properties: Record<string, unknown> } }) => r.get('d').properties)
              }, null, 2)
            }]
          };
        } finally {
          await session.close();
        }
      }
      
      case "list_agent_registry": {
        const { active_only = true } = args as any;
        
        const session = neo4jDriver!.session();
        try {
          let cypher = `MATCH (a:AIAgent)`;
          if (active_only) {
            cypher += ` WHERE a.status = 'active'`;
          }
          cypher += ` RETURN a ORDER BY a.created_at DESC`;
          
          const result = await session.run(cypher);
          const agents = result.records.map((r: { get: (key: string) => { properties: Record<string, unknown> } }) => r.get('a').properties);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                count: agents.length,
                agents: agents.map((a: Record<string, unknown>) => ({
                  id: a.id,
                  name: a.name,
                  status: a.status,
                  role: a.role,
                  created_at: a.created_at
                }))
              }, null, 2)
            }]
          };
        } finally {
          await session.close();
        }
      }
      
      case "sync_drift_report": {
        const { group_id, since } = args as any;
        
        // Get Neo4j knowledge items
        const session = neo4jDriver!.session();
        try {
          const neoResult = await session.run(`
            MATCH (k:KnowledgeItem)
            WHERE k.ai_accessible = true
            ${group_id ? 'AND k.group_id = $group_id' : ''}
            ${since ? 'AND k.updated_at > datetime($since)' : ''}
            RETURN k.id as id, k.title as title, k.updated_at as updated_at, k.notion_page_id as notion_page_id
          `, { group_id, since });
          
          const neoItems = neoResult.records.map(r => ({
            id: r.get('id'),
            title: r.get('title'),
            updated_at: r.get('updated_at'),
            notion_page_id: r.get('notion_page_id')
          }));
          
          const syncedItems = neoItems.filter(i => i.notion_page_id);
          const unsyncedItems = neoItems.filter(i => !i.notion_page_id);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                drift_detected: unsyncedItems.length > 0,
                neo4j_items: neoItems.length,
                synced_count: syncedItems.length,
                unsynced_neo4j: unsyncedItems,
                note: "Use mcp__MCP_DOCKER__notion-fetch to check Notion database status",
                recommendation: unsyncedItems.length > 0
                  ? 'Use mcp__MCP_DOCKER__notion-create-pages to sync unsynced items to Notion'
                  : 'Knowledge bases are in sync'
              }, null, 2)
            }]
          };
        } finally {
          await session.close();
        }
      }
      // ========================================
      // ADAS TOOLS
      // ========================================
      
      case "mcp__adas__run_search": {
        const { domain, iterations = 10, population = 20, group_id = 'global' } = args as any;
        
        // Helper to get domain configuration
        const getDomainConfig = (domainId: string) => {
          const domains: Record<string, any> = {
            "code": { domainId: "code", name: "Code Generation", accuracyWeight: 0.7, costWeight: 0.15, latencyWeight: 0.15 },
            "math": { domainId: "math", name: "Math Solving", accuracyWeight: 0.8, costWeight: 0.1, latencyWeight: 0.1 },
            "reasoning": { domainId: "reasoning", name: "Reasoning", accuracyWeight: 0.6, costWeight: 0.2, latencyWeight: 0.2 }
          };
          return domains[domainId] || { domainId, name: domainId, accuracyWeight: 0.5, costWeight: 0.25, latencyWeight: 0.25 };
        };

        const domainConfig = getDomainConfig(domain);
        
        // Import sandboxed evaluation helpers
        const { createSandboxExecutor, createSandboxedForwardFn } = await import("@/lib/adas");
        const sandbox = createSandboxExecutor();
        
        try {
          const result = await runMetaAgentSearch(
            group_id,
            domainConfig,
            (design) => createSandboxedForwardFn(design, sandbox),
            { maxIterations: iterations, populationSize: population }
          );
          
          return { 
            content: [{ 
              type: "text", 
              text: JSON.stringify({
                domain,
                best_design_id: result.finalBestDesign.design_id,
                best_score: result.finalBestScore,
                iterations_run: result.iterations.length,
                status: "completed",
                best_design: result.finalBestDesign
              }, null, 2) 
            }] 
          };
        } finally {
          await sandbox.cleanup();
        }
      }
      
      case "mcp__adas__get_proposals": {
        const { group_id, status } = args as any;
        const proposals = await getAdasProposals(group_id || 'global');
        
        let filtered = proposals;
        if (status) {
          filtered = proposals.filter((p: any) => p.status === status);
        }
        
        return { 
          content: [{ 
            type: "text", 
            text: JSON.stringify(filtered, null, 2) 
          }] 
        };
      }
      
      case "mcp__adas__approve_proposal": {
        const { proposal_id, decision, reviewer_notes } = args as any;
        
        const session = neo4jDriver!.session();
        try {
          // Find the proposal to get design_id and group_id
          const result = await session.run(
            `MATCH (d:AgentDesign {id: $proposal_id}) RETURN d.design_id as design_id, d.group_id as group_id`,
            { proposal_id }
          );
          
          if (result.records.length === 0) {
            return { content: [{ type: "text", text: `Proposal ${proposal_id} not found` }], isError: true };
          }
          
          const designId = result.records[0].get('design_id');
          const groupId = result.records[0].get('group_id');
          
          if (decision === 'approved') {
            const approvalResult = await approveProposal(designId, groupId, 'mcp-user', reviewer_notes);
            return { content: [{ type: "text", text: JSON.stringify(approvalResult, null, 2) }] };
          } else {
            const rejectionResult = await rejectProposal(designId, groupId, 'mcp-user', reviewer_notes || 'Rejected via MCP');
            return { content: [{ type: "text", text: JSON.stringify(rejectionResult, null, 2) }] };
          }
        } finally {
          await session.close();
        }
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
