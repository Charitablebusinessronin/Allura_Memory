"use client"

import { Search } from "lucide-react"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchInput({ value, onChange, placeholder = "Search..." }: SearchInputProps) {
  return (
    <div className="relative flex-1">
      <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] pl-9 pr-3 text-sm text-[var(--dashboard-text-primary)] outline-none focus:border-[var(--dashboard-accent)] focus:ring-2 focus:ring-[var(--dashboard-accent)]/20"
      />
    </div>
  )
}