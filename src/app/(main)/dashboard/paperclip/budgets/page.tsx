/**
 * Paperclip Budgets Page
 * Story 3-1: Paperclip Dashboard Foundation
 * Epic 3: Human-in-the-Loop (HITL) Governance Interface
 * 
 * Placeholder page - Full budget monitoring coming in Phase 2
 */

import Link from "next/link";

import { 
  ArrowLeft, 
  AlertCircle,
  DollarSign, 
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function BudgetsPage() {
  // Placeholder budget data
  const budgets = [
    {
      id: "faith-meats",
      name: "Faith Meats",
      monthlyBudget: 50,
      currentSpend: 42,
      percentUsed: 84,
      projectedBurn: 48,
      trend: "stable",
    },
    {
      id: "audits",
      name: "Audits",
      monthlyBudget: 30,
      currentSpend: 8,
      percentUsed: 27,
      projectedBurn: 28,
      trend: "under",
    },
    {
      id: "nonprofit",
      name: "Nonprofit",
      monthlyBudget: 20,
      currentSpend: 4,
      percentUsed: 20,
      projectedBurn: 18,
      trend: "under",
    },
    {
      id: "creative",
      name: "Creative",
      monthlyBudget: 40,
      currentSpend: 18,
      percentUsed: 45,
      projectedBurn: 42,
      trend: "stable",
    },
  ];

  const totalBudget = budgets.reduce((sum, b) => sum + b.monthlyBudget, 0);
  const totalSpend = budgets.reduce((sum, b) => sum + b.currentSpend, 0);
  const totalPercent = Math.round((totalSpend / totalBudget) * 100);

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return "bg-red-500";
    if (percent >= 70) return "bg-yellow-500";
    return "bg-green-500";
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
          <h1 className="text-2xl font-bold tracking-tight">Budget Monitor</h1>
          <p className="text-muted-foreground">
            Track token usage and manage spending limits
          </p>
        </div>
      </div>

      {/* Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Monthly Budget Overview</CardTitle>
              <CardDescription>April 2026</CardDescription>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">${totalSpend.toFixed(2)} / ${totalBudget.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">{totalPercent}% of total budget</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={totalPercent} className="h-3" />
        </CardContent>
      </Card>

      {/* Budget Breakdown */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Workspace Budgets</h2>
        
        {budgets.map((budget) => (
          <Card key={budget.id} className={budget.percentUsed >= 90 ? "border-red-200" : ""}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="min-w-[120px]">
                    <p className="font-medium">{budget.name}</p>
                  </div>
                  
                  <div className="w-[300px] space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        ${budget.currentSpend} / ${budget.monthlyBudget}
                      </span>
                      <span className={`font-medium ${
                        budget.percentUsed >= 90 ? "text-red-600" : 
                        budget.percentUsed >= 70 ? "text-yellow-600" : "text-green-600"
                      }`}>
                        {budget.percentUsed}%
                      </span>
                    </div>
                    <Progress 
                      value={budget.percentUsed} 
                      className={`h-2 ${getProgressColor(budget.percentUsed)}`}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Projected</p>
                    <p className="font-mono text-sm">${budget.projectedBurn}</p>
                  </div>
                  
                  {budget.percentUsed >= 90 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Warning
                    </Badge>
                  )}
                  
                  <Button variant="ghost" size="sm">
                    <TrendingUp className="mr-1 h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Burn Rate */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Token Burn</CardTitle>
          <CardDescription>
            Average consumption across all workspaces
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">$24.80</p>
              <p className="text-sm text-muted-foreground">per day</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm text-green-600">↓ 8% vs last week</p>
              <p className="text-xs text-muted-foreground">Efficient usage</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardContent className="py-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Phase 1 Foundation:</strong> This is a placeholder showing budget structure.
            Full budget editing and real-time monitoring coming in Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
