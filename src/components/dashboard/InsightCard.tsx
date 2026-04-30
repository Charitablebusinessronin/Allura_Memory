import type { ReactNode } from "react"

import type { Insight } from "@/lib/dashboard/types"
import { ConfidenceBadge } from "./ConfidenceBadge"

export function InsightCard({ insight, actions }: { insight: Insight; actions?: ReactNode }) {
  return (
    <article className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{insight.title}</h3>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--dashboard-text-secondary)]">
            <span>Agent: {insight.agent}</span>
            <span>Project: {insight.project}</span>
            <span>{new Date(insight.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--dashboard-text-secondary)]">Confidence</p>
          <ConfidenceBadge value={insight.confidence} size="sm" />
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-[var(--dashboard-text-secondary)]">Event</p>
          <p className="mt-1 text-sm">{insight.event}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-[var(--dashboard-text-secondary)]">Outcome</p>
          <p className="mt-1 text-sm">{insight.outcome}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-[var(--dashboard-text-secondary)]">Evidence</p>
          <p className="mt-1 text-sm">{insight.evidence}</p>
        </div>
      </div>
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </article>
  )
}
