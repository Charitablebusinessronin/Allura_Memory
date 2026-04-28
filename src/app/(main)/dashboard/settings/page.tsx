"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PageHeader } from "@/components/dashboard"
import { DASHBOARD_GROUP_ID } from "@/lib/dashboard/api"

type Tab = "general" | "api-keys" | "curator" | "exports" | "team"

const tabs: Array<{ value: Tab; label: string }> = [
  { value: "general", label: "General" },
  { value: "api-keys", label: "API Keys" },
  { value: "curator", label: "Curator thresholds" },
  { value: "exports", label: "Exports" },
  { value: "team", label: "Team access" },
]

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general")
  const [promotionMode, setPromotionMode] = useState(true)
  const [groupId, setGroupId] = useState(DASHBOARD_GROUP_ID)
  const [apiKeyVisible, setApiKeyVisible] = useState(false)

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure the Brain, exports, and your account." />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full shrink-0 lg:w-60">
          <nav className="rounded-xl border bg-[var(--dashboard-surface)] p-2">
            {tabs.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  tab === t.value
                    ? "bg-[var(--dashboard-surface-alt)] font-semibold text-[var(--dashboard-text-primary)]"
                    : "text-[var(--dashboard-text-secondary)] hover:bg-[var(--dashboard-surface-alt)]/50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-6">
          {tab === "general" && (
            <Card className="border-[var(--dashboard-border)] bg-[var(--dashboard-surface)]">
              <CardHeader>
                <CardTitle className="text-[var(--dashboard-text-primary)]">Brain configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-[var(--dashboard-border)] p-4">
                  <div>
                    <h4 className="text-sm font-medium text-[var(--dashboard-text-primary)]">Default group scope</h4>
                    <p className="text-xs text-[var(--dashboard-text-secondary)]">{groupId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                      className="h-8 w-48 text-xs"
                    />
                    <Button variant="outline" size="sm" className="text-xs">
                      Change
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-[var(--dashboard-border)] p-4">
                  <div>
                    <h4 className="text-sm font-medium text-[var(--dashboard-text-primary)]">Promotion mode</h4>
                    <p className="text-xs text-[var(--dashboard-text-secondary)]">
                      SOC2 human approval before graph activation
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={promotionMode ? "default" : "outline"}>
                      {promotionMode ? "Enabled" : "Disabled"}
                    </Badge>
                    <Switch checked={promotionMode} onCheckedChange={setPromotionMode} />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-[var(--dashboard-border)] p-4">
                  <div>
                    <h4 className="text-sm font-medium text-[var(--dashboard-text-primary)]">Neo4j health</h4>
                    <p className="text-xs text-[var(--dashboard-text-secondary)]">
                      Graph views may be degraded until backend recovers
                    </p>
                  </div>
                  <Badge variant="destructive">Degraded</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {tab === "api-keys" && (
            <Card className="border-[var(--dashboard-border)] bg-[var(--dashboard-surface)]">
              <CardHeader>
                <CardTitle className="text-[var(--dashboard-text-primary)]">API Keys</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-[var(--dashboard-border)] p-4">
                  <div>
                    <h4 className="text-sm font-medium text-[var(--dashboard-text-primary)]">Allura Brain API</h4>
                    <p className="text-xs text-[var(--dashboard-text-secondary)]">Full read/write access to memory</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-[var(--dashboard-surface-alt)] px-2 py-1 text-xs text-[var(--dashboard-text-primary)]">
                      {apiKeyVisible ? "ak_live_51H8m...xK9q" : "••••••••••••xK9q"}
                    </code>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setApiKeyVisible((v) => !v)}>
                      {apiKeyVisible ? "Hide" : "Show"}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-[var(--dashboard-border)] p-4">
                  <div>
                    <h4 className="text-sm font-medium text-[var(--dashboard-text-primary)]">Read-only key</h4>
                    <p className="text-xs text-[var(--dashboard-text-secondary)]">Dashboard and analytics only</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-[var(--dashboard-surface-alt)] px-2 py-1 text-xs text-[var(--dashboard-text-primary)]">
                      ••••••••••••r4d2
                    </code>
                    <Button variant="outline" size="sm" className="text-xs">
                      Regenerate
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {tab === "curator" && (
            <Card className="border-[var(--dashboard-border)] bg-[var(--dashboard-surface)]">
              <CardHeader>
                <CardTitle className="text-[var(--dashboard-text-primary)]">Curator thresholds</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-[var(--dashboard-border)] p-4">
                  <div>
                    <h4 className="text-sm font-medium text-[var(--dashboard-text-primary)]">Auto-approve confidence</h4>
                    <p className="text-xs text-[var(--dashboard-text-secondary)]">
                      Minimum score to skip human review
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input type="number" defaultValue={0.85} min={0} max={1} step={0.01} className="h-8 w-20 text-xs" />
                    <span className="text-xs text-[var(--dashboard-text-secondary)]">0–1</span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-[var(--dashboard-border)] p-4">
                  <div>
                    <h4 className="text-sm font-medium text-[var(--dashboard-text-primary)]">Max daily promotions</h4>
                    <p className="text-xs text-[var(--dashboard-text-secondary)]">
                      Hard limit on auto-approved writes per day
                    </p>
                  </div>
                  <Input type="number" defaultValue={50} min={0} className="h-8 w-20 text-xs" />
                </div>
              </CardContent>
            </Card>
          )}

          {tab === "exports" && (
            <Card className="border-[var(--dashboard-border)] bg-[var(--dashboard-surface)]">
              <CardHeader>
                <CardTitle className="text-[var(--dashboard-text-primary)]">Exports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-[var(--dashboard-border)] p-4">
                  <div>
                    <h4 className="text-sm font-medium text-[var(--dashboard-text-primary)]">Memory dump (JSON)</h4>
                    <p className="text-xs text-[var(--dashboard-text-secondary)]">All memories for current group</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs">
                    Download
                  </Button>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-[var(--dashboard-border)] p-4">
                  <div>
                    <h4 className="text-sm font-medium text-[var(--dashboard-text-primary)]">Graph export (Cypher)</h4>
                    <p className="text-xs text-[var(--dashboard-text-secondary)]">Neo4j-compatible import script</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs">
                    Download
                  </Button>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-[var(--dashboard-border)] p-4">
                  <div>
                    <h4 className="text-sm font-medium text-[var(--dashboard-text-primary)]">Audit log (CSV)</h4>
                    <p className="text-xs text-[var(--dashboard-text-secondary)]">Last 90 days of events</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs">
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {tab === "team" && (
            <Card className="border-[var(--dashboard-border)] bg-[var(--dashboard-surface)]">
              <CardHeader>
                <CardTitle className="text-[var(--dashboard-text-primary)]">Team access</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-[var(--dashboard-border)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--dashboard-surface-alt)] text-xs font-semibold text-[var(--dashboard-text-primary)]">
                      SA
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-[var(--dashboard-text-primary)]">Sabir Asheed</h4>
                      <p className="text-xs text-[var(--dashboard-text-secondary)]">Admin · Owner</p>
                    </div>
                  </div>
                  <Badge>Admin</Badge>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-[var(--dashboard-border)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--dashboard-surface-alt)] text-xs font-semibold text-[var(--dashboard-text-primary)]">
                      B
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-[var(--dashboard-text-primary)]">Brooks (AI)</h4>
                      <p className="text-xs text-[var(--dashboard-text-secondary)]">Curator · Automated</p>
                    </div>
                  </div>
                  <Badge variant="outline">Curator</Badge>
                </div>

                <Button variant="outline" size="sm" className="text-xs">
                  Invite member
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}