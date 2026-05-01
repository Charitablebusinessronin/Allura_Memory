"use client"

import type { GraphEdge, GraphNode } from "@/lib/dashboard/types"

/**
 * Token Authority for this component:
 * - CSS var() usage via Allura design tokens (allura, dashboard, tone prefixes)
 *   e.g. var(--allura-blue), var(--dashboard-text-primary), var(--tone-blue-bg)
 *   is the CORRECT pattern for Tailwind/HTML contexts.
 * - The `tokens.ts` file is for Canvas 2D and JS-only contexts where CSS vars cannot be used.
 * - This component correctly uses the Allura CSS custom property token system.
 * - Never use raw hex values or generic shadcn color utilities.
 */

interface NodeDetailPanelProps {
  node: GraphNode | null
  edges: GraphEdge[]
  nodes: GraphNode[]
}

function formatMetadata(metadata: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(metadata)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)])
}

function relativeTime(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diff = now - then
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export function NodeDetailPanel({ node, edges, nodes }: NodeDetailPanelProps) {
  if (!node) {
    return (
      <div className="rounded-xl border bg-[var(--dashboard-surface)] p-5 text-center">
        <p className="text-sm text-[var(--dashboard-text-secondary)]">Select a node to see its relationships.</p>
      </div>
    )
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const connectedEdges = edges.filter((e) => e.source === node.id || e.target === node.id)
  const metadata = node.metadata ?? {}

  return (
    <div className="rounded-xl border bg-[var(--dashboard-surface)] p-5 space-y-5" style={{ fontFamily: "var(--font-ibm-plex-sans)" }}>
      <div>
        <h2 className="font-semibold text-[var(--dashboard-text-primary)]">{node.label}</h2>
        <span className="mt-1 inline-block rounded-full bg-[var(--tone-blue-bg)] px-2 py-0.5 text-xs font-medium text-[var(--tone-blue-text)]">
          {node.type}
        </span>
      </div>

      {Object.keys(metadata).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--dashboard-text-secondary)]">Metadata</h3>
          <dl className="mt-2 space-y-2 text-sm">
            {formatMetadata(metadata).map(([key, value]) => (
              <div key={key}>
                <dt className="text-[var(--dashboard-text-secondary)]">{key}</dt>
                <dd className="mt-0.5 text-[var(--dashboard-text-primary)]">
                  {value.length > 200 ? `${value.slice(0, 197)}...` : value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--dashboard-text-secondary)]">
          Connected To ({connectedEdges.length})
        </h3>
        {connectedEdges.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--dashboard-text-secondary)]">No relationships found for this node.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {connectedEdges.map((edge) => {
              const isSource = edge.source === node.id
              const otherId = isSource ? edge.target : edge.source
              const otherNode = nodeMap.get(otherId)
              return (
                <div key={edge.id} className="flex items-center gap-2 rounded-lg border border-[var(--dashboard-border)] p-2 text-sm">
                  <span className="rounded bg-[var(--tone-blue-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--tone-blue-text)]">
                    {edge.label}
                  </span>
                  <span className="text-[var(--dashboard-text-primary)]">
                    {isSource ? "→" : "←"} {otherNode?.label ?? otherId}
                  </span>
                  {otherNode && (
                    <span className="text-[var(--dashboard-text-secondary)] text-xs">({otherNode.type})</span>
                  )}
                  {typeof edge.metadata?.relationship_type === "string" && edge.metadata.relationship_type !== edge.label && (
                    <span className="text-[var(--dashboard-text-secondary)] text-xs">
                      [{edge.metadata.relationship_type}]
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {"created_at" in metadata && typeof metadata.created_at === "string" && (
        <p className="text-xs text-[var(--dashboard-text-secondary)]">
          Created {relativeTime(metadata.created_at)}
        </p>
      )}
    </div>
  )
}
