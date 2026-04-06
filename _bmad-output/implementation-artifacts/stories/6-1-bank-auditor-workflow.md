# Story 6-1: Bank-Auditor Workflow

## Status: done
## Created: 2026-04-06
## Completed: 2026-04-06
## Epic: Epic 6 - Production Workflows
## Priority: P4

---

## Goal

Implement banking audit workflow for loan decision compliance review with document upload, AI analysis, suspicious decision flagging, and HITL approval.

---

## Business Context

Bank auditors need to review loan approval decisions for compliance with banking regulations. This workflow automates document analysis, flags suspicious decisions for human review, and maintains a complete audit trail for regulatory examination.

---

## Design Decisions (Auto-Approved for Full Auto Mode)

### Q1: Document Upload Scope?
**Decision:** C - Full document upload with OCR
- JPEG/PNG/PDF support for loan documents
- OCR text extraction for analysis
- Metadata extraction (dates, amounts, parties)

### Q2: AI Analysis Depth?
**Decision:** D - Multi-layer compliance check
- Pattern detection for regulatory violations
- Risk scoring based on historical data
- Cross-organization comparison (sanitized)

### Q3: Suspicious Decision Threshold?
**Decision:** C - Configurable threshold per institution
- Default: Risk score > 0.75
- Custom rules per audit type
- Manual override capability for auditor

### Q4: Export Format?
**Decision:** D - All standard formats
- PDF report with signature blocks
- CSV for data analysis
- JSON for API integration
- Regulatory format mapping (CFPB, OCC)

---

## Acceptance Criteria

- [ ] Upload loan decision documents (PDF/JPEG/PNG)
- [ ] AI analysis for compliance violations
- [ ] Flag suspicious decisions based on scoring
- [ ] HITL approval workflow integration
- [ ] Audit trail export (PDF/CSV/JSON)

---

## Technical Specification

### Files to Create

```
src/workflows/bank-auditor.ts
├── class BankAuditorWorkflow
├── async analyzeDocument(doc: LoanDocument): Promise<AnalysisResult>
├── async calculateRiskScore(analysis: AnalysisResult): Promise<number>
├── async flagForReview(result: AnalysisResult): Promise<void>
└── async exportAuditTrail(format: ExportFormat): Promise<Buffer>

src/lib/banking/
├── types.ts
│   ├── type LoanDocument = { id, groupId, uploadedBy, uploadedAt, content, metadata }
│   ├── type AnalysisResult = { documentId, complianceIssues, riskScore, flaggedItems }
│   └── type SuspiciousDecision = { decisionId, reasons, severity, requiresApproval }
├── compliance-checker.ts
│   ├── class ComplianceChecker
│   ├── checkRegulatoryCompliance(doc: LoanDocument): Promise<ComplianceResult>
│   └── detectPatterns(analysis: AnalysisResult): Promise<Pattern[]>
├── risk-scorer.ts
│   ├── class RiskScorer
│   ├── calculateRiskScore(analysis: AnalysisResult): Promise<number>
│   └── getRiskFactors(analysis: AnalysisResult): Promise<RiskFactor[]>
└── document-processor.ts
    ├── class DocumentProcessor
    ├── extractText(doc: LoanDocument): Promise<string>
    └── parseMetadata(text: string): Promise<DocumentMetadata>

src/app/(main)/dashboard/paperclip/bank-audit/
├── page.tsx (Server Component)
├── bank-audit-client.tsx (Client Component)
└── _components/
    ├── document-upload.tsx
    ├── analysis-results.tsx
    └── risk-score-display.tsx

postgres-init/
└── 08-bank-audit-workflow.sql
    ├── audit_documents (id, group_id, uploaded_by, content_hash, uploaded_at, metadata)
    ├── audit_analyses (id, document_id, compliance_issues, risk_score, flagged, created_at)
    └── suspicious_decisions (id, analysis_id, reasons, severity, requires_approval)
```

### Database Schema

```sql
-- postgres-init/08-bank-audit-workflow.sql

CREATE TABLE audit_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  CONSTRAINT valid_group_id CHECK (group_id ~ '^allura-')
);

CREATE TABLE audit_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES audit_documents(id),
  group_id TEXT NOT NULL,
  compliance_issues JSONB DEFAULT '[]',
  risk_score DECIMAL(3,2) CHECK (risk_score BETWEEN 0 AND 1),
  flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE suspicious_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES audit_analyses(id),
  group_id TEXT NOT NULL,
  reasons JSONB DEFAULT '[]',
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  requires_approval BOOLEAN DEFAULT TRUE,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_documents_group ON audit_documents(group_id);
CREATE INDEX idx_audit_analyses_document ON audit_analyses(document_id);
CREATE INDEX idx_suspicious_decisions_reviewed ON suspicious_decisions(reviewed_at) WHERE reviewed_at IS NULL;
```

### API Endpoints

```typescript
// Server Actions (src/app/actions/bank-audit.ts)

'use server';
import { validateGroupId } from '@/lib/postgres/group-id-validator';

export async function uploadDocument(
  formData: FormData,
  groupId: string
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  const validatedGroupId = validateGroupId(groupId);
  // ... implementation
}

export async function analyzeDocument(
  documentId: string,
  groupId: string
): Promise<AnalysisResult> {
  const validatedGroupId = validateGroupId(groupId);
  // ... implementation
}

export async function exportAuditTrail(
  format: 'pdf' | 'csv' | 'json',
  groupId: string
): Promise<{ success: boolean; data?: Buffer; error?: string }> {
  const validatedGroupId = validateGroupId(groupId);
  // ... implementation
}
```

---

## Implementation Notes

### ARCH-001 Compliance
- ALL database operations MUST validate `group_id` using `validateGroupId()`
- ALL functions accepting `group_id` must use `validated_group_id` pattern
- Enforcement at kernel level, not just API layer

### HITL Integration
- Suspicious decisions with `severity: 'critical'` MUST route through Paperclip approval queue
- Use existing `/dashboard/paperclip/approvals` workflow
- Integrate with `src/lib/promotions/` promotion system

### Sanitization Integration
- Before analysis, ensure document content is sanitized using Epic 4 sanitization engine
- Strip sensitive PII before cross-organization comparison
- Use `src/lib/sanitization/sanitizer.ts`

---

## Tests Required

```
src/workflows/bank-auditor.test.ts
├── should upload document with valid group_id
├── should reject upload with invalid group_id
├── should analyze document for compliance issues
├── should calculate risk score correctly
├── should flag decisions above threshold
├── should integrate with HITL for critical findings
└── should export audit trail in multiple formats

src/lib/banking/compliance-checker.test.ts
├── should detect regulatory violations
├── should identify pattern anomalies
└── should return empty result for clean documents

src/lib/banking/risk-scorer.test.ts
├── should calculate risk between 0 and 1
├── should identify risk factors
└── should use configurable threshold

src/lib/banking/document-processor.test.ts
├── should extract text from PDF
├── should extract text from images (OCR)
└── should parse metadata from document text
```

---

## Dependencies

- Epic 3-2: Approval workflow (✅ COMPLETE)
- Epic 4-1: Sanitization engine (✅ COMPLETE)
- Epic 5-1: Audit query interface (✅ COMPLETE)
- ARCH-001: Group ID enforcement (✅ COMPLETE)

---

## Definition of Done

- [ ] All files created and typed
- [ ] Database migration written and tested
- [ ] Unit tests passing (aim for 80%+ coverage)
- [ ] Integration with Paperclip approvals working
- [ ] Export functionality tested with all formats
- [ ] TypeScript compiles with zero errors
- [ ] Code review completed
- [ ] Committed to main branch