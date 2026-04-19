/**
 * Graph Adapter Factory — Feature Flag Selection (Slice C)
 *
 * Selects the IGraphAdapter implementation based on GRAPH_BACKEND env var.
 *
 * GRAPH_BACKEND=neo4j     → Neo4jGraphAdapter (legacy, default for backward compat)
 * GRAPH_BACKEND=ruvector  → RuVectorGraphAdapter (new, target)
 *
 * After Slice E (Remove Neo4j), the flag and Neo4j adapter are removed,
 * and RuVectorGraphAdapter becomes the sole implementation.
 *
 * ADR: AD-029 — Graph Adapter Pattern for Neo4j → RuVector Migration
 */

import type { IGraphAdapter } from "./types"
import { Neo4jGraphAdapter } from "./neo4j-adapter"
import { RuVectorGraphAdapter } from "./ruvector-adapter"
import type { Driver } from "neo4j-driver"
import type { Pool } from "pg"

export type GraphBackend = "neo4j" | "ruvector"

/**
 * Get the configured graph backend from environment.
 * Defaults to "neo4j" for backward compatibility during migration.
 */
export function getGraphBackend(): GraphBackend {
  const value = process.env.GRAPH_BACKEND?.toLowerCase()
  if (value === "ruvector") return "ruvector"
  if (value === "neo4j") return "neo4j"
  // Default: neo4j during migration, ruvector after Slice E
  return "neo4j"
}

/**
 * Create the appropriate graph adapter based on feature flag.
 *
 * @param connections - Object with pg Pool and/or neo4j Driver
 * @returns IGraphAdapter instance
 *
 * @example
 * ```ts
 * // With Neo4j (legacy)
 * const adapter = createGraphAdapter({ neo4j: driver })
 *
 * // With RuVector (new)
 * const adapter = createGraphAdapter({ pg: pool })
 *
 * // Auto-select based on GRAPH_BACKEND env var
 * const adapter = createGraphAdapter({ pg: pool, neo4j: driver })
 * ```
 */
export function createGraphAdapter(connections: {
  pg?: Pool
  neo4j?: Driver
}): IGraphAdapter {
  const backend = getGraphBackend()

  if (backend === "ruvector") {
    if (!connections.pg) {
      throw new Error(
        "GRAPH_BACKEND=ruvector but no PostgreSQL pool provided. " +
        "Ensure PG connection is available for graph adapter."
      )
    }
    return new RuVectorGraphAdapter(connections.pg)
  }

  // neo4j (default)
  if (!connections.neo4j) {
    throw new Error(
      "GRAPH_BACKEND=neo4j but no Neo4j driver provided. " +
      "Ensure Neo4j connection is available, or set GRAPH_BACKEND=ruvector."
    )
  }
  return new Neo4jGraphAdapter(connections.neo4j)
}

/**
 * Check if the graph adapter is available for the configured backend.
 * Returns false if required connections are missing.
 */
export function isGraphAdapterAvailable(connections: {
  pg?: Pool
  neo4j?: Driver
}): boolean {
  const backend = getGraphBackend()
  if (backend === "ruvector") {
    return connections.pg != null
  }
  return connections.neo4j != null
}