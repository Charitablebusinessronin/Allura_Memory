"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Search, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchFilterBarProps {
  onSearch?: (query: string) => void
  onFilterChange?: (filter: string) => void
  onClear?: () => void
  placeholder?: string
  className?: string
  isEmpty?: boolean
}

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "raw", label: "Raw" },
  { key: "candidates", label: "Candidates" },
  { key: "approved", label: "Approved" },
  { key: "evidence", label: "Evidence" },
] as const

type FilterKey = (typeof FILTER_OPTIONS)[number]["key"]

export function SearchFilterBar({
  onSearch,
  onFilterChange,
  onClear,
  placeholder = "Search memories…",
  className,
  isEmpty = false,
}: SearchFilterBarProps) {
  const [query, setQuery] = useState("")
  const [focused, setFocused] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasFilters = activeFilter !== "all"

  // Debounced search
  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSearch?.(value)
      }, 300)
    },
    [onSearch]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleFilterSelect = useCallback(
    (key: FilterKey) => {
      setActiveFilter(key)
      onFilterChange?.(key === "all" ? "" : key)
    },
    [onFilterChange]
  )

  const handleClearAll = useCallback(() => {
    setQuery("")
    setActiveFilter("all")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    onSearch?.("")
    onFilterChange?.("")
    onClear?.()
  }, [onSearch, onFilterChange, onClear])

  const isWhiteBg = focused || hasFilters

  return (
    <div className={cn("flex flex-col gap-0", className)}>
      {/* Input row */}
      <div
        className={cn(
          "relative flex items-center gap-2 rounded-lg border px-3 transition-all duration-150",
          "h-[44px]",
          isWhiteBg
            ? "border-[var(--allura-blue)] bg-[var(--dashboard-surface)]"
            : "border-[var(--dashboard-border)] bg-[var(--dashboard-surface-muted)]",
          focused && "pl-[calc(0.75rem+3px)]"
        )}
      >
        {/* Orange focus bar */}
        {focused && (
          <span
            className="pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-l-lg bg-[var(--allura-orange)]"
            aria-hidden
          />
        )}

        {/* Search icon */}
        <Search
          className="size-4 shrink-0 text-[var(--dashboard-text-muted)]"
          aria-hidden
        />

        {/* Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-sm outline-none",
            "text-[var(--dashboard-text-primary)]",
            "placeholder:text-[var(--dashboard-text-muted)]"
          )}
          aria-label="Search"
        />

        {/* Mobile filter button — visible only on small screens */}
        <button
          type="button"
          onClick={() => setShowMobileFilters((v) => !v)}
          className="ml-1 shrink-0 text-[var(--dashboard-text-secondary)] md:hidden"
          aria-label="Toggle filters"
        >
          <SlidersHorizontal className="size-4" />
        </button>
      </div>

      {/* Filter chips row — desktop always when hasFilters; mobile toggled */}
      {(hasFilters || showMobileFilters) && (
        <div
          className={cn(
            "mt-2 flex flex-wrap items-center gap-2",
            // On desktop always shown when condition met; on mobile only when toggled
            showMobileFilters ? "flex" : "hidden md:flex"
          )}
        >
          {FILTER_OPTIONS.map(({ key, label }) => {
            const isActive = activeFilter === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleFilterSelect(key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-[var(--allura-blue)] text-white"
                    : "bg-[var(--dashboard-surface-muted)] text-[var(--dashboard-text-secondary)] hover:bg-[var(--dashboard-border)]"
                )}
              >
                {label}
              </button>
            )
          })}

          {hasFilters && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs font-medium text-[var(--allura-blue)] hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 py-8 text-center">
          <Search
            className="size-10 text-[var(--dashboard-text-muted)]"
            aria-hidden
          />
          <p className="text-sm text-[var(--dashboard-text-secondary)]">
            No results found. Try adjusting your filters.
          </p>
        </div>
      )}
    </div>
  )
}
