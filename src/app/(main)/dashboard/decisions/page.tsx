import { BookOpen, CheckCircle2, Clock, FileText, HelpCircle, XCircle } from "lucide-react"

import { EmptyState, ErrorState, PageHeader, WarningList } from "@/components/dashboard"
import { loadDecisions } from "@/lib/dashboard/queries"
import type { DecisionRecord, DecisionStatus } from "@/lib/dashboard/types"

// ─── helpers ─────────────────────────────────────────────────────────────────

function statusIcon(status: DecisionStatus) {
  switch (status) {
    case "decided":
      return <CheckCircle2 className="size-4 shrink-0 text-[var(--allura-green)]" />
    case "proposed":
      return <Clock className="size-4 shrink-0 text-[var(--dashboard-evidence)]" />
    case "superseded":
      return <XCircle className="size-4 shrink-0 text-[var(--allura-orange)]" />
    case "deferred":
      return <HelpCircle className="size-4 shrink-0 text-[var(--allura-gray-400-text)]" />
    default:
      return <FileText className="size-4 shrink-0 text-[var(--allura-gray-400-text)]" />
  }
}

function statusLabel(status: DecisionStatus): string {
  switch (status) {
    case "decided": return "Decided"
    case "proposed": return "Proposed"
    case "superseded": return "Superseded"
    case "deferred": return "Deferred"
    default: return "Unknown"
  }
}

function statusBadgeClass(status: DecisionStatus): string {
  switch (status) {
    case "decided": return "bg-[var(--tone-green-bg)] text-[var(--tone-green-text)] border-[var(--allura-green)]/20"
    case "proposed": return "bg-[var(--dashboard-surface)] text-[var(--allura-charcoal)] border-[var(--dashboard-border)]/20"
    case "superseded": return "bg-[var(--tone-orange-bg)] text-[var(--tone-orange-text)] border-[var(--allura-orange)]/20"
    case "deferred": return "bg-[var(--tone-charcoal-bg)] text-[var(--tone-charcoal-text)] border-[var(--allura-charcoal)]/20"
    default: return "bg-[var(--allura-gray-100)] text-[var(--allura-gray-500)] border-[var(--allura-gray-200)]"
  }
}

function relativeTime(isoTs: string): string {
  const diff = Date.now() - new Date(isoTs).getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(isoTs).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// ─── sub-components ───────────────────────────────────────────────────────────

function DecisionCard({ record }: { record: DecisionRecord }) {
  return (
    <div className="agency-card group">
      <div className="p-5 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            {statusIcon(record.status)}
            <h3 className="text-sm font-semibold text-[var(--allura-charcoal)] leading-snug">
              {record.title}
            </h3>
          </div>
          <span className={`agency-badge shrink-0 ${statusBadgeClass(record.status)}`}>
            {statusLabel(record.status)}
          </span>
        </div>

        {/* Summary */}
        {record.summary && record.summary !== "No summary captured." && (
          <p className="text-xs text-[var(--allura-gray-500)] leading-relaxed line-clamp-3">
            {record.summary}
          </p>
        )}

        {/* Rationale */}
        {record.rationale && (
          <div className="rounded-lg border border-[var(--allura-border-1)] bg-[var(--dashboard-bg)] px-3 py-2">
            <p className="text-xs font-medium text-[var(--allura-gray-400-text)] mb-0.5">Rationale</p>
            <p className="text-xs text-[var(--allura-gray-500)] leading-relaxed line-clamp-2">
              {record.rationale}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-[var(--allura-gray-400-text)] uppercase tracking-wide">
              {record.agentId}
            </span>
          </div>
          <time
            dateTime={record.createdAt}
            className="text-[11px] text-[var(--allura-gray-400-text)] shrink-0"
          >
            {relativeTime(record.createdAt)}
          </time>
        </div>
      </div>
    </div>
  )
}

function DecisionStats({ records }: { records: DecisionRecord[] }) {
  const counts = records.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="metric-card">
        <div>
          <p className="metric-label">Total ADRs</p>
          <p className="metric-value">{records.length}</p>
        </div>
        <div className="metric-icon blue">
          <FileText className="size-5" />
        </div>
      </div>
      <div className="metric-card">
        <div>
          <p className="metric-label">Decided</p>
          <p className="metric-value">{counts.decided ?? 0}</p>
        </div>
        <div className="metric-icon green">
          <CheckCircle2 className="size-5" />
        </div>
      </div>
      <div className="metric-card">
        <div>
          <p className="metric-label">Proposed</p>
          <p className="metric-value">{counts.proposed ?? 0}</p>
        </div>
        <div className="metric-icon gold">
          <Clock className="size-5" />
        </div>
      </div>
      <div className="metric-card">
        <div>
          <p className="metric-label">Superseded</p>
          <p className="metric-value">{counts.superseded ?? 0}</p>
        </div>
        <div className="metric-icon charcoal">
          <XCircle className="size-5" />
        </div>
      </div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function DecisionsPage(): Promise<React.ReactElement> {
  const result = await loadDecisions()

  return (
    <div className="space-y-8">
      <PageHeader
        title="Decision Records"
        description="Architectural decisions and rationale captured from agent sessions."
        action={
          <div className="flex items-center gap-2 rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] px-3 py-2">
            <BookOpen className="size-4 text-[var(--dashboard-text-muted)]" />
            <span className="text-sm text-[var(--dashboard-text-secondary)]">ADR Registry</span>
          </div>
        }
      />

      {result.error ? (
        <ErrorState message={result.error} />
      ) : (
        <>
          <WarningList warnings={result.warnings} />
          <DecisionStats records={result.data ?? []} />

          {result.data && result.data.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--allura-charcoal)]">
                  All Decisions
                  <span className="ml-2 font-normal text-[var(--allura-gray-400-text)]">
                    ({result.data.length})
                  </span>
                </h2>
                {result.degraded && (
                  <span className="text-xs text-[var(--allura-orange)]">Partial data</span>
                )}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {result.data.map((record) => (
                  <DecisionCard key={record.id} record={record} />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No decision records yet"
              description="Decision records will appear here as agents capture architectural decisions during sessions."
            />
          )}
        </>
      )}
    </div>
  )
}
