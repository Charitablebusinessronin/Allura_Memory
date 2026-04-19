/**
 * RuVector Connection Module
 * 
 * High Performance Vector DB with GNN - PostgreSQL extension
 * https://github.com/Charitablebusinessronin/RuVector
 * 
 * RuVector provides:
 * - 143 SQL functions for vector operations
 * - HNSW progressive indexing (Layer A/B/C)
 * - Graph Neural Network integration
 * - Real-time self-learning
 * - Fractional Kelly for optimal sizing
 * - LSTM-Transformer for temporal prediction
 */

import { Pool } from "pg";
import { env } from "process";

// Server-only guard: throw if imported in browser environment
if (typeof window !== "undefined") {
  throw new Error("RuVector connection module can only be used server-side");
}

/**
 * RuVector connection configuration
 * Built from environment variables with safe defaults
 */
export interface RuVectorConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
  max: number;
}

/**
 * Pool configuration for connection safety
 */
interface PoolConfig {
  maxConnections: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
}

const DEFAULT_POOL_CONFIG: PoolConfig = {
  maxConnections: parseInt(env.RUVECTOR_POOL_MAX || "5", 10),
  connectionTimeoutMillis: 10000, // 10 seconds
  idleTimeoutMillis: 30000, // 30 seconds
};

// Singleton pool instance
let poolInstance: Pool | null = null;

/**
 * Get connection configuration from environment variables
 * Uses safe defaults matching docker-compose.yml setup
 */
export function getRuVectorConnectionConfig(): RuVectorConnectionConfig {
  const password = env.RUVECTOR_PASSWORD || env.POSTGRES_PASSWORD;
  
  if (!password) {
    throw new Error("RUVECTOR_PASSWORD or POSTGRES_PASSWORD environment variable is required");
  }

  return {
    host: env.RUVECTOR_HOST || "localhost",
    port: parseInt(env.RUVECTOR_PORT || "5432", 10),
    database: env.RUVECTOR_DB || env.POSTGRES_DB || "ruvector_test",
    user: env.RUVECTOR_USER || env.POSTGRES_USER || "ruvector",
    password,
    connectionTimeoutMillis: DEFAULT_POOL_CONFIG.connectionTimeoutMillis,
    idleTimeoutMillis: DEFAULT_POOL_CONFIG.idleTimeoutMillis,
    max: DEFAULT_POOL_CONFIG.maxConnections,
  };
}

/**
 * Get or create the RuVector connection pool
 * 
 * RuVector runs on port 5433 by default (separate from main PostgreSQL on 5432)
 * This allows vector operations without affecting the main memory traces database.
 */
export function getRuVectorPool(): Pool {
  if (!poolInstance) {
    const config = getRuVectorConnectionConfig();
    
    poolInstance = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
      idleTimeoutMillis: config.idleTimeoutMillis,
      max: config.max,
    });

    // Log connection errors
    poolInstance.on("error", (err) => {
      console.error("[RuVector] Unexpected connection error:", err);
    });

    console.log(`[RuVector] Pool created: ${config.host}:${config.port}/${config.database}`);
  }

  return poolInstance;
}

/**
 * Close the RuVector connection pool
 * Call during graceful shutdown
 */
export async function closeRuVectorPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    console.log("[RuVector] Pool closed");
  }
}

/**
 * Check if RuVector is enabled
 */
export function isRuVectorEnabled(): boolean {
  return env.RUVECTOR_ENABLED === "true";
}

/**
 * Health check for RuVector connection
 */
export async function checkRuVectorHealth(): Promise<{
  status: "healthy" | "unhealthy";
  latencyMs: number;
  version?: string;
}> {
  const startTime = Date.now();
  
  try {
    const pool = getRuVectorPool();
    const result = await pool.query("SELECT version()");
    const latencyMs = Date.now() - startTime;
    
    return {
      status: "healthy",
      latencyMs,
      version: result.rows[0]?.version,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * RuVector SQL Functions Reference (143 functions)
 * 
 * Key function categories:
 * - Vector similarity: cosine_similarity, euclidean_distance, dot_product
 * - HNSW indexing: hnsw_build, hnsw_insert, hnsw_search
 * - GNN operations: gnn_forward, gnn_backward, gnn_embed
 * - Quantization: scalar_quantize, product_quantize, binary_quantize
 * - Crypto: shake256_hash, ed25519_sign, witness_chain
 * 
 * See: https://github.com/Charitablebusinessronin/RuVector
 */

/**
 * Example: Create a vector table for embeddings
 */
export async function createVectorTable(
  tableName: string,
  dimensions: number = 1536
): Promise<void> {
  const pool = getRuVectorPool();
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      embedding VECTOR(${dimensions}),
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_${tableName}_group 
      ON ${tableName}(group_id, created_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_${tableName}_embedding 
      ON ${tableName} USING hnsw (embedding vector_cosine_ops);
  `);
}

/**
 * Example: Insert embedding with vector
 */
export async function insertEmbedding(
  tableName: string,
  groupId: string,
  content: string,
  embedding: number[],
  metadata: Record<string, unknown> = {}
): Promise<string> {
  const pool = getRuVectorPool();
  
  const result = await pool.query(
    `INSERT INTO ${tableName} (group_id, content, embedding, metadata)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [groupId, content, `[${embedding.join(",")}]`, JSON.stringify(metadata)]
  );
  
  return result.rows[0].id;
}

/**
 * Example: Semantic search using vector similarity
 */
export async function searchSimilar(
  tableName: string,
  groupId: string,
  queryEmbedding: number[],
  limit: number = 10,
  threshold: number = 0.75
): Promise<Array<{
  id: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
}>> {
  const pool = getRuVectorPool();
  
  const result = await pool.query(
    `SELECT id, content, metadata,
            1 - (embedding <=> $2::vector) AS similarity
     FROM ${tableName}
     WHERE group_id = $1
       AND 1 - (embedding <=> $2::vector) >= $4
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    [groupId, `[${queryEmbedding.join(",")}]`, limit, threshold]
  );
  
  return result.rows.map((row) => ({
    id: row.id,
    content: row.content,
    similarity: parseFloat(row.similarity),
    metadata: row.metadata,
  }));
}