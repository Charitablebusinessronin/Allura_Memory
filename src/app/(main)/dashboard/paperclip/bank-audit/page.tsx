/**
 * Bank Audit Page
 * Story 6-1: Bank-Auditor Workflow
 * Epic 6: Production Workflows
 * 
 * Server Component - Fetches initial audit data
 * Pattern: ARCH-001 (group_id enforcement)
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { BankAuditClient } from './bank-audit-client';

// TODO: Get group_id from authenticated session
// See: Epic 3 auth implementation
// For now, using default system workspace for demo
const DEFAULT_GROUP_ID = 'allura-system'; // Will be replaced with: session.user.groupId

/**
 * Fetch initial audit documents from database
 * ARCH-001: Validates group_id before query
 */
async function fetchAuditDocuments(groupId: string) {
  // ARCH-001: group_id validation
  if (!groupId.startsWith('allura-')) {
    console.warn('[BankAuditPage] Invalid group_id, using default');
    return [];
  }

  // TODO: Replace with actual database query
  // Production: await db.query.auditDocuments.findMany({ where: { groupId } })
  
  // Placeholder data for demo
  return [];
}

/**
 * Fetch initial audit analyses
 * ARCH-001: Validates group_id before query
 */
async function fetchAuditAnalyses(groupId: string) {
  // ARCH-001: group_id validation
  if (!groupId.startsWith('allura-')) {
    console.warn('[BankAuditPage] Invalid group_id, using default');
    return [];
  }

  // TODO: Replace with actual database query
  // Production: await db.query.auditAnalyses.findMany({ where: { groupId } })
  
  // Placeholder data for demo
  return [];
}

export default async function BankAuditPage() {
  // Server-side data fetch
  const documents = await fetchAuditDocuments(DEFAULT_GROUP_ID);
  const analyses = await fetchAuditAnalyses(DEFAULT_GROUP_ID);

  // Calculate stats
  const pendingCount = documents.filter((d: { status?: string }) => d.status === 'uploading' || d.status === 'processing').length;
  const flaggedCount = analyses.filter((a: { flagged?: boolean }) => a.flagged === true).length;

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
          <h1 className="text-2xl font-bold tracking-tight">Bank Audit Workflow</h1>
          <p className="text-muted-foreground">
            Upload and analyze loan decision documents for compliance review
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{documents.length}</div>
            <p className="text-xs text-muted-foreground">Total Documents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{analyses.length}</div>
            <p className="text-xs text-muted-foreground">Analyzed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{flaggedCount}</div>
              {flaggedCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  Attention Required
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Flagged</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content - Client Component */}
      <BankAuditClient 
        initialDocuments={documents} 
        initialAnalyses={analyses}
        groupId={DEFAULT_GROUP_ID} 
      />

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardContent className="py-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Compliance Review:</strong> Documents are automatically analyzed for regulatory compliance. 
            Suspicious decisions are flagged for human review and routed through the approval workflow.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}