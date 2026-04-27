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
            `inline-flex h-9 w-9 items-center justify-center rounded-[${tokens.borderRadius.sm}] border border-[${tokens.color.border.subtle}] text-sm font-medium text-[${tokens.color.text.secondary}] transition-colors hover:bg-[${tokens.color.surface.muted}] hover:border-[${tokens.color.border.default}] disabled:cursor-not-allowed disabled:opacity-40`
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {pages.map((p, i) =>
        typeof p === "string" ? (
          <span key={`ellipsis-${i}`} className={`inline-flex h-9 w-9 items-center justify-center text-sm text-[${tokens.color.text.muted}]`}>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={cn(
              `inline-flex h-9 w-9 items-center justify-center rounded-[${tokens.borderRadius.sm}] border text-sm font-medium transition-colors`,
              p === currentPage
                ? `border-[${tokens.color.primary.default}] bg-[${tokens.color.primary.default}] text-white`
                : `border-[${tokens.color.border.subtle}] text-[${tokens.color.text.secondary}] hover:bg-[${tokens.color.surface.muted}] hover:border-[${tokens.color.border.default}]`
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
            `inline-flex h-9 w-9 items-center justify-center rounded-[${tokens.borderRadius.sm}] border border-[${tokens.color.border.subtle}] text-sm font-medium text-[${tokens.color.text.secondary}] transition-colors hover:bg-[${tokens.color.surface.muted}] hover:border-[${tokens.color.border.default}] disabled:cursor-not-allowed disabled:opacity-40`
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </nav>
  )
}
