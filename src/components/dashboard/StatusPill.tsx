import { cn } from "@/lib/utils"

export function StatusPill({ value }: { value: string }) {
  const lower = value.toLowerCase()
  const cls =
    lower.includes("approve") || lower.includes("active") || lower.includes("healthy")
      ? "bg-[var(--tone-green-bg)] text-[var(--tone-green-text)]"
      : lower.includes("pending") || lower.includes("degraded")
        ? "bg-[var(--tone-orange-bg)] text-[var(--tone-orange-text)]"
        : lower.includes("reject") || lower.includes("fail") || lower.includes("unhealthy")
          ? "bg-[var(--tone-red-bg)] text-[var(--tone-red-text)]"
          : "bg-muted text-muted-foreground"

  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", cls)}>
      {value}
    </span>
  )
}