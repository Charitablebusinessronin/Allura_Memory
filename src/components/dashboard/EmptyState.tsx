import { BrainCircuit } from "lucide-react"

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--dashboard-border)] px-6 py-16 text-center">
      <BrainCircuit className="mb-4 size-12 text-[var(--dashboard-text-muted)]" />
      <p className="font-medium text-[var(--dashboard-text-primary)]">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-[var(--dashboard-text-secondary)]">{description}</p>
    </div>
  )
}