/**
 * Paperclip Settings Page
 * Story 3-1: Paperclip Dashboard Foundation
 * Epic 3: Human-in-the-Loop (HITL) Governance Interface
 * 
 * Placeholder page - Full settings coming in Phase 2
 */

import Link from "next/link";

import { 
  ArrowLeft, 
  Bell,
  Key,
  Shield,
  Users,
  Settings,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/paperclip">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage organization settings and preferences
          </p>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Members Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Members</CardTitle>
            </div>
            <CardDescription>Manage team access and permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Organization Members</p>
                <p className="text-sm text-muted-foreground">5 members</p>
              </div>
              <Button variant="outline" size="sm">Manage</Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Invite Members</p>
                <p className="text-sm text-muted-foreground">Send invitations</p>
              </div>
              <Button variant="outline" size="sm">Invite</Button>
            </div>
          </CardContent>
        </Card>

        {/* API Keys Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-muted-foreground" />
              <CardTitle>API Keys</CardTitle>
            </div>
            <CardDescription>Manage API access tokens</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Production Key</p>
                <p className="text-sm text-muted-foreground font-mono">pk_live_••••••••••••</p>
              </div>
              <Badge variant="outline">Active</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Test Key</p>
                <p className="text-sm text-muted-foreground font-mono">pk_test_••••••••••••</p>
              </div>
              <Button variant="ghost" size="sm">Reveal</Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>Configure security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="font-medium">Require HITL for All</p>
                <p className="text-sm text-muted-foreground">
                  Mandate human approval for all agent promotions
                </p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="font-medium">Audit Logging</p>
                <p className="text-sm text-muted-foreground">
                  Log all agent actions for compliance
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Notifications Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>Configure alert preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="font-medium">Approval Requests</p>
                <p className="text-sm text-muted-foreground">Notify on new approvals</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="font-medium">Budget Alerts</p>
                <p className="text-sm text-muted-foreground">Warn at 80% usage</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardContent className="py-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Phase 1 Foundation:</strong> This is a placeholder showing settings structure.
            Full configuration and persistence coming in Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
