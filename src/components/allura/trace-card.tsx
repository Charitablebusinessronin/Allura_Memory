"use client"

interface TraceCardProps {
  tool: string
  snippet: string
  timestamp: string
  className?: string
}

export function TraceCard({ tool, snippet, timestamp, className }: TraceCardProps) {
  return (
    <div
      className={`rounded-lg bg-[var(--allura-pure-white)] p-3 ${className ?? ""}`}
      style={{ borderRadius: 8 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--allura-deep-navy)]">
          {tool}
        </span>
        <span className="text-xs text-[var(--allura-warm-gray)]">
          {timestamp}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-[var(--allura-ink-black)]">
        {snippet}
      </p>
    </div>
  )
}