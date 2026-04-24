/**
 * MCP Catalog Registry — CRUD operations backed by PostgreSQL
 *
 * Manages the lifecycle: ToolCandidate → ApprovedTool → ToolProfile → ToolApproval
 * All mutations are append-only where specified; audit events logged to events table.
 *
 * Reference: docs/allura/SPRINT-PLAN.md (Sprint 3)
 */

import { createHash } from "crypto"
import { getPool } from "@/lib/postgres/connection"
import { validateGroupId } from "@/lib/validation/group-id"
import {
  type ToolCandidate,
  type ApprovedTool,
  type ToolProfile,
  type ToolApproval,
  type ToolInvocationLog,
  classifyRiskLevel,
  requiresAlwaysAsk,
  validateToolCandidate,
  validateToolProfile,
} from "./types"

// ============================================================================
// ToolCandidate operations
// ============================================================================

/**
 * Import a tool from the Docker MCP catalog as a candidate.
 * If it already exists, update the discovery timestamp.
 */
export async function importCandidate(candidate: Omit<ToolCandidate, "riskLevel" | "discoveredAt" | "status">): Promise<ToolCandidate> {
  const errors = validateToolCandidate(candidate)
  if (errors.length > 0) {
    throw new Error(`Invalid candidate: ${errors.join(", ")}`)
  }

  const riskLevel = classifyRiskLevel(candidate.tool, candidate.description)
  const discoveredAt = new Date().toISOString()

  const full: ToolCandidate = {
    ...candidate,
    riskLevel,
    discoveredAt,
    status: "candidate",
  }

  const pg = getPool()

  await pg.query(
    `INSERT INTO mcp_tool_candidates (id, server, tool, description, input_schema, discovered_at, discovery_method, status, risk_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       description = EXCLUDED.description,
       input_schema = EXCLUDED.input_schema,
       discovered_at = EXCLUDED.discovered_at,
       risk_level = EXCLUDED.risk_level`,
    [
      full.id,
      full.server,
      full.tool,
      full.description,
      JSON.stringify(full.inputSchema),
      full.discoveredAt,
      full.discoveryMethod,
      full.status,
      full.riskLevel,
    ]
  )

  return full
}

/**
 * List all candidates, optionally filtered by status.
 */
export async function listCandidates(status?: ToolCandidate["status"]): Promise<ToolCandidate[]> {
  const pg = getPool()
  const query = status
    ? `SELECT * FROM mcp_tool_candidates WHERE status = $1 ORDER BY discovered_at ASC`
    : `SELECT * FROM mcp_tool_candidates ORDER BY discovered_at ASC`

  const result = status ? await pg.query(query, [status]) : await pg.query(query)

  return result.rows.map((row) => ({
    id: row.id,
    server: row.server,
    tool: row.tool,
    description: row.description,
    inputSchema: typeof row.input_schema === "string" ? JSON.parse(row.input_schema) : row.input_schema,
    discoveredAt: row.discovered_at,
    discoveryMethod: row.discovery_method,
    status: row.status,
    riskLevel: row.risk_level,
  }))
}

// ============================================================================
// ApprovedTool operations
// ============================================================================

/**
 * Approve a candidate, creating an ApprovedTool and logging a ToolApproval event.
 * Approved tools are immutable — once approved, their definition cannot be changed.
 */
export async function approveCandidate(
  candidateId: string,
  decidedBy: string,
  rationale: string,
  profileNames: string[] = []
): Promise<{ tool: ApprovedTool; approval: ToolApproval }> {
  const pg = getPool()

  // Fetch the candidate
  const candidateResult = await pg.query(
    `SELECT * FROM mcp_tool_candidates WHERE id = $1`,
    [candidateId]
  )

  if (candidateResult.rows.length === 0) {
    throw new Error(`Candidate not found: ${candidateId}`)
  }

  const candidate = candidateResult.rows[0]

  if (candidate.status === "approved") {
    throw new Error(`Candidate already approved: ${candidateId}`)
  }

  if (candidate.status === "denied") {
    throw new Error(`Candidate already denied: ${candidateId}`)
  }

  const approvedAt = new Date().toISOString()
  const version = `1.0.0`
  const alwaysAsk = requiresAlwaysAsk(candidate.risk_level)

  // Create approved tool
  const approvedTool: ApprovedTool = {
    id: candidate.id,
    candidateId: candidate.id,
    server: candidate.server,
    tool: candidate.tool,
    description: candidate.description,
    approvedBy: decidedBy,
    approvedAt,
    version,
    immutable: true,
    riskLevel: candidate.risk_level,
    alwaysAsk,
    profiles: profileNames,
  }

  // Create approval event with witness hash
  const witnessPayload = `${candidateId}|${decidedBy}|${approvedAt}|approved|${rationale}`
  const witnessHash = createHash("shake256", { outputLength: 64 })
    .update(witnessPayload)
    .digest("hex")

  const approval: ToolApproval = {
    id: `approval-${candidateId}-${Date.now()}`,
    candidateId,
    approvedToolId: approvedTool.id,
    decision: "approved",
    decidedBy,
    decidedAt: approvedAt,
    rationale,
    profiles: profileNames,
    witnessHash,
  }

  // Insert approved tool
  await pg.query(
    `INSERT INTO mcp_approved_tools (id, candidate_id, server, tool, description, approved_by, approved_at, version, immutable, risk_level, always_ask, profiles)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       profiles = EXCLUDED.profiles`,
    [
      approvedTool.id,
      approvedTool.candidateId,
      approvedTool.server,
      approvedTool.tool,
      approvedTool.description,
      approvedTool.approvedBy,
      approvedTool.approvedAt,
      approvedTool.version,
      approvedTool.riskLevel,
      approvedTool.alwaysAsk,
      approvedTool.profiles,
    ]
  )

  // Update candidate status
  await pg.query(
    `UPDATE mcp_tool_candidates SET status = 'approved' WHERE id = $1`,
    [candidateId]
  )

  // Log approval event
  await pg.query(
    `INSERT INTO events (group_id, event_type, agent_id, status, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      "allura-system",
      "tool_approved",
      decidedBy,
      "completed",
      JSON.stringify({ candidate_id: candidateId, tool_id: approvedTool.id, rationale, profiles: profileNames }),
      approvedAt,
    ]
  )

  // Insert approval record
  await pg.query(
    `INSERT INTO mcp_tool_approvals (id, candidate_id, approved_tool_id, decision, decided_by, decided_at, rationale, profiles, witness_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      approval.id,
      approval.candidateId,
      approval.approvedToolId,
      approval.decision,
      approval.decidedBy,
      approval.decidedAt,
      approval.rationale,
      approval.profiles,
      approval.witnessHash,
    ]
  )

  // Add to specified profiles
  for (const profileName of profileNames) {
    await addToolToProfile(profileName, approvedTool.id)
  }

  return { tool: approvedTool, approval }
}

/**
 * Deny a candidate, logging the denial as a ToolApproval event.
 */
export async function denyCandidate(
  candidateId: string,
  decidedBy: string,
  rationale: string
): Promise<ToolApproval> {
  const pg = getPool()

  const candidateResult = await pg.query(
    `SELECT * FROM mcp_tool_candidates WHERE id = $1`,
    [candidateId]
  )

  if (candidateResult.rows.length === 0) {
    throw new Error(`Candidate not found: ${candidateId}`)
  }

  const candidate = candidateResult.rows[0]

  if (candidate.status !== "candidate") {
    throw new Error(`Candidate already ${candidate.status}: ${candidateId}`)
  }

  const decidedAt = new Date().toISOString()
  const witnessPayload = `${candidateId}|${decidedBy}|${decidedAt}|denied|${rationale}`
  const witnessHash = createHash("shake256", { outputLength: 64 })
    .update(witnessPayload)
    .digest("hex")

  const approval: ToolApproval = {
    id: `approval-${candidateId}-${Date.now()}`,
    candidateId,
    approvedToolId: null,
    decision: "denied",
    decidedBy,
    decidedAt,
    rationale,
    profiles: [],
    witnessHash,
  }

  await pg.query(
    `UPDATE mcp_tool_candidates SET status = 'denied' WHERE id = $1`,
    [candidateId]
  )

  await pg.query(
    `INSERT INTO mcp_tool_approvals (id, candidate_id, approved_tool_id, decision, decided_by, decided_at, rationale, profiles, witness_hash)
     VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8)`,
    [
      approval.id,
      approval.candidateId,
      approval.decision,
      approval.decidedBy,
      approval.decidedAt,
      approval.rationale,
      approval.profiles,
      approval.witnessHash,
    ]
  )

  await pg.query(
    `INSERT INTO events (group_id, event_type, agent_id, status, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      "allura-system",
      "tool_denied",
      decidedBy,
      "completed",
      JSON.stringify({ candidate_id: candidateId, rationale }),
      decidedAt,
    ]
  )

  return approval
}

// ============================================================================
// ToolProfile operations
// ============================================================================

/**
 * Create a new tool profile.
 */
export async function createProfile(
  name: string,
  description: string,
  createdBy: string,
  toolIds: string[] = []
): Promise<ToolProfile> {
  const errors = validateToolProfile({ name, description, tools: toolIds })
  if (errors.length > 0) {
    throw new Error(`Invalid profile: ${errors.join(", ")}`)
  }

  const pg = getPool()
  const now = new Date().toISOString()

  await pg.query(
    `INSERT INTO mcp_tool_profiles (name, description, tools, created_by, created_at, updated_at, active)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     ON CONFLICT (name) DO UPDATE SET
       description = EXCLUDED.description,
       updated_at = EXCLUDED.updated_at`,
    [name, description, toolIds, createdBy, now, now]
  )

  return {
    name,
    description,
    tools: toolIds,
    createdBy,
    createdAt: now,
    updatedAt: now,
    active: true,
  }
}

/**
 * Add a tool to a profile. Creates the profile if it doesn't exist.
 */
export async function addToolToProfile(
  profileName: string,
  toolId: string
): Promise<void> {
  const pg = getPool()

  // Check if tool is approved
  const toolResult = await pg.query(
    `SELECT id FROM mcp_approved_tools WHERE id = $1`,
    [toolId]
  )

  if (toolResult.rows.length === 0) {
    throw new Error(`Cannot add unapproved tool to profile: ${toolId}`)
  }

  await pg.query(
    `INSERT INTO mcp_tool_profiles (name, description, tools, created_by, created_at, updated_at, active)
     VALUES ($1, '', ARRAY[$2]::text[], 'system', NOW(), NOW(), true)
     ON CONFLICT (name) DO UPDATE SET
       tools = array_append(mcp_tool_profiles.tools, $2),
       updated_at = NOW()`,
    [profileName, toolId]
  )
}

/**
 * Remove a tool from a profile.
 */
export async function removeToolFromProfile(
  profileName: string,
  toolId: string
): Promise<void> {
  const pg = getPool()

  await pg.query(
    `UPDATE mcp_tool_profiles SET
       tools = array_remove(tools, $2),
       updated_at = NOW()
     WHERE name = $1`,
    [profileName, toolId]
  )
}

/**
 * List all profiles.
 */
export async function listProfiles(): Promise<ToolProfile[]> {
  const pg = getPool()

  const result = await pg.query(
    `SELECT * FROM mcp_tool_profiles WHERE active = true ORDER BY name ASC`
  )

  return result.rows.map((row) => ({
    name: row.name,
    description: row.description,
    tools: row.tools || [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    active: row.active,
  }))
}

/**
 * Get the combined allowlist for a profile (all tools in that profile).
 */
export async function getProfileAllowlist(profileName: string): Promise<string[]> {
  const pg = getPool()

  const result = await pg.query(
    `SELECT tools FROM mcp_tool_profiles WHERE name = $1 AND active = true`,
    [profileName]
  )

  if (result.rows.length === 0) {
    return []
  }

  return result.rows[0].tools || []
}

// ============================================================================
// ToolInvocationLog operations (append-only)
// ============================================================================

/**
 * Log a tool invocation. Append-only — never update or delete.
 */
export async function logInvocation(
  invocation: Omit<ToolInvocationLog, "witnessHash">
): Promise<ToolInvocationLog> {
  const pg = getPool()

  const witnessPayload = `${invocation.approvedToolId}|${invocation.profileName}|${invocation.agentId}|${invocation.groupId}|${invocation.invokedAt}|${invocation.durationMs}|${invocation.success}`
  const witnessHash = createHash("shake256", { outputLength: 64 })
    .update(witnessPayload)
    .digest("hex")

  const full: ToolInvocationLog = {
    ...invocation,
    witnessHash,
  }

  await pg.query(
    `INSERT INTO mcp_tool_invocation_logs (id, approved_tool_id, profile_name, agent_id, group_id, invoked_at, duration_ms, success, error_message, witness_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      full.id,
      full.approvedToolId,
      full.profileName,
      full.agentId,
      full.groupId,
      full.invokedAt,
      full.durationMs,
      full.success,
      full.errorMessage,
      full.witnessHash,
    ]
  )

  return full
}