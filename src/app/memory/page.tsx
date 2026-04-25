"use client"

import dynamic from "next/dynamic"
import { useMemo, useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Search, Settings2, Clock, BrainCircuit } from "lucide-react"
import { AddMemoryDialog } from "@/components/memory/add-memory-dialog"
import { DeleteConfirmDialog } from "@/components/memory/delete-confirm-dialog"
import { DeletedMemoryCard } from "@/components/memory/deleted-memory-card"
import { SettingsSheet } from "@/components/memory/settings-sheet"
import { AlluraMemoryCard } from "@/components/allura/memory-card"
import { EmptyState } from "@/components/allura/empty-state"
import { PanelDrawer } from "@/components/allura/panel-drawer"
import { DEFAULT_GROUP_ID, DEFAULT_USER_ID } from "@/lib/defaults/scope"
import { useMemoryList } from "@/hooks/use-memory-list"
import { buildScopeLabel } from "@/lib/scope/display-names"
import type { Memory } from "@/hooks/use-memory-list"

const GraphTabLoader = dynamic(
  () => import("@/components/allura/graph-tab").then((mod) => mod.GraphTab),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-xl border border-[var(--allura-deep-navy)]/10 bg-white">
        <div className="text-center">
          <div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-[var(--allura-deep-navy)] border-t-transparent" />
          <p className="text-sm text-[var(--allura-warm-gray)]">Loading graph...</p>
        </div>
      </div>
    ),
  }
)

type TabValue = "memories" | "forgotten" | "graph"

export default function MemoryViewerPage() {
  const {
    memories,
    deletedMemories,
    hasMore,
    isLoading,
    isLoadingMore,
    viewStatus,
    setViewStatus,
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
    restoreMemory,
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
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [scopeLabel, setScopeLabel] = useState<string>("Loading...")
  const [activeTab, setActiveTab] = useState<TabValue>("memories")
  const [drawerMemory, setDrawerMemory] = useState<Memory | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    buildScopeLabel(groupId, userId, allUsers).then((label) => {
      if (mounted) setScopeLabel(label)
    })
    return () => { mounted = false }
  }, [groupId, userId, allUsers])

  const handleAddSubmit = async () => {
    if (!addContent.trim()) return
    await addMemory(addContent.trim())
    setAddContent("")
    setShowAddModal(false)
  }

  const handleRestore = async (memoryId: string) => {
    setRestoringId(memoryId)
    await restoreMemory(memoryId)
    setRestoringId(null)
  }

  const handleViewSource = useCallback((memory: Memory) => {
    setDrawerMemory(memory)
    setDrawerOpen(true)
  }, [])

  const handleForget = useCallback((memory: Memory) => {
    setSelectedMemory(memory)
    setShowDeleteConfirm(true)
  }, [])

  const tabToViewStatus = useCallback((tab: TabValue) => {
    if (tab === "forgotten") return "deleted" as const
    return "active" as const
  }, [])

  const handleTabChange = useCallback((tab: TabValue) => {
    setActiveTab(tab)
    setViewStatus(tabToViewStatus(tab))
  }, [setViewStatus, tabToViewStatus])

  const resultsLabel = useMemo(() => {
    if (activeTab === "forgotten") {
      return `${deletedMemories.length} forgotten memor${deletedMemories.length === 1 ? "y" : "ies"} in recovery window`
    }
    if (searchQuery) {
      return `${memories.length} result${memories.length === 1 ? "" : "s"} for "${searchQuery}"`
    }
    return `${memories.length} memor${memories.length === 1 ? "y" : "ies"} ready to review`
  }, [memories.length, deletedMemories.length, searchQuery, activeTab])

  return (
    <div className="flex min-h-screen flex-col bg-[var(--allura-pure-white)]">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 flex items-center justify-between bg-[var(--allura-deep-navy)] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--allura-coral)]">
            <BrainCircuit className="size-4 text-white" />
          </div>
          <span className="font-display text-lg text-[var(--allura-pure-white)]">Allura</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-[var(--allura-coral)] text-white hover:bg-[var(--allura-coral)]/90"
            style={{ borderRadius: "var(--allura-radius-button)" }}
          >
            <Plus className="mr-1.5 size-4" />
            <span className="hidden sm:inline">Add Memory</span>
            <span className="sm:hidden">Add</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            className="text-[var(--allura-pure-white)] hover:bg-white/10"
            aria-label="Settings"
          >
            <Settings2 className="size-5" />
          </Button>
          <div className="flex size-8 items-center justify-center rounded-full bg-[var(--allura-clarity-blue)] text-xs font-semibold text-white">
            U
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="mb-8">
          <h1 className="font-display text-[40px] leading-tight text-[var(--allura-ink-black)]">
            What does your system know?
          </h1>
          <p className="mt-2 text-base text-[var(--allura-warm-gray)]">
            Start with a question, then review the memories behind it.
          </p>
        </div>

        {/* Search bar */}
        {(activeTab === "memories" || activeTab === "forgotten") && (
          <div className="mb-6">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[var(--allura-warm-gray)]" />
              <Input
                placeholder="Search by person, preference, decision, or phrase"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-14 bg-white pr-12 pl-12 text-base shadow-[var(--allura-shadow-card)]"
                style={{ borderRadius: "var(--allura-radius-input)" }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute top-1/2 right-4 -translate-y-1/2 text-sm font-medium text-[var(--allura-warm-gray)] hover:text-[var(--allura-deep-navy)]"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--allura-deep-navy)]">{resultsLabel}</p>
              <p className="text-sm text-[var(--allura-warm-gray)]">{scopeLabel}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl bg-[var(--allura-navy-5)] p-1">
          {(["memories", "forgotten", "graph"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-white text-[var(--allura-deep-navy)] shadow-[var(--allura-shadow-card)]"
                  : "text-[var(--allura-warm-gray)] hover:text-[var(--allura-deep-navy)]"
              }`}
              style={{ borderRadius: "var(--allura-radius-button)" }}
            >
              {tab === "memories" && "Memories"}
              {tab === "forgotten" && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4" />
                  Recently Forgotten
                </span>
              )}
              {tab === "graph" && "Graph"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "memories" && (
          <>
            {/* Undo banner */}
            {showUndo && recentlyDeleted.length > 0 && (
              <div className="mb-4 rounded-xl border border-[var(--allura-coral-20)] bg-[var(--allura-coral-10)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--allura-deep-navy)]">
                      Memory removed from view.
                    </p>
                    <p className="text-sm text-[var(--allura-warm-gray)]">
                      You can restore it within 30 days if this was a mistake.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={undoDelete}
                    className="text-[var(--allura-deep-navy)] hover:bg-white/60"
                    style={{ borderRadius: "var(--allura-radius-button)" }}
                  >
                    Undo
                  </Button>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="size-8 animate-spin rounded-full border-2 border-[var(--allura-deep-navy)] border-t-transparent" />
              </div>
            ) : memories.length === 0 ? (
              searchQuery ? (
                <EmptyState
                  title={`No memories matched "${searchQuery}"`}
                  description="Try a broader phrase or add it yourself."
                  cta={{
                    label: "Save this manually",
                    onClick: () => {
                      setAddContent(searchQuery)
                      setShowAddModal(true)
                    },
                  }}
                />
              ) : (
                <EmptyState
                  title="Nothing has been saved here yet"
                  description="Once conversations or notes are stored, they will show up here."
                  cta={{ label: "Add the first memory", onClick: () => setShowAddModal(true) }}
                />
              )
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {memories.map((memory) => (
                  <AlluraMemoryCard
                    key={memory.id}
                    memory={memory}
                    onViewSource={() => handleViewSource(memory)}
                    onForget={() => handleForget(memory)}
                    formatRelativeTime={formatRelativeTime}
                  />
                ))}
              </div>
            )}

            {hasMore && memories.length > 0 && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="border-[var(--allura-deep-navy)] text-[var(--allura-deep-navy)]"
                  style={{ borderRadius: "var(--allura-radius-button)" }}
                >
                  {isLoadingMore ? "Loading more..." : "Load more"}
                </Button>
              </div>
            )}
          </>
        )}

        {activeTab === "forgotten" && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="size-8 animate-spin rounded-full border-2 border-[var(--allura-deep-navy)] border-t-transparent" />
              </div>
            ) : deletedMemories.length === 0 ? (
              <EmptyState
                title="Nothing in the recovery window"
                description="When you forget a memory, it appears here for 30 days. Restore any that were removed."
              />
            ) : (
              <div className="rounded-xl border border-[var(--allura-deep-navy)]/10 bg-white p-3 sm:p-4">
                <ScrollArea className="h-[calc(100vh-24rem)] min-h-[24rem]">
                  <div className="space-y-3">
                    {deletedMemories.map((memory) => (
                      <DeletedMemoryCard
                        key={memory.id}
                        memory={memory}
                        onRestore={handleRestore}
                        isRestoring={restoringId === memory.id}
                        formatRelativeTime={formatRelativeTime}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </>
        )}

        {activeTab === "graph" && (
          <GraphTabLoader onNodeClick={handleViewSource} />
        )}
      </div>

      {/* Dialogs */}
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

      {/* Panel Drawer */}
      <PanelDrawer
        memory={drawerMemory}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        formatRelativeTime={formatRelativeTime}
      />

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
    </div>
  )
}

