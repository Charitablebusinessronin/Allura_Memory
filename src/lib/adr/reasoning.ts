/**
 * ADR Reasoning Layer - Thought Process and Counterfactual Capture
 * Story 3.5: Record Five-Layer Agent Decision Records
 * 
 * AC 1: Records reasoning chain and counterfactuals
 * This module handles Layer 3 (Reasoning) and Layer 4 (Counterfactuals)
 */

import {
  type ReasoningLayer,
  type CounterfactualsLayer,
  type ReasoningType,
  type ThoughtStep,
  type Evidence,
  type AlternativeConsidered,
  type RejectedOption,
  type RiskAssessment,
  type RiskItem,
  type MitigationStrategy,
  type ModelVersion,
  type PromptVersion,
  type AgentDecisionRecord,
  computeChecksum,
  generateId,
} from "./types";
import type { ADRCapture } from "./capture";

/**
 * Reasoning capture builder for Layer 3
 * Records the thought process and evidence for decisions
 */
export class ReasoningCapture {
  private thoughtSteps: ThoughtStep[] = [];
  private evidenceList: Evidence[] = [];
  private reasoningType: ReasoningType = "heuristic";
  private currentADR: AgentDecisionRecord | null = null;
  private modelUsed: ModelVersion;
  private promptUsed: PromptVersion;
  private rawModelOutput?: string;
  private parsedOutput?: Record<string, unknown>;
  private confidence: number = 0;

  constructor(model?: ModelVersion, prompt?: PromptVersion) {
    this.modelUsed = model ?? {
      provider: "unknown",
      modelId: "unknown",
      modelVersion: "unknown",
    };
    this.promptUsed = prompt ?? {
      promptId: "unknown",
      promptVersion: "unknown",
      promptHash: computeChecksum("unknown"),
    };
  }

  /**
   * Set the current ADR being built
   */
  setCurrentADR(adr: AgentDecisionRecord): void {
    this.currentADR = adr;
  }

  /**
   * Set reasoning type
   */
  setReasoningType(type: ReasoningType): void {
    this.reasoningType = type;
  }

  /**
   * Set model used for this reasoning
   */
  setModel(model: ModelVersion): void {
    this.modelUsed = model;
  }

  /**
   * Set prompt used for this reasoning
   */
  setPrompt(prompt: PromptVersion): void {
    this.promptUsed = prompt;
  }

  /**
   * Set raw model output (for reproducibility - AC2)
   */
  setRawModelOutput(output: string): void {
    this.rawModelOutput = output;
  }

  /**
   * Set parsed output
   */
  setParsedOutput(output: Record<string, unknown>): void {
    this.parsedOutput = output;
  }

  /**
   * Set confidence level (0-1)
   */
  setConfidence(confidence: number): void {
    this.confidence = Math.max(0, Math.min(1, confidence));
  }

  /**
   * Add a thought step to the reasoning chain
   */
  addThoughtStep(
    thought: string,
    reasoning?: string,
    dependencies?: string[],
  ): ThoughtStep {
    const step: ThoughtStep = {
      stepId: generateId("thought"),
      stepNumber: this.thoughtSteps.length + 1,
      thought,
      reasoning,
      dependencies,
      timestamp: new Date(),
    };
    this.thoughtSteps.push(step);
    return step;
  }

  /**
   * Add evidence supporting the reasoning
   */
  addEvidence(
    type: Evidence["type"],
    source: string,
    content: Record<string, unknown>,
    reliability: number = 1.0,
  ): Evidence {
    const evidence: Evidence = {
      evidenceId: generateId("evidence"),
      type,
      source,
      content,
      reliability: Math.max(0, Math.min(1, reliability)),
      timestamp: new Date(),
    };
    this.evidenceList.push(evidence);
    return evidence;
  }

  /**
   * Add observation evidence
   */
  addObservation(source: string, content: Record<string, unknown>, reliability: number = 1.0): Evidence {
    return this.addEvidence("observation", source, content, reliability);
  }

  /**
   * Add data evidence
   */
  addData(source: string, content: Record<string, unknown>, reliability: number = 1.0): Evidence {
    return this.addEvidence("data", source, content, reliability);
  }

  /**
   * Add rule evidence (e.g., policy rule, business rule)
   */
  addRule(source: string, content: Record<string, unknown>, reliability: number = 1.0): Evidence {
    return this.addEvidence("rule", source, content, reliability);
  }

  /**
   * Add heuristic evidence
   */
  addHeuristic(source: string, content: Record<string, unknown>, reliability: number = 0.8): Evidence {
    return this.addEvidence("heuristic", source, content, reliability);
  }

  /**
   * Add external evidence (e.g., from external API or source)
   */
  addExternal(source: string, content: Record<string, unknown>, reliability: number = 0.9): Evidence {
    return this.addEvidence("external", source, content, reliability);
  }

  /**
   * Build the reasoning layer
   */
  build(): ReasoningLayer {
    const layer: ReasoningLayer = {
      layerId: generateId("reasoning"),
      timestamp: new Date(),
      reasoningType: this.reasoningType,
      thoughtProcess: [...this.thoughtSteps],
      evidence: [...this.evidenceList],
      confidence: this.confidence,
      modelUsed: this.modelUsed,
      promptUsed: this.promptUsed,
      rawModelOutput: this.rawModelOutput,
      parsedOutput: this.parsedOutput,
      checksum: "",
    };
    layer.checksum = computeChecksum(layer);
    return layer;
  }

  /**
   * Get all thought steps
   */
  getThoughtSteps(): ThoughtStep[] {
    return [...this.thoughtSteps];
  }

  /**
   * Get all evidence
   */
  getEvidence(): Evidence[] {
    return [...this.evidenceList];
  }

  /**
   * Clear all recorded data
   */
  reset(): void {
    this.thoughtSteps = [];
    this.evidenceList = [];
    this.confidence = 0;
    this.rawModelOutput = undefined;
    this.parsedOutput = undefined;
  }
}

/**
 * Counterfactuals capture builder for Layer 4
 * Records alternatives considered and options rejected
 */
export class CounterfactualsCapture {
  private alternatives: AlternativeConsidered[] = [];
  private rejected: RejectedOption[] = [];
  private risks: RiskItem[] = [];
  private mitigations: MitigationStrategy[] = [];
  private overallRiskLevel: RiskAssessment["overallRiskLevel"] = "low";
  private residualRisk: number = 0;
  private learningNotes: string[] = [];

  /**
   * Add an alternative that was considered
   */
  addAlternative(
    description: string,
    estimatedOutcome: string,
    estimatedCost: number,
    estimatedDuration: number,
    evaluationScore: number,
    ranking: number,
  ): AlternativeConsidered {
    const alternative: AlternativeConsidered = {
      alternativeId: generateId("alt"),
      description,
      estimatedOutcome,
      estimatedCost,
      estimatedDuration,
      evaluationScore,
      ranking,
      consideredAt: new Date(),
    };
    this.alternatives.push(alternative);
    return alternative;
  }

  /**
   * Add a rejected option with reason
   */
  addRejectedOption(
    description: string,
    rejectionReason: string,
    rejectionCriteria: string[],
    wouldHaveBeenViable: boolean,
  ): RejectedOption {
    const option: RejectedOption = {
      optionId: generateId("rej"),
      description,
      rejectionReason,
      rejectionCriteria,
      rejectedAt: new Date(),
      wouldHaveBeenViable,
    };
    this.rejected.push(option);
    return option;
  }

  /**
   * Add a risk to the assessment
   */
  addRisk(
    description: string,
    probability: number,
    impact: number,
    category: RiskItem["category"],
  ): RiskItem {
    const risk: RiskItem = {
      riskId: generateId("risk"),
      description,
      probability: Math.max(0, Math.min(1, probability)),
      impact: Math.max(1, Math.min(5, impact)),
      category,
    };
    this.risks.push(risk);
    this.updateOverallRiskLevel();
    return risk;
  }

  /**
   * Add a mitigation strategy for a risk
   */
  addMitigation(
    riskId: string,
    description: string,
    effectiveness: number,
    implemented: boolean = false,
  ): MitigationStrategy {
    const strategy: MitigationStrategy = {
      strategyId: generateId("mit"),
      riskId,
      description,
      effectiveness: Math.max(0, Math.min(1, effectiveness)),
      implemented,
    };
    this.mitigations.push(strategy);
    return strategy;
  }

  /**
   * Set overall risk level
   */
  setRiskLevel(level: RiskAssessment["overallRiskLevel"]): void {
    this.overallRiskLevel = level;
  }

  /**
   * Set residual risk after mitigations
   */
  setResidualRisk(risk: number): void {
    this.residualRisk = Math.max(0, Math.min(1, risk));
  }

  /**
   * Add a learning note
   */
  addLearningNote(note: string): void {
    this.learningNotes.push(note);
  }

  /**
   * Update overall risk level based on risks
   */
  private updateOverallRiskLevel(): void {
    if (this.risks.length === 0) {
      this.overallRiskLevel = "low";
      return;
    }

    const maxImpact = Math.max(...this.risks.map(r => r.impact));
    const avgProbability = this.risks.reduce((sum, r) => sum + r.probability, 0) / this.risks.length;

    if (maxImpact >= 4 && avgProbability > 0.5) {
      this.overallRiskLevel = "critical";
    } else if (maxImpact >= 3 && avgProbability > 0.3) {
      this.overallRiskLevel = "high";
    } else if (maxImpact >= 2 && avgProbability > 0.2) {
      this.overallRiskLevel = "medium";
    } else {
      this.overallRiskLevel = "low";
    }
  }

  /**
   * Build the counterfactuals layer
   */
  build(): CounterfactualsLayer {
    const layer: CounterfactualsLayer = {
      layerId: generateId("counter"),
      timestamp: new Date(),
      alternativesConsidered: [...this.alternatives],
      rejectedOptions: [...this.rejected],
      riskAssessment: {
        overallRiskLevel: this.overallRiskLevel,
        identifiedRisks: [...this.risks],
        mitigationStrategies: [...this.mitigations],
        residualRisk: this.residualRisk,
      },
      learningNotes: [...this.learningNotes],
      checksum: "",
    };
    layer.checksum = computeChecksum(layer);
    return layer;
  }

  /**
   * Get all alternatives
   */
  getAlternatives(): AlternativeConsidered[] {
    return [...this.alternatives];
  }

  /**
   * Get all rejected options
   */
  getRejectedOptions(): RejectedOption[] {
    return [...this.rejected];
  }

  /**
   * Get all risks
   */
  getRisks(): RiskItem[] {
    return [...this.risks];
  }

  /**
   * Get all mitigations
   */
  getMitigations(): MitigationStrategy[] {
    return [...this.mitigations];
  }

  /**
   * Clear all recorded data
   */
  reset(): void {
    this.alternatives = [];
    this.rejected = [];
    this.risks = [];
    this.mitigations = [];
    this.learningNotes = [];
    this.overallRiskLevel = "low";
    this.residualRisk = 0;
  }
}

/**
 * ADR Reasoning Manager
 * Coordinates reasoning and counterfactuals capture
 */
export class ReasoningManager {
  private reasoningCapture: ReasoningCapture;
  private counterfactualsCapture: CounterfactualsCapture;

  constructor(
    model?: ModelVersion,
    prompt?: PromptVersion,
  ) {
    this.reasoningCapture = new ReasoningCapture(model, prompt);
    this.counterfactualsCapture = new CounterfactualsCapture();
  }

  /**
   * Add a thought step to reasoning
   */
  addThought(thought: string, reasoning?: string, dependencies?: string[]): ThoughtStep {
    return this.reasoningCapture.addThoughtStep(thought, reasoning, dependencies);
  }

  /**
   * Add evidence to reasoning
   */
  addEvidence(
    type: Evidence["type"],
    source: string,
    content: Record<string, unknown>,
    reliability?: number,
  ): Evidence {
    return this.reasoningCapture.addEvidence(type, source, content, reliability);
  }

  /**
   * Set confidence in reasoning
   */
  setConfidence(confidence: number): void {
    this.reasoningCapture.setConfidence(confidence);
  }

  /**
   * Set model output for reproducibility
   */
  setModelOutput(raw: string, parsed?: Record<string, unknown>): void {
    this.reasoningCapture.setRawModelOutput(raw);
    if (parsed) {
      this.reasoningCapture.setParsedOutput(parsed);
    }
  }

  /**
   * Add alternative consideration
   */
  addAlternative(
    description: string,
    estimatedOutcome: string,
    estimatedCost: number,
    estimatedDuration: number,
    score: number,
    ranking: number,
  ): AlternativeConsidered {
    return this.counterfactualsCapture.addAlternative(
      description,
      estimatedOutcome,
      estimatedCost,
      estimatedDuration,
      score,
      ranking,
    );
  }

  /**
   * Rejec an option
   */
  rejectOption(
    description: string,
    reason: string,
    criteria: string[],
    wasViable: boolean,
  ): RejectedOption {
    return this.counterfactualsCapture.addRejectedOption(
      description,
      reason,
      criteria,
      wasViable,
    );
  }

  /**
   * Add risk assessment
   */
  addRisk(
    description: string,
    probability: number,
    impact: number,
    category: RiskItem["category"],
  ): RiskItem {
    return this.counterfactualsCapture.addRisk(description, probability, impact, category);
  }

  /**
   * Add mitigation for a risk
   */
  addMitigation(
    riskId: string,
    description: string,
    effectiveness: number,
    implemented?: boolean,
  ): MitigationStrategy {
    return this.counterfactualsCapture.addMitigation(riskId, description, effectiveness, implemented);
  }

  /**
   * Add learning note
   */
  addLearningNote(note: string): void {
    this.counterfactualsCapture.addLearningNote(note);
  }

  /**
   * Build reasoning layer
   */
  buildReasoningLayer(): ReasoningLayer {
    return this.reasoningCapture.build();
  }

  /**
   * Build counterfactuals layer
   */
  buildCounterfactualsLayer(): CounterfactualsLayer {
    return this.counterfactualsCapture.build();
  }

  /**
   * Get reasoning capture for advanced use
   */
  getReasoningCapture(): ReasoningCapture {
    return this.reasoningCapture;
  }

  /**
   * Get counterfactuals capture for advanced use
   */
  getCounterfactualsCapture(): CounterfactualsCapture {
    return this.counterfactualsCapture;
  }

  /**
   * Reset both captures
   */
  reset(): void {
    this.reasoningCapture.reset();
    this.counterfactualsCapture.reset();
  }
}

/**
 * Create a reasoning manager instance
 */
export function createReasoningManager(
  model?: ModelVersion,
  prompt?: PromptVersion,
): ReasoningManager {
  return new ReasoningManager(model, prompt);
}

/**
 * Create a reasoning capture instance
 */
export function createReasoningCapture(
  model?: ModelVersion,
  prompt?: PromptVersion,
): ReasoningCapture {
  return new ReasoningCapture(model, prompt);
}

/**
 * Create a counterfactuals capture instance
 */
export function createCounterfactualsCapture(): CounterfactualsCapture {
  return new CounterfactualsCapture();
}