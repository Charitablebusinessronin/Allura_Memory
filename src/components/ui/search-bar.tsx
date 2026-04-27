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
        `relative flex items-center rounded-[${tokens.borderRadius.md}] border border-[${tokens.color.border.default}] bg-white shadow-[${tokens.shadow.sm}] transition-all focus-within:border-[${tokens.color.primary.default}] focus-within:shadow-[${tokens.shadow.md}] hover:border-[${tokens.color.border.subtle}] hover:shadow-[${tokens.shadow.md}]`,
        height,
        className
      )}
    >
      <Search className={`ml-3 h-4 w-4 shrink-0 text-[${tokens.color.text.muted}]`} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className={`h-full w-full bg-transparent px-3 text-sm text-[${tokens.color.text.primary}] placeholder:text-[${tokens.color.text.muted}] focus:outline-none`}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange?.("")
            inputRef.current?.focus()
          }}
          className={`mr-2 rounded p-0.5 text-[${tokens.color.text.muted}] hover:text-[${tokens.color.text.secondary}]`}
        >
          <X className="h-4 w-4" />
        </button>
      ) : shortcut ? (
        <kbd className={`mr-3 hidden items-center gap-0.5 rounded-[${tokens.borderRadius.sm}] bg-[${tokens.color.surface.muted}] px-1.5 py-0.5 text-[10px] font-medium text-[${tokens.color.text.muted}] sm:inline-flex`}>
          <span className="text-[10px]">⌘</span>K
        </kbd>
      ) : null}
    </div>
  )
}
