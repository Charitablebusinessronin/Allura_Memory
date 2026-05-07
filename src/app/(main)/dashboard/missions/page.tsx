import { ArrowRight, CheckCircle2, GitBranch, HeartPulse, ShieldCheck } from "lucide-react"
import Link from "next/link"

import { PageHeader } from "@/components/dashboard"
import { Button } from "@/components/ui/button"

const missions = [
  {
    title: "Dashboard brand correction",
    owner: "IRIS Brand + Gilliam",
    status: "Active",
    detail: "Logo, icon, navigation language, and settings surface aligned to Allura Command.",
  },
  {
    title: "Approval queue visibility",
    owner: "Curator",
    status: "Ready",
    detail: "Pending insights stay one click away instead of buried in review machinery.",
  },
  {
    title: "Handoff traceability",
    owner: "TALON → IRIS → Gilliam",
    status: "Watching",
    detail: "Agent transitions surface as handoffs, not raw internal traces.",
  },
]

const approvals = [
  "Promotion requires human approval before graph activation",
  "Evidence must remain attached to every trusted claim",
]

export default function MissionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Deck"
        description="What is happening, what needs approval, and whether the ship is intact. No database tourism."
        action={
          <Button asChild>
            <Link href="/dashboard/insights">Review approvals</Link>
          </Button>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-5 shadow-[var(--allura-sh-sm)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--allura-orange)]">Active missions</p>
              <h2 className="mt-1 text-2xl font-bold text-[var(--dashboard-text-primary)]">3 missions in motion</h2>
            </div>
            <ShieldCheck className="size-8 text-[var(--allura-blue)]" />
          </div>
          <div className="space-y-3">
            {missions.map((mission) => (
              <article key={mission.title} className="rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface-alt)]/40 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-[var(--dashboard-text-primary)]">{mission.title}</h3>
                    <p className="mt-1 text-sm text-[var(--dashboard-text-secondary)]">{mission.detail}</p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[var(--dashboard-text-muted)]">Owner: {mission.owner}</p>
                  </div>
                  <span className="inline-flex w-fit rounded-full bg-[var(--allura-orange)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--allura-orange)]">
                    {mission.status}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-5 shadow-[var(--allura-sh-sm)]">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-6 text-[var(--allura-green)]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dashboard-text-muted)]">Approvals</p>
                <h2 className="text-lg font-bold text-[var(--dashboard-text-primary)]">Human gate is visible</h2>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-[var(--dashboard-text-secondary)]">
              {approvals.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--allura-orange)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-4 w-full justify-between">
              <Link href="/dashboard/insights">Open approvals <ArrowRight className="size-4" /></Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-5 shadow-[var(--allura-sh-sm)]">
            <div className="flex items-center gap-3">
              <GitBranch className="size-6 text-[var(--allura-blue)]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dashboard-text-muted)]">Handoffs</p>
                <h2 className="text-lg font-bold text-[var(--dashboard-text-primary)]">Agent transitions surfaced</h2>
              </div>
            </div>
            <p className="mt-3 text-sm text-[var(--dashboard-text-secondary)]">TALON work, IRIS review, and Gilliam decisions now belong in one readable flow.</p>
          </div>

          <div className="rounded-2xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-5 shadow-[var(--allura-sh-sm)]">
            <div className="flex items-center gap-3">
              <HeartPulse className="size-6 text-[var(--allura-green)]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dashboard-text-muted)]">Ship status</p>
                <h2 className="text-lg font-bold text-[var(--dashboard-text-primary)]">Operational view first</h2>
              </div>
            </div>
            <Button asChild variant="outline" className="mt-4 w-full justify-between">
              <Link href="/dashboard/health">Check ship status <ArrowRight className="size-4" /></Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
