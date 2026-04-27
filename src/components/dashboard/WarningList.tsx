import { ErrorState } from "./ErrorState"

export function WarningList({ warnings }: { warnings: Array<{ id: string; message: string; source: string }> }) {
  if (warnings.length === 0) return null
  return (
    <div className="space-y-2">
      {warnings.map((warning) => (
        <ErrorState key={warning.id} message={`${warning.source}: ${warning.message}`} />
      ))}
    </div>
  )
}