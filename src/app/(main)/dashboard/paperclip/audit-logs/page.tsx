/**
 * Audit Log Viewer Page
 * Story 3-2: Task 6 - Build Audit Trail Viewer
 */

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AuditClient } from './audit-client';

// Default group_id - TODO: Get from session/auth
const DEFAULT_GROUP_ID = 'allura-system';

export default async function AuditLogsPage() {
  // Server-side data fetch would go here
  // For now, client component handles fetching
  
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
          <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
          <p className="text-muted-foreground">
            Complete history of approval decisions
          </p>
        </div>
      </div>

      {/* Audit Log Table */}
      <AuditClient groupId={DEFAULT_GROUP_ID} />
    </div>
  );
}