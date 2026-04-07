/**
 * Paperclip Approvals Page - Minimal Working Version
 * Story 3-1: Paperclip Dashboard Foundation
 */

import Link from 'next/link';
import { ArrowLeft, CheckCircle, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

// Static data to avoid database errors
const MOCK_APPROVALS = [
  {
    id: '1',
    agent_name: 'Memory Builder',
    requested_by: 'system',
    status: 'pending',
    confidence_score: 0.87,
    created_at: new Date().toISOString(),
  },
  {
    id: '2', 
    agent_name: 'Memory Guardian',
    requested_by: 'system',
    status: 'pending',
    confidence_score: 0.92,
    created_at: new Date().toISOString(),
  },
  {
    id: '3',
    agent_name: 'Memory Scout',
    requested_by: 'system', 
    status: 'pending',
    confidence_score: 0.78,
    created_at: new Date().toISOString(),
  },
];

export default function ApprovalsPage() {
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
          <h1 className="text-2xl font-bold tracking-tight">Agent Approvals</h1>
          <p className="text-muted-foreground">
            Review and approve agent promotion requests
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{MOCK_APPROVALS.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Approved Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85%</div>
          </CardContent>
        </Card>
      </div>

      {/* Approval List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Pending Approvals</h2>
        {MOCK_APPROVALS.map((approval) => (
          <Card key={approval.id} className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-medium">{approval.agent_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Requested by {approval.requested_by}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Confidence: {(approval.confidence_score * 100).toFixed(0)}%
                  </span>
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
            <strong>Phase 1 Foundation:</strong> This is a placeholder showing the approval queue structure.
            Full HITL functionality coming in Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}