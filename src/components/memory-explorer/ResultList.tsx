"use client"

import type { SearchResult } from "./types"

interface ResultListProps {
  results: SearchResult[]
  onSelect: (nodeId: string) => void
}

/**
 * ResultList — search-driven list per spec §9
 * Used when graph is collapsed (<768px) or search has results
 * Replaces graph interaction on mobile
 */
export function ResultList({ results, onSelect }: ResultListProps) {
  if (results.length === 0) return null

  return (
    <ul className="memory-explorer__result-list">
      {results.map((r) => (
        <li
          key={r.node.id}
          className="memory-explorer__result-item"
          onClick={() => onSelect(r.node.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onSelect(r.node.id)
            }
          }}
          tabIndex={0}
          role="option"
          aria-selected={false}
        >
          <p className="memory-explorer__result-item__title">
            <span className={`memory-explorer__result-item__badge memory-explorer__detail-pane__type-badge--${r.node.type}`}>
              {r.node.type}
            </span>
            {r.node.label}
          </p>
          {r.snippet && (
            <p className="memory-explorer__result-item__snippet">{r.snippet}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
