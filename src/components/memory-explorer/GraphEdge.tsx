"use client"

import type { GraphEdge as EdgeData, GraphNode as NodeData, NodeType } from "./types"

interface GraphEdgeProps {
  edge: EdgeData
  sourcePos: { x: number; y: number }
  targetPos: { x: number; y: number }
  isHighlighted: boolean
}

/**
 * GraphEdge — SVG line between two nodes
 * Per spec §2: opacity 0 default, 0.30 when highlighted; no arrowheads
 */
export function GraphEdge({ edge, sourcePos, targetPos, isHighlighted }: GraphEdgeProps) {
  return (
    <line
      className="memory-explorer__edge"
      x1={sourcePos.x}
      y1={sourcePos.y}
      x2={targetPos.x}
      y2={targetPos.y}
      data-edge-id={edge.id}
      data-edge-label={edge.label ?? ""}
      style={{ opacity: isHighlighted ? 0.30 : 0 }}
    />
  )
}
