import Link from "next/link";
import { RefreshCw, AlertTriangle, Activity, Clock, CheckCircle, XCircle, MinusCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import type { ComponentHealth, HealthResponse } from "@/app/api/health/route";
import { HealthTable } from "./_components/health-table";

const DEFAULT_GROUP_ID = "allura-roninmemory";

async function fetchHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/health?detailed=true`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchPendingCount(): Promise<number> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/curator/proposals?group_id=${DEFAULT_GROUP_ID}&status=pending&limit=1`,
      { cache: "no-store" }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return (data.proposals as unknown[])?.length ?? 0;
  } catch {
    return 0;
  }
}

async function fetchTotalMemories(): Promise<number> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/memory?group_id=${DEFAULT_GROUP_ID}&user_id=system&limit=1`,
      { cache: "no-store" }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return (data as { total?: number }).total ?? 0;
  } catch {
    return 0;
  }
}

function StatusBadge({ status }: { status: string }) {
  if (status === "healthy") {
    return (
      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400">
        <CheckCircle className="size-3 mr-1" />
        healthy
      </Badge>
    );
  }
  if (status === "degraded") {
    return (
      <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-400">
        <MinusCircle className="size-3 mr-1" />
        degraded
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <XCircle className="size-3 mr-1" />
      unhealthy
    </Badge>
  );
}

export default async function DashboardPage() {
  const [health, pendingCount, totalMemories] = await Promise.all([
    fetchHealth(),
    fetchPendingCount(),
    fetchTotalMemories(),
  ]);

  const components: ComponentHealth[] = health?.components ?? [];
  const activeComponents = components.filter((c) => c.status === "healthy").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">System overview for {DEFAULT_GROUP_ID}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" />
              {health ? (
                <StatusBadge status={health.status} />
              ) : (
                <Badge variant="outline">unknown</Badge>
              )}
            </div>
            {health && (
              <p className="text-xs text-muted-foreground mt-2">
                Uptime: {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{pendingCount}</span>
              {pendingCount > 0 && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/curator">Review</Link>
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">proposals awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Memories</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{totalMemories}</span>
            <p className="text-xs text-muted-foreground mt-1">stored in {DEFAULT_GROUP_ID}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Components</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              {activeComponents}
              <span className="text-base font-normal text-muted-foreground">/{components.length}</span>
            </span>
            <p className="text-xs text-muted-foreground mt-1">healthy components</p>
          </CardContent>
        </Card>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
          <AlertTriangle className="size-4 text-yellow-600 mt-0.5 shrink-0 dark:text-yellow-400" />
          <div className="flex-1">
            <p className="text-sm font-medium">Needs Attention</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {pendingCount} curator proposal{pendingCount > 1 ? "s" : ""} pending human review.{" "}
              <Link href="/dashboard/curator" className="underline underline-offset-2 hover:text-foreground">
                Review now
              </Link>
            </p>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Component Status</h2>
          <HealthTable.RefreshButton />
        </div>
        <HealthTable components={components} />
      </div>
    </div>
  );
}
