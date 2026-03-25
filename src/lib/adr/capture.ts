/**
 * ADR Capture - Recording Agent Decision Records
 * Story 3.5: Record Five-Layer Agent Decision Records
 * 
 * AC 1: Given an agent completes a reasoning step, when the state is updated,
 *       then the system logs Action, Context, Reasoning, Counterfactuals, and Oversight.
 * 
 * This module handles the capture and storage of decision records.
 */

import type { Pool } from "pg";
import { getPool } from "../postgres/connection";
import {
  type AgentDecisionRecord,
  type ADRCreationOptions,
  type ADRQueryOptions,
  type ActionLayer,
  type ContextLayer,
  type ActionType,
  type ActionResult,
  type ToolCallRecord,
  type SessionContext,
  type BudgetSnapshot,
  type GoalContext,
  type ConstraintContext,
  type OptionContext,
  type EnvironmentalFactors,
  computeChecksum,
  generateId,
  createDefaultReproducibilityInfo,
} from "./types";
import type { SessionId } from "../budget/types";

/**
 * ADR storage interface - abstract storage backend
 */
export interface ADRStorage {
  save(adr: AgentDecisionRecord): Promise<string>;
  findById(adrId: string): Promise<AgentDecisionRecord | null>;
  findBySessionId(sessionId: SessionId, limit?: number): Promise<AgentDecisionRecord[]>;
  findByGroupId(groupId: string, limit?: number): Promise<AgentDecisionRecord[]>;
  query(options: ADRQueryOptions): Promise<AgentDecisionRecord[]>;
  updateLifecycle(adrId: string, lifecycle: string, checksum: string): Promise<boolean>;
  archive(adrId: string): Promise<boolean>;
}

/**
 * PostgreSQL-backed ADR storage
 */
export class PostgreSQLADRStorage implements ADRStorage {
  private pool: Pool;

  constructor(pool?: Pool) {
    if (typeof window !== "undefined") {
      throw new Error("ADR storage can only be used server-side");
    }
    this.pool = pool ?? getPool();
  }

  async save(adr: AgentDecisionRecord): Promise<string> {
    const existing = await this.findById(adr.adrId);
    
    if (existing) {
      const query = `
        UPDATE agent_decision_records 
        SET group_id = $1, session_id = $2, created_at = $3, updated_at = $4, lifecycle = $5,
            action_layer = $6, context_layer = $7, reasoning_layer = $8, counterfactuals_layer = $9,
            oversight_layer = $10, reproducibility = $11, overall_checksum = $12, previous_version_id = $13, archived_at = $14
        WHERE adr_id = $15
        RETURNING adr_id
      `;

      const values = [
        adr.groupId,
        JSON.stringify(adr.sessionId),
        adr.createdAt,
        adr.updatedAt,
        adr.lifecycle,
        JSON.stringify(adr.actionLayer),
        JSON.stringify(adr.contextLayer),
        JSON.stringify(adr.reasoningLayer),
        JSON.stringify(adr.counterfactualsLayer),
        JSON.stringify(adr.oversightLayer),
        JSON.stringify(adr.reproducibility),
        adr.overallChecksum,
        adr.previousVersionId ?? null,
        adr.archivedAt ?? null,
        adr.adrId,
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0].adr_id;
    }

    const query = `
      INSERT INTO agent_decision_records (
        adr_id, group_id, session_id, created_at, updated_at, lifecycle,
        action_layer, context_layer, reasoning_layer, counterfactuals_layer,
        oversight_layer, reproducibility, overall_checksum, previous_version_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING adr_id
    `;

    const values = [
      adr.adrId,
      adr.groupId,
      JSON.stringify(adr.sessionId),
      adr.createdAt,
      adr.updatedAt,
      adr.lifecycle,
      JSON.stringify(adr.actionLayer),
      JSON.stringify(adr.contextLayer),
      JSON.stringify(adr.reasoningLayer),
      JSON.stringify(adr.counterfactualsLayer),
      JSON.stringify(adr.oversightLayer),
      JSON.stringify(adr.reproducibility),
      adr.overallChecksum,
      adr.previousVersionId ?? null,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0].adr_id;
  }

  async findById(adrId: string): Promise<AgentDecisionRecord | null> {
    const query = `
      SELECT * FROM agent_decision_records WHERE adr_id = $1
    `;
    const result = await this.pool.query(query, [adrId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.rowToADR(result.rows[0]);
  }

  async findBySessionId(sessionId: SessionId, limit: number = 100): Promise<AgentDecisionRecord[]> {
    const query = `
      SELECT * FROM agent_decision_records 
      WHERE session_id->>'sessionId' = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await this.pool.query(query, [sessionId.sessionId, limit]);
    return result.rows.map(row => this.rowToADR(row));
  }

  async findByGroupId(groupId: string, limit: number = 100): Promise<AgentDecisionRecord[]> {
    const query = `
      SELECT * FROM agent_decision_records 
      WHERE group_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await this.pool.query(query, [groupId, limit]);
    return result.rows.map(row => this.rowToADR(row));
  }

  async query(options: ADRQueryOptions): Promise<AgentDecisionRecord[]> {
    let query = "SELECT * FROM agent_decision_records WHERE 1=1";
    const values: unknown[] = [];
    let paramIndex = 1;

    if (options.groupId) {
      query += ` AND group_id = $${paramIndex++}`;
      values.push(options.groupId);
    }

    if (options.sessionId) {
      query += ` AND session_id->>'sessionId' = $${paramIndex++}`;
      values.push(options.sessionId.sessionId);
    }

    if (options.adrId) {
      query += ` AND adr_id = $${paramIndex++}`;
      values.push(options.adrId);
    }

    if (options.lifecycle) {
      query += ` AND lifecycle = $${paramIndex++}`;
      values.push(options.lifecycle);
    }

    if (options.fromDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      values.push(options.fromDate);
    }

    if (options.toDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      values.push(options.toDate);
    }

    query += ` ORDER BY created_at DESC`;

    if (options.limit) {
      query += ` LIMIT $${paramIndex++}`;
      values.push(options.limit);
    }

    if (options.offset) {
      query += ` OFFSET $${paramIndex++}`;
      values.push(options.offset);
    }

    const result = await this.pool.query(query, values);
    return result.rows.map(row => this.rowToADR(row));
  }

  async updateLifecycle(adrId: string, lifecycle: string, checksum: string): Promise<boolean> {
    const query = `
      UPDATE agent_decision_records 
      SET lifecycle = $1, overall_checksum = $2, updated_at = NOW() 
      WHERE adr_id = $3
    `;
    const result = await this.pool.query(query, [lifecycle, checksum, adrId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  async archive(adrId: string): Promise<boolean> {
    const query = `
      UPDATE agent_decision_records 
      SET lifecycle = 'archived', archived_at = NOW() 
      WHERE adr_id = $1
    `;
    const result = await this.pool.query(query, [adrId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  private rowToADR(row: Record<string, unknown>): AgentDecisionRecord {
    return {
      adrId: row.adr_id as string,
      groupId: row.group_id as string,
      sessionId: JSON.parse(row.session_id as string) as SessionId,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
      lifecycle: row.lifecycle as AgentDecisionRecord["lifecycle"],
      reproducibility: JSON.parse(row.reproducibility as string),
      actionLayer: JSON.parse(row.action_layer as string),
      contextLayer: JSON.parse(row.context_layer as string),
      reasoningLayer: JSON.parse(row.reasoning_layer as string),
      counterfactualsLayer: JSON.parse(row.counterfactuals_layer as string),
      oversightLayer: JSON.parse(row.oversight_layer as string),
      overallChecksum: row.overall_checksum as string,
      previousVersionId: row.previous_version_id as string | undefined,
      archivedAt: row.archived_at as Date | undefined,
    };
  }
}

/**
 * In-memory ADR storage for testing
 */
export class InMemoryADRStorage implements ADRStorage {
  private records: Map<string, AgentDecisionRecord> = new Map();

  async save(adr: AgentDecisionRecord): Promise<string> {
    this.records.set(adr.adrId, { ...adr });
    return adr.adrId;
  }

  async findById(adrId: string): Promise<AgentDecisionRecord | null> {
    const record = this.records.get(adrId);
    return record ? { ...record } : null;
  }

  async findBySessionId(sessionId: SessionId, limit: number = 100): Promise<AgentDecisionRecord[]> {
    return Array.from(this.records.values())
      .filter(r => r.sessionId.sessionId === sessionId.sessionId)
      .slice(0, limit);
  }

  async findByGroupId(groupId: string, limit: number = 100): Promise<AgentDecisionRecord[]> {
    return Array.from(this.records.values())
      .filter(r => r.groupId === groupId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async query(options: ADRQueryOptions): Promise<AgentDecisionRecord[]> {
    let results = Array.from(this.records.values());

    if (options.groupId) {
      results = results.filter(r => r.groupId === options.groupId);
    }
    if (options.sessionId) {
      results = results.filter(r => r.sessionId.sessionId === options.sessionId!.sessionId);
    }
    if (options.adrId) {
      results = results.filter(r => r.adrId === options.adrId);
    }
    if (options.lifecycle) {
      results = results.filter(r => r.lifecycle === options.lifecycle);
    }
    if (options.fromDate) {
      results = results.filter(r => r.createdAt >= options.fromDate!);
    }
    if (options.toDate) {
      results = results.filter(r => r.createdAt <= options.toDate!);
    }

    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (options.offset) {
      results = results.slice(options.offset);
    }
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async updateLifecycle(adrId: string, lifecycle: string, checksum: string): Promise<boolean> {
    const record = this.records.get(adrId);
    if (!record) return false;
    record.lifecycle = lifecycle as AgentDecisionRecord["lifecycle"];
    record.overallChecksum = checksum;
    record.updatedAt = new Date();
    return true;
  }

  async archive(adrId: string): Promise<boolean> {
    const record = this.records.get(adrId);
    if (!record) return false;
    record.lifecycle = "archived";
    record.archivedAt = new Date();
    return true;
  }
}

/**
 * ADRCapture - Main capture class for recording decisions
 * AC 1: Captures all five layers
 */
export class ADRCapture {
  private storage: ADRStorage;
  private currentADR: AgentDecisionRecord | null = null;

  constructor(storage?: ADRStorage) {
    this.storage = storage ?? new InMemoryADRStorage();
  }

  /**
   * Begin capturing a new decision
   * W2/W3: Checks for ID uniqueness and retries on duplicate key errors
   */
  async beginDecision(options: ADRCreationOptions): Promise<string> {
    const maxAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const adrId = generateId("adr");
      const now = new Date();

      const actionLayer: ActionLayer = {
        layerId: generateId("action"),
        timestamp: now,
        actionType: options.actionType,
        actionId: generateId("act"),
        inputs: {},
        result: "pending",
        durationMs: 0,
        toolCalls: [],
        checksum: "",
      };
      actionLayer.checksum = computeChecksum(actionLayer);

      const contextLayer: ContextLayer = {
        layerId: generateId("context"),
        timestamp: now,
        sessionState: {
          sessionId: options.sessionId,
          currentStep: 0,
          totalSteps: 0,
          budgetRemaining: {
            tokensRemaining: 0,
            toolCallsRemaining: 0,
            timeRemainingMs: 0,
            costRemainingUsd: 0,
          },
          activePolicies: [],
        },
        goals: [],
        constraints: [],
        availableOptions: [],
        selectedOption: "",
        environmentalFactors: {},
        checksum: "",
      };
      contextLayer.checksum = computeChecksum(contextLayer);

      const adr: AgentDecisionRecord = {
        adrId,
        groupId: options.groupId,
        sessionId: options.sessionId,
        createdAt: now,
        updatedAt: now,
        lifecycle: "created",
        reproducibility: options.reproducibility,
        actionLayer,
        contextLayer,
        reasoningLayer: {
          layerId: generateId("reasoning"),
          timestamp: now,
          reasoningType: "heuristic",
          thoughtProcess: [],
          evidence: [],
          confidence: 0,
          modelUsed: options.reproducibility.model,
          promptUsed: options.reproducibility.prompt,
          checksum: "",
        },
        counterfactualsLayer: {
          layerId: generateId("counter"),
          timestamp: now,
          alternativesConsidered: [],
          rejectedOptions: [],
          riskAssessment: {
            overallRiskLevel: "low",
            identifiedRisks: [],
            mitigationStrategies: [],
            residualRisk: 0,
          },
          learningNotes: [],
          checksum: "",
        },
        oversightLayer: {
          layerId: generateId("oversight"),
          timestamp: now,
          humanInteractions: [],
          approvals: [],
          modifications: [],
          escalationHistory: [],
          versionTrail: [{
            versionId: generateId("ver"),
            version: 1,
            timestamp: now,
            changeType: "created",
            changedBy: "system",
            checksum: "",
          }],
          auditStatus: {
            status: "pending",
            complianceFlags: [],
          },
          finalChecksum: "",
        },
        overallChecksum: "",
      };

      adr.reasoningLayer.checksum = computeChecksum(adr.reasoningLayer);
      adr.counterfactualsLayer.checksum = computeChecksum(adr.counterfactualsLayer);
      adr.oversightLayer.finalChecksum = computeChecksum(adr.oversightLayer);
      adr.overallChecksum = computeChecksum(adr);

      try {
        const existing = await this.storage.findById(adrId);
        if (existing) {
          if (attempt < maxAttempts) {
            continue;
          }
          throw new Error(`ADR ID collision after ${maxAttempts} attempts: ${adrId}`);
        }

        this.currentADR = adr;
        await this.storage.save(adr);
        return adrId;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const isDuplicateKeyError = error instanceof Error &&
          (error.message.includes("duplicate key") ||
           error.message.includes("unique constraint") ||
           error.message.includes("already exists"));

        if (isDuplicateKeyError) {
          if (attempt < maxAttempts) {
            console.warn(`[ADRCapture] Duplicate key on attempt ${attempt}, retrying...`);
            continue;
          }
        }

        throw error;
      }
    }

    throw lastError ?? new Error(`Failed to begin ADR after ${maxAttempts} attempts`);
  }

  /**
   * Get current ADR being captured
   */
  getCurrentADR(): AgentDecisionRecord | null {
    return this.currentADR;
  }

  /**
   * Capture action details - Layer 1
   */
  captureAction(
    inputs: Record<string, unknown>,
    outputs: Record<string, unknown> | undefined,
    result: ActionResult,
    durationMs: number,
    toolCalls: ToolCallRecord[] = [],
    parentActionId?: string,
  ): void {
    if (!this.currentADR) {
      throw new Error("No active ADR - call beginDecision first");
    }

    this.currentADR.actionLayer.inputs = inputs;
    this.currentADR.actionLayer.outputs = outputs;
    this.currentADR.actionLayer.result = result;
    this.currentADR.actionLayer.durationMs = durationMs;
    this.currentADR.actionLayer.toolCalls = toolCalls;
    this.currentADR.actionLayer.parentActionId = parentActionId;
    this.currentADR.actionLayer.timestamp = new Date();
    this.currentADR.actionLayer.checksum = computeChecksum(this.currentADR.actionLayer);
    this.currentADR.updatedAt = new Date();
  }

  /**
   * Capture context details - Layer 2
   */
  captureContext(
    sessionState: SessionContext,
    goals: GoalContext[],
    constraints: ConstraintContext[],
    availableOptions: OptionContext[],
    selectedOption: string,
    environmentalFactors: EnvironmentalFactors = {},
  ): void {
    if (!this.currentADR) {
      throw new Error("No active ADR - call beginDecision first");
    }

    this.currentADR.contextLayer.sessionState = sessionState;
    this.currentADR.contextLayer.goals = goals;
    this.currentADR.contextLayer.constraints = constraints;
    this.currentADR.contextLayer.availableOptions = availableOptions;
    this.currentADR.contextLayer.selectedOption = selectedOption;
    this.currentADR.contextLayer.environmentalFactors = environmentalFactors;
    this.currentADR.contextLayer.timestamp = new Date();
    this.currentADR.contextLayer.checksum = computeChecksum(this.currentADR.contextLayer);
    this.currentADR.updatedAt = new Date();
  }

  /**
   * Update lifecycle status
   */
  updateLifecycle(lifecycle: "created" | "active" | "completed" | "archived"): void {
    if (!this.currentADR) {
      throw new Error("No active ADR - call beginDecision first");
    }

    this.currentADR.lifecycle = lifecycle;
    this.currentADR.updatedAt = new Date();
    this.currentADR.overallChecksum = computeChecksum(this.currentADR);
  }

  /**
   * Finalize the ADR and persist
   */
  async finalize(): Promise<string> {
    if (!this.currentADR) {
      throw new Error("No active ADR - call beginDecision first");
    }

    this.currentADR.lifecycle = "completed";
    this.currentADR.updatedAt = new Date();
    this.currentADR.overallChecksum = computeChecksum(this.currentADR);

    await this.storage.save(this.currentADR);
    const adrId = this.currentADR.adrId;
    this.currentADR = null;
    
    return adrId;
  }

  /**
   * Persist current ADR state
   */
  async persist(): Promise<void> {
    if (!this.currentADR) {
      throw new Error("No active ADR - call beginDecision first");
    }
    
    this.currentADR.overallChecksum = computeChecksum(this.currentADR);
    await this.storage.save(this.currentADR);
  }

  /**
   * Load an existing ADR for editing
   */
  async loadADR(adrId: string): Promise<void> {
    const adr = await this.storage.findById(adrId);
    if (!adr) {
      throw new Error(`ADR not found: ${adrId}`);
    }
    this.currentADR = adr;
  }

  /**
   * Get storage backend
   */
  getStorage(): ADRStorage {
    return this.storage;
  }
}

/**
 * Create a new ADR capture instance
 */
export function createADRCapture(storage?: ADRStorage): ADRCapture {
  return new ADRCapture(storage);
}

/**
 * Create in-memory storage (for testing)
 */
export function createInMemoryStorage(): InMemoryADRStorage {
  return new InMemoryADRStorage();
}

/**
 * Create PostgreSQL storage (for production)
 */
export function createPostgreSQLStorage(pool?: Pool): PostgreSQLADRStorage {
  return new PostgreSQLADRStorage(pool);
}

/**
 * Create action layer from state update
 * Helper for capturing action from Ralph loop step
 */
export function captureActionFromState(
  sessionId: SessionId,
  actionType: ActionType,
  inputs: Record<string, unknown>,
  result: ActionResult,
  durationMs: number,
  toolCalls: ToolCallRecord[] = [],
): Omit<ActionLayer, "checksum"> {
  return {
    layerId: generateId("action"),
    timestamp: new Date(),
    actionType,
    actionId: generateId("act"),
    inputs,
    result,
    durationMs,
    toolCalls,
  };
}

/**
 * Create context layer from current state
 * Helper for capturing context from Ralph loop
 */
export function captureContextFromState(
  sessionId: SessionId,
  currentStep: number,
  totalSteps: number,
  budget: BudgetSnapshot,
  goals: GoalContext[],
  constraints: ConstraintContext[],
  options: OptionContext[],
  selectedOption: string,
): Omit<ContextLayer, "checksum"> {
  return {
    layerId: generateId("context"),
    timestamp: new Date(),
    sessionState: {
      sessionId,
      currentStep,
      totalSteps,
      budgetRemaining: budget,
      activePolicies: [],
    },
    goals,
    constraints,
    availableOptions: options,
    selectedOption,
    environmentalFactors: {},
  };
}