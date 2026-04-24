/**
 * MCP Catalog Governance — Type Definitions
 *
 * Formal TypeScript schemas for the catalog governance workflow:
 * ToolCandidate → ApprovedTool → ToolProfile → ToolApproval → ToolInvocationLog
 *
 * Reference: docs/allura/SPRINT-PLAN.md (Sprint 3)
 * Reference: docs/allura/BLUEPRINT.md (B18 — MCP tool governance)
 */

// ============================================================================
// ToolCandidate — A tool discovered from Docker MCP catalog, not yet approved
// ============================================================================

export interface ToolCandidate {
  /** Unique identifier: server::tool format (e.g., "allura-brain::memory_search") */
  id: string
  /** MCP server that provides this tool */
  server: string
  /** Tool name within the server */
  tool: string
  /** Human-readable description from the MCP catalog */
  description: string
  /** JSON Schema for the tool's input parameters */
  inputSchema: Record<string, unknown>
  /** When this candidate was discovered */
  discoveredAt: string // ISO 8601
  /** How it was discovered: "catalog_scan" | "manual_import" | "auto_detect" */
  discoveryMethod: "catalog_scan" | "manual_import" | "auto_detect"
  /** Current governance status */
  status: "candidate" | "approved" | "denied" | "deprecated"
  /** Risk classification based on tool capabilities */
  riskLevel: "read" | "write" | "admin" | "destructive"
}

// ============================================================================
// ApprovedTool — A tool that has passed governance review
// ============================================================================

export interface ApprovedTool {
  /** Same ID format as ToolCandidate: server::tool */
  id: string
  /** Reference to the original candidate */
  candidateId: string
  /** MCP server that provides this tool */
  server: string
  /** Tool name within the server */
  tool: string
  /** Human-readable description */
  description: string
  /** Who approved this tool */
  approvedBy: string
  /** When it was approved */
  approvedAt: string // ISO 8601
  /** Version of the tool at time of approval (for immutability) */
  version: string
  /** Whether this tool is immutable (approved tools are immutable) */
  immutable: true
  /** Risk classification */
  riskLevel: ToolCandidate["riskLevel"]
  /** SOC2 mode: write-capable tools require always_ask confirmation */
  alwaysAsk: boolean
  /** Which tool profiles include this tool */
  profiles: string[]
}

// ============================================================================
// ToolProfile — A named group of approved tools (e.g., "allura-core")
// ============================================================================

export interface ToolProfile {
  /** Unique profile name (e.g., "allura-core", "allura-debug") */
  name: string
  /** Human-readable description */
  description: string
  /** Tools included in this profile */
  tools: string[] // ApprovedTool IDs
  /** Who created this profile */
  createdBy: string
  /** When it was created */
  createdAt: string // ISO 8601
  /** When it was last updated */
  updatedAt: string // ISO 8601
  /** Whether this profile is active */
  active: boolean
}

// ============================================================================
// ToolApproval — Governance event record (append-only audit trail)
// ============================================================================

export interface ToolApproval {
  /** Unique approval event ID */
  id: string
  /** The candidate being approved or denied */
  candidateId: string
  /** The resulting approved tool ID (if approved) */
  approvedToolId: string | null
  /** Decision: approved or denied */
  decision: "approved" | "denied"
  /** Who made the decision */
  decidedBy: string
  /** When the decision was made */
  decidedAt: string // ISO 8601
  /** Rationale for the decision */
  rationale: string
  /** Which profile(s) this tool was added to (if approved) */
  profiles: string[]
  /** SHAKE-256 witness hash for audit */
  witnessHash: string
}

// ============================================================================
// ToolInvocationLog — Append-only log of every MCP tool call
// ============================================================================

export interface ToolInvocationLog {
  /** Unique log entry ID */
  id: string
  /** The approved tool that was invoked */
  approvedToolId: string
  /** Which profile authorized this invocation */
  profileName: string
  /** Agent that made the call */
  agentId: string
  /** Tenant group */
  groupId: string
  /** When the call was made */
  invokedAt: string // ISO 8601
  /** How long the call took in milliseconds */
  durationMs: number
  /** Whether the call succeeded */
  success: boolean
  /** Error message if call failed */
  errorMessage: string | null
  /** SHAKE-256 witness hash for audit */
  witnessHash: string
}

// ============================================================================
// Risk Classification Helper
// ============================================================================

/**
 * Classify a tool's risk level based on its name and description.
 * Write-capable tools get higher risk levels.
 */
export function classifyRiskLevel(
  tool: string,
  description: string
): ToolCandidate["riskLevel"] {
  const destructivePatterns = ["delete", "drop", "remove", "destroy", "purge", "wipe"]
  const adminPatterns = ["admin", "config", "approve", "reject", "promote", "manage"]
  const writePatterns = ["create", "update", "add", "insert", "write", "modify", "set"]

  const combined = `${tool} ${description}`.toLowerCase()

  if (destructivePatterns.some((p) => combined.includes(p))) return "destructive"
  if (adminPatterns.some((p) => combined.includes(p))) return "admin"
  if (writePatterns.some((p) => combined.includes(p))) return "write"
  return "read"
}

/**
 * Determine if a tool requires always_ask confirmation in SOC2 mode.
 * Write, admin, and destructive tools always require confirmation.
 */
export function requiresAlwaysAsk(riskLevel: ToolCandidate["riskLevel"]): boolean {
  return riskLevel !== "read"
}

// ============================================================================
// Validation helpers
// ============================================================================

const TOOL_ID_PATTERN = /^[a-z0-9_-]+::[a-z0-9_]+$/
const GROUP_ID_PATTERN = /^allura-/

export function validateToolId(id: string): boolean {
  return TOOL_ID_PATTERN.test(id)
}

export function validateToolCandidate(candidate: Partial<ToolCandidate>): string[] {
  const errors: string[] = []

  if (!candidate.id || !validateToolId(candidate.id)) {
    errors.push("id must be in server::tool format (lowercase, underscores, hyphens)")
  }
  if (!candidate.server || candidate.server.trim().length === 0) {
    errors.push("server is required")
  }
  if (!candidate.tool || candidate.tool.trim().length === 0) {
    errors.push("tool is required")
  }
  if (!candidate.description || candidate.description.trim().length === 0) {
    errors.push("description is required")
  }
  if (!candidate.discoveryMethod) {
    errors.push("discoveryMethod is required")
  }

  return errors
}

export function validateToolProfile(profile: Partial<ToolProfile>): string[] {
  const errors: string[] = []

  if (!profile.name || profile.name.trim().length === 0) {
    errors.push("name is required")
  }
  if (!profile.description || profile.description.trim().length === 0) {
    errors.push("description is required")
  }
  if (!Array.isArray(profile.tools) || profile.tools.length === 0) {
    errors.push("tools must be a non-empty array of approved tool IDs")
  }

  return errors
}