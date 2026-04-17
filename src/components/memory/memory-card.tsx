/**
 * MemoryCard — renders a single memory item in collapsed or expanded state.
 *
 * Extracted from page.tsx to keep the page component focused on layout.
 * All data callbacks (toggle, delete) come from the parent.
 */

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import type { Memory } from "@/hooks/use-memory-list"

interface MemoryCardProps {
  memory: Memory
  onToggle: (id: string) => void
  onForget: (memory: Memory) => void
  formatRelativeTime: (dateString: string) => string
}

export function MemoryCard({ memory, onToggle, onForget, formatRelativeTime }: MemoryCardProps) {
  const provenanceLabel = memory.provenance === "conversation" ? "from conversation" : "added manually"
  const learnedLabel =
    memory.provenance === "conversation"
      ? `Allura picked this up during a conversation on ${new Date(memory.created_at).toLocaleDateString()}.`
      : `This was added by hand on ${new Date(memory.created_at).toLocaleDateString()}.`

  return (
    <Card
      className="cursor-pointer border-[--durham-border] bg-white/90 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[--durham-steel-blue]/40 hover:shadow-md"
      onClick={() => onToggle(memory.id)}
    >
      <CardContent className="p-5">
        {!memory.expanded ? (
          <div>
            <p className="text-base leading-7 font-medium text-[--durham-deep-graphite]">{memory.content}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[--durham-muted-text]">
              <span>{formatRelativeTime(memory.created_at)}</span>
              <span>·</span>
              <span>{provenanceLabel}</span>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-lg leading-8 font-semibold text-[--durham-deep-graphite]">{memory.content}</p>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[--durham-muted-text]">
              <span>{formatRelativeTime(memory.created_at)}</span>
              <span>·</span>
              <span>{provenanceLabel}</span>
            </div>
            <Separator className="my-4 bg-[--durham-border]" />
            <p className="mb-4 text-sm leading-6 text-[--durham-warm-slate]">{learnedLabel}</p>
            {memory.tags && memory.tags.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {memory.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[--durham-border] bg-[--durham-hover-amber-bg] px-2.5 py-1 text-xs font-medium text-[--durham-warm-slate]"
                  >
                    {tag}
                  </span>
                ))}
                {memory.tags.length > 4 && (
                  <span className="rounded-full border border-[--durham-border] bg-white px-2.5 py-1 text-xs text-[--durham-muted-text]">
                    +{memory.tags.length - 4} more
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-[--durham-muted-text]">
                {memory.usage_count != null && memory.usage_count > 0
                  ? `Used ${memory.usage_count} time${memory.usage_count === 1 ? "" : "s"} recently`
                  : "No recent usage signal yet"}
              </span>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                  <Link href={`/memory/${memory.id}`}>Inspect</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onForget(memory)
                  }}
                >
                  Forget
                </Button>
              </div>
            </div>
            <p className="mt-4 text-xs tracking-[0.16em] text-[--durham-caption-text] uppercase">
              {memory.source === "both" ? "Seen in both memory stores" : `Seen in the ${memory.source} store`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
