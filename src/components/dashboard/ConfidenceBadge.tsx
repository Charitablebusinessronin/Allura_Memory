import { cn } from "@/lib/utils"

interface ConfidenceBadgeProps {
  value: number
  size?: "sm" | "md" | "lg"
}

const sizeClasses: Record<string, string> = {
  sm: "text-xs px-1.5 py-0.5",
  md: "text-sm px-2.5 py-1",
  lg: "text-base px-3 py-1.5",
}

function confidenceColor(value: number): string {
  if (value >= 0.85) return "bg-[var(--tone-green-bg)] text-[var(--tone-green-text)]"
  if (value >= 0.65) return "bg-[var(--tone-blue-bg)] text-[var(--tone-blue-text)]"
  if (value >= 0.45) return "bg-[var(--tone-orange-bg)] text-[var(--tone-orange-text)]"
  return "bg-[var(--tone-red-bg)] text-[var(--tone-red-text)]"
}

export function ConfidenceBadge({ value, size = "md" }: ConfidenceBadgeProps) {
  const pct = Math.round(value * 100)
  return (
    <span className={cn("inline-flex items-center rounded-full font-medium", sizeClasses[size], confidenceColor(value))}>
      {pct}%
    </span>
  )
}