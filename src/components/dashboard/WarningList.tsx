import { AlertTriangle } from "lucide-react"

export function WarningList({ warnings }: { warnings: Array<{ id: string; message: string; source: string }> }) {
  if (warnings.length === 0) return null
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      {warnings.map((warning) => (
        <div key={warning.id} className="flex items-start gap-2 rounded-xl border border-[color-mix(in_srgb,var(--allura-orange)_35%,white)] bg-[color-mix(in_srgb,var(--allura-orange)_7%,white)] p-4 text-sm text-[var(--allura-orange-on-text)]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span><strong>{warning.source}:</strong> {warning.message}</span>
        </div>
      ))}
    </div>
  )
}
