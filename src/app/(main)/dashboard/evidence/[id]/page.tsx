"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Copy, Download } from "lucide-react"

import { ConfidenceBadge, ErrorState, LoadingState, PageHeader, StatusPill, WarningList } from "@/components/dashboard"
import { Button } from "@/components/ui/button"
import { loadEvidenceDetail } from "@/lib/dashboard/queries"
import { tokens } from "@/lib/tokens"
import type { DashboardResult, Evidence } from "@/lib/dashboard/types"

type DetailTab = "raw" | "metadata" | "trace"

const detailTabs: Array<{ value: DetailTab; label: string }> = [
  { value: "raw", label: "Raw Log" },
  { value: "metadata", label: "Metadata" },
  { value: "trace", label: "Trace" },
]

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

function useClipboard() {
  const [copied, setCopied] = useState(false)
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }
  return { copied, copy }
}

function JsonSyntaxHighlight({ json }: { json: string }) {
  const lines = useMemo(() => {
    const pretty = json
    return pretty.split("\n").map((line, i) => {
      // Simple inline syntax highlight
      const highlighted = line
        .replace(/(".*?")/g, `<span style="color:${tokens.color.primary.default}">$1</span>`)
        .replace(/\b(true|false|null)\b/g, `<span style="color:${tokens.color.success.default}">$1</span>`)
        .replace(/\b(\d+(?:\.\d+)?)\b/g, `<span style="color:${tokens.color.secondary.default}">$1</span>`)
      return { num: i + 1, html: highlighted }
    })
  }, [json])

  return (
    <pre className="overflow-x-auto p-5 text-xs leading-relaxed" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      {lines.map(({ num, html }) => (
        <div key={num} className="flex">
          <span className={`w-10 shrink-0 select-none text-right text-[var(--allura-text-3)] pr-4`}>{num}</span>
          <span dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      ))}
    </pre>
  )
}

function RawLogTab({ rawLog }: { rawLog: string }) {
  const { copied, copy } = useClipboard()

  let prettyLog = rawLog
  try {
    const parsed = JSON.parse(rawLog)
    if (typeof parsed === "object" && parsed !== null) prettyLog = JSON.stringify(parsed, null, 2)
  } catch { /* not JSON */ }

  return (
    <>
      <div className={`flex items-center justify-between border-b border-[var(--allura-border-1)] p-5`}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => copy(prettyLog)} className="gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button variant="primary" size="sm" onClick={() => {
            const blob = new Blob([prettyLog], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = "evidence.json"
            a.click()
            URL.revokeObjectURL(url)
          }} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
        <span className={`text-xs text-[var(--allura-text-3)]`}>{prettyLog.split("\n").length} lines</span>
      </div>
      <JsonSyntaxHighlight json={prettyLog} />
    </>
  )
}

function MetadataTab({ evidence }: { evidence: Evidence }) {
  const { copied, copy } = useClipboard()
  const baseEntries = useMemo(() => [
    { key: "Source", value: evidence.source },
    { key: "Agent", value: evidence.agent },
    { key: "Project", value: evidence.project },
    { key: "Timestamp", value: relativeTime(evidence.timestamp) },
    { key: "Tags", value: evidence.tags.length > 0 ? evidence.tags.join(", ") : "None" },
  ], [evidence])

  const extendedEntries = useMemo(() => {
    const meta = evidence.metadata
    return Object.entries(meta).filter(([, v]) => v !== undefined && v !== null && v !== "")
  }, [evidence.metadata])

  const copyRow = (text: string) => copy(text)

  return (
    <div className="p-5 space-y-6">
      <div className="space-y-0">
        {baseEntries.map(({ key, value }) => (
          <div key={key} className="grid items-center gap-4 py-3" style={{ gridTemplateColumns: "30% 1fr 40px" }}>
            <dt className={`text-sm font-medium text-[var(--allura-text-2)]`}>{key}</dt>
            <dd className={`text-sm text-[var(--allura-charcoal)]`}>{value}</dd>
            <button
              type="button"
              onClick={() => copyRow(String(value))}
              className={`flex h-8 w-8 items-center justify-center rounded-[var(--allura-r-sm)] text-[var(--allura-text-3)] hover:bg-[var(--allura-muted)] hover:text-[var(--allura-charcoal)] transition-colors`}
              title="Copy"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        ))}
      </div>
      {extendedEntries.length > 0 && (
        <div className={`border-t border-[var(--allura-border-1)] pt-4`}>
          <h3 className={`text-xs font-semibold uppercase tracking-wider text-[var(--allura-text-2)] mb-3`}>Extended Metadata</h3>
          <div className="space-y-0">
            {extendedEntries.map(([key, value]) => (
              <div key={key} className="grid items-start gap-4 py-3" style={{ gridTemplateColumns: "30% 1fr 40px" }}>
                <dt className={`text-sm font-medium text-[var(--allura-text-2)]`}>{key}</dt>
                <dd className={`text-sm text-[var(--allura-charcoal)] break-all`}>
                  {typeof value === "object" ? (
                    <pre className={`overflow-x-auto whitespace-pre-wrap rounded-[var(--allura-r-md)] border border-[var(--allura-border-1)] bg-[var(--allura-cream)] p-2 text-xs`}>{JSON.stringify(value, null, 2)}</pre>
                  ) : String(value)}
                </dd>
                <button
                  type="button"
                  onClick={() => copyRow(typeof value === "object" ? JSON.stringify(value, null, 2) : String(value))}
                  className={`flex h-8 w-8 items-center justify-center rounded-[var(--allura-r-sm)] text-[var(--allura-text-3)] hover:bg-[var(--allura-muted)] hover:text-[var(--allura-charcoal)] transition-colors`}
                  title="Copy"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface TraceEvent {
  id: string
  label: string
  timestamp: string
  status: "success" | "error" | "warning" | "info" | "pending"
  detail?: string
}

const traceStatusColors: Record<TraceEvent["status"], string> = {
  success: tokens.color.success.default,
  error: tokens.color.secondary.default,
  warning: tokens.color.accent.gold,
  info: tokens.color.primary.default,
  pending: tokens.color.text.muted,
}

function TraceTab({ evidence }: { evidence: Evidence }) {
  // Build trace from metadata.trace if available; otherwise create a basic trace from evidence data
  const traceEvents = useMemo<TraceEvent[]>(() => {
    const fromMeta = evidence.metadata?.trace
    if (Array.isArray(fromMeta)) return fromMeta as TraceEvent[]
    // Fallback: derive simple trace from evidence lifecycle
    return [
      { id: "1", label: "Evidence recorded", timestamp: evidence.timestamp, status: "success", detail: `Source: ${evidence.source}` },
      { id: "2", label: "Agent submitted", timestamp: evidence.timestamp, status: "info", detail: `Agent: ${evidence.agent}` },
      { id: "3", label: "Status", timestamp: evidence.timestamp, status: evidence.status === "approved" ? "success" : evidence.status === "rejected" ? "error" : "pending", detail: evidence.status },
    ]
  }, [evidence])

  return (
    <div className="p-5">
      <ol className="relative border-l border-[var(--allura-border-1)] ml-3 space-y-6">
        {traceEvents.map((evt) => (
          <li key={evt.id} className="mb-6 ml-6">
            <span
              className="absolute -left-[7px] flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-white"
              style={{ backgroundColor: traceStatusColors[evt.status] }}
            />
            <div className="space-y-1">
              <h4 className={`text-sm font-medium text-[var(--allura-charcoal)]`}>{evt.label}</h4>
              <time className={`text-xs text-[var(--allura-text-3)]`}>{relativeTime(evt.timestamp)}</time>
              {evt.detail && <p className={`text-xs text-[var(--allura-text-2)] mt-1`}>{evt.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function EvidenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [id, setId] = useState<string | null>(null)
  const [state, setState] = useState<DashboardResult<Evidence> | null>(null)
  const [tab, setTab] = useState<DetailTab>("raw")

  useEffect(() => { void params.then((next) => setId(next.id)) }, [params])
  useEffect(() => { if (id) void loadEvidenceDetail(id).then(setState) }, [id])

  if (!id || !state) return <LoadingState />
  if (state.error) return <ErrorState message={state.error} />
  if (!state.data) return <ErrorState message="Evidence not found." />

  const evidence = state.data

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/evidence")} className="gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back to Memory Feed
      </Button>

      <PageHeader
        title={evidence.title}
        description="Dive into the real evidence behind this memory or insight."
        action={<StatusPill value={evidence.status} />}
      />
      <WarningList warnings={state.warnings} />

      {"confidence" in evidence.metadata && typeof evidence.metadata.confidence === "number" && (
        <div className={`flex items-center gap-2 rounded-xl border bg-[var(--dashboard-surface)] p-4`}>
          <span className={`text-sm font-medium text-[var(--allura-charcoal)]`}>Confidence</span>
          <ConfidenceBadge value={evidence.metadata.confidence as number} size="md" />
        </div>
      )}

      {/* Tab Bar */}
      <div className={`flex border-b border-[var(--allura-border-1)]`}>
        {detailTabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`relative px-4 py-3 text-sm font-medium transition-colors ${
              tab === t.value
                ? `text-[var(--allura-blue)]`
                : `text-[var(--allura-text-2)] hover:text-[var(--allura-charcoal)]`
            }`}
          >
            {t.label}
            {tab === t.value && (
              <span className={`absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--allura-gold)]`} />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className={`rounded-xl border border-[var(--allura-border-1)] bg-[var(--dashboard-surface)]`}>
        {tab === "raw" && <RawLogTab rawLog={evidence.rawLog} />}
        {tab === "metadata" && <MetadataTab evidence={evidence} />}
        {tab === "trace" && <TraceTab evidence={evidence} />}
      </div>
    </div>
  )
}
