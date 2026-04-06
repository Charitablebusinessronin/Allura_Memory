/**
 * Paperclip Dashboard
 * Story 3-1: Paperclip Dashboard Foundation
 * Epic 3: Human-in-the-Loop (HITL) Governance Interface
 */

import Link from "next/link";

import { AlertCircle, Bot, Building2, CheckCircle, Clock, DollarSign } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaperclipDashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">🏗️ Paperclip Dashboard</h1>
          <p className="text-muted-foreground">
            Manage agents, approvals, and workspace budgets
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/paperclip/approvals">
            View Pending Approvals
          </Link>
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Active Agents"
          value="14"
          delta="↑ 2 this week"
          icon={Bot}
          variant="default"
        />
        <KPICard
          title="Pending Approvals"
          value="3"
          delta="⚠ Needs attention"
          icon={Clock}
          variant="warning"
        />
        <KPICard
          title="Token Burn"
          value="$24.80/day"
          delta="84% of limit"
          icon={DollarSign}
          variant="warning"
        />
        <KPICard
          title="Insights Generated"
          value="1,204"
          delta="+12 today"
          icon={CheckCircle}
          variant="default"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <QuickActionCard
          title="Agent Approvals"
          description="Review and approve agent promotion requests"
          href="/dashboard/paperclip/approvals"
          icon={CheckCircle}
          badge="3 pending"
        />
        <QuickActionCard
          title="Agent Roster"
          description="View and manage all agents"
          href="/dashboard/paperclip/agents"
          icon={Bot}
        />
        <QuickActionCard
          title="Workspaces"
          description="Manage workspace settings and budgets"
          href="/dashboard/paperclip/workspaces"
          icon={Building2}
        />
        <QuickActionCard
          title="Budget Monitor"
          description="Track token usage and set limits"
          href="/dashboard/paperclip/budgets"
          icon={DollarSign}
          badge="1 near limit"
        />
      </div>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertCircle className="mt-0.5 h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Paperclip Dashboard (Phase 1)
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              This is the foundation page. Full functionality including approval queue,
              agent contracts, and budget monitoring is coming in Phase 2.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface KPICardProps {
  title: string;
  value: string;
  delta: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "default" | "warning" | "error";
}

function KPICard({ title, value, delta, icon: Icon, variant }: KPICardProps) {
  const variantStyles = {
    default: "border-l-4 border-l-green-500",
    warning: "border-l-4 border-l-yellow-500",
    error: "border-l-4 border-l-red-500",
  };

  return (
    <Card className={variantStyles[variant]}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <p className="text-xs text-muted-foreground">{delta}</p>
      </CardContent>
    </Card>
  );
}

interface QuickActionCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

function QuickActionCard({
  title,
  description,
  href,
  icon: Icon,
  badge,
}: QuickActionCardProps) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{title}</CardTitle>
              {badge && (
                <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
                  {badge}
                </span>
              )}
            </div>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
