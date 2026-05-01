"use client"

import { BrainCircuit } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  title: string
  description?: string
  cta?: { label: string; onClick: () => void }
  className?: string
}

export function EmptyState({ title, description, cta, className }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className ?? ""}`}
    >
      <BrainCircuit className="mb-4 size-12 text-[var(--dashboard-text-muted)]" />
      <h3 className="text-lg font-semibold text-[var(--dashboard-text-primary)]">
        {title}
      </h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-[var(--dashboard-text-secondary)]">
          {description}
        </p>
      )}
      {cta && (
        <Button
          onClick={cta.onClick}
          className="mt-6 bg-[var(--allura-blue)] text-white hover:bg-[var(--allura-blue-hover)]"
          style={{ borderRadius: "var(--allura-radius-button)" }}
        >
          {cta.label}
        </Button>
      )}
    </div>
  )
}