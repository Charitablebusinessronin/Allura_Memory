/**
 * Audit Query Interface
 * Story 5.1: Regulator-Grade Audit Queries
 * 
 * Provides regulator-grade query capabilities for:
 * - Decision provenance (what led to this decision)
 * - Rule version history (how rules evolved over time)
 * - Evidence chain reconstruction (what data supported decisions)
 * - Human override review (when and why humans intervened)
 * - Full audit trail export (JSON, CSV, PDF)
 * 
 * Enforces group_id for all queries (tenant isolation).
 */

import type { Pool } from "pg";
import { getPool } from "../postgres/connection";
import { readTransaction, type ManagedTransaction } from "../neo4j/connection";

/**
 * Audit query types
 */
export type AuditQueryType = "provenance" | "rule_version" | "evidence_chain" | "human_override" | "full";

/**
 * Audit query parameters
 */
export interface AuditQuery {
  type: AuditQueryType;
  group_id?: string;
  agent_id?: string;
  decision_id?: string;
  time_range?: { start: Date; end: Date };
}

/**
 * Time range for filtering
 */
export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Provenance chain - shows the lineage of a decision
 * Includes all parent decisions that led to this decision
 */
export interface ProvenanceChain {
  decision_id: string;
  group_id: string;
  agent_id: string;
  decision_type: string;
  inputs: ProvenanceInput[];
  reasoning: string;
  outcome: string;
  confidence: number;
  created_at: Date;
  chain: ProvenanceChainEntry[];
}

/**
 * Single entry in the provenance chain
 */
export interface ProvenanceChainEntry {
  decision_id: string;
  decision_type: string;
  agent_id: string;
  outcome: string;
  confidence: number;
  created_at: Date;
  inputs: ProvenanceInput[];
  parent_decision_id: string | null;
}

/**
 * Input to a provenance decision
 */
export interface ProvenanceInput {
  type: "postgres_event" | "neo4j_insight" | "rule" | "external_data";
  ref: string;
  resolved: boolean;
  data?: Record<string, unknown>;
}

/**
 * Rule version history
 */
export interface RuleVersion {
  rule_id: string;
  version: number;
  group_id: string;
  content: string;
  created_at: Date;
  created_by: string;
  change_description: string;
  parent_version?: number;
}

/**
 * Evidence chain - reconstructs the data and rules that supported a decision
 */
export interface EvidenceChain {
  decision_id: string;
  group_id: string;
  created_at: Date;
  inputs: EvidenceInput[];
}

/**
 * Resolved evidence input
 */
export interface EvidenceInput {
  type: "postgres_event" | "neo4j_insight" | "rule" | "external_data";
  ref: string;
  resolved: boolean;
  data?: Record<string, unknown>;
  resolution_error?: string;
}

/**
 * Human override record
 */
export interface HumanOverride {
  decision_id: string;
  group_id: string;
  agent_id: string;
  decision_type: string;
  agent_recommendation: string;
  agent_confidence: number;
  override_by: string;
  override_reason: string;
  override_outcome: string;
  override_at: Date;
  created_at: Date;
}

/**
 * Audit trail export result
 */
export interface AuditTrailExport {
  query: AuditQuery;
  generated_at: Date;
  decisions?: ProvenanceChain[];
  rules?: RuleVersion[];
  overrides?: HumanOverride[];
  evidence?: EvidenceChain[];
}

/**
 * Decision node from Neo4j (internal)
 */
interface Neo4jDecision {
  decision_id: string;
  group_id: string;
  agent_id: string;
  decision_type: string;
  inputs: string; // JSON string that needs parsing
  reasoning: string;
  outcome: string;
  confidence: number;
  created_at: string; // Neo4j date string
  parent_decision_id?: string;
  human_override?: boolean;
  override_by?: string;
  override_reason?: string;
  override_at?: string;
}

/**
 * Rule version node from Neo4j (internal)
 */
interface Neo4jRuleVersion {
  rule_id: string;
  version: number;
  group_id: string;
  content: string;
  created_at: string;
  created_by: string;
  change_description: string;
  parent_version?: number;
}

/**
 * Query decision provenance from Neo4j
 * Returns the full chain of decisions leading to the specified decision
 * 
 * @param params - Query parameters
 * @returns Provenance chain or null if decision not found
 * @throws Error if group_id is missing
 */
export async function queryDecisionProvenance(params: {
  decision_id: string;
  group_id: string;
}): Promise<ProvenanceChain | null> {
  const { decision_id, group_id } = params;

  if (!group_id) {
    throw new Error("group_id is required for all audit queries");
  }

  // Query the decision and build the chain
  const result = await readTransaction(async (tx: ManagedTransaction) => {
    // First, get the target decision
    const targetQuery = `
      MATCH (d:Decision {decision_id: $decision_id, group_id: $group_id})
      RETURN d
    `;

    const targetResult = await tx.run(targetQuery, {
      decision_id,
      group_id,
    });

    if (targetResult.records.length === 0) {
      return null;
    }

    const targetNode = targetResult.records[0].get("d").properties as Neo4jDecision;
    const targetDecision = parseDecision(targetNode);

    // Build the chain by following parent_decision_id
    const chain: ProvenanceChainEntry[] = [
      {
        decision_id: targetDecision.decision_id,
        decision_type: targetDecision.decision_type,
        agent_id: targetDecision.agent_id,
        outcome: targetDecision.outcome,
        confidence: targetDecision.confidence,
        created_at: targetDecision.created_at,
        inputs: targetDecision.inputs,
        parent_decision_id: targetDecision.parent_decision_id || null,
      },
    ];

    // Follow parent chain
    let currentParentId = targetDecision.parent_decision_id;
    const visited = new Set<string>();
    visited.add(decision_id);

    while (currentParentId && !visited.has(currentParentId)) {
      visited.add(currentParentId);

      const parentQuery = `
        MATCH (d:Decision {decision_id: $parent_id, group_id: $group_id})
        RETURN d
      `;

      const parentResult = await tx.run(parentQuery, {
        parent_id: currentParentId,
        group_id,
      });

      if (parentResult.records.length === 0) {
        break;
      }

      const parentNode = parentResult.records[0].get("d").properties as Neo4jDecision;
      const parentDecision = parseDecision(parentNode);

      chain.push({
        decision_id: parentDecision.decision_id,
        decision_type: parentDecision.decision_type,
        agent_id: parentDecision.agent_id,
        outcome: parentDecision.outcome,
        confidence: parentDecision.confidence,
        created_at: parentDecision.created_at,
        inputs: parentDecision.inputs,
        parent_decision_id: parentDecision.parent_decision_id || null,
      });

      currentParentId = parentDecision.parent_decision_id;
    }

    return {
      decision_id: targetDecision.decision_id,
      group_id: targetDecision.group_id,
      agent_id: targetDecision.agent_id,
      decision_type: targetDecision.decision_type,
      inputs: targetDecision.inputs,
      reasoning: targetDecision.reasoning,
      outcome: targetDecision.outcome,
      confidence: targetDecision.confidence,
      created_at: targetDecision.created_at,
      chain,
    };
  });

  return result;
}

/**
 * Query rule version history from Neo4j
 * Returns all versions of a rule, newest first
 * 
 * @param params - Query parameters
 * @returns Array of rule versions
 * @throws Error if group_id is missing
 */
export async function queryRuleVersions(params: {
  rule_id: string;
  group_id: string;
  time_range?: TimeRange;
}): Promise<RuleVersion[]> {
  const { rule_id, group_id, time_range } = params;

  if (!group_id) {
    throw new Error("group_id is required for all audit queries");
  }

  const result = await readTransaction(async (tx: ManagedTransaction) => {
    let query = `
      MATCH (r:RuleVersion {rule_id: $rule_id, group_id: $group_id})
    `;

    const queryParams: Record<string, unknown> = {
      rule_id,
      group_id,
    };

    if (time_range) {
      query += `
        WHERE r.created_at >= datetime($start)
        AND r.created_at <= datetime($end)
      `;
      queryParams.start = time_range.start.toISOString();
      queryParams.end = time_range.end.toISOString();
    }

    query += `
      RETURN r
      ORDER BY r.version DESC
    `;

    const runResult = await tx.run(query, queryParams);

    return runResult.records.map((record) => {
      const node = record.get("r").properties as Neo4jRuleVersion;
      return {
        rule_id: node.rule_id,
        version: typeof node.version === "object" && "toNumber" in node.version ? node.version.toNumber() : node.version,
        group_id: node.group_id,
        content: node.content,
        created_at: new Date(node.created_at.toString()),
        created_by: node.created_by,
        change_description: node.change_description,
        parent_version: node.parent_version,
      };
    });
  });

  return result;
}

/**
 * Reconstruct evidence chain for a decision
 * Resolves all input references to their actual data
 * 
 * @param params - Query parameters
 * @returns Evidence chain with resolved inputs
 * @throws Error if group_id is missing
 */
export async function reconstructEvidenceChain(params: {
  decision_id: string;
  group_id: string;
}): Promise<EvidenceChain | null> {
  const { decision_id, group_id } = params;

  if (!group_id) {
    throw new Error("group_id is required for all audit queries");
  }

  // Get decision to find its inputs
  const provenance = await queryDecisionProvenance({ decision_id, group_id });

  if (!provenance) {
    return null;
  }

  // Resolve each input
  const pool = getPool();
  const resolvedInputs: EvidenceInput[] = [];

  for (const input of provenance.inputs) {
    const resolved: EvidenceInput = {
      type: input.type,
      ref: input.ref,
      resolved: false,
    };

    try {
      if (input.type === "postgres_event") {
        // Parse ref like "events:123"
        const match = input.ref.match(/^(\w+):(\d+)$/);
        if (match) {
          const [, table, id] = match;
          if (table === "events") {
            const eventResult = await pool.query(
              "SELECT * FROM events WHERE id = $1 AND group_id = $2",
              [id, group_id]
            );
            if (eventResult.rows.length > 0) {
              resolved.resolved = true;
              resolved.data = {
                id: eventResult.rows[0].id,
                event_type: eventResult.rows[0].event_type,
                agent_id: eventResult.rows[0].agent_id,
                metadata: eventResult.rows[0].metadata,
                outcome: eventResult.rows[0].outcome,
              };
            }
          }
        }
      } else if (input.type === "rule") {
        // Query rule versions from Neo4j
        const ruleResult = await readTransaction(async (tx: ManagedTransaction) => {
          const query = `
            MATCH (r:RuleVersion {rule_id: $rule_id, group_id: $group_id})
            RETURN r
            ORDER BY r.version DESC
            LIMIT 1
          `;
          const result = await tx.run(query, {
            rule_id: input.ref,
            group_id,
          });
          return result.records.length > 0 ? result.records[0].get("r").properties : null;
        });

        if (ruleResult) {
          resolved.resolved = true;
          resolved.data = {
            rule_id: ruleResult.rule_id,
            version: ruleResult.version,
            content: ruleResult.content,
          };
        }
      }

      if (!resolved.resolved) {
        resolved.resolution_error = `Could not resolve input: ${input.ref}`;
      }
    } catch (error) {
      resolved.resolution_error = error instanceof Error ? error.message : String(error);
    }

    resolvedInputs.push(resolved);
  }

  return {
    decision_id: provenance.decision_id,
    group_id: provenance.group_id,
    created_at: provenance.created_at,
    inputs: resolvedInputs,
  };
}

/**
 * Review human overrides for decisions
 * Returns all decisions where humans overrode agent recommendations
 * 
 * @param params - Query parameters
 * @returns Array of human override records
 * @throws Error if group_id is missing
 */
export async function reviewHumanOverrides(params: {
  group_id: string;
  time_range?: TimeRange;
}): Promise<HumanOverride[]> {
  const { group_id, time_range } = params;

  if (!group_id) {
    throw new Error("group_id is required for all audit queries");
  }

  const result = await readTransaction(async (tx: ManagedTransaction) => {
    let query = `
      MATCH (d:Decision {group_id: $group_id})
      WHERE d.human_override = true
    `;

    const queryParams: Record<string, unknown> = { group_id };

    if (time_range) {
      query += `
        AND d.override_at >= datetime($start)
        AND d.override_at <= datetime($end)
      `;
      queryParams.start = time_range.start.toISOString();
      queryParams.end = time_range.end.toISOString();
    }

    query += `
      RETURN d
      ORDER BY d.override_at DESC
    `;

    const runResult = await tx.run(query, queryParams);

    return runResult.records.map((record) => {
      const node = record.get("d").properties as Neo4jDecision;
      const parsed = parseDecision(node);

      return {
        decision_id: node.decision_id,
        group_id: node.group_id,
        agent_id: node.agent_id,
        decision_type: node.decision_type,
        agent_recommendation: parsed.reasoning,
        agent_confidence: parsed.confidence,
        override_by: node.override_by || "unknown",
        override_reason: node.override_reason || "No reason provided",
        override_outcome: node.outcome,
        override_at: node.override_at ? new Date(node.override_at.toString()) : new Date(),
        created_at: parsed.created_at,
      };
    });
  });

  return result;
}

/**
 * Export audit trail in specified format
 * Supports JSON, CSV, and PDF (PDF is JSON + metadata for rendering)
 * 
 * @param params - Export parameters
 * @returns Buffer containing the export data
 * @throws Error if group_id is missing or format is invalid
 */
export async function exportAuditTrail(params: {
  query: AuditQuery;
  format: "json" | "csv" | "pdf";
}): Promise<Buffer> {
  const { query, format } = params;

  if (!query.group_id) {
    throw new Error("group_id is required for all audit queries");
  }

  const exportData: AuditTrailExport = {
    query,
    generated_at: new Date(),
  };

  // Gather data based on query type
  if (query.type === "provenance" || query.type === "full") {
    const decisions = await exportProvenance(query.group_id, query.decision_id);
    exportData.decisions = decisions;
  }

  if (query.type === "rule_version" || query.type === "full") {
    const rules = await exportRules(query.group_id);
    exportData.rules = rules;
  }

  if (query.type === "human_override" || query.type === "full") {
    const overrides = await reviewHumanOverrides({
      group_id: query.group_id,
      time_range: query.time_range,
    });
    exportData.overrides = overrides;
  }

  if (query.type === "evidence_chain" || query.type === "full") {
    if (query.decision_id) {
      const evidence = await reconstructEvidenceChain({
        decision_id: query.decision_id,
        group_id: query.group_id,
      });
      if (evidence) {
        exportData.evidence = [evidence];
      }
    }
  }

  // Convert to requested format
  if (format === "json") {
    return Buffer.from(JSON.stringify(exportData, null, 2), "utf-8");
  }

  if (format === "csv") {
    return exportAsCSV(exportData);
  }

  if (format === "pdf") {
    // PDF format is JSON with metadata for PDF rendering
    const pdfData = {
      ...exportData,
      format: "pdf-ready",
      metadata: {
        title: "Audit Trail Export",
        generated_at: new Date().toISOString(),
        system: "roninmemory",
      },
    };
    return Buffer.from(JSON.stringify(pdfData, null, 2), "utf-8");
  }

  throw new Error(`Invalid export format: ${format}`);
}

/**
 * Parse decision from Neo4j format
 */
function parseDecision(node: Neo4jDecision): {
  decision_id: string;
  group_id: string;
  agent_id: string;
  decision_type: string;
  inputs: ProvenanceInput[];
  reasoning: string;
  outcome: string;
  confidence: number;
  created_at: Date;
  parent_decision_id?: string;
} {
  let inputs: ProvenanceInput[] = [];
  try {
    if (node.inputs) {
      const parsed = JSON.parse(node.inputs);
      inputs = Array.isArray(parsed)
        ? parsed.map((i: { type: string; ref: string }) => ({
            type: i.type as ProvenanceInput["type"],
            ref: i.ref,
            resolved: false,
          }))
        : [];
    }
  } catch {
    inputs = [];
  }

  return {
    decision_id: node.decision_id,
    group_id: node.group_id,
    agent_id: node.agent_id,
    decision_type: node.decision_type,
    inputs,
    reasoning: node.reasoning,
    outcome: node.outcome,
    confidence: typeof node.confidence === "object" && "toNumber" in node.confidence ? node.confidence.toNumber() : node.confidence,
    created_at: new Date(node.created_at.toString()),
    parent_decision_id: node.parent_decision_id,
  };
}

/**
 * Export provenance data for a group
 */
async function exportProvenance(
  groupId: string,
  decisionId?: string
): Promise<ProvenanceChain[]> {
  if (decisionId) {
    const result = await queryDecisionProvenance({
      decision_id: decisionId,
      group_id: groupId,
    });
    return result ? [result] : [];
  }

  // Get all decisions for the group
  const decisions = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (d:Decision {group_id: $group_id})
      RETURN d
      ORDER BY d.created_at DESC
    `;
    const result = await tx.run(query, { group_id: groupId });
    return result.records.map((record) => {
      const node = record.get("d").properties as Neo4jDecision;
      return node.decision_id;
    });
  });

  const chains: ProvenanceChain[] = [];
  for (const decision_id of decisions) {
    const chain = await queryDecisionProvenance({ decision_id, group_id: groupId });
    if (chain) {
      chains.push(chain);
    }
  }

  return chains;
}

/**
 * Export rule versions for a group
 */
async function exportRules(groupId: string): Promise<RuleVersion[]> {
  const result = await readTransaction(async (tx: ManagedTransaction) => {
    const query = `
      MATCH (r:RuleVersion {group_id: $group_id})
      RETURN r
      ORDER BY r.rule_id, r.version DESC
    `;
    const runResult = await tx.run(query, { group_id: groupId });

    return runResult.records.map((record) => {
      const node = record.get("r").properties as Neo4jRuleVersion;
      return {
        rule_id: node.rule_id,
        version: typeof node.version === "object" && "toNumber" in node.version ? node.version.toNumber() : node.version,
        group_id: node.group_id,
        content: node.content,
        created_at: new Date(node.created_at.toString()),
        created_by: node.created_by,
        change_description: node.change_description,
        parent_version: node.parent_version,
      };
    });
  });

  return result;
}

/**
 * Export data as CSV format
 */
function exportAsCSV(data: AuditTrailExport): Buffer {
  const rows: string[] = [];

  // Header
  rows.push("type,decision_id,group_id,agent_id,decision_type,outcome,confidence,created_at");

  // Decision rows
  if (data.decisions) {
    for (const decision of data.decisions) {
      rows.push(
        `decision,${decision.decision_id},${decision.group_id},${decision.agent_id},${decision.decision_type},${decision.outcome},${decision.confidence},${decision.created_at.toISOString()}`
      );
    }
  }

  // Rule rows
  if (data.rules) {
    for (const rule of data.rules) {
      rows.push(
        `rule,${rule.rule_id},rule,${rule.version},-,-,-,${rule.created_at.toISOString()}`
      );
    }
  }

  // Override rows
  if (data.overrides) {
    for (const override of data.overrides) {
      rows.push(
        `override,${override.decision_id},${override.group_id},${override.agent_id},${override.decision_type},${override.override_outcome},${override.agent_confidence},${override.created_at.toISOString()}`
      );
    }
  }

  return Buffer.from(rows.join("\n"), "utf-8");
}