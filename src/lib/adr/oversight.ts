/**
 * ADR Human Oversight Trail - Layer 5
 * Story 3.5: Record Five-Layer Agent Decision Records
 * 
 * AC 1, AC 2: Captures human interactions, approvals, version tracking
 * This module handles Layer 5 (Human Oversight Trail)
 */

import {
  type OversightLayer,
  type HumanInteraction,
  type ApprovalRecord,
  type ModificationRecord,
  type EscalationRecord,
  type VersionTrailEntry,
  type AuditStatus,
  type ComplianceFlag,
  type ComplianceVerification,
  type HumanOversightSummary,
  type AgentDecisionRecord,
  type TamperIntegrityCheck,
  type ADRReconstruction,
  type DecisionTimelineEntry,
  type EvidenceChainEntry,
  computeChecksum,
  generateId,
} from "./types";
import type { ADRCapture } from "./capture";

/**
 * Human Oversight Capture for Layer 5
 * Records all human interactions with the decision process
 */
export class OversightCapture {
  private humanInteractions: HumanInteraction[] = [];
  private approvals: ApprovalRecord[] = [];
  private modifications: ModificationRecord[] = [];
  private escalationHistory: EscalationRecord[] = [];
  private versionTrail: VersionTrailEntry[] = [];
  private complianceFlags: ComplianceFlag[] = [];
  private auditStatus: AuditStatus["status"] = "pending";
  private reviewedBy?: string;
  private reviewedAt?: Date;
  private notes?: string;
  private currentADR: AgentDecisionRecord | null = null;
  private currentVersion: number = 1;

  /**
   * Set current ADR for version tracking
   */
  setCurrentADR(adr: AgentDecisionRecord): void {
    this.currentADR = adr;
    this.currentVersion = adr.oversightLayer.versionTrail.length + 1;
  }

  /**
   * Record a human interaction
   */
  addInteraction(
    userId: string,
    userRole: string,
    interactionType: HumanInteraction["interactionType"],
    content: string,
    response?: string,
    actionTaken?: string,
  ): HumanInteraction {
    const interaction: HumanInteraction = {
      interactionId: generateId("inter"),
      userId,
      userRole,
      interactionType,
      timestamp: new Date(),
      content,
      response,
      actionTaken,
    };
    this.humanInteractions.push(interaction);
    return interaction;
  }

  /**
   * Record a review interaction
   */
  addReview(userId: string, userRole: string, content: string, response?: string): HumanInteraction {
    return this.addInteraction(userId, userRole, "review", content, response);
  }

  /**
   * Record an approval
   */
  addApproval(
    approvedBy: string,
    approvalLevel: ApprovalRecord["approvalLevel"],
    conditions?: string[],
    expiresAt?: Date,
  ): ApprovalRecord {
    const approval: ApprovalRecord = {
      approvalId: generateId("approval"),
      approvedBy,
      approvedAt: new Date(),
      approvalLevel,
      conditions,
      expiresAt,
      checksum: "",
    };
    approval.checksum = computeChecksum(approval);
    this.approvals.push(approval);
    return approval;
  }

  /**
   * Record a modification
   */
  addModification(
    modifiedBy: string,
    modificationType: ModificationRecord["modificationType"],
    previousValue: unknown,
    newValue: unknown,
    reason: string,
  ): ModificationRecord {
    const modification: ModificationRecord = {
      modificationId: generateId("mod"),
      modifiedBy,
      modifiedAt: new Date(),
      modificationType,
      previousValue,
      newValue,
      reason,
      checksum: "",
    };
    modification.checksum = computeChecksum(modification);
    this.modifications.push(modification);
    
    this.currentVersion++;
    const versionEntry = this.createVersionEntry("updated", modifiedBy);
    this.versionTrail.push(versionEntry);
    
    return modification;
  }

  /**
   * Record an escalation
   */
  addEscalation(
    escalatedFrom: string,
    escalatedTo: string,
    reason: string,
  ): EscalationRecord {
    const escalation: EscalationRecord = {
      escalationId: generateId("esc"),
      escalatedFrom,
      escalatedTo,
      reason,
      timestamp: new Date(),
    };
    this.escalationHistory.push(escalation);
    return escalation;
  }

  /**
   * Resolve an escalation
   */
  resolveEscalation(escalationId: string, resolution: string, resolvedBy: string): boolean {
    const escalation = this.escalationHistory.find(e => e.escalationId === escalationId);
    if (!escalation) return false;
    
    escalation.resolvedAt = new Date();
    escalation.resolution = resolution;
    return true;
  }

  /**
   * Record an override action
   */
  addOverride(
    userId: string,
    userRole: string,
    content: string,
    actionTaken: string,
  ): HumanInteraction {
    return this.addInteraction(userId, userRole, "override", content, undefined, actionTaken);
  }

  /**
   * Record a query interaction
   */
  addQuery(
    userId: string,
    userRole: string,
    question: string,
    response?: string,
  ): HumanInteraction {
    return this.addInteraction(userId, userRole, "query", question, response);
  }

  /**
   * Add compliance flag for SOC 2, GDPR, ISO 27001
   */
  addComplianceFlag(
    framework: ComplianceFlag["framework"],
    requirement: string,
    status: ComplianceFlag["status"],
    evidence?: string,
    remediation?: string,
  ): ComplianceFlag {
    const flag: ComplianceFlag = {
      framework,
      requirement,
      status,
      evidence,
      remediation,
    };
    this.complianceFlags.push(flag);
    return flag;
  }

  /**
   * Set audit status
   */
  setAuditStatus(
    status: AuditStatus["status"],
    reviewedBy?: string,
    notes?: string,
  ): void {
    this.auditStatus = status;
    this.reviewedBy = reviewedBy;
    this.reviewedAt = new Date();
    this.notes = notes;
  }

  /**
   * Create version trail entry
   */
  private createVersionEntry(
    changeType: VersionTrailEntry["changeType"],
    changedBy: string,
  ): VersionTrailEntry {
    const previousId = this.versionTrail.length > 0
      ? this.versionTrail[this.versionTrail.length - 1].versionId
      : undefined;
    
    const entry: VersionTrailEntry = {
      versionId: generateId("ver"),
      version: this.currentVersion,
      timestamp: new Date(),
      changeType,
      changedBy,
      previousVersionId: previousId,
      checksum: "",
    };
    entry.checksum = computeChecksum(entry);
    return entry;
  }

  /**
   * Initialize version trail (called when ADR is created)
   */
  initializeVersionTrail(createdBy: string = "system"): VersionTrailEntry {
    const entry = this.createVersionEntry("created", createdBy);
    this.versionTrail.push(entry);
    return entry;
  }

  /**
   * Build the oversight layer
   */
  build(): OversightLayer {
    if (this.versionTrail.length === 0) {
      this.initializeVersionTrail();
    }

    const layer: OversightLayer = {
      layerId: generateId("oversight"),
      timestamp: new Date(),
      humanInteractions: [...this.humanInteractions],
      approvals: [...this.approvals],
      modifications: [...this.modifications],
      escalationHistory: [...this.escalationHistory],
      versionTrail: [...this.versionTrail],
      auditStatus: {
        status: this.auditStatus,
        reviewedBy: this.reviewedBy,
        reviewedAt: this.reviewedAt,
        notes: this.notes,
        complianceFlags: [...this.complianceFlags],
      },
      finalChecksum: "",
    };
    layer.finalChecksum = computeChecksum(layer);
    return layer;
  }

  /**
   * Get human interactions
   */
  getInteractions(): HumanInteraction[] {
    return [...this.humanInteractions];
  }

  /**
   * Get approvals
   */
  getApprovals(): ApprovalRecord[] {
    return [...this.approvals];
  }

  /**
   * Get modifications
   */
  getModifications(): ModificationRecord[] {
    return [...this.modifications];
  }

  /**
   * Get escalation history
   */
  getEscalations(): EscalationRecord[] {
    return [...this.escalationHistory];
  }

  /**
   * Get version trail
   */
  getVersionTrail(): VersionTrailEntry[] {
    return [...this.versionTrail];
  }

  /**
   * Get compliance flags
   */
  getComplianceFlags(): ComplianceFlag[] {
    return [...this.complianceFlags];
  }

  /**
   * Clear all recorded data
   */
  reset(): void {
    this.humanInteractions = [];
    this.approvals = [];
    this.modifications = [];
    this.escalationHistory = [];
    this.versionTrail = [];
    this.complianceFlags = [];
    this.auditStatus = "pending";
    this.reviewedBy = undefined;
    this.reviewedAt = undefined;
    this.notes = undefined;
    this.currentVersion = 1;
  }
}

/**
 * ADR Reconstruction Manager
 * AC 3: Reconstruct decision process for audit
 */
export class ADRReconstructor {
  /**
   * Reconstruct decision process from ADR for auditing
   * AC 3: System can reconstruct the decision process from ADR data
   */
  reconstructDecisionProcess(adr: AgentDecisionRecord): ADRReconstruction {
    const decisionTimeline = this.buildDecisionTimeline(adr);
    const evidenceChain = this.buildEvidenceChain(adr);
    const humanOversightSummary = this.buildHumanOversightSummary(adr);
    const complianceVerification = this.verifyCompliance(adr);
    const tamperIntegrity = this.verifyTamperIntegrity(adr);

    return {
      adrId: adr.adrId,
      reconstructedAt: new Date(),
      decisionTimeline,
      evidenceChain,
      humanOversightSummary,
      complianceVerification,
      tamperIntegrity,
    };
  }

  /**
   * Build decision timeline from ADR layers
   */
  private buildDecisionTimeline(adr: AgentDecisionRecord): DecisionTimelineEntry[] {
    const timeline: DecisionTimelineEntry[] = [];

    timeline.push({
      timestamp: adr.actionLayer.timestamp,
      layer: "action",
      action: adr.actionLayer.actionType,
      details: {
        actionId: adr.actionLayer.actionId,
        inputs: adr.actionLayer.inputs,
        outputs: adr.actionLayer.outputs,
        result: adr.actionLayer.result,
        durationMs: adr.actionLayer.durationMs,
      },
    });

    timeline.push({
      timestamp: adr.contextLayer.timestamp,
      layer: "context",
      action: "context_captured",
      details: {
        goals: adr.contextLayer.goals,
        constraints: adr.contextLayer.constraints,
        selectedOption: adr.contextLayer.selectedOption,
      },
    });

    timeline.push({
      timestamp: adr.reasoningLayer.timestamp,
      layer: "reasoning",
      action: "reasoning_recorded",
      details: {
        reasoningType: adr.reasoningLayer.reasoningType,
        thoughtSteps: adr.reasoningLayer.thoughtProcess.length,
        evidenceCount: adr.reasoningLayer.evidence.length,
        confidence: adr.reasoningLayer.confidence,
        model: adr.reasoningLayer.modelUsed,
        prompt: adr.reasoningLayer.promptUsed,
      },
    });

    timeline.push({
      timestamp: adr.counterfactualsLayer.timestamp,
      layer: "counterfactuals",
      action: "alternatives_analyzed",
      details: {
        alternativesConsidered: adr.counterfactualsLayer.alternativesConsidered.length,
        rejectedOptions: adr.counterfactualsLayer.rejectedOptions.length,
        riskLevel: adr.counterfactualsLayer.riskAssessment.overallRiskLevel,
      },
    });

    for (const approval of adr.oversightLayer.approvals) {
      timeline.push({
        timestamp: approval.approvedAt,
        layer: "oversight",
        action: "approval_granted",
        details: {
          approvalId: approval.approvalId,
          approvedBy: approval.approvedBy,
          approvalLevel: approval.approvalLevel,
          conditions: approval.conditions,
        },
      });
    }

    for (const modification of adr.oversightLayer.modifications) {
      timeline.push({
        timestamp: modification.modifiedAt,
        layer: "oversight",
        action: "modification_applied",
        details: {
          modificationId: modification.modificationId,
          modificationType: modification.modificationType,
          modifiedBy: modification.modifiedBy,
          reason: modification.reason,
        },
      });
    }

    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return timeline;
  }

  /**
   * Build evidence chain from ADR
   */
  private buildEvidenceChain(adr: AgentDecisionRecord): EvidenceChainEntry[] {
    const chain: EvidenceChainEntry[] = [];

    for (const evidence of adr.reasoningLayer.evidence) {
      chain.push({
        evidenceId: evidence.evidenceId,
        source: evidence.source,
        type: evidence.type,
        timestamp: evidence.timestamp,
        linkedToEvidenceIds: [],
      });
    }

    return chain;
  }

  /**
   * Build human oversight summary
   */
  private buildHumanOversightSummary(adr: AgentDecisionRecord): HumanOversightSummary {
    const oversight = adr.oversightLayer;
    
    const finalApproval = oversight.approvals.length > 0
      ? oversight.approvals[oversight.approvals.length - 1].approvalLevel
      : "auto";

    return {
      totalInteractions: oversight.humanInteractions.length,
      totalApprovals: oversight.approvals.length,
      totalModifications: oversight.modifications.length,
      totalEscalations: oversight.escalationHistory.length,
      finalApprovalLevel: finalApproval,
      auditStatus: oversight.auditStatus.status,
    };
  }

  /**
   * Verify compliance for SOC 2, GDPR, ISO 27001
   */
  private verifyCompliance(adr: AgentDecisionRecord): ComplianceVerification {
    const soc2Flags = adr.oversightLayer.auditStatus.complianceFlags.filter(f => f.framework === "SOC2");
    const gdprFlags = adr.oversightLayer.auditStatus.complianceFlags.filter(f => f.framework === "GDPR");
    const isoFlags = adr.oversightLayer.auditStatus.complianceFlags.filter(f => f.framework === "ISO27001");

    const soc2Compliant = !soc2Flags.some(f => f.status === "non_compliant");
    const gdprCompliant = !gdprFlags.some(f => f.status === "non_compliant");
    const isoCompliant = !isoFlags.some(f => f.status === "non_compliant");

    const issues: ComplianceVerification["issues"] = [];

    for (const flag of adr.oversightLayer.auditStatus.complianceFlags) {
      if (flag.status === "non_compliant" || flag.status === "needs_review") {
        issues.push({
          framework: flag.framework,
          requirement: flag.requirement,
          severity: flag.status === "non_compliant" ? "high" : "medium",
          description: flag.remediation ?? `Requirement ${flag.requirement} needs attention`,
        });
      }
    }

    return {
      frameworks: {
        SOC2: {
          compliant: soc2Compliant,
          checkedAt: new Date(),
          requirementsMet: soc2Flags.filter(f => f.status === "compliant").length,
          requirementsTotal: soc2Flags.length || 1,
          gaps: soc2Flags.filter(f => f.status !== "compliant").map(f => f.requirement),
        },
        GDPR: {
          compliant: gdprCompliant,
          checkedAt: new Date(),
          requirementsMet: gdprFlags.filter(f => f.status === "compliant").length,
          requirementsTotal: gdprFlags.length || 1,
          gaps: gdprFlags.filter(f => f.status !== "compliant").map(f => f.requirement),
        },
        ISO27001: {
          compliant: isoCompliant,
          checkedAt: new Date(),
          requirementsMet: isoFlags.filter(f => f.status === "compliant").length,
          requirementsTotal: isoFlags.length || 1,
          gaps: isoFlags.filter(f => f.status !== "compliant").map(f => f.requirement),
        },
      },
      overallCompliant: soc2Compliant && gdprCompliant && isoCompliant,
      issues,
    };
  }

  /**
   * Verify tamper integrity for all layers
   */
  private verifyTamperIntegrity(adr: AgentDecisionRecord): TamperIntegrityCheck {
    const actionActual = computeChecksum(adr.actionLayer);
    const contextActual = computeChecksum(adr.contextLayer);
    const reasoningActual = computeChecksum(adr.reasoningLayer);
    const counterfactualsActual = computeChecksum(adr.counterfactualsLayer);
    const oversightActual = computeChecksum(adr.oversightLayer);
    const overallActual = computeChecksum(adr);

    const layerChecksums = {
      action: {
        expected: adr.actionLayer.checksum,
        actual: actionActual,
        match: adr.actionLayer.checksum === actionActual,
      },
      context: {
        expected: adr.contextLayer.checksum,
        actual: contextActual,
        match: adr.contextLayer.checksum === contextActual,
      },
      reasoning: {
        expected: adr.reasoningLayer.checksum,
        actual: reasoningActual,
        match: adr.reasoningLayer.checksum === reasoningActual,
      },
      counterfactuals: {
        expected: adr.counterfactualsLayer.checksum,
        actual: counterfactualsActual,
        match: adr.counterfactualsLayer.checksum === counterfactualsActual,
      },
      oversight: {
        expected: adr.oversightLayer.finalChecksum,
        actual: oversightActual,
        match: adr.oversightLayer.finalChecksum === oversightActual,
      },
    };

    const allLayersMatch = Object.values(layerChecksums).every(c => c.match);

    return {
      verified: allLayersMatch && adr.overallChecksum === overallActual,
      checkedAt: new Date(),
      layerChecksums,
      overallChecksum: {
        expected: adr.overallChecksum,
        actual: overallActual,
        match: adr.overallChecksum === overallActual,
      },
    };
  }
}

/**
 * Create an oversight capture instance
 */
export function createOversightCapture(): OversightCapture {
  return new OversightCapture();
}

/**
 * Create an ADR reconstructor instance
 */
export function createADRReconstructor(): ADRReconstructor {
  return new ADRReconstructor();
}