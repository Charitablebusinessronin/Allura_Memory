"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { tokens } from "@/lib/tokens"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  showFirstLast?: boolean
  siblingCount?: number
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showFirstLast = true,
  siblingCount = 1,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const pages: (number | string)[] = []

  const addPage = (p: number) => pages.push(p)
  const addEllipsis = () => {
    if (pages[pages.length - 1] !== "…") pages.push("…")
  }

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) addPage(i)
  } else {
    addPage(1)
    if (currentPage - siblingCount > 2) addEllipsis()
    for (let i = Math.max(2, currentPage - siblingCount); i <= Math.min(totalPages - 1, currentPage + siblingCount); i++) {
      addPage(i)
    }
    if (currentPage + siblingCount < totalPages - 1) addEllipsis()
    addPage(totalPages)
  }

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      {showFirstLast && (
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className={cn(
            `inline-flex h-9 w-9 items-center justify-center rounded-[var(--allura-r-sm)] border border-[var(--allura-border-1)] text-sm font-medium text-[var(--allura-text-2)] transition-colors hover:bg-[var(--allura-muted)] hover:border-[var(--allura-border-2)] disabled:cursor-not-allowed disabled:opacity-40`
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {pages.map((p, i) =>
        typeof p === "string" ? (
          <span key={`ellipsis-${i}`} className={`inline-flex h-9 w-9 items-center justify-center text-sm text-[var(--allura-text-3)]`}>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={cn(
              `inline-flex h-9 w-9 items-center justify-center rounded-[var(--allura-r-sm)] border text-sm font-medium transition-colors`,
              p === currentPage
                ? `border-[var(--allura-blue)] bg-[var(--allura-blue)] text-white`
                : `border-[var(--allura-border-1)] text-[var(--allura-text-2)] hover:bg-[var(--allura-muted)] hover:border-[var(--allura-border-2)]`
            )}
          >
            {p}
          </button>
        )
      )}
      {showFirstLast && (
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className={cn(
            `inline-flex h-9 w-9 items-center justify-center rounded-[var(--allura-r-sm)] border border-[var(--allura-border-1)] text-sm font-medium text-[var(--allura-text-2)] transition-colors hover:bg-[var(--allura-muted)] hover:border-[var(--allura-border-2)] disabled:cursor-not-allowed disabled:opacity-40`
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </nav>
  )
}
