import { CheckCircle2 } from "lucide-react"
import Link from "next/link"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
      {/* Approve — confirmation required */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" disabled={busy}>
            <CheckCircle2 className="mr-1.5 size-3" />
            Approve
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this insight?</AlertDialogTitle>
            <AlertDialogDescription>
              This will promote it to the knowledge graph. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onApprove(insight.id)}>
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject — confirmation required */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="destructive" disabled={busy}>
            Reject
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this insight?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => onReject(insight.id)}>
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {insight.evidenceId && (
        <Button size="sm" variant="outline" asChild>
          <Link href={`/dashboard/evidence/${encodeURIComponent(insight.evidenceId)}`}>View Evidence</Link>
        </Button>
      )}
    </>
  )
}
