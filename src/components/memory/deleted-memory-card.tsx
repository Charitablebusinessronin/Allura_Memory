/**
 * DeletedMemoryCard — renders a soft-deleted memory in the "Recently Forgotten" view.
 *
 * Shows memory content, deletion date, days remaining in recovery window,
 * and a Restore action button. Uses Durham brand tokens throughout.
 */

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RotateCcw, Clock } from "lucide-react"
import Link from "next/link"
import type { DeletedMemory } from "@/hooks/use-memory-list"

interface DeletedMemoryCardProps {
  memory: DeletedMemory
  onRestore: (id: string) => void
  isRestoring?: boolean
  formatRelativeTime: (dateString: string) => string
}

export function DeletedMemoryCard({ memory, onRestore, isRestoring, formatRelativeTime }: DeletedMemoryCardProps) {
  const provenanceLabel = memory.provenance === "conversation" ? "from conversation" : "added manually"

  return (
    <Card className="cursor-pointer border-[--durham-border] bg-white/80 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[--durham-steel-blue]/40 hover:shadow-md">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2 rounded-full border border-[--durham-status-failed-border] bg-[--durham-status-failed-bg] px-3 py-1.5">
          <Clock className="size-3.5 text-[--durham-status-failed-text]" />
          <span className="text-xs font-medium text-[--durham-status-failed-text]">
            Forgotten {formatRelativeTime(memory.deleted_at)}
            {memory.recovery_days_remaining <= 7 && memory.recovery_days_remaining > 0 && (
              <>
                {" "}
                · {memory.recovery_days_remaining} day{memory.recovery_days_remaining === 1 ? "" : "s"} left to restore
              </>
            )}
            {memory.recovery_days_remaining === 0 && " · Expiring soon"}
          </span>
        </div>

        <p className="mb-2 text-base leading-7 font-medium text-[--durham-deep-graphite] opacity-80">
          {memory.content}
        </p>

        <div className="flex flex-wrap items-center gap-2 text-sm text-[--durham-muted-text]">
          <span>{formatRelativeTime(memory.created_at)}</span>
          <span>·</span>
          <span>{provenanceLabel}</span>
        </div>

        {memory.tags && memory.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {memory.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[--durham-border] bg-[--durham-hover-amber-bg] px-2.5 py-1 text-xs font-medium text-[--durham-warm-slate] opacity-80"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 border-t border-[--durham-border-light] pt-3">
          <Button
            size="sm"
            onClick={() => onRestore(memory.id)}
            disabled={isRestoring}
            className="bg-[--durham-rich-navy] text-[--durham-warm-mist] hover:bg-[--durham-hover-navy]"
          >
            <RotateCcw className="mr-2 size-4" />
            {isRestoring ? "Restoring…" : "Restore"}
          </Button>
          <Button asChild variant="ghost" size="sm" className="text-[--durham-muted-text]">
            <Link href={`/memory/${memory.id}?group_id=allura-roninmemory`}>View</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
