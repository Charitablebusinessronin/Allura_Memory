-- MCP Catalog Governance Tables
-- Sprint 3: ToolCandidate → ApprovedTool → ToolProfile → ToolApproval → ToolInvocationLog
-- Reference: docs/allura/SPRINT-PLAN.md (Sprint 3)

BEGIN;

-- ToolCandidate: Tools discovered from Docker MCP catalog, not yet approved
CREATE TABLE IF NOT EXISTS mcp_tool_candidates (
  id TEXT PRIMARY KEY,  -- server::tool format (e.g., "allura-brain::memory_search")
  server TEXT NOT NULL,
  tool TEXT NOT NULL,
  description TEXT NOT NULL,
  input_schema JSONB DEFAULT '{}',
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discovery_method TEXT NOT NULL DEFAULT 'catalog_scan' CHECK (discovery_method IN ('catalog_scan', 'manual_import', 'auto_detect')),
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'approved', 'denied', 'deprecated')),
  risk_level TEXT NOT NULL DEFAULT 'read' CHECK (risk_level IN ('read', 'write', 'admin', 'destructive')),
  UNIQUE(server, tool)
);

-- ApprovedTool: Tools that have passed governance review (immutable after approval)
CREATE TABLE IF NOT EXISTS mcp_approved_tools (
  id TEXT PRIMARY KEY,  -- Same as candidate ID: server::tool
  candidate_id TEXT NOT NULL REFERENCES mcp_tool_candidates(id),
  server TEXT NOT NULL,
  tool TEXT NOT NULL,
  description TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version TEXT NOT NULL DEFAULT '1.0.0',
  immutable BOOLEAN NOT NULL DEFAULT TRUE,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('read', 'write', 'admin', 'destructive')),
  always_ask BOOLEAN NOT NULL DEFAULT FALSE,  -- SOC2: write/admin/destructive require confirmation
  profiles TEXT[] DEFAULT '{}'
);

-- ToolProfile: Named groups of approved tools (e.g., "allura-core")
CREATE TABLE IF NOT EXISTS mcp_tool_profiles (
  name TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  tools TEXT[] DEFAULT '{}',  -- Array of ApprovedTool IDs
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- ToolApproval: Governance event records (append-only audit trail)
CREATE TABLE IF NOT EXISTS mcp_tool_approvals (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES mcp_tool_candidates(id),
  approved_tool_id TEXT REFERENCES mcp_approved_tools(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'denied')),
  decided_by TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rationale TEXT,
  profiles TEXT[] DEFAULT '{}',
  witness_hash TEXT NOT NULL  -- SHAKE-256 for audit
);

-- ToolInvocationLog: Append-only log of every MCP tool call
CREATE TABLE IF NOT EXISTS mcp_tool_invocation_logs (
  id TEXT PRIMARY KEY,
  approved_tool_id TEXT NOT NULL REFERENCES mcp_approved_tools(id),
  profile_name TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  group_id TEXT NOT NULL CHECK (group_id ~ '^allura-'),
  invoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  witness_hash TEXT NOT NULL  -- SHAKE-256 for audit
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_candidates_status ON mcp_tool_candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_server ON mcp_tool_candidates(server);
CREATE INDEX IF NOT EXISTS idx_approved_tools_risk ON mcp_approved_tools(risk_level);
CREATE INDEX IF NOT EXISTS idx_approvals_decided_at ON mcp_tool_approvals(decided_at);
CREATE INDEX IF NOT EXISTS idx_invocation_logs_group ON mcp_tool_invocation_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_invocation_logs_agent ON mcp_tool_invocation_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_invocation_logs_invoked_at ON mcp_tool_invocation_logs(invoked_at);

COMMIT;