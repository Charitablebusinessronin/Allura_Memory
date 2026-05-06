"use client"

import { Search } from "lucide-react"
import { useCallback, useRef } from "react"

interface SearchBarProps {
  query: string
  onChange: (query: string) => void
  placeholder?: string
}

/**
 * SearchBar — primary interaction surface per spec §6
 * 48px height, centered, max 640px width
 * Uses all CSS custom properties for colors
 */
export function SearchBar({ query, onChange, placeholder = "Search memories…" }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    [onChange]
  )

  return (
    <div className="memory-explorer__search">
      <Search size={18} />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label="Search memories"
      />
    </div>
  )
}
