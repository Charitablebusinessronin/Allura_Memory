"use client"

import { useEffect, useRef } from "react"
import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { tokens } from "@/lib/tokens"

interface SearchBarProps {
  placeholder?: string
  size?: "sm" | "md"
  value?: string
  onChange?: (value: string) => void
  onFocus?: () => void
  shortcut?: boolean
  autoFocus?: boolean
  className?: string
}

export function SearchBar({
  placeholder = "Search memories…",
  size = "md",
  value = "",
  onChange,
  onFocus,
  shortcut = true,
  autoFocus = false,
  className,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === "Escape" && inputRef.current) {
        inputRef.current.value = ""
        onChange?.("")
        inputRef.current.blur()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onChange])

  const height = size === "sm" ? "h-9" : "h-10"

  return (
    <div
      className={cn(
        `relative flex items-center rounded-[var(--allura-r-md)] border border-[var(--allura-border-2)] bg-white shadow-[var(--allura-sh-sm)] transition-all focus-within:border-[var(--allura-blue)] focus-within:shadow-[var(--allura-sh-md)] hover:border-[var(--allura-border-1)] hover:shadow-[var(--allura-sh-md)]`,
        height,
        className
      )}
    >
      <Search className={`ml-3 h-4 w-4 shrink-0 text-[var(--allura-text-3)]`} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className={`h-full w-full bg-transparent px-3 text-sm text-[var(--allura-charcoal)] placeholder:text-[var(--allura-text-3)] focus:outline-none`}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange?.("")
            inputRef.current?.focus()
          }}
          className={`mr-2 rounded p-0.5 text-[var(--allura-text-3)] hover:text-[var(--allura-text-2)]`}
        >
          <X className="h-4 w-4" />
        </button>
      ) : shortcut ? (
        <kbd className={`mr-3 hidden items-center gap-0.5 rounded-[var(--allura-r-sm)] bg-[var(--allura-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--allura-text-3)] sm:inline-flex`}>
          <span className="text-[10px]">⌘</span>K
        </kbd>
      ) : null}
    </div>
  )
}
