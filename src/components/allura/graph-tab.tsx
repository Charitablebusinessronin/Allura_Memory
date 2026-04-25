"use client"

import { useCallback, useMemo, useState } from "react"
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  type Node,
  type Edge,
  type NodeTypes,
  MarkerType,
  useNodesState,
  useEdgesState,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import type { Memory } from "@/hooks/use-memory-list"

interface GraphTabProps {
  onNodeClick?: (memory: Memory) => void
}

type NodeCategory = "people" | "topics" | "decisions" | "traces"

const CATEGORY_COLORS: Record<NodeCategory, string> = {
  people: "var(--allura-deep-navy)",
  topics: "var(--allura-clarity-blue)",
  decisions: "var(--allura-trust-green)",
  traces: "var(--allura-coral)",
}

const CATEGORY_TEXT: Record<NodeCategory, string> = {
  people: "#FFFFFF",
  topics: "#FFFFFF",
  decisions: "#FFFFFF",
  traces: "#FFFFFF",
}

const EDGE_STYLES: Record<string, { stroke: string; strokeDasharray?: string; markerEnd?: boolean }> = {
  DERIVED_FROM: { stroke: "var(--allura-warm-gray)", strokeDasharray: "5 5" },
  APPROVED_BY: { stroke: "var(--allura-deep-navy)" },
  SUPERSEDES: { stroke: "var(--allura-coral)", markerEnd: true },
}

const NODE_LIMIT = 100
const NEIGHBORHOOD_THRESHOLD = 80

function CustomNode({ data }: { data: { label: string; category: NodeCategory } }) {
  const bgColor = CATEGORY_COLORS[data.category]
  const textColor = CATEGORY_TEXT[data.category]

  return (
    <div
      className="flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold shadow-[var(--allura-shadow-card)]"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        borderRadius: "var(--allura-radius-badge)",
        minWidth: 80,
      }}
    >
      {data.label}
    </div>
  )
}

const nodeTypes: NodeTypes = {
  custom: CustomNode,
}

function generateSampleData() {
  const categories: NodeCategory[] = ["people", "topics", "decisions", "traces"]
  const nodes: Node[] = []
  const edges: Edge[] = []
  const labels = [
    "Agent Brooks", "Agent Woz", "Agent Scout",
    "Memory Architecture", "Curator Pipeline", "Knowledge Graph",
    "Switch to RuVector", "Deprecate Durham tokens",
    "Trace #1042", "Trace #1087", "Trace #1123", "Trace #1099",
  ]

  const limit = Math.min(labels.length, NODE_LIMIT)
  for (let i = 0; i < limit; i++) {
    const category = categories[i % categories.length]
    const angle = (2 * Math.PI * i) / limit
    const radius = 200 + (i % 3) * 80
    nodes.push({
      id: `node-${i}`,
      type: "custom",
      position: { x: 400 + Math.cos(angle) * radius, y: 300 + Math.sin(angle) * radius },
      data: { label: labels[i], category },
    })
  }

  const edgeTypes = ["DERIVED_FROM", "APPROVED_BY", "SUPERSEDES"]
  for (let i = 0; i < limit - 1; i++) {
    const edgeType = edgeTypes[i % edgeTypes.length]
    const style = EDGE_STYLES[edgeType]
    edges.push({
      id: `edge-${i}`,
      source: `node-${i}`,
      target: `node-${(i + 1) % limit}`,
      style: { stroke: style.stroke, strokeDasharray: style.strokeDasharray },
      markerEnd: style.markerEnd ? { type: MarkerType.ArrowClosed, color: style.stroke } : undefined,
      label: edgeType.replace(/_/g, " ").toLowerCase(),
    })
  }

  return { nodes, edges }
}

export function GraphTab({ onNodeClick }: GraphTabProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => generateSampleData(), [])
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [searchTerm, setSearchTerm] = useState("")
  const [neighborhoodMode, setNeighborhoodMode] = useState(false)

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        const memory: Memory = {
          id: node.id,
          content: String(node.data?.label ?? ""),
          score: 0.85,
          source: "semantic",
          provenance: "conversation",
          created_at: new Date().toISOString(),
        }
        onNodeClick(memory)
      }

      if (nodes.length >= NEIGHBORHOOD_THRESHOLD) {
        setNeighborhoodMode(true)
      }
    },
    [onNodeClick, nodes.length, setNeighborhoodMode]
  )

  const filteredNodes = useMemo(() => {
    if (!searchTerm) return nodes
    return nodes.filter((n) =>
      String(n.data?.label ?? "").toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [nodes, searchTerm])

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--allura-deep-navy)]/10 bg-white" style={{ height: 500 }}>
      {/* Search overlay */}
      <div className="absolute top-3 left-3 z-10">
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-9 w-48 border border-[var(--allura-deep-navy)]/20 bg-white/90 px-3 text-sm shadow-[var(--allura-shadow-card)] backdrop-blur-sm"
          style={{ borderRadius: "var(--allura-radius-input)" }}
        />
      </div>

      {/* Neighborhood mode indicator */}
      {neighborhoodMode && (
        <div className="absolute top-3 right-3 z-10 rounded-lg bg-[var(--allura-coral-10)] px-3 py-1 text-xs font-medium text-[var(--allura-deep-navy)]">
          Neighborhood mode
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 flex gap-3 rounded-lg bg-white/90 px-3 py-2 shadow-[var(--allura-shadow-card)] backdrop-blur-sm">
        {(["people", "topics", "decisions", "traces"] as const).map((cat) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div className="size-3 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
            <span className="text-xs capitalize text-[var(--allura-warm-gray)]">{cat}</span>
          </div>
        ))}
      </div>

      <ReactFlow
        nodes={filteredNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          className="!border-[var(--allura-deep-navy)]/10 !shadow-[var(--allura-shadow-card)]"
        />
        <MiniMap
          nodeColor={(n) => {
            const cat = n.data?.category as NodeCategory | undefined
            return cat ? CATEGORY_COLORS[cat] : "var(--allura-warm-gray)"
          }}
          maskColor="rgba(26, 43, 74, 0.1)"
          className="!border-[var(--allura-deep-navy)]/10 !shadow-[var(--allura-shadow-card)]"
        />
        <Background color="var(--allura-navy-5)" gap={16} />
      </ReactFlow>
    </div>
  )
}