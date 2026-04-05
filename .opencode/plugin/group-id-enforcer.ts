/**
 * Group ID Enforcer Plugin for OpenCode
 * 
 * Validates and enforces group_id on all MCP_DOCKER tool calls.
 * This ensures tenant isolation at the agent execution layer.
 * 
 * ARCH-001: Wire groupIdEnforcer into OpenCode plugin hooks
 */

import type { Plugin } from "@opencode-ai/plugin"

// 🔧 CONFIGURATION
const ENABLED = true
const DEFAULT_GROUP_ID = "allura-default"
const GROUP_ID_PATTERN = /^allura-[a-z0-9][a-z0-9_-]*[a-z0-9]$/

// MCP_DOCKER tools that require group_id
const MCP_TOOLS_REQUIRING_GROUP_ID = [
  // Notion tools
  "MCP_DOCKER_notion-create-comment",
  "MCP_DOCKER_notion-create-database",
  "MCP_DOCKER_notion-create-pages",
  "MCP_DOCKER_notion-create-view",
  "MCP_DOCKER_notion-duplicate-page",
  "MCP_DOCKER_notion-fetch",
  "MCP_DOCKER_notion-get-comments",
  "MCP_DOCKER_notion-get-teams",
  "MCP_DOCKER_notion-get-users",
  "MCP_DOCKER_notion-move-pages",
  "MCP_DOCKER_notion-query-database-view",
  "MCP_DOCKER_notion-query-meeting-notes",
  "MCP_DOCKER_notion-search",
  "MCP_DOCKER_notion-update-data-source",
  "MCP_DOCKER_notion-update-page",
  "MCP_DOCKER_notion-update-view",
  
  // Tavily tools
  "MCP_DOCKER_tavily_crawl",
  "MCP_DOCKER_tavily_extract",
  "MCP_DOCKER_tavily_map",
  "MCP_DOCKER_tavily_research",
  "MCP_DOCKER_tavily_search",
  
  // Exa tools
  "MCP_DOCKER_web_search_exa",
  "MCP_DOCKER_crawling_exa",
  "MCP_DOCKER_get_code_context_exa",
  "exa_web_search_exa",
  "exa_crawling_exa",
  "exa_get_code_context_exa",
  
  // Prisma Postgres tools
  "MCP_DOCKER_create_prisma_postgres_backup",
  "MCP_DOCKER_create_prisma_postgres_connection_string",
  "MCP_DOCKER_create_prisma_postgres_database",
  "MCP_DOCKER_create_prisma_postgres_recovery",
  "MCP_DOCKER_delete_prisma_postgres_connection_string",
  "MCP_DOCKER_delete_prisma_postgres_database",
  "MCP_DOCKER_execute_prisma_postgres_schema_update",
  "MCP_DOCKER_execute_sql_query",
  "MCP_DOCKER_fetch_workspace_details",
  "MCP_DOCKER_introspect_database_schema",
  "MCP_DOCKER_list_prisma_postgres_backups",
  "MCP_DOCKER_list_prisma_postgres_connection_strings",
  "MCP_DOCKER_list_prisma_postgres_databases",
]

/**
 * Validate group_id format
 * Must follow allura-* naming convention
 */
function validateGroupId(groupId: string): { valid: boolean; error?: string } {
  if (!groupId || typeof groupId !== 'string') {
    return { valid: false, error: "group_id is required" }
  }
  
  const trimmed = groupId.trim()
  
  if (trimmed.length === 0) {
    return { valid: false, error: "group_id cannot be empty" }
  }
  
  if (!GROUP_ID_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: `group_id must match pattern allura-* (got: '${trimmed}'). Example: allura-faith-meats`
    }
  }
  
  return { valid: true }
}

/**
 * Get group_id from environment or default
 * Priority: GROUP_ID env var > DEFAULT_GROUP_ID
 */
function getGroupId(): string {
  return process.env.GROUP_ID || DEFAULT_GROUP_ID
}

/**
 * Group ID Enforcer Plugin
 * 
 * Intercepts MCP_DOCKER tool calls and validates/injects group_id
 */
export const GroupIdEnforcer: Plugin = async ({ $ }) => {
  // Plugin disabled - set ENABLED = true to activate
  if (!ENABLED) return {}

  return {
    /**
     * Hook: tool.execute.before
     * 
     * Validates and injects group_id on MCP_DOCKER tool calls.
     * This ensures tenant isolation at the agent execution layer.
     */
    "tool.execute.before": async (input, output) => {
      const toolName = input.tool as string
      
      // Only enforce on MCP_DOCKER tools
      if (!MCP_TOOLS_REQUIRING_GROUP_ID.includes(toolName)) {
        return
      }
      
      // Get args (may be renamed by output)
      const args = output.args || {}
      
      // Check if group_id is provided
      if (args.group_id) {
        // Validate existing group_id
        const validation = validateGroupId(args.group_id as string)
        if (!validation.valid) {
          // Log error and block execution
          console.error(`[GroupIdEnforcer] Invalid group_id: ${validation.error}`)
          throw new Error(`[GroupIdEnforcer] ${validation.error}`)
        }
        // Valid group_id - allow execution
        return
      }
      
      // No group_id provided - inject default
      const groupId = getGroupId()
      const validation = validateGroupId(groupId)
      
      if (!validation.valid) {
        console.error(`[GroupIdEnforcer] Invalid default group_id: ${validation.error}`)
        throw new Error(`[GroupIdEnforcer] ${validation.error}`)
      }
      
      // Inject validated group_id
      output.args = {
        ...args,
        group_id: groupId
      }
      
      console.log(`[GroupIdEnforcer] Injected group_id: ${groupId} for tool: ${toolName}`)
    },

    /**
     * Hook: tool.execute.after
     * 
     * Logs group_id usage after tool execution for audit trail.
     */
    "tool.execute.after": async (input, output) => {
      const toolName = input.tool as string
      
      if (!MCP_TOOLS_REQUIRING_GROUP_ID.includes(toolName)) {
        return
      }
      
      const groupId = (input.args as any)?.group_id || "unknown"
      
      // Log for audit trail
      console.log(`[GroupIdEnforcer] Tool ${toolName} executed with group_id: ${groupId}`)
    },

    /**
     * Hook: shell.env
     * 
     * Injects GROUP_ID into shell environment for tools that use shell commands.
     */
    "shell.env": async (input, output) => {
      output.env.GROUP_ID = getGroupId()
    }
  }
}

export default GroupIdEnforcer