"use client"

import { useCallback } from "react"
import type { GraphNode as NodeData } from "./types"
import { EvidenceBlock } from "./EvidenceBlock"

interface DetailPaneProps {
  node: NodeData | null
  onClose: () => void
  onPromote?: (id: string) => void
}

/**
 * DetailPane — single inspector pane per spec §4
 * Replaces the old 5-panel layout
 * 
 * Sections (top to bottom):
 * a. Header bar (title + type badge)
 * b. Evidence block (cream surface)
 * c. Metadata row (source, timestamp, confidence)
 * d. Action buttons
 */
export function DetailPane({ node, onClose, onPromote }: DetailPaneProps) {
  const handlePromote = useCallback(() => {
    if (node && onPromote) onPromote(node.id)
  }, [node, onPromote])

  if (!node) return null

  const meta = node.metadata

  return (
    <aside className="memory-explorer__detail-pane">
      {/* a. Header */}
      <header className="memory-explorer__detail-pane__header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--allura-sm)" }}>
          <h2 className="memory-explorer__detail-pane__title">
            {node.label}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--dashboard-text-muted)",
              cursor: "pointer",
              fontSize: "1.125rem",
              padding: "var(--allura-xs)",
              lineHeight: 1,
            }}
            aria-label="Close detail pane"
          >
            ✕
          </button>
        </div>
        <span className={`memory-explorer__detail-pane__type-badge memory-explorer__detail-pane__type-badge--${node.type}`}>
          {node.type}
        </span>
      </header>

      {/* b. Evidence section — cream (§5) */}
      <EvidenceBlock content={meta?.evidence ?? meta?.content} />

      {/* c. Metadata row (§4c) */}
      <div className="memory-explorer__metadata">
        {meta?.source && (
          <span className="memory-explorer__metadata-item">
            Source: {meta.source}
          </span>
        )}
        {meta?.timestamp && (
          <span className="memory-explorer__metadata-item">
            {meta.timestamp}
          </span>
        )}
        {meta?.confidence != null && (
          <span className="memory-explorer__metadata-item">
            Confidence: {(meta.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {/* d. Action buttons (§4d) */}
      <div className="memory-explorer__actions">
        {node.type === "memory" && onPromote && (
          <button className="btn-ghost btn-ghost--primary" onClick={handlePromote}>
            Promote
          </button>
        )}
        <button className="btn-ghost">
          Copy
        </button>
      </div>
    </aside>
  )
}
