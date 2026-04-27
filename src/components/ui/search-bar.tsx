"use client"

import { useEffect, useRef } from "react"
import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"

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
        "relative flex items-center rounded-[8px] border border-[#D1D5DB] bg-white shadow-[0_1px_2px_0_rgba(15,17,21,0.05)] transition-all focus-within:border-[#1D4ED8] focus-within:shadow-[0_4px_6px_-1px_rgba(15,17,21,0.1),0_2px_4px_-2px_rgba(15,17,21,0.1)] hover:border-[#E5E7EB] hover:shadow-[0_4px_6px_-1px_rgba(15,17,21,0.1),0_2px_4px_-2px_rgba(15,17,21,0.1)]",
        height,
        className
      )}
    >
      <Search className="ml-3 h-4 w-4 shrink-0 text-[#9CA3AF]" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className="h-full w-full bg-transparent px-3 text-sm text-[#0F1115] placeholder:text-[#9CA3AF] focus:outline-none"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange?.("")
            inputRef.current?.focus()
          }}
          className="mr-2 rounded p-0.5 text-[#9CA3AF] hover:text-[#6B7280]"
        >
          <X className="h-4 w-4" />
        </button>
      ) : shortcut ? (
        <kbd className="mr-3 hidden items-center gap-0.5 rounded-[4px] bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-medium text-[#9CA3AF] sm:inline-flex">
          <span className="text-[10px]">⌘</span>K
        </kbd>
      ) : null}
    </div>
  )
}
