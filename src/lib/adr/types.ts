/**
 * Agent Decision Record (ADR) Type Definitions
 * Story 3.5: Record Five-Layer Agent Decision Records
 * 
 * ADRs provide comprehensive audit trails for SOC 2, GDPR, and ISO 27001 compliance.
 * Five audit layers: Action, Context, Reasoning, Counterfactuals, Oversight.
 * 
 * NFR4: Five audit layers for critical decisions
 * NFR5: SOC 2, GDPR, ISO 27001 compliance
 */

import { createHash } from "crypto";
import type { SessionId } from "../budget/types";

/**
 * ADR Lifecycle states
 */
export type ADRLifecycle = "created" | "active" | "completed" | "archived";

/**
 * Model version information for reproducibility
 */
export interface ModelVersion {
  provider: string;
  modelId: string;
  modelVersion: string;
  apiVersion?: string;
}

/**
 * Prompt version information for reproducibility
 */
export interface PromptVersion {
  promptId: string;
  promptVersion: string;
  promptHash: string;
  templateVariables?: Record<string, unknown>;
}

/**
 * Tool version information for reproducibility
 */
export interface ToolVersion {
  toolId: string;
  toolName: string;
  toolVersion: string;
  configuration?: Record<string, unknown>;
}

/**
 * Reproducibility metadata - AC2: model, prompt, tool versions
 */
export interface ReproducibilityInfo {
  model: ModelVersion;
  prompt: PromptVersion;
  tools: ToolVersion[];
  frameworkVersion: string;
  timestamp: Date;
  environmentId: string;
  configurationHash: string;
}

/**
 * Layer 1: Action Logging
 * WHAT was done - the observable action
 */
export interface ActionLayer {
  layerId: string;
  timestamp: Date;
  actionType: ActionType;
  actionId: string;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  result: ActionResult;
  durationMs: number;
  toolCalls: ToolCallRecord[];
  parentActionId?: string;
  checksum: string;
}

/**
 * Types of actions that can be logged
 */
export type ActionType =
  | "tool_invocation"
  | "llm_request"
  | "decision_made"
  | "state_transition"
  | "data_access"
  | "external_request"
  | "internal_calculation"
  | "policy_check"
  | "budget_check";

/**
 * Result of an action
 */
export type ActionResult = "success" | "failure" | "partial" | "skipped" | "pending";

/**
 * Tool call record for action layer
 */
export interface ToolCallRecord {
  toolId: string;
  toolName: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  success: boolean;
  timestamp: Date;
  durationMs: number;
}

/**
 * Layer 2: Decision Context
 * WHY it was done - state, goals, constraints at decision time
 */
export interface ContextLayer {
  layerId: string;
  timestamp: Date;
  sessionState: SessionContext;
  goals: GoalContext[];
  constraints: ConstraintContext[];
  availableOptions: OptionContext[];
  selectedOption: string;
  environmentalFactors: EnvironmentalFactors;
  checksum: string;
}

/**
 * Session context at decision time
 */
export interface SessionContext {
  sessionId: SessionId;
  currentStep: number;
  totalSteps: number;
  budgetRemaining: BudgetSnapshot;
  activePolicies: string[];
  parentDecisionId?: string;
}

/**
 * Budget snapshot for context
 */
export interface BudgetSnapshot {
  tokensRemaining: number;
  toolCallsRemaining: number;
  timeRemainingMs: number;
  costRemainingUsd: number;
}

/**
 * Goal being pursued
 */
export interface GoalContext {
  goalId: string;
  description: string;
  priority: number;
  status: "active" | "completed" | "blocked" | "abandoned";
}

/**
 * Constraint affecting the decision
 */
export interface ConstraintContext {
  constraintId: string;
  type: "hard" | "soft";
  description: string;
  value: unknown;
  source: string;
}

/**
 * Available option at decision point
 */
export interface OptionContext {
  optionId: string;
  description: string;
  estimatedCost: number;
  estimatedDuration: number;
  riskLevel: "low" | "medium" | "high";
}

/**
 * Environmental factors
 */
export interface EnvironmentalFactors {
  systemLoad?: number;
  networkLatency?: number;
  dependentServicesHealth?: Record<string, boolean>;
  customFactors?: Record<string, unknown>;
}

/**
 * Layer 3: Reasoning Chain
 * HOW the decision was made - thought process and evidence
 */
export interface ReasoningLayer {
  layerId: string;
  timestamp: Date;
  reasoningType: ReasoningType;
  thoughtProcess: ThoughtStep[];
  evidence: Evidence[];
  confidence: number;
  modelUsed: ModelVersion;
  promptUsed: PromptVersion;
  rawModelOutput?: string;
  parsedOutput?: Record<string, unknown>;
  checksum: string;
}

/**
 * Types of reasoning
 */
export type ReasoningType =
  | "deductive"
  | "inductive"
  | "abductive"
  | "heuristic"
  | "rule_based"
  | "probabilistic"
  | "hybrid";

/**
 * Single thought step in the reasoning chain
 */
export interface ThoughtStep {
  stepId: string;
  stepNumber: number;
  thought: string;
  reasoning?: string;
  dependencies?: string[];
  timestamp: Date;
}

/**
 * Evidence supporting the reasoning
 */
export interface Evidence {
  evidenceId: string;
  type: "observation" | "data" | "rule" | "heuristic" | "external";
  source: string;
  content: Record<string, unknown>;
  reliability: number;
  timestamp: Date;
}

/**
 * Layer 4: Counterfactuals
 * WHAT ELSE COULD have been done - alternatives and rejections
 */
export interface CounterfactualsLayer {
  layerId: string;
  timestamp: Date;
  alternativesConsidered: AlternativeConsidered[];
  rejectedOptions: RejectedOption[];
  riskAssessment: RiskAssessment;
  learningNotes?: string[];
  checksum: string;
}

/**
 * Alternative that was considered
 */
export interface AlternativeConsidered {
  alternativeId: string;
  description: string;
  estimatedOutcome: string;
  estimatedCost: number;
  estimatedDuration: number;
  evaluationScore: number;
  ranking: number;
  consideredAt: Date;
}

/**
 * Rejected option with reason
 */
export interface RejectedOption {
  optionId: string;
  description: string;
  rejectionReason: string;
  rejectionCriteria: string[];
  rejectedAt: Date;
  wouldHaveBeenViable: boolean;
}

/**
 * Risk assessment for counterfactuals
 */
export interface RiskAssessment {
  overallRiskLevel: "low" | "medium" | "high" | "critical";
  identifiedRisks: RiskItem[];
  mitigationStrategies: MitigationStrategy[];
  residualRisk: number;
}

/**
 * Individual risk item
 */
export interface RiskItem {
  riskId: string;
  description: string;
  probability: number;
  impact: number;
  category: "security" | "compliance" | "operational" | "financial" | "reputational";
}

/**
 * Mitigation strategy
 */
export interface MitigationStrategy {
  strategyId: string;
  riskId: string;
  description: string;
  effectiveness: number;
  implemented: boolean;
}

/**
 * Layer 5: Human Oversight Trail
 * WHO reviewed and approved - human interactions
 */
export interface OversightLayer {
  layerId: string;
  timestamp: Date;
  humanInteractions: HumanInteraction[];
  approvals: ApprovalRecord[];
  modifications: ModificationRecord[];
  escalationHistory: EscalationRecord[];
  versionTrail: VersionTrailEntry[];
  auditStatus: AuditStatus;
  finalChecksum: string;
}

/**
 * Human interaction record
 */
export interface HumanInteraction {
  interactionId: string;
  userId: string;
  userRole: string;
  interactionType: "review" | "approval" | "modification" | "escalation" | "override" | "query";
  timestamp: Date;
  content: string;
  response?: string;
  actionTaken?: string;
}

/**
 * Approval record
 */
export interface ApprovalRecord {
  approvalId: string;
  approvedBy: string;
  approvedAt: Date;
  approvalLevel: "auto" | "supervisor" | "manager" | "executive";
  conditions?: string[];
  expiresAt?: Date;
  checksum: string;
}

/**
 * Modification record
 */
export interface ModificationRecord {
  modificationId: string;
  modifiedBy: string;
  modifiedAt: Date;
  modificationType: "parameter" | "decision" | "constraint" | "goal";
  previousValue: unknown;
  newValue: unknown;
  reason: string;
  checksum: string;
}

/**
 * Escalation record
 */
export interface EscalationRecord {
  escalationId: string;
  escalatedFrom: string;
  escalatedTo: string;
  reason: string;
  timestamp: Date;
  resolvedAt?: Date;
  resolution?: string;
}

/**
 * Version trail entry
 */
export interface VersionTrailEntry {
  versionId: string;
  version: number;
  timestamp: Date;
  changeType: "created" | "updated" | "approved" | "archived";
  changedBy: string;
  previousVersionId?: string;
  checksum: string;
}

/**
 * Audit status for oversight layer
 */
export interface AuditStatus {
  status: "pending" | "reviewed" | "approved" | "rejected" | "archived";
  reviewedBy?: string;
  reviewedAt?: Date;
  notes?: string;
  complianceFlags: ComplianceFlag[];
}

/**
 * Compliance flag for SOC 2, GDPR, ISO 27001
 */
export interface ComplianceFlag {
  framework: "SOC2" | "GDPR" | "ISO27001";
  requirement: string;
  status: "compliant" | "non_compliant" | "needs_review";
  evidence?: string;
  remediation?: string;
}

/**
 * Complete Agent Decision Record
 * Five-layer audit trail with tamper-evidence
 */
export interface AgentDecisionRecord {
  adrId: string;
  groupId: string;
  sessionId: SessionId;
  createdAt: Date;
  updatedAt: Date;
  lifecycle: ADRLifecycle;
  reproducibility: ReproducibilityInfo;
  
  actionLayer: ActionLayer;
  contextLayer: ContextLayer;
  reasoningLayer: ReasoningLayer;
  counterfactualsLayer: CounterfactualsLayer;
  oversightLayer: OversightLayer;
  
  overallChecksum: string;
  previousVersionId?: string;
  archivedAt?: Date;
}

/**
 * ADR Creation options
 */
export interface ADRCreationOptions {
  groupId: string;
  sessionId: SessionId;
  actionType: ActionType;
  reproducibility: ReproducibilityInfo;
}

/**
 * ADR Query options for retrieval
 */
export interface ADRQueryOptions {
  groupId?: string;
  sessionId?: SessionId;
  adrId?: string;
  lifecycle?: ADRLifecycle;
  fromDate?: Date;
  toDate?: Date;
  actionTypes?: ActionType[];
  limit?: number;
  offset?: number;
}

/**
 * ADR Reconstruction result for audits (AC3)
 */
export interface ADRReconstruction {
  adrId: string;
  reconstructedAt: Date;
  decisionTimeline: DecisionTimelineEntry[];
  evidenceChain: EvidenceChainEntry[];
  humanOversightSummary: HumanOversightSummary;
  complianceVerification: ComplianceVerification;
  tamperIntegrity: TamperIntegrityCheck;
}

/**
 * Decision timeline entry
 */
export interface DecisionTimelineEntry {
  timestamp: Date;
  layer: "action" | "context" | "reasoning" | "counterfactuals" | "oversight";
  action: string;
  details: Record<string, unknown>;
}

/**
 * Evidence chain entry
 */
export interface EvidenceChainEntry {
  evidenceId: string;
  source: string;
  type: string;
  linkedToEvidenceIds: string[];
  timestamp: Date;
}

/**
 * Human oversight summary
 */
export interface HumanOversightSummary {
  totalInteractions: number;
  totalApprovals: number;
  totalModifications: number;
  totalEscalations: number;
  finalApprovalLevel: string;
  auditStatus: string;
}

/**
 * Compliance verification result
 */
export interface ComplianceVerification {
  frameworks: {
    SOC2: ComplianceStatus;
    GDPR: ComplianceStatus;
    ISO27001: ComplianceStatus;
  };
  overallCompliant: boolean;
  issues: ComplianceIssue[];
}

/**
 * Compliance status for a framework
 */
export interface ComplianceStatus {
  compliant: boolean;
  checkedAt: Date;
  requirementsMet: number;
  requirementsTotal: number;
  gaps: string[];
}

/**
 * Compliance issue
 */
export interface ComplianceIssue {
  framework: "SOC2" | "GDPR" | "ISO27001";
  requirement: string;
  severity: "low" | "medium" | "high";
  description: string;
}

/**
 * Tamper integrity check
 */
export interface TamperIntegrityCheck {
  verified: boolean;
  checkedAt: Date;
  layerChecksums: {
    action: { expected: string; actual: string; match: boolean };
    context: { expected: string; actual: string; match: boolean };
    reasoning: { expected: string; actual: string; match: boolean };
    counterfactuals: { expected: string; actual: string; match: boolean };
    oversight: { expected: string; actual: string; match: boolean };
  };
  overallChecksum: { expected: string; actual: string; match: boolean };
}

/**
 * Compute checksum for data integrity
 * Excludes checksum fields from calculation (checksum, finalChecksum, overallChecksum)
 * Uses deterministic JSON serialization with sorted keys
 */
export function computeChecksum(data: unknown): string {
  if (data === null || data === undefined) {
    return createHash("sha256").update("null").digest("hex");
  }

  const obj = typeof data === "object" ? data : { value: data };
  
  // Remove all checksum fields from calculation (at any level)
  const cleanObj = removeChecksums(obj);
  
  // Sort keys for deterministic serialization
  const sortedObj = sortObjectKeys(cleanObj);
  const content = JSON.stringify(sortedObj);
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Remove checksum fields recursively from an object
 */
function removeChecksums(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(removeChecksums);
  }
  
  const { checksum, finalChecksum, overallChecksum, ...rest } = obj as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(rest)) {
    cleaned[key] = removeChecksums(value);
  }
  
  return cleaned;
}

/**
 * Recursively sort object keys for deterministic serialization
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();
  
  for (const key of keys) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  
  return sorted;
}

/**
 * Generate unique ID for ADR components
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Create empty budget snapshot
 */
export function createEmptyBudgetSnapshot(): BudgetSnapshot {
  return {
    tokensRemaining: 0,
    toolCallsRemaining: 0,
    timeRemainingMs: 0,
    costRemainingUsd: 0,
  };
}

/**
 * Create default reproducibility info
 */
export function createDefaultReproducibilityInfo(): ReproducibilityInfo {
  return {
    model: {
      provider: "unknown",
      modelId: "unknown",
      modelVersion: "unknown",
    },
    prompt: {
      promptId: "unknown",
      promptVersion: "unknown",
      promptHash: computeChecksum("unknown"),
    },
    tools: [],
    frameworkVersion: "1.0.0",
    timestamp: new Date(),
    environmentId: "default",
    configurationHash: computeChecksum({}),
  };
}

/**
 * Create default ADR with all five layers initialized
 */
export function createDefaultADR(
  groupId: string,
  sessionId: SessionId,
): Omit<AgentDecisionRecord, "adrId" | "overallChecksum"> {
  const now = new Date();
  const reproducibility = createDefaultReproducibilityInfo();
  
  const actionLayer: ActionLayer = {
    layerId: generateId("action"),
    timestamp: now,
    actionType: "internal_calculation",
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
      sessionId,
      currentStep: 0,
      totalSteps: 0,
      budgetRemaining: createEmptyBudgetSnapshot(),
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
  
  const reasoningLayer: ReasoningLayer = {
    layerId: generateId("reasoning"),
    timestamp: now,
    reasoningType: "heuristic",
    thoughtProcess: [],
    evidence: [],
    confidence: 0,
    modelUsed: reproducibility.model,
    promptUsed: reproducibility.prompt,
    checksum: "",
  };
  reasoningLayer.checksum = computeChecksum(reasoningLayer);
  
  const counterfactualsLayer: CounterfactualsLayer = {
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
  };
  counterfactualsLayer.checksum = computeChecksum(counterfactualsLayer);
  
  const oversightLayer: OversightLayer = {
    layerId: generateId("oversight"),
    timestamp: now,
    humanInteractions: [],
    approvals: [],
    modifications: [],
    escalationHistory: [],
    versionTrail: [
      {
        versionId: generateId("ver"),
        version: 1,
        timestamp: now,
        changeType: "created",
        changedBy: "system",
        checksum: "",
      },
    ],
    auditStatus: {
      status: "pending",
      complianceFlags: [],
    },
    finalChecksum: "",
  };
  oversightLayer.finalChecksum = computeChecksum(oversightLayer);
  
  const adr: Omit<AgentDecisionRecord, "adrId" | "overallChecksum"> = {
    groupId,
    sessionId,
    createdAt: now,
    updatedAt: now,
    lifecycle: "created",
    reproducibility,
    actionLayer,
    contextLayer,
    reasoningLayer,
    counterfactualsLayer,
    oversightLayer,
    previousVersionId: undefined,
  };
  
  return adr;
}