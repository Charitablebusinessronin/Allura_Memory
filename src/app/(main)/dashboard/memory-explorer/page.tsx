"use client"

import { useEffect, useMemo, useState } from "react"
import { MemoryExplorer } from "@/components/memory-explorer"
import type { GraphEdgeData, GraphNodeData, NodeType } from "@/components/memory-explorer"

// ─── Fallback demo graph — Allura Memory content model ───────────────────────
// Used when live data is unavailable (graceful degradation)
const FALLBACK_NODES: GraphNodeData[] = [
  { id: "n1",  label: "MCP Auth Failure",       type: "memory"  },
  { id: "n2",  label: "Missing DB Secrets",      type: "memory"  },
  { id: "n3",  label: "Postgres Auth Failed",    type: "memory"  },
  { id: "n4",  label: "Agent Brooks",            type: "agent"   },
  { id: "n5",  label: "Allura Core",             type: "system"  },
  { id: "n6",  label: "Insight: Add Secret Check", type: "insight" },
  { id: "n7",  label: "Evidence: Error Log",     type: "evidence" },
  { id: "n8",  label: "Project: Allura Memory",  type: "project" },
  { id: "n9",  label: "Tool Retry Without Context", type: "memory" },
  { id: "n10", label: "User Onboarding Dropoff", type: "memory"  },
  { id: "n11", label: "Retrieval Pattern",       type: "memory"  },
  { id: "n12", label: "Promotion Candidate",     type: "insight" },
]

const FALLBACK_EDGES: GraphEdgeData[] = [
  { id: "e1",  source: "n2", target: "n1",  label: "caused"      },
  { id: "e2",  source: "n2", target: "n3",  label: "led to"      },
  { id: "e3",  source: "n4", target: "n1",  label: "observed"    },
  { id: "e4",  source: "n7", target: "n6",  label: "supports"    },
  { id: "e5",  source: "n6", target: "n8",  label: "informs"     },
  { id: "e6",  source: "n4", target: "n9",  label: "triggered"   },
  { id: "e7",  source: "n5", target: "n2",  label: "missing"     },
  { id: "e8",  source: "n10", target: "n8", label: "impacts"     },
  { id: "e9",  source: "n11", target: "n12",label: "candidate"   },
  { id: "e10", source: "n12", target: "n6", label: "promotes to" },
  { id: "e11", source: "n1",  target: "n3", label: "triggered"   },
]

/** Map lib GraphNode types to spec NodeType (handle "event" → "evidence",
 *  "outcome" → "insight") */
function normalizeNodeType(raw: string): NodeType {
  const specTypes = new Set<string>(["memory", "insight", "evidence", "agent", "project", "system"])
  if (specTypes.has(raw)) return raw as NodeType
  if (raw === "event") return "evidence"
  if (raw === "outcome") return "insight"
  return "memory" // best-effort fallback
}

interface LibGraphNode {
  id: string
  label: string
  type: string
  metadata?: Record<string, unknown>
}

interface LibGraphEdge {
  id: string
  source: string
  target: string
  label?: string
}

function adaptNode(raw: LibGraphNode): GraphNodeData {
  return {
    id: raw.id,
    label: raw.label,
    type: normalizeNodeType(raw.type),
    metadata: raw.metadata ? {
      source: typeof raw.metadata.source === "string" ? raw.metadata.source : undefined,
      timestamp: typeof raw.metadata.timestamp === "string" ? raw.metadata.timestamp : undefined,
      confidence: typeof raw.metadata.confidence === "number" ? raw.metadata.confidence : undefined,
      content: typeof raw.metadata.content === "string" ? raw.metadata.content : undefined,
      evidence: typeof raw.metadata.evidence === "string" ? raw.metadata.evidence : undefined,
    } : undefined,
  }
}

function adaptEdge(raw: LibGraphEdge): GraphEdgeData {
  return {
    id: raw.id,
    source: raw.source,
    target: raw.target,
    label: raw.label,
  }
}

export default function MemoryExplorerPage() {
  const [liveNodes, setLiveNodes] = useState<LibGraphNode[] | null>(null)
  const [liveEdges, setLiveEdges] = useState<LibGraphEdge[] | null>(null)
  const [degraded, setDegraded] = useState(false)

  // Attempt to load live data; fall back to demo data
  useEffect(() => {
    async function fetchLive() {
      try {
        const { loadGraph } = await import("@/lib/dashboard/queries")
        const result = await loadGraph()
        if (result?.data) {
          setLiveNodes(result.data.nodes)
          setLiveEdges(result.data.edges)
        }
      } catch {
        setDegraded(true)
      }
    }
    fetchLive()
  }, [])

  const nodes = useMemo<GraphNodeData[]>(
    () => liveNodes ? liveNodes.map(adaptNode) : FALLBACK_NODES,
    [liveNodes]
  )
  const edges = useMemo<GraphEdgeData[]>(
    () => liveEdges ? liveEdges.map(adaptEdge) : FALLBACK_EDGES,
    [liveEdges]
  )

  return (
    <div className="dark -mx-4 -my-6 sm:-mx-6 sm:-my-8 lg:-mx-8 lg:-py-8" style={{ height: "calc(100vh - 3.5rem)" }}>
      {degraded && (
        <div style={{
          position: "absolute",
          top: "var(--allura-sm)",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 30,
          background: "var(--dashboard-warning)",
          color: "var(--dashboard-text-primary)",
          padding: "var(--allura-xs) var(--allura-md)",
          borderRadius: "var(--allura-r-md)",
          fontFamily: "var(--font-family-brand)",
          fontSize: "0.75rem",
        }}>
          Could not load live data — showing preview
        </div>
      )}
      <MemoryExplorer nodes={nodes} edges={edges} />
    </div>
  )
}
