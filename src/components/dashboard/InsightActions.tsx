import Link from "next/link"
import { CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Insight } from "@/lib/dashboard/types"

export function InsightActions({
  insight,
  onApprove,
  onReject,
  busy,
}: {
  insight: Insight
  onApprove: (id: string) => void
  onReject: (id: string) => void
  busy?: boolean
}) {
  return (
    <>
      <Button size="sm" disabled={busy} onClick={() => onApprove(insight.id)}>
        <CheckCircle2 className="mr-1.5 size-3" />
        Approve
      </Button>
      <Button size="sm" variant="outline" disabled={busy}>
        Revise
      </Button>
      <Button size="sm" variant="destructive" disabled={busy} onClick={() => onReject(insight.id)}>
        Reject
      </Button>
      {insight.evidenceId && (
        <Button size="sm" variant="outline" asChild>
          <Link href={`/dashboard/evidence/${encodeURIComponent(insight.evidenceId)}`}>View Evidence</Link>
        </Button>
      )}
    </>
  )
}