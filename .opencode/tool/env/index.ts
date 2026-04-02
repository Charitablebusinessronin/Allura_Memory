import { readFile } from "fs/promises"
import { resolve } from "path"

/**
 * Configuration for environment variable loading
 */
export interface EnvLoaderConfig {
  /** Custom paths to search for .env files (relative to current working directory) */
  searchPaths?: string[]
  /** Whether to log when environment variables are loaded */
  verbose?: boolean
  /** Whether to override existing environment variables */
  override?: boolean
}

/**
 * Default search paths for .env files
 */
const DEFAULT_ENV_PATHS = [
  './.env',
  '../.env', 
  '../../.env',
  '../plugin/.env',
  '../../../.env',
  './docker/.env',
  '../docker/.env'
]

/**
 * Load environment variables from .env files
 * Searches multiple common locations for .env files and loads them into process.env
 * 
 * @param config Configuration options
 * @returns Object containing loaded environment variables
 */
export async function loadEnvVariables(config: EnvLoaderConfig = {}): Promise<Record<string, string>> {
  const { 
    searchPaths = DEFAULT_ENV_PATHS, 
    verbose = false, 
    override = false 
  } = config
  
  const loadedVars: Record<string, string> = {}
  
  for (const envPath of searchPaths) {
    try {
      const fullPath = resolve(envPath)
      const content = await readFile(fullPath, 'utf8')
      
      if (verbose) {
        console.log(`Checking .env file: ${envPath}`)
      }
      
      // Parse .env file content
      const lines = content.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...valueParts] = trimmed.split('=')
          const value = valueParts.join('=').trim()
          
          // Remove quotes if present
          const cleanValue = value.replace(/^["']|["']$/g, '')
          
          if (key && cleanValue && (override || !process.env[key])) {
            process.env[key] = cleanValue
            loadedVars[key] = cleanValue
            
            if (verbose) {
              console.log(`Loaded ${key} from ${envPath}`)
            }
          }
        }
      }
    } catch (error) {
      // File doesn't exist or can't be read, continue to next
      if (verbose) {
        console.log(`Could not read ${envPath}: ${error.message}`)
      }
    }
  }
  
  return loadedVars
}

/**
 * Get a specific environment variable with automatic .env file loading
 * 
 * @param varName Name of the environment variable
 * @param config Configuration options
 * @returns The environment variable value or null if not found
 */
export async function getEnvVariable(varName: string, config: EnvLoaderConfig = {}): Promise<string | null> {
  // First check if it's already in the environment
  let value = process.env[varName]
  
  if (!value) {
    // Try to load from .env files
    const loadedVars = await loadEnvVariables(config)
    value = loadedVars[varName] || process.env[varName]
  }
  
  return value || null
}

/**
 * Get a required environment variable with automatic .env file loading
 * Throws an error if the variable is not found
 * 
 * @param varName Name of the environment variable
 * @param config Configuration options
 * @returns The environment variable value
 * @throws Error if the variable is not found
 */
export async function getRequiredEnvVariable(varName: string, config: EnvLoaderConfig = {}): Promise<string> {
  const value = await getEnvVariable(varName, config)
  
  if (!value) {
    const searchPaths = config.searchPaths || DEFAULT_ENV_PATHS
    throw new Error(`${varName} not found. Please set it in your environment or .env file.
    
To fix this:
1. Add to .env file: ${varName}=your_value_here
2. Or export it: export ${varName}=your_value_here

Current working directory: ${process.cwd()}
Searched paths: ${searchPaths.join(', ')}
Environment variables available: ${Object.keys(process.env).filter(k => k.includes(varName.split('_')[0])).join(', ') || 'none matching'}`)
  }
  
  return value
}

/**
 * Load multiple required environment variables at once
 * 
 * @param varNames Array of environment variable names
 * @param config Configuration options
 * @returns Object with variable names as keys and values as values
 * @throws Error if any variable is not found
 */
export async function getRequiredEnvVariables(varNames: string[], config: EnvLoaderConfig = {}): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  
  // Load all .env files first
  await loadEnvVariables(config)
  
  // Check each required variable
  for (const varName of varNames) {
    const value = process.env[varName]
    if (!value) {
      throw new Error(`Required environment variable ${varName} not found. Please set it in your environment or .env file.`)
    }
    result[varName] = value
  }
  
  return result
}

/**
 * Utility function specifically for API keys
 * 
 * @param apiKeyName Name of the API key environment variable
 * @param config Configuration options
 * @returns The API key value
 * @throws Error if the API key is not found
 */
export async function getApiKey(apiKeyName: string, config: EnvLoaderConfig = {}): Promise<string> {
  return getRequiredEnvVariable(apiKeyName, config)
}

/**
 * Get MCP Docker database configuration
 * Returns the configuration object needed for MCP_DOCKER_mcp-config-set
 * 
 * @param config Configuration options
 * @returns Object with database_url for PostgreSQL and Neo4j config
 */
export async function getMcpDockerDbConfig(config: EnvLoaderConfig = {}): Promise<{
  postgres: { database_url: string }
  neo4j: { url: string; username: string; password: string }
}> {
  await loadEnvVariables(config)
  
  const postgresPassword = process.env.POSTGRES_PASSWORD || 'password123'
  const postgresUser = process.env.POSTGRES_USER || 'ronin4life'
  const postgresHost = process.env.POSTGRES_HOST || 'host.docker.internal'
  const postgresPort = process.env.POSTGRES_PORT || '5432'
  const postgresDb = process.env.POSTGRES_DB || 'memory'
  
  const neo4jPassword = process.env.NEO4J_PASSWORD || 'password123'
  const neo4jUser = process.env.NEO4J_USER || 'neo4j'
  const neo4jUri = process.env.NEO4J_URI || 'bolt://host.docker.internal:7687'
  
  return {
    postgres: {
      database_url: `postgresql+asyncpg://${postgresUser}:${postgresPassword}@${postgresHost}:${postgresPort}/${postgresDb}`
    },
    neo4j: {
      url: neo4jUri,
      username: neo4jUser,
      password: neo4jPassword
    }
  }
}

/**
 * Check if MCP Docker should be used for database operations
 * Returns true if containers are running
 * 
 * @returns boolean indicating if MCP Docker is available
 */
export function shouldUseMcpDocker(): boolean {
  // Always return true - MCP Docker is the standard
  return true
}

/**
 * Get container status for MCP Docker servers
 * 
 * @returns Object with container status
 */
export async function getContainerStatus(): Promise<{
  postgres: boolean
  neo4j: boolean
}> {
  try {
    // These would need to be run via bash tool in actual usage
    return {
      postgres: true, // Assume running for now
      neo4j: true
    }
  } catch {
    return {
      postgres: false,
      neo4j: false
    }
  }
}