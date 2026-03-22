/**
 * ADR Index - Public API for Agent Decision Records
 * Story 3.5: Record Five-Layer Agent Decision Records
 * 
 * Five-layer audit trail for SOC 2, GDPR, ISO 27001 compliance:
 * - Layer 1: Action Logging (what was done)
 * - Layer 2: Decision Context (why it was done)
 * - Layer 3: Reasoning Chain (how the decision was made)
 * - Layer 4: Counterfactuals (what else could have been done)
 * - Layer 5: Human Oversight Trail (who reviewed and approved)
 */

export type {
  ADRLifecycle,
  ModelVersion,
  PromptVersion,
  ToolVersion,
  ReproducibilityInfo,
  ActionLayer,
  ActionType,
  ActionResult,
  ToolCallRecord,
  ContextLayer,
  SessionContext,
  BudgetSnapshot,
  GoalContext,
  ConstraintContext,
  OptionContext,
  EnvironmentalFactors,
  ReasoningLayer,
  ReasoningType,
  ThoughtStep,
  Evidence,
  CounterfactualsLayer,
  AlternativeConsidered,
  RejectedOption,
  RiskAssessment,
  RiskItem,
  MitigationStrategy,
  OversightLayer,
  HumanInteraction,
  ApprovalRecord,
  ModificationRecord,
  EscalationRecord,
  VersionTrailEntry,
  AuditStatus,
  ComplianceFlag,
  AgentDecisionRecord,
  ADRCreationOptions,
  ADRQueryOptions,
  ADRReconstruction,
  DecisionTimelineEntry,
  EvidenceChainEntry,
  HumanOversightSummary,
  ComplianceVerification,
  ComplianceStatus,
  ComplianceIssue,
  TamperIntegrityCheck,
} from "./types";

export {
  computeChecksum,
  generateId,
  createEmptyBudgetSnapshot,
  createDefaultReproducibilityInfo,
  createDefaultADR,
} from "./types";

export {
  type ADRStorage,
  PostgreSQLADRStorage,
  InMemoryADRStorage,
  ADRCapture,
  createADRCapture,
  createInMemoryStorage,
  createPostgreSQLStorage,
  captureActionFromState,
  captureContextFromState,
} from "./capture";

export {
  ReasoningCapture,
  CounterfactualsCapture,
  ReasoningManager,
  createReasoningManager,
  createReasoningCapture,
  createCounterfactualsCapture,
} from "./reasoning";

export {
  OversightCapture,
  ADRReconstructor,
  createOversightCapture,
  createADRReconstructor,
} from "./oversight";

import type { Pool } from "pg";
import { getPool } from "../postgres/connection";
import { ADRCapture, createADRCapture, createInMemoryStorage, type ADRStorage } from "./capture";
import { createReasoningManager, ReasoningManager } from "./reasoning";
import { createOversightCapture, OversightCapture, createADRReconstructor, ADRReconstructor } from "./oversight";
import { computeChecksum } from "./types";

const CREATE_ADR_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS agent_decision_records (
  id SERIAL PRIMARY KEY,
  adr_id VARCHAR(255) NOT NULL UNIQUE,
  group_id VARCHAR(255) NOT NULL,
  session_id JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lifecycle VARCHAR(50) NOT NULL DEFAULT 'created',
  action_layer JSONB NOT NULL,
  context_layer JSONB NOT NULL,
  reasoning_layer JSONB NOT NULL,
  counterfactuals_layer JSONB NOT NULL,
  oversight_layer JSONB NOT NULL,
  reproducibility JSONB NOT NULL,
  overall_checksum VARCHAR(255) NOT NULL,
  previous_version_id VARCHAR(255),
  archived_at TIMESTAMPTZ,
  
  CONSTRAINT valid_lifecycle CHECK (
    lifecycle IN ('created', 'active', 'completed', 'archived')
  )
);

CREATE INDEX IF NOT EXISTS idx_adr_group_id ON agent_decision_records(group_id);
CREATE INDEX IF NOT EXISTS idx_adr_session_id ON agent_decision_records((session_id->>'sessionId'));
CREATE INDEX IF NOT EXISTS idx_adr_created_at ON agent_decision_records(created_at);
CREATE INDEX IF NOT EXISTS idx_adr_lifecycle ON agent_decision_records(lifecycle);
`;

/**
 * Initialize ADR tables in PostgreSQL
 */
export async function initializeADRTables(pool?: Pool): Promise<void> {
  const db = pool ?? getPool();
  await db.query(CREATE_ADR_TABLE_SQL);
}

/**
 * Five-layer ADR builder for creating complete decision records
 */
export class FiveLayerADRBuilder {
  private capture: ADRCapture;
  private reasoningManager: ReasoningManager;
  private oversightCapture: OversightCapture;
  private adrId: string | null = null;

  constructor(storage?: ADRStorage) {
    this.capture = createADRCapture(storage);
    this.reasoningManager = createReasoningManager();
    this.oversightCapture = createOversightCapture();
  }

  /**
   * Start building a new ADR
   */
  async start(options: import("./types").ADRCreationOptions): Promise<string> {
    this.adrId = await this.capture.beginDecision(options);
    const adr = this.capture.getCurrentADR();
    
    if (adr) {
      this.oversightCapture.initializeVersionTrail();
      this.reasoningManager.getReasoningCapture().setCurrentADR(adr);
      this.oversightCapture.setCurrentADR(adr);
    }
    
    return this.adrId!;
  }

  /**
   * Set action layer (Layer 1)
   */
  setAction(
    inputs: Record<string, unknown>,
    outputs: Record<string, unknown> | undefined,
    result: import("./types").ActionResult,
    durationMs: number,
    toolCalls: import("./types").ToolCallRecord[] = [],
  ): void {
    this.capture.captureAction(inputs, outputs, result, durationMs, toolCalls);
  }

  /**
   * Set context layer (Layer 2)
   */
  setContext(
    sessionState: import("./types").SessionContext,
    goals: import("./types").GoalContext[],
    constraints: import("./types").ConstraintContext[],
    availableOptions: import("./types").OptionContext[],
    selectedOption: string,
    environmentalFactors?: import("./types").EnvironmentalFactors,
  ): void {
    this.capture.captureContext(
      sessionState,
      goals,
      constraints,
      availableOptions,
      selectedOption,
      environmentalFactors,
    );
  }

  /**
   * Add thought to reasoning layer (Layer 3)
   */
  addThought(thought: string, reasoning?: string, dependencies?: string[]): import("./types").ThoughtStep {
    return this.reasoningManager.addThought(thought, reasoning, dependencies);
  }

  /**
   * Add evidence to reasoning layer (Layer 3)
   */
  addEvidence(
    type: import("./types").Evidence["type"],
    source: string,
    content: Record<string, unknown>,
    reliability?: number,
  ): import("./types").Evidence {
    return this.reasoningManager.addEvidence(type, source, content, reliability);
  }

  /**
   * Set reasoning confidence
   */
  setConfidence(confidence: number): void {
    this.reasoningManager.setConfidence(confidence);
  }

  /**
   * Add alternative to counterfactuals layer (Layer 4)
   */
  addAlternative(
    description: string,
    estimatedOutcome: string,
    estimatedCost: number,
    estimatedDuration: number,
    score: number,
    ranking: number,
  ): import("./types").AlternativeConsidered {
    return this.reasoningManager.addAlternative(
      description,
      estimatedOutcome,
      estimatedCost,
      estimatedDuration,
      score,
      ranking,
    );
  }

  /**
   * Reject an option in counterfactuals layer (Layer 4)
   */
  rejectOption(
    description: string,
    reason: string,
    criteria: string[],
    wasViable: boolean,
  ): import("./types").RejectedOption {
    return this.reasoningManager.rejectOption(description, reason, criteria, wasViable);
  }

  /**
   * Add risk to counterfactuals layer (Layer 4)
   */
  addRisk(
    description: string,
    probability: number,
    impact: number,
    category: import("./types").RiskItem["category"],
  ): import("./types").RiskItem {
    return this.reasoningManager.addRisk(description, probability, impact, category);
  }

  /**
   * Record human interaction in oversight layer (Layer 5)
   */
  addHumanInteraction(
    userId: string,
    userRole: string,
    interactionType: import("./types").HumanInteraction["interactionType"],
    content: string,
    response?: string,
  ): import("./types").HumanInteraction {
    return this.oversightCapture.addInteraction(userId, userRole, interactionType, content, response);
  }

  /**
   * Record approval in oversight layer (Layer 5)
   */
  addApproval(
    approvedBy: string,
    approvalLevel: import("./types").ApprovalRecord["approvalLevel"],
    conditions?: string[],
  ): import("./types").ApprovalRecord {
    return this.oversightCapture.addApproval(approvedBy, approvalLevel, conditions);
  }

  /**
   * Add compliance flag
   */
  addComplianceFlag(
    framework: import("./types").ComplianceFlag["framework"],
    requirement: string,
    status: import("./types").ComplianceFlag["status"],
  ): import("./types").ComplianceFlag {
    return this.oversightCapture.addComplianceFlag(framework, requirement, status);
  }

  /**
   * Finalize and persist the ADR
   */
  async finalize(): Promise<string> {
    const adr = this.capture.getCurrentADR();
    if (!adr) {
      throw new Error("No ADR in progress");
    }

    adr.reasoningLayer = this.reasoningManager.buildReasoningLayer();
    adr.counterfactualsLayer = this.reasoningManager.buildCounterfactualsLayer();
    adr.oversightLayer = this.oversightCapture.build();
    adr.overallChecksum = computeChecksum(adr);
    adr.lifecycle = "completed";
    adr.updatedAt = new Date();

    await this.capture.persist();
    const id = await this.capture.finalize();
    this.adrId = null;
    return id;
  }

  /**
   * Get current ADR
   */
  getCurrentADR(): import("./types").AgentDecisionRecord | null {
    return this.capture.getCurrentADR();
  }

  /**
   * Get reconstructor for audit support
   */
  getReconstructor(): ADRReconstructor {
    return createADRReconstructor();
  }
}

/**
 * Create a five-layer ADR builder
 */
export function createFiveLayerADRBuilder(
  storage?: ADRStorage,
): FiveLayerADRBuilder {
  return new FiveLayerADRBuilder(storage);
}