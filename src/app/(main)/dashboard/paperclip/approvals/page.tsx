/**
 * Paperclip Approvals Page
 * Story 3-1: Paperclip Dashboard Foundation
 * Epic 3: Human-in-the-Loop (HITL) Governance Interface
 * 
 * Server Component - Fetches data server-side
 * Pattern: ARCH-001 (group_id enforcement)
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { ApprovalsClient } from './approvals-client';
import { fetchPendingApprovals } from './approval-utils';

// TODO: Get group_id from authenticated session
// See: Epic 3 auth implementation
// For now, using default system workspace for demo
const DEFAULT_GROUP_ID = 'allura-system'; // Will be replaced with: session.user.groupId

export default async function ApprovalsPage() {
  // Server-side data fetch
  const pendingApprovals = await fetchPendingApprovals(DEFAULT_GROUP_ID);

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

      {/* Pending Count */}
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Pending</h2>
        <Badge variant="default" className="bg-yellow-500 text-yellow-950 hover:bg-yellow-500/90">
          {pendingApprovals.length}
        </Badge>
      </div>

      {/* Approval Cards - Client Component for Interactivity */}
      <ApprovalsClient initialApprovals={pendingApprovals} groupId={DEFAULT_GROUP_ID} />

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardContent className="py-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Phase 1 Foundation:</strong> This is a placeholder showing the approval queue structure.
            Full HITL functionality with AER (Agent Execution Record) viewing and inline actions
            coming in Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}