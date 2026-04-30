"use client"

import { cn } from "@/lib/utils"

interface TabsProps<T extends string> {
  items: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}

export function Tabs<T extends string>({ items, value, onChange }: TabsProps<T>) {
  return (
    <div className="flex gap-2">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors",
            value === item.value
              ? "bg-[var(--dashboard-accent-secondary)] text-white"
              : "bg-[var(--allura-gray-100)] text-[var(--allura-gray-500)] hover:bg-[var(--allura-gray-200)]"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}