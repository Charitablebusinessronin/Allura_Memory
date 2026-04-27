import { PageHeader } from "@/components/dashboard"
import { DASHBOARD_GROUP_ID } from "@/lib/dashboard/api"

export default function SettingsPage() {
  return (
    <div className="space-y-6" >
      <PageHeader title="Settings" description="Dashboard configuration and tenant scope." />

      <section className="rounded-xl border bg-[var(--dashboard-surface)] p-5">
        <h2 className="font-semibold text-[var(--dashboard-text-primary)]">Tenant Scope</h2>
        <p className="text-[var(--dashboard-text-secondary)] mt-2 text-sm">
          All dashboard memory and graph reads are scoped with:
        </p>
        <code className="mt-3 block rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-surface-alt)] p-3 text-sm text-[var(--dashboard-text-primary)]">
          group_id={DASHBOARD_GROUP_ID}
        </code>
        <p className="text-[var(--dashboard-text-secondary)] mt-3 text-sm">
          This screen intentionally exposes configuration only; it does not mutate Brain state.
        </p>
      </section>

      <section className="rounded-xl border bg-[var(--dashboard-surface)] p-5">
        <h2 className="font-semibold text-[var(--dashboard-text-primary)]">System Information</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-[var(--dashboard-text-secondary)]">Group ID</dt>
            <dd className="text-[var(--dashboard-text-primary)]">{DASHBOARD_GROUP_ID}</dd>
          </div>
          <div>
            <dt className="text-[var(--dashboard-text-secondary)]">Dashboard User</dt>
            <dd className="text-[var(--dashboard-text-primary)]">dashboard-user</dd>
          </div>
          <div>
            <dt className="text-[var(--dashboard-text-secondary)]">Font</dt>
            <dd className="text-[var(--dashboard-text-primary)]">IBM Plex Sans</dd>
          </div>
          <div>
            <dt className="text-[var(--dashboard-text-secondary)]">Architecture</dt>
            <dd className="text-[var(--dashboard-text-primary)]">Dual-database (PostgreSQL + Neo4j) with HITL curator pipeline</dd>
          </div>
          <div>
            <dt className="text-[var(--dashboard-text-secondary)]">MCP Endpoints</dt>
            <dd className="text-[var(--dashboard-text-primary)]">
              /api/memory, /api/memory/graph, /api/curator/proposals, /api/audit/events, /api/health
            </dd>
          </div>
          <div>
            <dt className="text-[var(--dashboard-text-secondary)]">Data Policy</dt>
            <dd className="text-[var(--dashboard-text-primary)]">Read-only dashboard. All mutations route through curator approval.</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border bg-[var(--dashboard-surface)] p-5">
        <h2 className="font-semibold text-[var(--dashboard-text-primary)]">Brand Tokens</h2>
        <p className="text-[var(--dashboard-text-secondary)] mt-2 text-sm">
          UI components use CSS custom properties from brand-tokens.css. No hardcoded hex colors in dashboard code.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {[
            { label: "Deep Navy", var: "--allura-deep-navy" },
            { label: "Coral", var: "--allura-coral" },
            { label: "Trust Green", var: "--allura-trust-green" },
            { label: "Clarity Blue", var: "--allura-clarity-blue" },
            { label: "Ink Black", var: "--allura-ink-black" },
            { label: "Warm Gray", var: "--allura-warm-gray" },
            { label: "Pure White", var: "--allura-pure-white" },
            { label: "Accent", var: "--dashboard-accent" },
          ].map(({ label, var: token }) => (
            <div key={token} className="flex items-center gap-2 rounded-lg border border-[var(--dashboard-border)] p-2 text-xs">
              <span className="size-4 shrink-0 rounded border" style={{ backgroundColor: `var(${token})` }} />
              <span className="text-[var(--dashboard-text-primary)]">{label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}