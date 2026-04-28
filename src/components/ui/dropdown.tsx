"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface DropdownOption {
  value: string
  label: string
  disabled?: boolean
}

interface DropdownProps {
  options: DropdownOption[]
  value?: string | string[]
  placeholder?: string
  multi?: boolean
  searchable?: boolean
  disabled?: boolean
  onChange: (value: string | string[]) => void
  className?: string
}

export function Dropdown({
  options,
  value,
  placeholder = "Select…",
  multi = false,
  searchable = false,
  disabled = false,
  onChange,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    if (open) {
      setHighlightedIndex(0)
      if (searchable) {
        setTimeout(() => searchInputRef.current?.focus(), 10)
      }
    } else {
      setSearch("")
    }
  }, [open, searchable])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      const filtered = searchable
        ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
        : options
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev + 1) % filtered.length)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev - 1 + filtered.length) % filtered.length)
      } else if (e.key === "Enter") {
        e.preventDefault()
        const option = filtered[highlightedIndex]
        if (option && !option.disabled) {
          toggle(option)
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
      } else if (e.key === "Tab") {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, searchable, search, options, highlightedIndex])

  const selectedSet = new Set(Array.isArray(value) ? value : value ? [value] : [])

  const filtered = searchable
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const triggerLabel = multi
    ? selectedSet.size === 0
      ? placeholder
      : selectedSet.size === 1
        ? options.find((o) => o.value === Array.from(selectedSet)[0])?.label ?? placeholder
        : `${selectedSet.size} selected`
    : options.find((o) => o.value === value)?.label ?? placeholder

  function toggle(option: DropdownOption) {
    if (multi) {
      const current = Array.isArray(value) ? [...value] : value ? [value] : []
      const next = current.includes(option.value)
        ? current.filter((v) => v !== option.value)
        : [...current, option.value]
      onChange(next)
    } else {
      onChange(option.value)
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          `flex h-10 w-full items-center justify-between rounded-[var(--allura-r-md)] border border-[var(--allura-border-2)] bg-white px-3 text-sm font-medium transition-colors hover:border-[var(--allura-text-3)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--allura-blue)] focus-visible:ring-offset-2 disabled:opacity-50`,
          open && `border-[var(--allura-blue)]`
        )}
      >
        <span className={cn("truncate", !selectedSet.size && `text-[var(--allura-text-3)]`)}>{triggerLabel}</span>
        <ChevronDown
          className={cn(`ml-2 h-4 w-4 shrink-0 text-[var(--allura-text-3)] transition-transform`, open && "rotate-180")}
        />
      </button>

      {open && (
        <div className={`absolute z-50 mt-1 w-full overflow-hidden rounded-[var(--allura-r-md)] border border-[var(--allura-border-1)] bg-white shadow-[var(--allura-sh-lg)]`}>
          {searchable && (
            <div className={`border-b border-[var(--allura-border-1)] p-2`}>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setHighlightedIndex(0)
                }}
                placeholder="Search…"
                className={`h-8 w-full rounded-[var(--allura-r-sm)] border border-[var(--allura-border-1)] bg-[var(--allura-cream)] px-2 text-sm text-[var(--allura-charcoal)] placeholder:text-[var(--allura-text-3)] focus:border-[var(--allura-blue)] focus:outline-none`}
                autoFocus
              />
            </div>
          )}
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.map((option, idx) => {
              const isSelected = selectedSet.has(option.value)
              const isHighlighted = idx === highlightedIndex
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    disabled={option.disabled}
                    onClick={() => toggle(option)}
                    className={cn(
                      `flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[var(--allura-muted)] disabled:opacity-40`,
                      isSelected && `bg-[var(--allura-muted)]`,
                      isHighlighted && `ring-1 ring-inset ring-[var(--allura-gold)]`
                    )}
                  >
                    {multi ? (
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border",
                          isSelected
                            ? `border-[var(--allura-blue)] bg-[var(--allura-blue)] text-white`
                            : `border-[var(--allura-border-2)] bg-white`
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </span>
                    ) : (
                      isSelected && (
                        <span className={`mr-1 h-1 w-1 shrink-0 rounded-full bg-[var(--allura-blue)]`} />
                      )
                    )}
                    <span className="truncate">{option.label}</span>
                  </button>
                </li>
              )
            })}
            {filtered.length === 0 && (
              <li className={`px-3 py-2 text-sm text-[var(--allura-text-3)]`}>No options found</li>
            )}
          </ul>
          {multi && selectedSet.size > 0 && (
            <div className={`border-t border-[var(--allura-border-1)] p-2`}>
              <button
                type="button"
                onClick={() => onChange([])}
                className={`flex w-full items-center justify-center gap-1 rounded-[var(--allura-r-sm)] py-1.5 text-xs font-medium text-[var(--allura-text-2)] hover:bg-[var(--allura-muted)]`}
              >
                <X className="h-3 w-3" /> Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
