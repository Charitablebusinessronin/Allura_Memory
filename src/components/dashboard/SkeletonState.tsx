"use client"

import { Skeleton } from "@/components/ui/skeleton"

/**
 * Skeleton screens for loading states — brand-compliant, token-based.
 * Replaces generic spinner-only LoadingState with visual placeholders.
 */

export function SearchResultsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-5">
          <div className="flex items-start justify-between">
            <Skeleton className="h-5 w-3/5 rounded bg-[var(--dashboard-surface-muted)]" />
            <Skeleton className="h-5 w-16 rounded-full bg-[var(--dashboard-surface-muted)]" />
          </div>
          <Skeleton className="mt-3 h-4 w-4/5 rounded bg-[var(--dashboard-surface-muted)]" />
          <Skeleton className="mt-2 h-4 w-2/5 rounded bg-[var(--dashboard-surface-muted)]" />
        </div>
      ))}
    </div>
  )
}

export function GraphSkeleton() {
  return (
    <div className="flex flex-1 min-h-0 items-center justify-center rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface-alt)]">
      <div className="flex flex-col items-center gap-4 p-12 text-center">
        <div className="flex gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton
              key={i}
              className="rounded-full bg-[var(--dashboard-surface-muted)]"
              style={{ width: `${24 + i * 8}px`, height: `${24 + i * 8}px` }}
            />
          ))}
        </div>
        <div className="space-y-2">
          <Skeleton className="mx-auto h-4 w-48 rounded bg-[var(--dashboard-surface-muted)]" />
          <Skeleton className="mx-auto h-3 w-32 rounded bg-[var(--dashboard-surface-muted)]" />
        </div>
      </div>
    </div>
  )
}

export function MemoryDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-24 rounded bg-[var(--dashboard-surface-muted)]" />
      <div className="rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)]">
        <div className="p-6 space-y-4">
          <Skeleton className="h-6 w-3/5 rounded bg-[var(--dashboard-surface-muted)]" />
          <Skeleton className="h-4 w-full rounded bg-[var(--dashboard-surface-muted)]" />
          <Skeleton className="h-4 w-4/5 rounded bg-[var(--dashboard-surface-muted)]" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-6 w-16 rounded-full bg-[var(--dashboard-surface-muted)]" />
            <Skeleton className="h-6 w-20 rounded-full bg-[var(--dashboard-surface-muted)]" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function MetricCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-6">
          <Skeleton className="h-3 w-20 rounded bg-[var(--dashboard-surface-muted)]" />
          <Skeleton className="mt-3 h-8 w-24 rounded bg-[var(--dashboard-surface-muted)]" />
        </div>
      ))}
    </div>
  )
}