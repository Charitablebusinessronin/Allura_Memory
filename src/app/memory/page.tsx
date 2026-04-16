/**
 * Consumer Memory Viewer
 * 
 * Design: iPhone clean, one thing on screen.
 * - No sidebar (memory is the only screen)
 * - Search dominant, full width
 * - Swipe to delete (no visible trash icon)
 * - Memory provenance on expand
 * - Usage indicator on expand
 * - Undo / recently deleted
 * 
 * Reference: docs/allura/DESIGN-ALLURA.md
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/dialog';

interface Memory {
  id: string;
  content: string;
  score: number;
  source: 'episodic' | 'semantic' | 'both';
  provenance: 'conversation' | 'manual';
  created_at: string;
  usage_count?: number;
  expanded?: boolean;
}

interface SearchResponse {
  results: Memory[];
  count: number;
  latency_ms: number;
}

interface ListResponse {
  memories: Memory[];
  total: number;
  has_more: boolean;
}

/** Normalize Neo4j DateTime objects to ISO strings (defensive client-side fix) */
function normalizeCreatedAt(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'year' in (value as Record<string, unknown>)) {
    const d = value as Record<string, { low: number; high?: number }>;
    const get = (field: string): number => d[field]?.low ?? 0;
    return new Date(
      Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'), Math.floor(get('nanosecond') / 1_000_000))
    ).toISOString();
  }
  return String(value ?? new Date().toISOString());
}

/** Normalize a memory object's created_at from potential Neo4j DateTime */
function normalizeMemory(m: Memory): Memory {
  return { ...m, created_at: normalizeCreatedAt(m.created_at), content: m.content ?? '' };
}

export default function MemoryViewerPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupId, setGroupId] = useState(
    process.env.NEXT_PUBLIC_DEFAULT_GROUP_ID ?? 'allura-roninmemory'
  );
  // FIX BUG-002: was 'load-test-vu-1' — caused load test data to appear on every fresh load
  const [userId, setUserId] = useState(
    process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? ''
  );
  const [allUsers, setAllUsers] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [recentlyDeleted, setRecentlyDeleted] = useState<Memory[]>([]);
  const [showUndo, setShowUndo] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // FIX BUG-004: debounced real-time search — no Enter key required
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchQuery.trim()) {
        searchMemories();
      } else {
        fetchMemories();
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Fetch memories on mount / when group/user changes
  useEffect(() => {
    fetchMemories();
  }, [groupId, userId, allUsers]);

  // Fetch all memories for user
  const fetchMemories = async () => {
    setIsLoading(true);
    try {
      const userParam = allUsers ? '' : userId ? `&user_id=${encodeURIComponent(userId)}` : '';
      const response = await fetch(
        `/api/memory?group_id=${encodeURIComponent(groupId)}${userParam}&limit=50`
      );
      const data: ListResponse = await response.json();
      setMemories((data.memories || []).map(normalizeMemory));
      setHasMore(data.has_more);
    } catch (error) {
      console.error('Failed to fetch memories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Search memories
  const searchMemories = async () => {
    if (!searchQuery.trim()) {
      fetchMemories();
      return;
    }

    setIsLoading(true);
    try {
      const userParam = allUsers ? '' : userId ? `&user_id=${encodeURIComponent(userId)}` : '';
      const response = await fetch(
        `/api/memory?query=${encodeURIComponent(searchQuery)}&group_id=${encodeURIComponent(groupId)}${userParam}&limit=50`
      );
      const data: SearchResponse = await response.json();
      setMemories((data.results || []).map(normalizeMemory));
    } catch (error) {
      console.error('Failed to search:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add memory (called from modal)
  const addMemory = async (content: string) => {
    try {
      const response = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: groupId,
          user_id: userId,
          content,
          metadata: { source: 'manual' },
        }),
      });
      
      if (response.ok) {
        fetchMemories();
      }
    } catch (error) {
      console.error('Failed to add memory:', error);
    }
  };

  // Delete memory (soft delete)
  const deleteMemory = async (memory: Memory) => {
    try {
      const response = await fetch(
        `/api/memory/${memory.id}?group_id=${groupId}&user_id=${userId}`,
        { method: 'DELETE' }
      );
      
      if (response.ok) {
        setRecentlyDeleted((prev) => [memory, ...prev].slice(0, 10));
        setShowUndo(true);
        setMemories((prev) => prev.filter((m) => m.id !== memory.id));
        setTimeout(() => setShowUndo(false), 30000);
      }
    } catch (error) {
      console.error('Failed to delete memory:', error);
    }
  };

  // Undo deletion
  const undoDelete = async () => {
    if (recentlyDeleted.length === 0) return;
    const memory = recentlyDeleted[0];
    await addMemory(memory.content);
    setRecentlyDeleted((prev) => prev.slice(1));
    setShowUndo(false);
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // FIX BUG-003: native Add Memory modal state (replaces prompt())
  const [showAddModal, setShowAddModal] = useState(false);
  const [addContent, setAddContent] = useState('');

  const handleAddSubmit = async () => {
    if (!addContent.trim()) return;
    await addMemory(addContent.trim());
    setAddContent('');
    setShowAddModal(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⬡</span>
            <span className="text-xl font-semibold">Allura</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="group_id"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-32 text-sm"
            />
            <Input
              placeholder="user_id"
              value={userId}
              onChange={(e) => { setUserId(e.target.value); setAllUsers(false); }}
              disabled={allUsers}
              className="w-32 text-sm"
            />
            <Button
              variant={allUsers ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAllUsers((v) => !v)}
              className="text-xs whitespace-nowrap"
            >
              {allUsers ? 'All Users ✓' : 'All Users'}
            </Button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              🔍
            </span>
            <Input
              placeholder="Search your memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>
          {/* FIX BUG-003: open modal instead of prompt() */}
          <Button variant="outline" onClick={() => setShowAddModal(true)}>
            Add manually
          </Button>
        </div>
      </div>

      {/* Undo Banner */}
      {showUndo && recentlyDeleted.length > 0 && (
        <div className="container mx-auto px-4 mb-4">
          <div className="bg-muted p-3 rounded-lg flex items-center justify-between">
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
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : memories.length === 0 ? (
          <div className="text-center py-12">
            {searchQuery ? (
              <div>
                <p className="text-lg mb-2">
                  Your AI hasn't learned anything about &quot;{searchQuery}&quot; yet.
                </p>
                <p className="text-muted-foreground mb-4">
                  Try: &quot;{searchQuery.split(' ')[0]}&quot;, or related terms
                </p>
                <Button variant="outline" onClick={() => { setAddContent(searchQuery); setShowAddModal(true); }}>
                  Add this manually
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-lg mb-2">No memories yet.</p>
                <p className="text-muted-foreground">
                  Start a conversation with your AI to build memory.
                </p>
              </div>
            )}
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-2">
              {memories.map((memory) => (
                <Card
                  key={memory.id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => {
                    setMemories((prev) =>
                      prev.map((m) =>
                        m.id === memory.id
                          ? { ...m, expanded: !m.expanded }
                          : { ...m, expanded: false }
                      )
                    );
                  }}
                >
                  <CardContent className="p-4">
                    {!memory.expanded ? (
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm">{memory.content}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <span>{formatRelativeTime(memory.created_at)}</span>
                            <span>·</span>
                            <span>
                              {memory.provenance === 'conversation' ? 'from conversation' : 'added manually'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium mb-2">{memory.content}</p>
                        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                          <span>{formatRelativeTime(memory.created_at)}</span>
                          <span>·</span>
                          <span>
                            {memory.provenance === 'conversation' ? 'from conversation' : 'added manually'}
                          </span>
                        </div>
                        <Separator className="my-3" />
                        <p className="text-xs text-muted-foreground mb-3">
                          Your AI learned this during a conversation on{' '}
                          {new Date(memory.created_at).toLocaleDateString()}.
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Used {memory.usage_count || 0} times this week
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMemory(memory);
                              setShowDeleteConfirm(true);
                            }}
                          >
                            Forget
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        <div className="border-t mt-4 py-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>{memories.length} memories</span>
          {hasMore && <Button variant="ghost">Load more</Button>}
        </div>
      </div>

      {/* FIX BUG-003: Add Memory Modal (replaces prompt()) */}
      <AlertDialog open={showAddModal} onOpenChange={setShowAddModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add a memory</AlertDialogTitle>
            <AlertDialogDescription>
              Manually teach your AI something new.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-2">
            <Input
              autoFocus
              placeholder="e.g. I prefer TypeScript over JavaScript"
              value={addContent}
              onChange={(e) => setAddContent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubmit()}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setAddContent(''); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddSubmit} disabled={!addContent.trim()}>
              Add memory
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget this memory?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the memory from your AI's knowledge. You can undo this within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedMemory) deleteMemory(selectedMemory);
                setShowDeleteConfirm(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Forget
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
