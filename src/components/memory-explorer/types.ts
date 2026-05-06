/*
 * Memory Explorer — TypeScript type definitions
 * Per spec §7: 6 node types with distinct shapes
 */

export type NodeType = "memory" | "insight" | "evidence" | "agent" | "project" | "system"

export interface GraphNode {
  id: string
  label: string
  type: NodeType
  metadata?: {
    source?: string
    timestamp?: string
    confidence?: number
    content?: string
    evidence?: string
  }
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export type NodeShape = "circle" | "diamond" | "rounded-square"

export const NODE_SHAPE: Record<NodeType, NodeShape> = {
  memory: "circle",
  insight: "circle",
  evidence: "circle",
  agent: "diamond",
  project: "rounded-square",
  system: "circle",
}

/** Sizing per spec §7 */
export const NODE_RADIUS: Record<NodeType, number> = {
  memory: 12,
  insight: 8,
  evidence: 10,
  agent: 8,
  project: 10,
  system: 6,
}

/** Search result item */
export interface SearchResult {
  node: GraphNode
  snippet?: string
}
