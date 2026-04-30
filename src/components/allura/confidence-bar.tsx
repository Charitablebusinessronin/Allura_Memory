"use client"

interface ConfidenceBarProps {
  value: number
  className?: string
}

export function ConfidenceBar({ value, className }: ConfidenceBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))

  return (
    <div className={className} style={{ width: 120 }}>
      <div
        className="relative h-2 overflow-hidden rounded bg-[var(--allura-border-1)]"
        style={{ borderRadius: 4 }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded bg-[var(--allura-deep-navy)]"
          style={{ width: `${clamped}%`, borderRadius: 4 }}
        />
      </div>
      <p className="mt-1 text-xs text-[var(--allura-warm-gray)]">
        {clamped}%
      </p>
    </div>
  )
}
