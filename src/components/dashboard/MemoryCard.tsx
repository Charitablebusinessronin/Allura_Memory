import Link from "next/link"
import { Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Memory } from "@/lib/dashboard/types"
import { StatusPill } from "./StatusPill"

export function MemoryCard({ memory }: { memory: Memory }) {
  return (
    <article className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{memory.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm text-[var(--dashboard-text-secondary)]">{memory.content}</p>
        </div>
        <StatusPill value={memory.status} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--dashboard-text-secondary)]">
        <span>Agent: {memory.agent}</span>
        <span>Project: {memory.project}</span>
        <span>{new Date(memory.timestamp).toLocaleString()}</span>
        <span>{memory.connectedMemoryCount} connections</span>
      </div>
      {memory.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {memory.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button size="xs" variant="ghost" asChild>
          <Link href={`/dashboard/insights?promote=${memory.id}`} data-testid="promote-link">
            <Lightbulb className="mr-1 size-3" />
            Promote
          </Link>
        </Button>
      </div>
    </article>
  )
}
