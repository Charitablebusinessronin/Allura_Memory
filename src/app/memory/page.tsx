/** Consumer Memory Viewer — iPhone clean, one thing on screen. Reference: docs/allura/DESIGN-ALLURA.md */

"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BrainCircuit, Search, Settings } from "lucide-react"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia, EmptyContent } from "@/components/ui/empty"
import { useMemoryList } from "@/hooks/use-memory-list"
import type { Memory } from "@/hooks/use-memory-list"
import { MemoryCard } from "@/components/memory/memory-card"
import { AddMemoryDialog } from "@/components/memory/add-memory-dialog"
import { DeleteConfirmDialog } from "@/components/memory/delete-confirm-dialog"
import { SettingsSheet } from "@/components/memory/settings-sheet"

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
    groupId: process.env.NEXT_PUBLIC_DEFAULT_GROUP_ID ?? "allura-roninmemory",
    userId: process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? "",
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

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-2 px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⬡</span>
            <span className="text-xl font-semibold">Allura</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <Input
                placeholder="group_id"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-32 text-sm"
              />
              <Input
                placeholder="user_id"
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value)
                  setAllUsers(false)
                }}
                disabled={allUsers}
                className="w-32 text-sm"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 sm:hidden"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="size-5" />
            </Button>
            <Button
              variant={allUsers ? "default" : "outline"}
              size="sm"
              onClick={() => setAllUsers((v: boolean) => !v)}
              className="text-xs whitespace-nowrap"
            >
              {allUsers ? "All Users ✓" : "All Users"}
            </Button>
          </div>
        </div>
      </div>

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        groupId={groupId}
        onGroupIdChange={setGroupId}
        userId={userId}
        onUserIdChange={(v) => {
          setUserId(v)
          setAllUsers(false)
        }}
        allUsers={allUsers}
      />

      {/* Search Bar */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative flex-1">
            <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">🔍</span>
            <Input
              placeholder="Search your memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
              >
                ✕
              </button>
            )}
          </div>
          <Button variant="outline" onClick={() => setShowAddModal(true)} className="w-full sm:w-auto">
            Add manually
          </Button>
        </div>
      </div>

      {/* Undo Banner */}
      {showUndo && recentlyDeleted.length > 0 && (
        <div className="container mx-auto mb-4 px-4">
          <div className="bg-muted flex items-center justify-between rounded-lg p-3">
            <span className="text-sm">
              Memory forgotten. <span className="text-muted-foreground">30 days to recover.</span>
            </span>
            <Button variant="ghost" size="sm" onClick={undoDelete}>
              Undo
            </Button>
          </div>
        </div>
      )}

      {/* Memory List */}
      <div className="container mx-auto px-4">
        {searchQuery && (
          <div className="mb-4">
            <Badge variant="secondary">{memories.length} memories</Badge>
          </div>
        )}
        {isLoading ? (
          <div className="text-muted-foreground py-12 text-center">Loading...</div>
        ) : memories.length === 0 ? (
          searchQuery ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Search className="text-muted-foreground h-12 w-12" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No results for &quot;{searchQuery}&quot;</EmptyTitle>
                <EmptyDescription>Your AI hasn&apos;t learned anything about this yet.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddContent(searchQuery)
                    setShowAddModal(true)
                  }}
                >
                  Add manually
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Empty>
              <EmptyMedia variant="icon">
                <BrainCircuit className="text-muted-foreground h-12 w-12" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>Your memory is blank — for now.</EmptyTitle>
                <EmptyDescription>
                  Allura captures what matters. Start a conversation or add your first memory.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setShowAddModal(true)}>Add your first memory</Button>
              </EmptyContent>
            </Empty>
          )
        ) : (
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-2">
              {memories.map((memory) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  onToggle={toggleExpand}
                  onForget={(m) => {
                    setSelectedMemory(m)
                    setShowDeleteConfirm(true)
                  }}
                  formatRelativeTime={formatRelativeTime}
                />
              ))}
            </div>
          </ScrollArea>
        )}
        <div className="text-muted-foreground mt-4 flex items-center justify-between border-t py-4 text-sm">
          <span>{memories.length} memories</span>
          {hasMore && (
            <Button variant="ghost" onClick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore ? "Loading..." : "Load more"}
            </Button>
          )}
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
