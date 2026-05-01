import type { ReactNode } from "react"
import { AlertCircle } from "lucide-react"

export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-[var(--dashboard-danger)]/25 bg-[var(--dashboard-danger)]/5 p-4 text-sm text-[var(--dashboard-danger)]" role="alert">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <span>{message}</span>
      </div>
      {action}
    </div>
  )
}
