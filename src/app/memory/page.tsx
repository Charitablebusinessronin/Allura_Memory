/** Consumer Memory Viewer — warmer Durham retrofit */

"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { BrainCircuit, Plus, Search, Settings2 } from "lucide-react"
import { AddMemoryDialog } from "@/components/memory/add-memory-dialog"
import { DeleteConfirmDialog } from "@/components/memory/delete-confirm-dialog"
import { MemoryCard } from "@/components/memory/memory-card"
import { SettingsSheet } from "@/components/memory/settings-sheet"
import { DURHAM_GRADIENTS } from "@/lib/brand/durham"
import { DEFAULT_GROUP_ID, DEFAULT_USER_ID } from "@/lib/defaults/scope"
import { useMemoryList } from "@/hooks/use-memory-list"
import type { Memory } from "@/hooks/use-memory-list"

function buildScopeLabel(groupId: string, userId: string, allUsers: boolean): string {
  if (allUsers) {
    return `Showing memories from everyone in ${groupId}`
  }

  if (userId) {
    return `Showing memories for ${userId}`
  }

  return `Showing memories in ${groupId}`
}

export default function MemoryViewerPage() {
  const {
    memories,
    hasMore,
    isLoading,
    isLoadingMore,
    searchQuery,
    setSearchQuery,
    groupId,
    setGroupId,
    userId,
    setUserId,
    allUsers,
    setAllUsers,
    loadMore,
    deleteMemory,
    addMemory,
    toggleExpand,
    recentlyDeleted,
    undoDelete,
    showUndo,
    formatRelativeTime,
  } = useMemoryList({
    groupId: DEFAULT_GROUP_ID,
    userId: DEFAULT_USER_ID,
  })

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addContent, setAddContent] = useState("")
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleAddSubmit = async () => {
    if (!addContent.trim()) return
    await addMemory(addContent.trim())
    setAddContent("")
    setShowAddModal(false)
  }

  const resultsLabel = useMemo(() => {
    if (searchQuery) {
      return `${memories.length} result${memories.length === 1 ? "" : "s"} for “${searchQuery}”`
    }

    return `${memories.length} memor${memories.length === 1 ? "y" : "ies"} ready to review`
  }, [memories.length, searchQuery])

  return (
    <div className="min-h-screen bg-[--durham-page-bg]" style={{ backgroundImage: DURHAM_GRADIENTS.page }}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-[28px] border border-white/70 bg-white/70 p-4 shadow-[--durham-shadow-base]/8 shadow-xl backdrop-blur sm:p-6 lg:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl space-y-3">
                <p className="text-xs font-semibold tracking-[0.28em] text-[--durham-amber-ochre] uppercase">
                  Allura memory
                </p>
                <div className="space-y-2">
                  <h1 className="text-3xl leading-tight font-semibold text-[--durham-deep-graphite] sm:text-4xl">
                    Search what your system remembers.
                  </h1>
                  <p className="text-base leading-7 text-[--durham-secondary-text] sm:text-lg">
                    Start with a question, then inspect the memories behind it in plain English.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSettingsOpen(true)}
                  className="border-[--durham-border-light] bg-white/80 text-[--durham-rich-navy] hover:bg-[--durham-hover-amber-bg]"
                >
                  <Settings2 className="mr-2 size-4" />
                  View settings
                </Button>
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="bg-[--durham-rich-navy] text-[--durham-warm-mist] hover:bg-[--durham-hover-navy]"
                >
                  <Plus className="mr-2 size-4" />
                  Add a thought
                </Button>
              </div>
            </div>

            <div className="rounded-[24px] border border-[--durham-border] bg-white/90 p-4 shadow-sm sm:p-5">
              <div className="relative">
                <Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[--durham-steel-blue]" />
                <Input
                  placeholder="Search by person, preference, decision, or phrase"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-14 rounded-2xl border-[--durham-input-border] bg-[--durham-surface] pr-12 pl-12 text-base shadow-none placeholder:text-[--durham-caption-text]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute top-1/2 right-4 -translate-y-1/2 text-sm font-medium text-[--durham-muted-text] hover:text-[--durham-deep-graphite]"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[--durham-rich-navy]">{resultsLabel}</p>
                  <p className="text-sm text-[--durham-tertiary-text]">{buildScopeLabel(groupId, userId, allUsers)}</p>
                </div>
              </div>
            </div>
          </div>

          <SettingsSheet
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            groupId={groupId}
            onGroupIdChange={setGroupId}
            userId={userId}
            onUserIdChange={(value) => {
              setUserId(value)
              setAllUsers(false)
            }}
            allUsers={allUsers}
          />

          {showUndo && recentlyDeleted.length > 0 && (
            <div className="mt-6 rounded-2xl border border-[--durham-undo-amber-border] bg-[--durham-undo-amber-bg] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[--durham-rich-navy]">Memory removed from view.</p>
                  <p className="text-sm text-[--durham-undo-amber-text]">
                    You can restore it within 30 days if this was a mistake.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={undoDelete}
                  className="justify-start text-[--durham-rich-navy] hover:bg-white/60"
                >
                  Undo
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6">
            {isLoading ? (
              <div className="py-16 text-center text-sm text-[--durham-tertiary-text]">Loading memories…</div>
            ) : memories.length === 0 ? (
              searchQuery ? (
                <Empty className="rounded-[24px] border border-dashed border-[--durham-border-light] bg-white/75 py-14">
                  <EmptyMedia variant="icon">
                    <Search className="h-12 w-12 text-[--durham-steel-blue]" />
                  </EmptyMedia>
                  <EmptyHeader>
                    <EmptyTitle>No memories matched "{searchQuery}".</EmptyTitle>
                    <EmptyDescription>
                      Nothing in view answers that yet. You can try a broader phrase or add it yourself.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      onClick={() => {
                        setAddContent(searchQuery)
                        setShowAddModal(true)
                      }}
                      className="bg-[--durham-rich-navy] text-[--durham-warm-mist] hover:bg-[--durham-hover-navy]"
                    >
                      Save this manually
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : (
                <Empty className="rounded-[24px] border border-dashed border-[--durham-border-light] bg-white/75 py-14">
                  <EmptyMedia variant="icon">
                    <BrainCircuit className="h-12 w-12 text-[--durham-steel-blue]" />
                  </EmptyMedia>
                  <EmptyHeader>
                    <EmptyTitle>Nothing has been saved here yet.</EmptyTitle>
                    <EmptyDescription>
                      Once conversations or manual notes are stored, they will show up here in a calmer review list.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      onClick={() => setShowAddModal(true)}
                      className="bg-[--durham-rich-navy] text-[--durham-warm-mist] hover:bg-[--durham-hover-navy]"
                    >
                      Add the first memory
                    </Button>
                  </EmptyContent>
                </Empty>
              )
            ) : (
              <div className="rounded-[24px] border border-[--durham-border] bg-[--durham-surface]/80 p-3 sm:p-4">
                <ScrollArea className="h-[calc(100vh-24rem)] min-h-[24rem] pr-2">
                  <div className="space-y-3">
                    {memories.map((memory) => (
                      <MemoryCard
                        key={memory.id}
                        memory={memory}
                        onToggle={toggleExpand}
                        onForget={(item) => {
                          setSelectedMemory(item)
                          setShowDeleteConfirm(true)
                        }}
                        formatRelativeTime={formatRelativeTime}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-[--durham-border] pt-4 text-sm text-[--durham-tertiary-text] sm:flex-row sm:items-center sm:justify-between">
            <span>{resultsLabel}</span>
            {hasMore && (
              <Button
                variant="ghost"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="justify-start text-[--durham-rich-navy] hover:bg-white"
              >
                {isLoadingMore ? "Loading more…" : "Load more"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <AddMemoryDialog
        open={showAddModal}
        onOpenChange={setShowAddModal}
        content={addContent}
        onContentChange={setAddContent}
        onSubmit={handleAddSubmit}
      />
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        memory={selectedMemory}
        onConfirm={deleteMemory}
      />
    </div>
  )
}
