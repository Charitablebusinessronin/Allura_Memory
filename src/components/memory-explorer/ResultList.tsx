"use client"

import { useCallback, useRef } from "react"
import type { SearchResult } from "./types"

interface ResultListProps {
  results: SearchResult[]
  onSelect: (nodeId: string) => void
  id?: string
}

/**
 * ResultList — search-driven list per spec §9
 * Used when graph is collapsed (<768px) or search has results
 * Replaces graph interaction on mobile
 */
export function ResultList({ results, onSelect, id }: ResultListProps) {
  const listRef = useRef<HTMLUListElement>(null)

  const handleListKeyDown = useCallback((e: React.KeyboardEvent<HTMLUListElement>) => {
    const items = listRef.current?.querySelectorAll<HTMLLIElement>('[role="option"]')
    if (!items || items.length === 0) return

    const currentIndex = Array.from(items).findIndex((el) => el === document.activeElement)

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        if (currentIndex < items.length - 1) {
          items[currentIndex + 1].focus()
        } else {
          items[0].focus()
        }
        break
      case "ArrowUp":
        e.preventDefault()
        if (currentIndex > 0) {
          items[currentIndex - 1].focus()
        } else {
          items[items.length - 1].focus()
        }
        break
      case "Home":
        e.preventDefault()
        items[0].focus()
        break
      case "End":
        e.preventDefault()
        items[items.length - 1].focus()
        break
    }
  }, [])
  if (results.length === 0) return null

  return (
    <ul
      ref={listRef}
      id={id}
      className="memory-explorer__result-list"
      role="listbox"
      aria-label="Search results"
      onKeyDown={handleListKeyDown}
    >
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
