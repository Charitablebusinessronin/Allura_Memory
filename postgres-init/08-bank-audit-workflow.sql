-- Bank Audit Workflow Schema
-- Story 6-1: Bank-Auditor Workflow
-- Epic 6: Production Workflows
-- 
-- ARCH-001: All tables MUST have group_id with validation constraint

-- Audit Documents Table
-- Stores uploaded loan decision documents
CREATE TABLE IF NOT EXISTS audit_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  CONSTRAINT valid_group_id CHECK (group_id ~ '^allura-')
);

-- Audit Analyses Table
-- Stores AI analysis results for documents
CREATE TABLE IF NOT EXISTS audit_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES audit_documents(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL,
  compliance_issues JSONB DEFAULT '[]',
  risk_score DECIMAL(3,2) CHECK (risk_score BETWEEN 0 AND 1),
  flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_group_id CHECK (group_id ~ '^allura-')
);

-- Suspicious Decisions Table
-- Stores flagged decisions requiring HITL review
CREATE TABLE IF NOT EXISTS suspicious_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES audit_analyses(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL,
  reasons JSONB DEFAULT '[]',
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  requires_approval BOOLEAN DEFAULT TRUE,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_group_id CHECK (group_id ~ '^allura-')
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_audit_documents_group ON audit_documents(group_id);
CREATE INDEX IF NOT EXISTS idx_audit_analyses_document ON audit_analyses(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_analyses_group ON audit_analyses(group_id);
CREATE INDEX IF NOT EXISTS idx_suspicious_decisions_reviewed ON suspicious_decisions(reviewed_at) WHERE reviewed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suspicious_decisions_group ON suspicious_decisions(group_id);

-- Row-Level Security (RLS) Policies
ALTER TABLE audit_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspicious_decisions ENABLE ROW LEVEL SECURITY;

-- Policies for audit_documents
CREATE POLICY audit_documents_select ON audit_documents
  FOR SELECT USING (group_id = current_setting('app.current_group_id', TRUE));

CREATE POLICY audit_documents_insert ON audit_documents
  FOR INSERT WITH CHECK (group_id = current_setting('app.current_group_id', TRUE));

-- Policies for audit_analyses
CREATE POLICY audit_analyses_select ON audit_analyses
  FOR SELECT USING (group_id = current_setting('app.current_group_id', TRUE));

CREATE POLICY audit_analyses_insert ON audit_analyses
  FOR INSERT WITH CHECK (group_id = current_setting('app.current_group_id', TRUE));

-- Policies for suspicious_decisions
CREATE POLICY suspicious_decisions_select ON suspicious_decisions
  FOR SELECT USING (group_id = current_setting('app.current_group_id', TRUE));

CREATE POLICY suspicious_decisions_insert ON suspicious_decisions
  FOR INSERT WITH CHECK (group_id = current_setting('app.current_group_id', TRUE));

CREATE POLICY suspicious_decisions_update ON suspicious_decisions
  FOR UPDATE USING (group_id = current_setting('app.current_group_id', TRUE));