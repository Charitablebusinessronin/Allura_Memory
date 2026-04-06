/**
 * Paperclip Agents Page
 * Story 3-1: Paperclip Dashboard Foundation
 * Epic 3: Human-in-the-Loop (HITL) Governance Interface
 * 
 * Placeholder page - Full agent roster coming in Phase 2
 */

import Link from "next/link";

import { ArrowLeft, Bot, Pause, Search, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AgentsPage() {
  // Placeholder agent data
  const agents = [
    {
      id: "1",
      name: "faithmeats-coder",
      workspace: "Faith Meats",
      status: "live",
      latency: "DT",
      lastActive: "2 min ago",
    },
    {
      id: "2",
      name: "audits-sentinel",
      workspace: "Audits",
      status: "building",
      latency: "HRT",
      lastActive: "1 hour ago",
    },
    {
      id: "3",
      name: "creative-designer",
      workspace: "Creative",
      status: "live",
      latency: "DT",
      lastActive: "5 min ago",
    },
    {
      id: "4",
      name: "curator",
      workspace: "Core",
      status: "live",
      latency: "DT",
      lastActive: "30 sec ago",
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "live":
        return (
          <Badge variant="default" className="bg-green-500 text-green-950 hover:bg-green-500/90">
            Live
          </Badge>
        );
      case "building":
        return (
          <Badge variant="default" className="bg-yellow-500 text-yellow-950 hover:bg-yellow-500/90">
            Building
          </Badge>
        );
      case "paused":
        return (
          <Badge variant="secondary">
            Paused
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
          <h1 className="text-2xl font-bold tracking-tight">Agent Roster</h1>
          <p className="text-muted-foreground">
            View and manage all agents across workspaces
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select defaultValue="all">
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by workspace" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Workspaces</SelectItem>
            <SelectItem value="faith-meats">Faith Meats</SelectItem>
            <SelectItem value="audits">Audits</SelectItem>
            <SelectItem value="creative">Creative</SelectItem>
            <SelectItem value="core">Core</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="all">
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="building">Building</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
        
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Agent Cards */}
      <div className="space-y-4">
        {agents.map((agent) => (
          <Card key={agent.id} className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{agent.name}</span>
                      {getStatusBadge(agent.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {agent.workspace} • {agent.latency} • Last active {agent.lastActive}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm">
                    <Settings className="mr-1 h-4 w-4" />
                    Contract
                  </Button>
                  <Button variant="outline" size="sm">
                    <Pause className="mr-1 h-4 w-4" />
                    Pause
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardContent className="py-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Phase 1 Foundation:</strong> This is a placeholder showing the agent roster structure.
            Full agent management with contract viewing and lifecycle controls coming in Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
