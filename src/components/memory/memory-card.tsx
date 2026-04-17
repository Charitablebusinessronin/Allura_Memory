/**
 * MemoryCard — renders a single memory item in collapsed or expanded state.
 *
 * Extracted from page.tsx to keep the page component focused on layout.
 * All data callbacks (toggle, delete) come from the parent.
 */

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { Memory } from "@/hooks/use-memory-list"

interface MemoryCardProps {
  memory: Memory
  onToggle: (id: string) => void
  onForget: (memory: Memory) => void
  formatRelativeTime: (dateString: string) => string
}

function MemoryTags({ tags }: { tags: string[] | undefined }) {
  if (!tags || tags.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {tags.slice(0, 4).map((tag) => (
        <Badge key={tag} variant="secondary" className="text-xs">
          {tag}
        </Badge>
      ))}
      {tags.length > 4 && (
        <Badge variant="outline" className="text-xs">
          +{tags.length - 4} more
        </Badge>
      )}
    </div>
  )
}

export function MemoryCard({ memory, onToggle, onForget, formatRelativeTime }: MemoryCardProps) {
  const provenanceLabel = memory.provenance === "conversation" ? "from conversation" : "added manually"

  return (
    <Card className="hover:bg-accent cursor-pointer transition-colors" onClick={() => onToggle(memory.id)}>
      <CardContent className="p-4">
        {!memory.expanded ? (
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm">{memory.content}</p>
              <MemoryTags tags={memory.tags} />
              <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                <span>{formatRelativeTime(memory.created_at)}</span>
                <span>·</span>
                <span>{provenanceLabel}</span>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-sm font-medium">{memory.content}</p>
            <MemoryTags tags={memory.tags} />
            <div className="text-muted-foreground mb-3 flex items-center gap-2 text-xs">
              <span>{formatRelativeTime(memory.created_at)}</span>
              <span>·</span>
              <span>{provenanceLabel}</span>
            </div>
            <Separator className="my-3" />
            <p className="text-muted-foreground mb-3 text-xs">
              Your AI learned this during a conversation on {new Date(memory.created_at).toLocaleDateString()}.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Used {memory.usage_count || 0} times this week</span>
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
        )}
      </CardContent>
    </Card>
  )
}
