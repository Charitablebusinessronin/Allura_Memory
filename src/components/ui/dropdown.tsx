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
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

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
          "flex h-10 w-full items-center justify-between rounded-[8px] border border-[#D1D5DB] bg-white px-3 text-sm font-medium transition-colors hover:border-[#9CA3AF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2 disabled:opacity-50",
          open && "border-[#1D4ED8]"
        )}
      >
        <span className={cn("truncate", !selectedSet.size && "text-[#9CA3AF]")}>{triggerLabel}</span>
        <ChevronDown
          className={cn("ml-2 h-4 w-4 shrink-0 text-[#9CA3AF] transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-[8px] border border-[#E5E7EB] bg-white shadow-[0_10px_15px_-3px_rgba(15,17,21,0.1),0_4px_6px_-4px_rgba(15,17,21,0.1)]">
          {searchable && (
            <div className="border-b border-[#E5E7EB] p-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="h-8 w-full rounded-[4px] border border-[#E5E7EB] bg-[#F6F4EF] px-2 text-sm text-[#0F1115] placeholder:text-[#9CA3AF] focus:border-[#1D4ED8] focus:outline-none"
                autoFocus
              />
            </div>
          )}
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.map((option) => {
              const isSelected = selectedSet.has(option.value)
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    disabled={option.disabled}
                    onClick={() => toggle(option)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[#F3F4F6] disabled:opacity-40",
                      isSelected && "bg-[#F3F4F6]"
                    )}
                  >
                    {multi ? (
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border",
                          isSelected
                            ? "border-[#1D4ED8] bg-[#1D4ED8] text-white"
                            : "border-[#D1D5DB] bg-white"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </span>
                    ) : (
                      isSelected && (
                        <span className="mr-1 h-1 w-1 shrink-0 rounded-full bg-[#1D4ED8]" />
                      )
                    )}
                    <span className="truncate">{option.label}</span>
                  </button>
                </li>
              )
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-[#9CA3AF]">No options found</li>
            )}
          </ul>
          {multi && selectedSet.size > 0 && (
            <div className="border-t border-[#E5E7EB] p-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex w-full items-center justify-center gap-1 rounded-[4px] py-1.5 text-xs font-medium text-[#6B7280] hover:bg-[#F3F4F6]"
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
