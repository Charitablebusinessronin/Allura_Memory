import { AlertCircle } from "lucide-react"

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[var(--dashboard-danger)]/20 bg-[var(--dashboard-danger)]/5 p-4 text-sm text-[var(--dashboard-danger)]">
      <AlertCircle className="mt-0.5 size-4" />
      {message}
    </div>
  )
}