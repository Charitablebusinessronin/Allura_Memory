/**
 * Paperclip Workspaces Page
 * Story 3-1: Paperclip Dashboard Foundation
 * Epic 3: Human-in-the-Loop (HITL) Governance Interface
 * 
 * Placeholder page - Full workspace management coming in Phase 2
 */

import Link from "next/link";

import { 
  ArrowLeft, 
  Beef, 
  Building2, 
  GraduationCap,
  Palette, 
  Settings, 
  User,
  Wallet 
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function WorkspacesPage() {
  // Placeholder workspace data
  const workspaces = [
    {
      id: "allura-faith-meats",
      name: "Faith Meats",
      icon: Beef,
      agents: 3,
      budget: "$50/mo",
      budgetUsed: 84,
      status: "building",
    },
    {
      id: "allura-audits",
      name: "Audits",
      icon: Wallet,
      agents: 2,
      budget: "$30/mo",
      budgetUsed: 27,
      status: "hold",
    },
    {
      id: "allura-nonprofit",
      name: "Nonprofit",
      icon: GraduationCap,
      agents: 2,
      budget: "$20/mo",
      budgetUsed: 20,
      status: "building",
    },
    {
      id: "allura-creative",
      name: "Creative",
      icon: Palette,
      agents: 2,
      budget: "$40/mo",
      budgetUsed: 45,
      status: "active",
    },
    {
      id: "allura-personal",
      name: "Personal",
      icon: User,
      agents: 1,
      budget: "$10/mo",
      budgetUsed: 30,
      status: "active",
    },
    {
      id: "allura-haccp",
      name: "HACCP",
      icon: Settings,
      agents: 1,
      budget: "$15/mo",
      budgetUsed: 50,
      status: "building",
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "building":
        return <Badge className="bg-yellow-500 text-yellow-950">Building</Badge>;
      case "hold":
        return <Badge variant="destructive">Hold</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getBudgetColor = (used: number) => {
    if (used >= 90) return "text-red-600";
    if (used >= 70) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/paperclip">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-muted-foreground">
            Manage workspace settings, budgets, and agents
          </p>
        </div>
        <Button variant="outline">
          <Building2 className="mr-2 h-4 w-4" />
          New Workspace
        </Button>
      </div>

      {/* Workspace Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {workspaces.map((workspace) => {
          const Icon = workspace.icon;
          return (
            <Card key={workspace.id} className="cursor-pointer transition-colors hover:bg-muted/50">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{workspace.name}</CardTitle>
                      <CardDescription className="font-mono text-xs">
                        {workspace.id}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(workspace.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Agents</span>
                  <span className="font-medium">{workspace.agents} active</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Budget</span>
                    <span className="font-medium">{workspace.budget}</span>
                  </div>
                  <Progress value={workspace.budgetUsed} className="h-2" />
                  <p className={`text-right text-xs ${getBudgetColor(workspace.budgetUsed)}`}>
                    {workspace.budgetUsed}% used
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardContent className="py-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Phase 1 Foundation:</strong> This is a placeholder showing workspace structure.
            Full workspace management with budget editing and agent assignment coming in Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
