/**
 * ADR Oversight Tests
 * Story 3.5: Record Five-Layer Agent Decision Records
 * 
 * AC 1: Human oversight trail captured
 * AC 2: Model, prompt, and tool versions recorded for reproducibility
 * AC 3: System can reconstruct decision process from ADR data
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  OversightCapture,
  ADRReconstructor,
  createOversightCapture,
  createADRReconstructor,
} from "./oversight";
import {
  type AgentDecisionRecord,
  computeChecksum,
  generateId,
  createDefaultADR,
} from "./types";
import type { SessionId } from "../budget/types";

describe("ADR Oversight", () => {
  const testSessionId: SessionId = {
    groupId: "test-group",
    agentId: "test-agent",
    sessionId: "test-session",
  };

  describe("OversightCapture", () => {
    let capture: OversightCapture;

    beforeEach(() => {
      capture = createOversightCapture();
    });

    describe("addInteraction", () => {
      it("should record human interactions", () => {
        capture.addInteraction(
          "user-123",
          "reviewer",
          "review",
          "Please check this decision",
          "Looks good",
        );

        const layer = capture.build();

        expect(layer.humanInteractions).toHaveLength(1);
        expect(layer.humanInteractions[0].userId).toBe("user-123");
        expect(layer.humanInteractions[0].userRole).toBe("reviewer");
        expect(layer.humanInteractions[0].interactionType).toBe("review");
        expect(layer.humanInteractions[0].content).toBe("Please check this decision");
        expect(layer.humanInteractions[0].response).toBe("Looks good");
        expect(layer.humanInteractions[0].timestamp).toBeInstanceOf(Date);
      });

      it("should track all interaction types", () => {
        const types = ["review", "approval", "modification", "escalation", "override", "query"] as const;

        for (const type of types) {
          capture.addInteraction("user", "role", type, `${type} interaction`);
        }

        const layer = capture.build();

        expect(layer.humanInteractions).toHaveLength(6);
        for (let i = 0; i < types.length; i++) {
          expect(layer.humanInteractions[i].interactionType).toBe(types[i]);
        }
      });
    });

    describe("addReview", () => {
      it("should record review interactions", () => {
        capture.addReview("reviewer-1", "senior", "Please review this ADR", "Approved");

        const layer = capture.build();

        expect(layer.humanInteractions).toHaveLength(1);
        expect(layer.humanInteractions[0].interactionType).toBe("review");
      });
    });

    describe("addApproval", () => {
      it("should record approvals with levels", () => {
        capture.addApproval("approver-1", "supervisor", ["condition 1", "condition 2"]);

        const layer = capture.build();

        expect(layer.approvals).toHaveLength(1);
        expect(layer.approvals[0].approvedBy).toBe("approver-1");
        expect(layer.approvals[0].approvalLevel).toBe("supervisor");
        expect(layer.approvals[0].conditions).toEqual(["condition 1", "condition 2"]);
        expect(layer.approvals[0].approvedAt).toBeInstanceOf(Date);
      });

      it("should support all approval levels", () => {
        const levels = ["auto", "supervisor", "manager", "executive"] as const;

        for (const level of levels) {
          capture.addApproval("user", level);
        }

        const layer = capture.build();

        expect(layer.approvals).toHaveLength(4);
        for (let i = 0; i < levels.length; i++) {
          expect(layer.approvals[i].approvalLevel).toBe(levels[i]);
        }
      });

      it("should compute checksum for approval integrity", () => {
        capture.addApproval("approver-1", "manager");

        const layer = capture.build();

        expect(layer.approvals[0].checksum).toMatch(/^[a-f0-9]{64}$/);
      });
    });

    describe("addModification", () => {
      it("should record modifications with version trail", () => {
        capture.initializeVersionTrail();
        capture.addModification(
          "modifier-1",
          "parameter",
          { old: "value" },
          { new: "value" },
          "Updated parameter value",
        );

        const layer = capture.build();

        expect(layer.modifications).toHaveLength(1);
        expect(layer.modifications[0].modifiedBy).toBe("modifier-1");
        expect(layer.modifications[0].modificationType).toBe("parameter");
        expect(layer.modifications[0].previousValue).toEqual({ old: "value" });
        expect(layer.modifications[0].newValue).toEqual({ new: "value" });
        expect(layer.modifications[0].reason).toBe("Updated parameter value");
      });

      it("should support all modification types", () => {
        const types = ["parameter", "decision", "constraint", "goal"] as const;

        for (const type of types) {
          capture.addModification("user", type, {}, {}, `Modified ${type}`);
        }

        const layer = capture.build();

        expect(layer.modifications).toHaveLength(4);
        for (let i = 0; i < types.length; i++) {
          expect(layer.modifications[i].modificationType).toBe(types[i]);
        }
      });

      it("should update version trail", () => {
        capture.initializeVersionTrail();
        capture.addModification("user", "parameter", {}, {}, "First change");
        capture.addModification("user", "decision", {}, {}, "Second change");

        const layer = capture.build();

        expect(layer.versionTrail).toHaveLength(3);
        expect(layer.versionTrail[0].changeType).toBe("created");
        expect(layer.versionTrail[1].changeType).toBe("updated");
        expect(layer.versionTrail[2].changeType).toBe("updated");
      });
    });

    describe("addEscalation", () => {
      it("should record escalations", () => {
        capture.addEscalation("engineer", "manager", "Budget exceeded threshold");

        const layer = capture.build();

        expect(layer.escalationHistory).toHaveLength(1);
        expect(layer.escalationHistory[0].escalatedFrom).toBe("engineer");
        expect(layer.escalationHistory[0].escalatedTo).toBe("manager");
        expect(layer.escalationHistory[0].reason).toBe("Budget exceeded threshold");
      });

      it("should resolve escalations", () => {
        const escalation = capture.addEscalation("eng", "mgr", "Needs approval");
        capture.resolveEscalation(escalation.escalationId, "Approved with conditions", "mgr");

        const layer = capture.build();

        expect(layer.escalationHistory[0].resolvedAt).toBeDefined();
        expect(layer.escalationHistory[0].resolution).toBe("Approved with conditions");
      });
    });

    describe("addComplianceFlag", () => {
      it("should add compliance flags for SOC 2, GDPR, ISO 27001", () => {
        capture.addComplianceFlag("SOC2", "CC6.1", "compliant", "Automated test");
        capture.addComplianceFlag("GDPR", "Article 5", "non_compliant", undefined, "Implement data retention");
        capture.addComplianceFlag("ISO27001", "A.9.4.1", "needs_review");

        const layer = capture.build();

        expect(layer.auditStatus.complianceFlags).toHaveLength(3);
        expect(layer.auditStatus.complianceFlags[0].framework).toBe("SOC2");
        expect(layer.auditStatus.complianceFlags[0].requirement).toBe("CC6.1");
        expect(layer.auditStatus.complianceFlags[0].status).toBe("compliant");
        expect(layer.auditStatus.complianceFlags[1].framework).toBe("GDPR");
        expect(layer.auditStatus.complianceFlags[2].framework).toBe("ISO27001");
      });
    });

    describe("setAuditStatus", () => {
      it("should set audit status", () => {
        capture.setAuditStatus("approved", "auditor-1", "Record approved");

        const layer = capture.build();

        expect(layer.auditStatus.status).toBe("approved");
        expect(layer.auditStatus.reviewedBy).toBe("auditor-1");
        expect(layer.auditStatus.notes).toBe("Record approved");
      });

      it("should support all audit statuses", () => {
        const statuses = ["pending", "reviewed", "approved", "rejected", "archived"] as const;

        for (const status of statuses) {
          capture.setAuditStatus(status);
          const layer = capture.build();
          expect(layer.auditStatus.status).toBe(status);
          capture.reset();
        }
      });
    });

    describe("build", () => {
      it("should compute final checksum", () => {
        capture.addApproval("user", "manager");
        const layer = capture.build();

        expect(layer.finalChecksum).toMatch(/^[a-f0-9]{64}$/);
      });

      it("should initialize version trail if not done", () => {
        const layer = capture.build();

        expect(layer.versionTrail).toHaveLength(1);
        expect(layer.versionTrail[0].changeType).toBe("created");
      });

      it("should include all oversight data", () => {
        capture.addInteraction("user", "role", "query", "Question");
        capture.addApproval("approver", "supervisor");
        capture.addModification("mod", "parameter", {}, {}, "Changed");
        capture.addEscalation("from", "to", "reason");
        capture.addComplianceFlag("SOC2", "req", "compliant");
        capture.setAuditStatus("approved", "auditor");

        const layer = capture.build();

        expect(layer.humanInteractions).toHaveLength(1);
        expect(layer.approvals).toHaveLength(1);
        expect(layer.modifications).toHaveLength(1);
        expect(layer.escalationHistory).toHaveLength(1);
        expect(layer.auditStatus.complianceFlags).toHaveLength(1);
        expect(layer.auditStatus.status).toBe("approved");
      });
    });

    describe("reset", () => {
      it("should clear all recorded data", () => {
        capture.addInteraction("user", "role", "query", "?");
        capture.addApproval("approver", "manager");
        capture.reset();

        const layer = capture.build();

        expect(layer.humanInteractions).toHaveLength(0);
        expect(layer.approvals).toHaveLength(0);
        expect(layer.auditStatus.status).toBe("pending");
      });
    });
  });

  describe("ADRReconstructor", () => {
    let reconstructor: ADRReconstructor;
    let testADR: AgentDecisionRecord;

    beforeEach(() => {
      reconstructor = createADRReconstructor();
      const defaultADR = createDefaultADR("test-group", testSessionId);
      
      testADR = {
        ...defaultADR,
        adrId: generateId("adr"),
        overallChecksum: "",
      };
      
      testADR.actionLayer = {
        ...testADR.actionLayer,
        actionType: "tool_invocation",
        inputs: { query: "test" },
        outputs: { results: ["a", "b"] },
        result: "success",
        durationMs: 150,
        toolCalls: [{
          toolId: "tool-1",
          toolName: "search",
          input: { q: "test" },
          output: { hits: 10 },
          success: true,
          timestamp: new Date(),
          durationMs: 100,
        }],
      };
      testADR.actionLayer.checksum = computeChecksum(testADR.actionLayer);

      testADR.contextLayer.selectedOption = "option-1";
      testADR.contextLayer.checksum = computeChecksum(testADR.contextLayer);

      testADR.reasoningLayer.thoughtProcess = [
        {
          stepId: generateId("thought"),
          stepNumber: 1,
          thought: "Analyze input",
          reasoning: "Need to understand the request",
          timestamp: new Date(),
        },
      ];
      testADR.reasoningLayer.evidence = [
        {
          evidenceId: generateId("evidence"),
          type: "data",
          source: "database",
          content: { records: 100 },
          reliability: 1.0,
          timestamp: new Date(),
        },
      ];
      testADR.reasoningLayer.confidence = 0.95;
      testADR.reasoningLayer.checksum = computeChecksum(testADR.reasoningLayer);

      testADR.counterfactualsLayer.alternativesConsidered = [
        {
          alternativeId: generateId("alt"),
          description: "Option A",
          estimatedOutcome: "Good result",
          estimatedCost: 10,
          estimatedDuration: 1000,
          evaluationScore: 0.9,
          ranking: 1,
          consideredAt: new Date(),
        },
      ];
      testADR.counterfactualsLayer.rejectedOptions = [
        {
          optionId: generateId("rej"),
          description: "Option B",
          rejectionReason: "Too expensive",
          rejectionCriteria: ["cost"],
          rejectedAt: new Date(),
          wouldHaveBeenViable: false,
        },
      ];
      testADR.counterfactualsLayer.checksum = computeChecksum(testADR.counterfactualsLayer);

      testADR.oversightLayer.approvals = [
        {
          approvalId: generateId("approval"),
          approvedBy: "manager-1",
          approvalLevel: "manager",
          approvedAt: new Date(),
          conditions: ["Complete documentation"],
          checksum: "",
        },
      ];
      testADR.oversightLayer.approvals[0].checksum = computeChecksum(testADR.oversightLayer.approvals[0]);
      testADR.oversightLayer.modifications = [
        {
          modificationId: generateId("mod"),
          modifiedBy: "engineer-1",
          modifiedAt: new Date(),
          modificationType: "parameter",
          previousValue: { threshold: 10 },
          newValue: { threshold: 15 },
          reason: "Adjusted threshold",
          checksum: "",
        },
      ];
      testADR.oversightLayer.modifications[0].checksum = computeChecksum(testADR.oversightLayer.modifications[0]);
      testADR.oversightLayer.auditStatus.status = "approved";
      testADR.oversightLayer.auditStatus.reviewedBy = "auditor-1";
      testADR.oversightLayer.finalChecksum = computeChecksum(testADR.oversightLayer);

      testADR.overallChecksum = computeChecksum(testADR);
    });

    describe("reconstructDecisionProcess (AC3)", () => {
      it("should reconstruct decision timeline from ADR", () => {
        const reconstruction = reconstructor.reconstructDecisionProcess(testADR);

        expect(reconstruction.adrId).toBe(testADR.adrId);
        expect(reconstruction.decisionTimeline.length).toBeGreaterThan(0);
      });

      it("should include all five layers in decision timeline", () => {
        const reconstruction = reconstructor.reconstructDecisionProcess(testADR);

        const layers = reconstruction.decisionTimeline.map(e => e.layer);
        const uniqueLayers = [...new Set(layers)];

        expect(uniqueLayers).toContain("action");
        expect(uniqueLayers).toContain("context");
        expect(uniqueLayers).toContain("reasoning");
        expect(uniqueLayers).toContain("counterfactuals");
        expect(uniqueLayers).toContain("oversight");
      });

      it("should build evidence chain from reasoning layer", () => {
        const reconstruction = reconstructor.reconstructDecisionProcess(testADR);

        expect(reconstruction.evidenceChain).toHaveLength(1);
        expect(reconstruction.evidenceChain[0].type).toBe("data");
        expect(reconstruction.evidenceChain[0].source).toBe("database");
      });

      it("should build human oversight summary", () => {
        const reconstruction = reconstructor.reconstructDecisionProcess(testADR);

        expect(reconstruction.humanOversightSummary.totalInteractions).toBe(0);
        expect(reconstruction.humanOversightSummary.totalApprovals).toBe(1);
        expect(reconstruction.humanOversightSummary.totalModifications).toBe(1);
        expect(reconstruction.humanOversightSummary.totalEscalations).toBe(0);
        expect(reconstruction.humanOversightSummary.finalApprovalLevel).toBe("manager");
        expect(reconstruction.humanOversightSummary.auditStatus).toBe("approved");
      });

      it("should verify compliance for SOC 2, GDPR, ISO 27001", () => {
        const reconstruction = reconstructor.reconstructDecisionProcess(testADR);

        expect(reconstruction.complianceVerification.frameworks.SOC2).toBeDefined();
        expect(reconstruction.complianceVerification.frameworks.GDPR).toBeDefined();
        expect(reconstruction.complianceVerification.frameworks.ISO27001).toBeDefined();
        expect(reconstruction.complianceVerification.overallCompliant).toBeDefined();
      });

      it("should verify tamper integrity (AC3)", () => {
        const reconstruction = reconstructor.reconstructDecisionProcess(testADR);

        expect(reconstruction.tamperIntegrity.verified).toBe(true);
        expect(reconstruction.tamperIntegrity.checkedAt).toBeInstanceOf(Date);
        expect(reconstruction.tamperIntegrity.layerChecksums.action.match).toBe(true);
        expect(reconstruction.tamperIntegrity.layerChecksums.context.match).toBe(true);
        expect(reconstruction.tamperIntegrity.layerChecksums.reasoning.match).toBe(true);
        expect(reconstruction.tamperIntegrity.layerChecksums.counterfactuals.match).toBe(true);
        expect(reconstruction.tamperIntegrity.layerChecksums.oversight.match).toBe(true);
        expect(reconstruction.tamperIntegrity.overallChecksum.match).toBe(true);
      });

      it("should detect tampering", () => {
        testADR.actionLayer.inputs = { modified: true };
        const reconstruction = reconstructor.reconstructDecisionProcess(testADR);

        expect(reconstruction.tamperIntegrity.verified).toBe(false);
        expect(reconstruction.tamperIntegrity.layerChecksums.action.match).toBe(false);
      });

      it("should include compliance issues when present", () => {
        testADR.oversightLayer.auditStatus.complianceFlags = [
          {
            framework: "GDPR",
            requirement: "Article 5",
            status: "non_compliant",
            remediation: "Implement data retention policy",
          },
        ];
        testADR.oversightLayer.finalChecksum = computeChecksum(testADR.oversightLayer);
        testADR.overallChecksum = computeChecksum(testADR);

        const reconstruction = reconstructor.reconstructDecisionProcess(testADR);

        expect(reconstruction.complianceVerification.overallCompliant).toBe(false);
        expect(reconstruction.complianceVerification.issues).toHaveLength(1);
        expect(reconstruction.complianceVerification.issues[0].framework).toBe("GDPR");
        expect(reconstruction.complianceVerification.issues[0].severity).toBe("high");
      });

      it("should calculate compliance percentages", () => {
        testADR.oversightLayer.auditStatus.complianceFlags = [
          { framework: "SOC2", requirement: "1", status: "compliant" },
          { framework: "SOC2", requirement: "2", status: "compliant" },
          { framework: "SOC2", requirement: "3", status: "non_compliant" },
        ];
        testADR.oversightLayer.finalChecksum = computeChecksum(testADR.oversightLayer);
        testADR.overallChecksum = computeChecksum(testADR);

        const reconstruction = reconstructor.reconstructDecisionProcess(testADR);

        expect(reconstruction.complianceVerification.frameworks.SOC2.requirementsMet).toBe(2);
        expect(reconstruction.complianceVerification.frameworks.SOC2.requirementsTotal).toBe(3);
        expect(reconstruction.complianceVerification.frameworks.SOC2.gaps).toContain("3");
      });
    });
  });
});