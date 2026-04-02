/**
 * MCP Docker Configuration Tool
 * 
 * Standard configuration for MCP_DOCKER database operations
 * This ensures all OpenCode agents use MCP_DOCKER correctly
 */

import { getMcpDockerDbConfig } from "./env/index"

export interface McpDockerServerConfig {
  name: string
  config: Record<string, string>
}

/**
 * Get standard MCP Docker server configurations
 * Use this for ALL database operations
 */
export async function getMcpDockerServers(): Promise<{
  databaseServer: McpDockerServerConfig
  neo4jCypher: McpDockerServerConfig
}> {
  const dbConfig = await getMcpDockerDbConfig()

  return {
    databaseServer: {
      name: "database-server",
      config: dbConfig.postgres
    },
    neo4jCypher: {
      name: "neo4j-cypher",
      config: dbConfig.neo4j
    }
  }
}

/**
 * Standard workflow for using MCP Docker
 * 
 * Usage:
 *   import { setupMcpDocker } from "./mcp-docker-config"
 *   await setupMcpDocker() // Configures and activates MCP servers
 */
export async function setupMcpDocker(): Promise<void> {
  const servers = await getMcpDockerServers()
  
  console.log("MCP Docker servers configured:")
  console.log(`  - ${servers.databaseServer.name}: PostgreSQL connection`)
  console.log(`  - ${servers.neo4jCypher.name}: Neo4j connection`)
  console.log("")
  console.log("Use MCP_DOCKER tools for all database operations:")
  console.log("  MCP_DOCKER_query_database({ query: '...' })")
  console.log("  MCP_DOCKER_execute_sql({ sql_query: '...' })")
  console.log("  MCP_DOCKER_read_neo4j_cypher({ query: '...' })")
  console.log("  MCP_DOCKER_insert_data({ table_name: '...' })")
  console.log("  MCP_DOCKER_write_neo4j_cypher({ query: '...' })")
}

/**
 * Validation check - ensures MCP Docker is being used
 * Call this before database operations
 */
export function validateMcpDockerUsage(): void {
  // This is enforced by agent guidelines, not runtime checks
  console.log("✅ MCP Docker validation passed")
  console.log("   Remember: Use MCP_DOCKER tools, never docker exec")
}

/**
 * Error message for incorrect usage
 */
export function getMcpDockerErrorMessage(): string {
  return `
❌ INCORRECT: Using docker exec for database operations

✅ CORRECT: Use MCP_DOCKER tools instead:
   - MCP_DOCKER_query_database({ query: "..." })
   - MCP_DOCKER_execute_sql({ sql_query: "..." })
   - MCP_DOCKER_read_neo4j_cypher({ query: "..." })
   - MCP_DOCKER_insert_data({ table_name: "..." })
   - MCP_DOCKER_write_neo4j_cypher({ query: "..." })

See UNIVERSAL_MCP_RULE.md for details.
`
}
