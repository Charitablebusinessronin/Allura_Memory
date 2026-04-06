/**
 * HACCP Compliance Module
 * Story 6-2: Faith Meats Operations
 *
 * Manages Critical Control Points (CCPs) for food safety compliance.
 * Follows BehaviorSpec ccp definitions with 7-year retention policy.
 */

import { getPool } from "@/lib/postgres/connection";
import { validateGroupId, GroupIdValidationError } from "@/lib/validation/group-id";

/**
 * Critical Control Point definitions per BehaviorSpec
 */
export interface CriticalControlPoint {
  id: string;
  description: string;
  monitoringFrequency: "every_delivery" | "continuous" | "every_batch" | "every_package";
  threshold: {
    min?: number;
    max?: number;
    unit: string;
  };
  correctiveActions: string[];
}

/**
 * CCP reading record
 */
export interface CCPReading {
  ccp_id: string;
  group_id: string;
  agent_id: string;
  value: number;
  unit: string;
  timestamp: Date;
  within_limits: boolean;
  logged_by: string;
  corrective_action_taken?: string;
  documentation_ref?: string;
}

/**
 * CCP violation escalation
 */
export interface CCPViolation {
  ccp_id: string;
  group_id: string;
  reading_id: number;
  deviation: number;
  severity: "minor" | "critical" | "severe";
  flagged_for_review: boolean;
  escalated_to?: string;
  resolved_at?: Date;
  resolution?: string;
}

/**
 * HACCP log entry for audit trail
 */
export interface HACCPLogEntry {
  group_id: string;
  event_type: string;
  ccp_id: string;
  reading_id: number;
  action: string;
  actor: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * CCP Definitions from BehaviorSpec
 */
export const HACCP_CCPS: CriticalControlPoint[] = [
  {
    id: "CCP-1",
    description: "Raw material receiving",
    monitoringFrequency: "every_delivery",
    threshold: { min: -18, max: 4, unit: "celsius" },
    correctiveActions: ["Reject delivery", "Document deviation", "Notify quality manager"],
  },
  {
    id: "CCP-2",
    description: "Storage temperature",
    monitoringFrequency: "continuous",
    threshold: { max: 4, unit: "celsius" },
    correctiveActions: ["Check refrigeration unit", "Transfer to backup storage", "Log deviation"],
  },
  {
    id: "CCP-3",
    description: "Processing temperature",
    monitoringFrequency: "every_batch",
    threshold: { min: 63, unit: "celsius" },
    correctiveActions: ["Extend processing time", "Document deviation", "Quality review"],
  },
  {
    id: "CCP-4",
    description: "Metal detection",
    monitoringFrequency: "every_package",
    threshold: { max: 0, unit: "ferrous_contaminants" },
    correctiveActions: ["Reject package", "Trace contamination source", "Equipment check"],
  },
  {
    id: "CCP-5",
    description: "Final product storage",
    monitoringFrequency: "continuous",
    threshold: { max: -18, unit: "celsius" },
    correctiveActions: ["Check freezer unit", "Transfer to backup storage", "Log deviation"],
  },
];

/**
 * HACCP Compliance Manager
 *
 * Provides CCP validation, deviation logging, and audit trail management.
 * All operations enforce group_id isolation for multi-tenant safety.
 */
export class HACCPCompliance {
  private readonly groupId: string;
  private readonly agentId: string;

  constructor(groupId: string, agentId: string = "faith-meats-agent") {
    this.groupId = validateGroupId(groupId);
    this.agentId = agentId;
  }

  /**
   * Record a CCP reading
   *
   * Validates against threshold and logs to PostgreSQL.
   * Creates violation record if outside limits.
   */
  async recordReading(params: {
    ccpId: string;
    value: number;
    unit: string;
    loggedBy: string;
    documentationRef?: string;
  }): Promise<{ readingId: number; withinLimits: boolean; violationId?: number }> {
    const ccp = HACCP_CCPS.find((c) => c.id === params.ccpId);
    if (!ccp) {
      throw new Error(`Unknown CCP: ${params.ccpId}`);
    }

    if (params.unit !== ccp.threshold.unit) {
      throw new Error(
        `Unit mismatch: expected ${ccp.threshold.unit}, got ${params.unit}`
      );
    }

    const withinLimits = this.checkThreshold(params.value, ccp.threshold);
    const pool = getPool();

    const result = await pool.query<{ id: number }>(
      `
      INSERT INTO haccp_readings (
        group_id, ccp_id, value, unit, within_limits,
        logged_by, documentation_ref, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
      `,
      [
        this.groupId,
        params.ccpId,
        params.value,
        params.unit,
        withinLimits,
        params.loggedBy,
        params.documentationRef ?? null,
        new Date(),
      ]
    );

    const readingId = result.rows[0].id;

    let violationId: number | undefined;
    if (!withinLimits) {
      violationId = await this.createViolation({
        ccpId: params.ccpId,
        readingId,
        value: params.value,
        threshold: ccp.threshold,
      });
    }

    await this.logHACCPEvent({
      ccp_id: params.ccpId,
      reading_id: readingId,
      action: withinLimits ? "reading_recorded" : "violation_detected",
      actor: params.loggedBy,
      metadata: { value: params.value, unit: params.unit },
    });

    return {
      readingId,
      withinLimits,
      violationId,
    };
  }

  /**
   * Check if value is within CCP threshold
   */
  private checkThreshold(
    value: number,
    threshold: CriticalControlPoint["threshold"]
  ): boolean {
    if (threshold.min !== undefined && value < threshold.min) {
      return false;
    }
    if (threshold.max !== undefined && value > threshold.max) {
      return false;
    }
    return true;
  }

  /**
   * Create a CCP violation record
   */
  private async createViolation(params: {
    ccpId: string;
    readingId: number;
    value: number;
    threshold: CriticalControlPoint["threshold"];
  }): Promise<number> {
    const deviation = this.calculateDeviation(params.value, params.threshold);
    const severity = this.determineSeverity(deviation);

    const pool = getPool();
    const result = await pool.query<{ id: number }>(
      `
      INSERT INTO haccp_violations (
        group_id, ccp_id, reading_id, deviation, severity,
        flagged_for_review, created_at
      ) VALUES ($1, $2, $3, $4, $5, true, $6)
      RETURNING id
      `,
      [this.groupId, params.ccpId, params.readingId, deviation, severity, new Date()]
    );

    return result.rows[0].id;
  }

  /**
   * Calculate deviation from threshold
   */
  private calculateDeviation(
    value: number,
    threshold: CriticalControlPoint["threshold"]
  ): number {
    if (threshold.min !== undefined && value < threshold.min) {
      return threshold.min - value;
    }
    if (threshold.max !== undefined && value > threshold.max) {
      return value - threshold.max;
    }
    return 0;
  }

  /**
   * Determine violation severity
   */
  private determineSeverity(deviation: number): "minor" | "critical" | "severe" {
    if (deviation < 2) return "minor";
    if (deviation < 5) return "critical";
    return "severe";
  }

  /**
   * Log HACCP event to audit trail
   */
  private async logHACCPEvent(params: {
    ccp_id: string;
    reading_id: number;
    action: string;
    actor: string;
    metadata?: Record<string, unknown>;
  }): Promise<number> {
    const pool = getPool();
    const result = await pool.query<{ id: number }>(
      `
      INSERT INTO events (
        group_id, event_type, agent_id, metadata, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
      `,
      [
        this.groupId,
        `haccp.${params.action}`,
        this.agentId,
        JSON.stringify({
          ccp_id: params.ccp_id,
          reading_id: params.reading_id,
          actor: params.actor,
          ...params.metadata,
        }),
        "completed",
        new Date(),
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Flag violation for quality manager review
   */
  async flagForReview(violationId: number, reviewedBy: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `
      UPDATE haccp_violations
      SET flagged_for_review = true,
          escalated_to = $3,
          updated_at = $4
      WHERE id = $1 AND group_id = $2
      `,
      [violationId, this.groupId, reviewedBy, new Date()]
    );
  }

  /**
   * Resolve a violation
   */
  async resolveViolation(
    violationId: number,
    resolution: string,
    resolvedBy: string
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      `
      UPDATE haccp_violations
      SET resolved_at = $3,
          resolution = $4,
          updated_at = $5
      WHERE id = $1 AND group_id = $2
      `,
      [violationId, this.groupId, new Date(), resolution, new Date()]
    );

    await this.logHACCPEvent({
      ccp_id: "system",
      reading_id: violationId,
      action: "violation_resolved",
      actor: resolvedBy,
      metadata: { resolution },
    });
  }

  /**
   * Get unreviewed violations
   */
  async getUnreviewedViolations(): Promise<CCPViolation[]> {
    const pool = getPool();
    const result = await pool.query<CCPViolation>(
      `
      SELECT ccp_id, group_id, reading_id, deviation, severity,
             flagged_for_review, escalated_to, resolved_at, resolution
      FROM haccp_violations
      WHERE group_id = $1
        AND resolved_at IS NULL
        AND flagged_for_review = true
      ORDER BY created_at DESC
      `,
      [this.groupId]
    );

    return result.rows;
  }

  /**
   * Get HACCP audit trail for date range
   */
  async getAuditTrail(
    startDate: Date,
    endDate: Date
  ): Promise<HACCPLogEntry[]> {
    const pool = getPool();
    const result = await pool.query<HACCPLogEntry>(
      `
      SELECT group_id, event_type, ccp_id, reading_id, action, actor, timestamp, metadata
      FROM haccp_audit_log
      WHERE group_id = $1
        AND timestamp >= $2
        AND timestamp <= $3
      ORDER BY timestamp DESC
      `,
      [this.groupId, startDate, endDate]
    );

    return result.rows;
  }

  /**
   * Get CCP readings for a specific date
   */
  async getReadingsByDate(date: Date): Promise<CCPReading[]> {
    const pool = getPool();
    const result = await pool.query<CCPReading>(
      `
      SELECT ccp_id, group_id, value, unit, within_limits, logged_by,
             documentation_ref, created_at as timestamp
      FROM haccp_readings
      WHERE group_id = $1
        AND DATE(created_at) = DATE($2)
      ORDER BY created_at DESC
      `,
      [this.groupId, date]
    );

    return result.rows;
  }
}

/**
 * Create HACCP compliance instance
 */
export function createHACCPCompliance(
  groupId: string,
  agentId?: string
): HACCPCompliance {
  return new HACCPCompliance(groupId, agentId);
}