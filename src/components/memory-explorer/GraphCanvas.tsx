"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import type { GraphEdge as EdgeData, GraphNode as NodeData } from "./types"
import { GraphEdge } from "./GraphEdge"
import { GraphNode } from "./GraphNode"

const PAN_STEP = 40
const ZOOM_FACTOR = 0.9

interface LayoutNode extends NodeData {
  x: number
  y: number
  vx: number
  vy: number
  fx?: number | null
  fy?: number | null
}

export interface GraphCanvasHandle {
  zoomIn: () => void
  zoomOut: () => void
  fitView: () => void
}

interface GraphCanvasProps {
  nodes: NodeData[]
  edges: EdgeData[]
  selectedId: string | null
  hoveredId: string | null
  detailOpenId: string | null
  onNodeClick: (id: string) => void
  onNodeHover: (id: string | null) => void
}

const CANVAS_WIDTH = 1200
const CANVAS_HEIGHT = 800

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Create initial layout nodes with circular arrangement
 */
function createLayoutNodes(nodeData: NodeData[]): LayoutNode[] {
  return nodeData.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodeData.length
    const dist = 150 + Math.random() * 100
    return {
      ...n,
      x: CANVAS_WIDTH / 2 + Math.cos(angle) * dist,
      y: CANVAS_HEIGHT / 2 + Math.sin(angle) * dist,
      vx: 0,
      vy: 0,
    }
  })
}

/**
 * Simple force-directed layout step. No raw hex values — all visual tokens via CSS.
 */
function tickStep(layout: LayoutNode[], nodeById: Map<string, LayoutNode>, edges: EdgeData[], alpha: number) {
  const area = CANVAS_WIDTH * CANVAS_HEIGHT
  const k = Math.sqrt(area / layout.length)

  // Reset velocities for free nodes
  for (const n of layout) {
    if (n.fx != null && n.fy != null) continue
    n.vx = 0
    n.vy = 0
  }

  // Repulsion between all node pairs
  for (let i = 0; i < layout.length; i++) {
    const a = layout[i]
    if (a.fx != null && a.fy != null) continue
    for (let j = i + 1; j < layout.length; j++) {
      const b = layout[j]
      if (b.fx != null && b.fy != null) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      if (dist > 500) continue
      const force = (k * k) / dist * alpha
      a.vx -= (dx / dist) * force
      a.vy -= (dy / dist) * force
      b.vx += (dx / dist) * force
      b.vy += (dy / dist) * force
    }
  }

  // Attraction along edges
  for (const e of edges) {
    const a = nodeById.get(e.source)
    const b = nodeById.get(e.target)
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const force = (dist - k * 1.5) / dist * alpha * 0.01
    if (!a.fx && !a.fy) { a.vx += dx * force; a.vy += dy * force }
    if (!b.fx && !b.fy) { b.vx -= dx * force; b.vy -= dy * force }
  }

  // Center gravity
  const cx = CANVAS_WIDTH / 2
  const cy = CANVAS_HEIGHT / 2
  for (const n of layout) {
    if (n.fx != null && n.fy != null) continue
    n.vx += (cx - n.x) * alpha * 0.001
    n.vy += (cy - n.y) * alpha * 0.001
  }

  // Apply velocities + damping
  for (const n of layout) {
    if (n.fx != null && n.fy != null) {
      n.x = n.fx
      n.y = n.fy
      continue
    }
    n.x += n.vx
    n.y += n.vy
  }
}

/**
 * GraphCanvas — full-viewport graph surface on dark abyss background
 * Per spec §1: background is var(--dashboard-surface-alt)
 * Per spec §2: edges opacity 0 default, 0.30 when highlighted
 * Per spec §3: labels tooltip-only on hover
 */
export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas({
  nodes,
  edges,
  selectedId,
  hoveredId,
  detailOpenId,
  onNodeClick,
  onNodeHover,
}, ref) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[]>([])
  const nodeByIdRef = useRef<Map<string, LayoutNode>>(new Map())
  const simAnimRef = useRef<number>(0)
  const [viewBox, setViewBox] = useState({ x: -200, y: -200, w: CANVAS_WIDTH + 400, h: CANVAS_HEIGHT + 400 })
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, vx: 0, vy: 0, vw: 0, vh: 0 })
  const zoomIn = useCallback(() => {
    setViewBox((vb) => {
      const s = 0.9
      const cw = vb.w / 2
      const ch = vb.h / 2
      const nw = vb.w * s
      const nh = vb.h * s
      return { x: vb.x + cw - nw / 2, y: vb.y + ch - nh / 2, w: clamp(nw, 200, 5000), h: clamp(nh, 200, 5000) }
    })
  }, [])

  const zoomOut = useCallback(() => {
    setViewBox((vb) => {
      const s = 1.1
      const cw = vb.w / 2
      const ch = vb.h / 2
      const nw = vb.w * s
      const nh = vb.h * s
      return { x: vb.x + cw - nw / 2, y: vb.y + ch - nh / 2, w: clamp(nw, 200, 5000), h: clamp(nh, 200, 5000) }
    })
  }, [])

  const handleFitView = useCallback(() => {
    if (layoutNodes.length === 0) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of layoutNodes) {
      if (n.x < minX) minX = n.x
      if (n.y < minY) minY = n.y
      if (n.x > maxX) maxX = n.x
      if (n.y > maxY) maxY = n.y
    }
    const pad = 80
    setViewBox({ x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 })
  }, [layoutNodes])

  useImperativeHandle(ref, () => ({ zoomIn, zoomOut, fitView: handleFitView }), [zoomIn, zoomOut, handleFitView])

  // Initialize layout positions when nodes/edges change
  // Initialize layout positions when nodes/edges change
  useEffect(() => {
    // Guard: skip simulation when no data (prevents infinite render loop)
    if (nodes.length === 0) {
      setLayoutNodes([])
      nodeByIdRef.current = new Map()
      return
    }
    const initial = createLayoutNodes(nodes)
    setLayoutNodes(initial)
    const byId = new Map<string, LayoutNode>()
    for (const n of initial) byId.set(n.id, n)
    nodeByIdRef.current = byId

    // Stop any running simulation
    if (simAnimRef.current) {
      cancelAnimationFrame(simAnimRef.current)
    }

    let alpha = 1
    let frameCount = 0
    const maxFrames = 300

    const sim = () => {
      if (frameCount >= maxFrames || alpha <= 0.005) return

      // Get current layout
      setLayoutNodes((prev) => {
        const working = prev.map((n) => ({ ...n }))
        const byId = new Map<string, LayoutNode>()
        for (const n of working) byId.set(n.id, n)

        for (let i = 0; i < 10; i++) {
          tickStep(working, byId, edges, alpha)
        }
        alpha *= 0.97
        nodeByIdRef.current = byId
        return working
      })

      frameCount++
      simAnimRef.current = requestAnimationFrame(sim)
    }

    simAnimRef.current = requestAnimationFrame(sim)

    return () => {
      if (simAnimRef.current) {
        cancelAnimationFrame(simAnimRef.current)
      }
    }
  }, [nodes.length + "," + edges.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mouse pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element)?.closest(".memory-explorer__node")) return
    dragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, vx: viewBox.x, vy: viewBox.y, vw: viewBox.w, vh: viewBox.h }
    e.preventDefault()
  }, [viewBox])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = (e.clientX - dragStart.current.x) * (viewBox.w / 600)
    const dy = (e.clientY - dragStart.current.y) * (viewBox.h / 600)
    setViewBox((vb) => ({
      x: dragStart.current.vx - dx,
      y: dragStart.current.vy - dy,
      w: vb.w,
      h: vb.h,
    }))
  }, [viewBox.w, viewBox.h])

  const handleMouseUp = useCallback(() => {
    dragging.current = false
  }, [])

  // Keyboard navigation: arrow keys to pan, +/- to zoom
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault()
        setViewBox((vb) => ({ ...vb, y: vb.y - PAN_STEP * (vb.w / 800) }))
        break
      case "ArrowDown":
        e.preventDefault()
        setViewBox((vb) => ({ ...vb, y: vb.y + PAN_STEP * (vb.w / 800) }))
        break
      case "ArrowLeft":
        e.preventDefault()
        setViewBox((vb) => ({ ...vb, x: vb.x - PAN_STEP * (vb.w / 800) }))
        break
      case "ArrowRight":
        e.preventDefault()
        setViewBox((vb) => ({ ...vb, x: vb.x + PAN_STEP * (vb.w / 800) }))
        break
      case "+":
      case "=":
        e.preventDefault()
        zoomIn()
        break
      case "-":
        e.preventDefault()
        zoomOut()
        break
      case "0":
        e.preventDefault()
        handleFitView()
        break
    }
  }, [zoomIn, zoomOut, handleFitView])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const scale = e.deltaY > 0 ? 1.1 : 0.9
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const vw = viewBox.w * scale
    const vh = viewBox.h * scale
    const vx = viewBox.x + (mx / rect.width) * viewBox.w - (mx / rect.width) * vw
    const vy = viewBox.y + (my / rect.height) * viewBox.h - (my / rect.height) * vh
    setViewBox({ x: vx, y: vy, w: clamp(vw, 200, 5000), h: clamp(vh, 200, 5000) })
  }, [viewBox])

  // Highlighted nodes via edge connections
  const highlightedNodeIds = useMemo(() => {
    const focus = hoveredId ?? selectedId
    if (!focus) return new Set<string>()
    const set = new Set<string>([focus])
    for (const e of edges) {
      if (e.source === focus) set.add(e.target)
      if (e.target === focus) set.add(e.source)
    }
    return set
  }, [hoveredId, selectedId, edges])

  return (
    <div
      className="memory-explorer__canvas"
      onMouseUp={handleMouseUp}
      tabIndex={0}
      role="application"
      aria-label="Memory graph — use arrow keys to pan, + and - to zoom, 0 to fit view"
      onKeyDown={handleKeyDown}
    >
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        width="100%"
        height="100%"
        style={{ display: "block" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        role="presentation"
        aria-hidden="true"
      >
        {/* Edges layer */}
        <g className="memory-explorer__edges">
          {edges.map((edge) => {
            const sourceNode = nodeByIdRef.current.get(edge.source)
            const targetNode = nodeByIdRef.current.get(edge.target)
            if (!sourceNode || !targetNode) return null
            const isHighlighted = highlightedNodeIds.has(edge.source) || highlightedNodeIds.has(edge.target)
            return (
              <GraphEdge
                key={edge.id}
                edge={edge}
                sourcePos={{ x: sourceNode.x, y: sourceNode.y }}
                targetPos={{ x: targetNode.x, y: targetNode.y }}
                isHighlighted={isHighlighted}
              />
            )
          })}
        </g>

        {/* Nodes layer */}
        <g className="memory-explorer__nodes">
          {layoutNodes.map((ln) => (
            <GraphNode
              key={ln.id}
              node={ln}
              x={ln.x}
              y={ln.y}
              isSelected={selectedId === ln.id}
              isHovered={hoveredId === ln.id}
              hasDetailOpen={detailOpenId === ln.id}
              onClick={onNodeClick}
              onHover={onNodeHover}
            />
          ))}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="memory-explorer__zoom-controls" role="group" aria-label="Graph zoom controls">
        <button onClick={zoomIn} title="Zoom in" aria-label="Zoom in">+</button>
        <button onClick={zoomOut} title="Zoom out" aria-label="Zoom out">−</button>
        <button onClick={handleFitView} title="Fit view" aria-label="Fit view">⟲</button>
      </div>

      {/* Legend */}
      <div className="memory-explorer__legend">
        {(["memory", "insight", "evidence", "agent", "project", "system"] as const).map((type) => (
          <div key={type} className="memory-explorer__legend-item">
            <span className={`memory-explorer__legend-dot memory-explorer__legend-dot--${type}`} />
            <span>{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
})
