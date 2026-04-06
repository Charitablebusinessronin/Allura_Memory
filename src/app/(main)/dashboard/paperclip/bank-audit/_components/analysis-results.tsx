/**
 * Analysis Results Component
 * Story 6-1: Bank-Auditor Workflow
 * Epic 6: Production Workflows
 * 
 * Displays compliance issues and flagged items from document analysis
 */

'use client';

import { AlertCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import type { AnalysisResult, Severity } from '@/lib/banking/types';

interface AnalysisResultsProps {
  analysis: AnalysisResult;
  groupId: string;
}

/**
 * Get icon for severity level
 */
function getSeverityIcon(severity: Severity) {
  switch (severity) {
    case 'critical':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'high':
      return <AlertCircle className="h-4 w-4 text-orange-600" />;
    case 'medium':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case 'low':
      return <Info className="h-4 w-4 text-blue-600" />;
  }
}

/**
 * Get badge variant for severity
 */
function getSeverityBadge(severity: Severity): "destructive" | "default" | "secondary" | "outline" {
  switch (severity) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'default';
    case 'medium':
      return 'secondary';
    case 'low':
      return 'outline';
  }
}

/**
 * Get background color for severity
 */
function getSeverityBgColor(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
    case 'high':
      return 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800';
    case 'medium':
      return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800';
    case 'low':
      return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800';
  }
}

export function AnalysisResults({ analysis, groupId }: AnalysisResultsProps) {
  const { complianceIssues, riskFactors, flaggedItems } = analysis;

  // Group issues by severity
  const issuesBySeverity = {
    critical: complianceIssues.filter(i => i.severity === 'critical'),
    high: complianceIssues.filter(i => i.severity === 'high'),
    medium: complianceIssues.filter(i => i.severity === 'medium'),
    low: complianceIssues.filter(i => i.severity === 'low'),
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>
              Document analyzed on {new Date(analysis.analyzedAt).toLocaleString()}
            </CardDescription>
          </div>
          <Badge variant={analysis.riskScore > 0.75 ? 'destructive' : 'default'}>
            Risk Score: {(analysis.riskScore * 100).toFixed(0)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm font-medium text-muted-foreground">Total Issues</p>
            <p className="text-2xl font-bold">{complianceIssues.length}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm font-medium text-muted-foreground">Risk Factors</p>
            <p className="text-2xl font-bold">{riskFactors.length}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm font-medium text-muted-foreground">Flagged Items</p>
            <p className="text-2xl font-bold">{flaggedItems.length}</p>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Compliance Issues by Severity */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Compliance Issues</h3>

          {/* Critical Issues */}
          {issuesBySeverity.critical.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <h4 className="font-semibold text-red-600">Critical ({issuesBySeverity.critical.length})</h4>
              </div>
              {issuesBySeverity.critical.map(issue => (
                <div 
                  key={issue.id}
                  className={`p-3 rounded-lg border ${getSeverityBgColor('critical')}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{issue.type}</p>
                      <p className="text-sm text-muted-foreground">{issue.description}</p>
                    </div>
                    <Badge variant="destructive">{issue.severity}</Badge>
                  </div>
                  {issue.regulation && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Regulation: {issue.regulation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* High Issues */}
          {issuesBySeverity.high.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <h4 className="font-semibold text-orange-600">High ({issuesBySeverity.high.length})</h4>
              </div>
              {issuesBySeverity.high.map(issue => (
                <div 
                  key={issue.id}
                  className={`p-3 rounded-lg border ${getSeverityBgColor('high')}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{issue.type}</p>
                      <p className="text-sm text-muted-foreground">{issue.description}</p>
                    </div>
                    <Badge variant="default">{issue.severity}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Medium Issues */}
          {issuesBySeverity.medium.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <h4 className="font-semibold text-yellow-600">Medium ({issuesBySeverity.medium.length})</h4>
              </div>
              {issuesBySeverity.medium.map(issue => (
                <div 
                  key={issue.id}
                  className={`p-3 rounded-lg border ${getSeverityBgColor('medium')}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{issue.type}</p>
                      <p className="text-sm text-muted-foreground">{issue.description}</p>
                    </div>
                    <Badge variant="secondary">{issue.severity}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Low Issues */}
          {issuesBySeverity.low.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-blue-600">Low ({issuesBySeverity.low.length})</h4>
              </div>
              {issuesBySeverity.low.map(issue => (
                <div 
                  key={issue.id}
                  className={`p-3 rounded-lg border ${getSeverityBgColor('low')}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{issue.type}</p>
                      <p className="text-sm text-muted-foreground">{issue.description}</p>
                    </div>
                    <Badge variant="outline">{issue.severity}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No issues message */}
          {complianceIssues.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Info className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <p>No compliance issues detected</p>
            </div>
          )}
        </div>

        <Separator className="my-4" />

        {/* Flagged Items */}
        {flaggedItems.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Flagged Items</h3>
            {flaggedItems.map(item => (
              <div 
                key={item.id}
                className="flex items-start gap-2 p-3 rounded-lg border bg-muted/50"
              >
                {getSeverityIcon(item.severity)}
                <div className="flex-1">
                  <p className="font-medium">{item.type}</p>
                  <p className="text-sm text-muted-foreground">{item.reason}</p>
                </div>
                {item.requiresApproval && (
                  <Badge variant="destructive" className="text-xs">
                    Requires Approval
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Group ID Footer */}
        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
          Group ID: {groupId} | Analysis ID: {analysis.id}
        </div>
      </CardContent>
    </Card>
  );
}