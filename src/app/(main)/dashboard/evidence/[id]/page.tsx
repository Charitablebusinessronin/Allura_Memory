"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { ConfidenceBadge, ErrorState, LoadingState, PageHeader, StatusPill, WarningList } from "@/components/dashboard"
import { Button } from "@/components/ui/button"
import { loadEvidenceDetail } from "@/lib/dashboard/queries"
import type { DashboardResult, Evidence } from "@/lib/dashboard/types"

function relativeTime(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diff = now - then
  if (!Number.isFinite(diff)) return new Date(timestamp).toLocaleString()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(timestamp).toLocaleString()
}

function MetadataList({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = useMemo(() => Object.entries(metadata).filter(([, v]) => v !== undefined && v !== null && v !== ""), [metadata])
  if (entries.length === 0) return <p className="text-sm text-[var(--dashboard-text-secondary)]">No metadata available.</p>
  return (
    <dl className="mt-4 space-y-3 text-sm">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt className="text-[var(--dashboard-text-secondary)]">{key}</dt>
          <dd className="mt-0.5 text-[var(--dashboard-text-primary)]">
            {typeof value === "object" ? <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-surface-alt)] p-2 text-xs">{JSON.stringify(value, null, 2)}</pre> : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export default function EvidenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null)
  const [state, setState] = useState<DashboardResult<Evidence> | null>(null)
  useEffect(() => { void params.then((next) => setId(next.id)) }, [params])
  useEffect(() => { if (id) void loadEvidenceDetail(id).then(setState) }, [id])

  if (!id || !state) return <LoadingState />
  if (state.error) return <ErrorState message={state.error} />
  if (!state.data) return <ErrorState message="Evidence not found." />

  const evidence = state.data
  const rawLog = evidence.rawLog
  let prettyLog: string | null = null
  try {
    const parsed = JSON.parse(rawLog)
    if (typeof parsed === "object" && parsed !== null) prettyLog = JSON.stringify(parsed, null, 2)
  } catch { /* not JSON */ }

  return (
    <div className="space-y-6" style={{ fontFamily: "var(--font-ibm-plex-sans)" }}>
      <Button variant="ghost" asChild>
        <Link href="/dashboard/evidence">← Back to evidence</Link>
      </Button>
      <PageHeader title={evidence.title} description="Dive into the real evidence behind this memory or insight." action={<StatusPill value={evidence.status} />} />
      <WarningList warnings={state.warnings} />

      {"confidence" in evidence.metadata && typeof evidence.metadata.confidence === "number" && (
        <div className="flex items-center gap-2 rounded-xl border bg-[var(--dashboard-surface)] p-4">
          <span className="text-sm font-medium text-[var(--dashboard-text-primary)]">Confidence</span>
          <ConfidenceBadge value={evidence.metadata.confidence as number} size="md" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-xl border bg-[var(--dashboard-surface)]">
          <div className="border-b p-5">
            <h2 className="font-semibold text-[var(--dashboard-text-primary)]">Raw Evidence Log</h2>
          </div>
          {rawLog ? (
            <pre className="overflow-x-auto whitespace-pre-wrap p-5 text-sm text-[var(--dashboard-text-primary)]">{prettyLog ?? rawLog}</pre>
          ) : (
            <div className="p-5">
              <p className="text-sm text-[var(--dashboard-text-secondary)]">No raw log available.</p>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-[var(--dashboard-surface)] p-5">
            <h2 className="font-semibold text-[var(--dashboard-text-primary)]">Metadata</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-[var(--dashboard-text-secondary)]">Source</dt>
                <dd className="text-[var(--dashboard-text-primary)]">{evidence.source}</dd>
              </div>
              <div>
                <dt className="text-[var(--dashboard-text-secondary)]">Agent</dt>
                <dd className="text-[var(--dashboard-text-primary)]">{evidence.agent}</dd>
              </div>
              <div>
                <dt className="text-[var(--dashboard-text-secondary)]">Project</dt>
                <dd className="text-[var(--dashboard-text-primary)]">{evidence.project}</dd>
              </div>
              <div>
                <dt className="text-[var(--dashboard-text-secondary)]">Timestamp</dt>
                <dd className="text-[var(--dashboard-text-primary)]">
                  {relativeTime(evidence.timestamp)}
                  <span className="ml-2 text-xs text-[var(--dashboard-text-secondary)]">
                    ({new Date(evidence.timestamp).toLocaleString()})
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-[var(--dashboard-text-secondary)]">Tags</dt>
                <dd className="text-[var(--dashboard-text-primary)]">
                  {evidence.tags.length > 0 ? evidence.tags.join(", ") : "None returned"}
                </dd>
              </div>
            </dl>
            {Object.keys(evidence.metadata).length > 0 && (
              <div className="mt-4 border-t pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--dashboard-text-secondary)]">Extended Metadata</h3>
                <MetadataList metadata={evidence.metadata} />
              </div>
            )}
          </div>

          {(evidence.relatedMemoryId || evidence.relatedInsightId) && (
            <div className="rounded-xl border bg-[var(--dashboard-surface)] p-5">
              <h2 className="font-semibold text-[var(--dashboard-text-primary)]">Related</h2>
              <div className="mt-3 space-y-2">
                {evidence.relatedMemoryId && (
                  <Link
                    href={`/dashboard/memories`}
                    className="block rounded-lg border border-[var(--dashboard-border)] p-3 text-sm text-[var(--dashboard-accent)] transition hover:bg-[var(--dashboard-surface-alt)]"
                  >
                    View related memory →
                  </Link>
                )}
                {evidence.relatedInsightId && (
                  <Link
                    href={`/dashboard/insights`}
                    className="block rounded-lg border border-[var(--dashboard-border)] p-3 text-sm text-[var(--dashboard-accent)] transition hover:bg-[var(--dashboard-surface-alt)]"
                  >
                    View related insight →
                  </Link>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}