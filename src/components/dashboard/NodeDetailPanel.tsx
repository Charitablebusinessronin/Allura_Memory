"use client"

import { Database } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Token Authority for this component:
 * - CSS var() usage via Allura design tokens (allura, dashboard, tone prefixes)
 *   e.g. var(--allura-blue), var(--dashboard-text-primary), var(--tone-blue-bg)
 *   is the CORRECT pattern for Tailwind/HTML contexts.
 * - The `tokens.ts` file is for Canvas 2D and JS-only contexts where CSS vars cannot be used.
 * - This component correctly uses the Allura CSS custom property token system.
 * - Never use raw hex values or generic shadcn color utilities.
 */

export interface NodeData {
  id: string
  type: "memory" | "insight" | "evidence" | "agent" | "project"
  title: string
  content: string
  confidence?: number
  source?: string
  project?: string
  agent?: string
  timestamp?: string
  evidenceLinks?: Array<{ url: string; label: string }>
  relatedInsights?: Array<{ id: string; title: string }>
  graphConnections?: Array<{ nodeId: string; relation: string }>
}

export interface NodeDetailPanelProps {
  node?: NodeData | null
  onViewEvidence?: () => void
  onPromote?: () => void
  onSupersede?: () => void
  onOpenDR?: () => void
  className?: string
}

const TYPE_CONFIG: Record<
  NodeData["type"],
  { label: string; bgClass: string }
> = {
  memory:   { label: "MEMORY",   bgClass: "bg-[var(--allura-blue)] text-white" },
  insight:  { label: "INSIGHT",  bgClass: "bg-[var(--allura-green)] text-white" },
  evidence: { label: "EVIDENCE", bgClass: "bg-[var(--dashboard-evidence)] text-[var(--allura-charcoal)]" },
  agent:    { label: "AGENT",    bgClass: "bg-[var(--allura-orange)] text-white" },
  project:  { label: "PROJECT",  bgClass: "bg-[var(--dashboard-text-secondary)] text-white" },
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, "0")
    return (
      `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
      `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
    )
  } catch {
    return iso
  }
}

function Divider() {
  return <div className="h-px w-full bg-[var(--dashboard-border)]" />
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] font-semibold text-[var(--dashboard-text-muted)]">
      {children}
    </p>
  )
}

export function NodeDetailPanel({
  node,
  onViewEvidence,
  onPromote,
  onSupersede,
  onOpenDR,
  className = "",
}: NodeDetailPanelProps) {
  // ── Empty state ──────────────────────────────────────────────────────────
  if (!node) {
    return (
      <div
        className={`flex w-[380px] shrink-0 flex-col items-center justify-center gap-3 rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-8 text-center ${className}`}
      >
        <Database
          size={32}
          className="text-[var(--dashboard-text-muted)]"
          strokeWidth={1.5}
        />
        <p className="text-[18px] font-semibold text-[var(--dashboard-text-primary)]">
          Select a node
        </p>
        <p className="text-[13px] text-[var(--dashboard-text-muted)]">
          Click any node in the graph to view details
        </p>
      </div>
    )
  }

  const { label: typeLabel, bgClass } = TYPE_CONFIG[node.type]

  const metaRows: Array<{ label: string; value: string }> = [
    ...(node.confidence !== undefined
      ? [{ label: "Confidence", value: `${node.confidence}%` }]
      : []),
    ...(node.source ? [{ label: "Source", value: node.source }] : []),
    ...(node.project ? [{ label: "Project", value: node.project }] : []),
    ...(node.agent ? [{ label: "Agent", value: node.agent }] : []),
    ...(node.timestamp
      ? [{ label: "Timestamp", value: formatTimestamp(node.timestamp) }]
      : []),
  ]

  return (
    <div
      className={`flex w-[380px] shrink-0 flex-col rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] overflow-hidden ${className}`}
    >
      {/* ── Header (80px) ──────────────────────────────────────────────── */}
      <div className="flex h-20 shrink-0 flex-col justify-center gap-1.5 px-5">
        <span
          className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wider ${bgClass}`}
        >
          {typeLabel}
        </span>
        <p className="truncate text-[18px] font-semibold leading-snug text-[var(--dashboard-text-primary)]">
          {node.title}
        </p>
      </div>

      <Divider />

      {/* ── Metadata rows ──────────────────────────────────────────────── */}
      {metaRows.length > 0 && (
        <>
          <div className="flex flex-col gap-2 px-5 py-4">
            {metaRows.map(({ label, value }) => (
              <div key={label} className="flex items-start gap-2 text-[12px]">
                <span className="w-[120px] shrink-0 text-[var(--dashboard-text-muted)]">
                  {label}
                </span>
                <span className="text-[var(--dashboard-text-primary)]">{value}</span>
              </div>
            ))}
          </div>
          <Divider />
        </>
      )}

      {/* ── Scrollable body ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "thin" }}>

        {/* Content */}
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Content</SectionLabel>
          <p className="text-[13px] leading-relaxed text-[var(--dashboard-text-primary)]">
            {node.content}
          </p>
        </div>

        {/* Evidence Links */}
        {node.evidenceLinks && node.evidenceLinks.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <SectionLabel>Evidence Links</SectionLabel>
            <div className="flex flex-col gap-1">
              {node.evidenceLinks.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-[var(--allura-blue)] hover:underline"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Related Insights */}
        {node.relatedInsights && node.relatedInsights.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <SectionLabel>Related Insights</SectionLabel>
            <div className="flex flex-col gap-1">
              {node.relatedInsights.map((insight) => (
                <span
                  key={insight.id}
                  className="text-[12px] text-[var(--dashboard-text-muted)]"
                >
                  {insight.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Graph Connections */}
        {node.graphConnections && node.graphConnections.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <SectionLabel>Graph Connections</SectionLabel>
            <div className="flex flex-col gap-1">
              {node.graphConnections.map((conn) => (
                <span
                  key={conn.nodeId}
                  className="text-[12px] text-[var(--dashboard-text-muted)]"
                >
                  {conn.relation} → {conn.nodeId}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <Divider />

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 px-5 py-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={onViewEvidence}
          className="bg-[var(--dashboard-surface-muted)] text-[var(--dashboard-text-primary)]"
        >
          View Evidence
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onPromote}
          className="bg-[var(--dashboard-surface-muted)] text-[var(--dashboard-text-primary)]"
        >
          Promote
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onSupersede}
          className="bg-[var(--dashboard-surface-muted)] text-[var(--dashboard-text-primary)]"
        >
          Supersede
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onOpenDR}
          className="bg-[var(--dashboard-surface-muted)] text-[var(--dashboard-text-primary)]"
        >
          Open DR
        </Button>
      </div>
    </div>
  )
}
