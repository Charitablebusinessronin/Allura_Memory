import Link from "next/link"

import type { Evidence } from "@/lib/dashboard/types"
import { StatusPill } from "./StatusPill"

export function EvidenceCard({ evidence }: { evidence: Evidence }) {
  return (
    <Link
      href={`/dashboard/evidence/${encodeURIComponent(evidence.id)}`}
      className="block rounded-xl border bg-card p-5 transition hover:bg-muted/30"
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold">{evidence.title}</h3>
        <StatusPill value={evidence.status} />
      </div>
      <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">{evidence.rawLog}</p>
      <div className="text-muted-foreground mt-3 flex flex-wrap gap-3 text-xs">
        <span>{evidence.source}</span>
        <span>{evidence.agent}</span>
        <span>{new Date(evidence.timestamp).toLocaleString()}</span>
      </div>
    </Link>
  )
}