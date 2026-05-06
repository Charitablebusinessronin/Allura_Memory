"use client"

import { Search } from "lucide-react"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/feed": "Memory Feed",
  "/dashboard/graph": "Knowledge Graph",
  "/dashboard/insights": "Insights",
  "/dashboard/evidence": "Evidence",
  "/dashboard/agents": "Agents",
  "/dashboard/projects": "Projects",
  "/dashboard/skills": "Skills",
  "/dashboard/settings": "Settings",
  "/dashboard/memory-explorer": "Memory Explorer",
  "/dashboard/decisions": "Decision Records",
  "/dashboard/builder": "Insight Builder",
  "/dashboard/health": "System Health",
}

function getPageTitle(pathname: string): string {
  return ROUTE_TITLES[pathname] ?? "Allura Memory"
}

export function TopNavBar({ className }: { className?: string }) {
  const pathname = usePathname()
  const title = getPageTitle(pathname)

  return (
    <header
      className={cn(
        "sticky top-0 z-20 hidden h-14 items-center gap-4 border-b border-[var(--dashboard-border)] bg-[var(--dashboard-surface)]/95 px-6 backdrop-blur-[16px] md:flex",
        className
      )}
    >
      <h1 className="min-w-0 flex-1 truncate text-xl font-semibold leading-7 text-[var(--dashboard-text-primary)]">
        {title}
      </h1>

      <div className="relative flex h-9 w-[280px] shrink-0 items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-[var(--dashboard-text-muted)]" />
        <input
          type="search"
          placeholder="Search memories, entities, decisions…"
          className="h-full w-full rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-surface-muted)] pl-9 pr-3 text-sm text-[var(--dashboard-text-primary)] placeholder:text-[var(--dashboard-text-muted)] transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--allura-blue)]"
        />
      </div>

      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--allura-blue)] text-xs font-semibold text-white"
        role="img"
        aria-label="User avatar"
      >
        U
      </div>
    </header>
  )
}
