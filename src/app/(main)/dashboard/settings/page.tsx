import { PageHeader } from "@/components/dashboard/components"
import { DASHBOARD_GROUP_ID } from "@/lib/dashboard/api"

export default function SettingsPage() {
  return <div className="space-y-6"><PageHeader title="Settings" description="Dashboard configuration and tenant scope." /><section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Tenant Scope</h2><p className="text-muted-foreground mt-2 text-sm">All dashboard memory and graph reads are scoped with:</p><code className="mt-3 block rounded-lg bg-muted p-3 text-sm">group_id={DASHBOARD_GROUP_ID}</code><p className="text-muted-foreground mt-3 text-sm">This screen intentionally exposes configuration only; it does not mutate Brain state.</p></section></div>
}
