/**
 * Bank Audit Client
 * Story 6-1: Bank-Auditor Workflow
 * Epic 6: Production Workflows
 * 
 * Client Component - Interactive audit workflow UI
 */

'use client';

import { useState } from 'react';
import { Upload, FileText, AlertTriangle, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { DocumentUpload } from './_components/document-upload';
import { AnalysisResults } from './_components/analysis-results';
import { RiskScoreDisplay } from './_components/risk-score-display';
import type { AnalysisResult } from '@/lib/banking/types';

interface BankAuditClientProps {
  initialDocuments: Array<{
    id: string;
    uploadedBy: string;
    uploadedAt: Date;
    status?: string;
  }>;
  initialAnalyses: Array<{
    id: string;
    documentId: string;
    riskScore: number;
    flagged: boolean;
    analyzedAt: Date;
  }>;
  groupId: string;
}

export function BankAuditClient({ 
  initialDocuments, 
  initialAnalyses, 
  groupId 
}: BankAuditClientProps) {
  const [documents] = useState(initialDocuments);
  const [analyses, setAnalyses] = useState<AnalysisResult[]>(
    initialAnalyses.map(a => ({
      id: a.id,
      documentId: a.documentId,
      groupId,
      complianceIssues: [],
      riskScore: a.riskScore,
      riskFactors: [],
      flaggedItems: [],
      analyzedAt: a.analyzedAt,
    }))
  );
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisResult | null>(null);
  const [uploading, setUploading] = useState(false);

  /**
   * Handle document upload
   */
  const handleUpload = async (formData: FormData) => {
    setUploading(true);
    
    try {
      const response = await fetch('/api/bank-audit/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      if (result.success) {
        // TODO: Refresh document list
        console.log('[BankAuditClient] Document uploaded:', result.documentId);
      }
    } catch (error) {
      console.error('[BankAuditClient] Upload error:', error);
      // TODO: Show error toast
    } finally {
      setUploading(false);
    }
  };

  /**
   * Handle document analysis
   */
  const handleAnalyze = async (documentId: string) => {
    try {
      const response = await fetch('/api/bank-audit/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, groupId }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();
      
      if (result.success && result.analysis) {
        setAnalyses(prev => [...prev, result.analysis]);
        setSelectedAnalysis(result.analysis);
      }
    } catch (error) {
      console.error('[BankAuditClient] Analysis error:', error);
      // TODO: Show error toast
    }
  };

  /**
   * Handle audit trail export
   */
  const handleExport = async (format: 'pdf' | 'csv' | 'json') => {
    try {
      const response = await fetch('/api/bank-audit/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, groupId }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trail-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('[BankAuditClient] Export error:', error);
      // TODO: Show error toast
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="mr-2 h-4 w-4" />
            Documents ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="analyses">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Analyses ({analyses.length})
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload Loan Document</CardTitle>
              <CardDescription>
                Upload PDF, JPEG, or PNG files for compliance analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentUpload 
                onUpload={handleUpload}
                uploading={uploading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Uploaded Documents</CardTitle>
              <CardDescription>
                View and analyze uploaded loan documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No documents uploaded yet
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div 
                      key={doc.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{doc.id}</p>
                        <p className="text-sm text-muted-foreground">
                          Uploaded by {doc.uploadedBy} on{' '}
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => handleAnalyze(doc.id)}
                      >
                        Analyze
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analyses Tab */}
        <TabsContent value="analyses">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Results</CardTitle>
              <CardDescription>
                View compliance analysis and risk scores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analyses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No analyses yet. Upload and analyze a document first.
                </div>
              ) : (
                <div className="space-y-4">
                  {analyses.map(analysis => (
                    <div 
                      key={analysis.id}
                      className="p-4 border rounded-lg cursor-pointer hover:bg-muted"
                      onClick={() => setSelectedAnalysis(analysis)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium">Document: {analysis.documentId}</p>
                        {analysis.riskScore > 0.75 && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                            Flagged
                          </span>
                        )}
                      </div>
                      <RiskScoreDisplay score={analysis.riskScore} />
                      <div className="mt-2 text-sm text-muted-foreground">
                        {analysis.complianceIssues.length} compliance issues found
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Selected Analysis Details */}
          {selectedAnalysis && (
            <AnalysisResults 
              analysis={selectedAnalysis}
              groupId={groupId}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle>Export Audit Trail</CardTitle>
          <CardDescription>
            Download audit trail for regulatory examination
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => handleExport('json')}
            >
              <Download className="mr-2 h-4 w-4" />
              JSON
            </Button>
            <Button 
              variant="outline"
              onClick={() => handleExport('csv')}
            >
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button 
              variant="outline"
              onClick={() => handleExport('pdf')}
            >
              <Download className="mr-2 h-4 w-4" />
              PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}