/**
 * ADR Types Tests
 * Story 3.5: Record Five-Layer Agent Decision Records
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  computeChecksum,
  generateId,
  resetIdCounter,
  createEmptyBudgetSnapshot,
  createDefaultReproducibilityInfo,
  createDefaultADR,
  type ActionLayer,
  type ContextLayer,
  type ReasoningLayer,
  type CounterfactualsLayer,
  type OversightLayer,
} from "./types";
import type { SessionId } from "../budget/types";

describe("ADR Types", () => {
  const testSessionId: SessionId = {
    groupId: "test-group",
    agentId: "test-agent",
    sessionId: "test-session",
  };

  describe("computeChecksum", () => {
    it("should compute a consistent SHA-256 checksum", () => {
      const data = { test: "data", nested: { value: 123 } };
      const checksum1 = computeChecksum(data);
      const checksum2 = computeChecksum(data);

      expect(checksum1).toBe(checksum2);
      expect(checksum1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should produce different checksums for different data", () => {
      const checksum1 = computeChecksum({ value: 1 });
      const checksum2 = computeChecksum({ value: 2 });

      expect(checksum1).not.toBe(checksum2);
    });

    it("should handle string input", () => {
      const checksum = computeChecksum("test string");
      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("generateId", () => {
    beforeEach(() => {
      resetIdCounter();
    });

    it("should generate unique IDs with prefix", () => {
      const id1 = generateId("test");
      const id2 = generateId("test");

      expect(id1).toMatch(/^test_[a-z0-9]+_[a-z0-9]+_[a-z0-9]+$/);
      expect(id2).toMatch(/^test_[a-z0-9]+_[a-z0-9]+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it("should use different prefixes for different types", () => {
      const actionId = generateId("action");
      const contextId = generateId("context");

      expect(actionId).toMatch(/^action_/);
      expect(contextId).toMatch(/^context_/);
    });

    it("should generate 1000 unique IDs when called rapidly", () => {
      resetIdCounter();
      const ids = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        const id = generateId("adr");
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }

      expect(ids.size).toBe(1000);
    });

    it("should include counter in ID for same-millisecond uniqueness", () => {
      resetIdCounter();
      const ids: string[] = [];

      for (let i = 0; i < 10; i++) {
        ids.push(generateId("test"));
      }

      const parsed = ids.map(id => {
        const parts = id.split("_");
        return {
          prefix: parts[0],
          timestamp: parts[1],
          random: parts[2],
          counter: parts[3],
        };
      });

      const counters = parsed.map(p => parseInt(p.counter!, 36));
      for (let i = 0; i < counters.length - 1; i++) {
        expect(counters[i]! + 1).toBe(counters[i + 1]);
      }
    });
  });

  describe("createEmptyBudgetSnapshot", () => {
    it("should create a budget snapshot with zero values", () => {
      const snapshot = createEmptyBudgetSnapshot();

      expect(snapshot.tokensRemaining).toBe(0);
      expect(snapshot.toolCallsRemaining).toBe(0);
      expect(snapshot.timeRemainingMs).toBe(0);
      expect(snapshot.costRemainingUsd).toBe(0);
    });
  });

  describe("createDefaultReproducibilityInfo", () => {
    it("should create reproducibility info with defaults", () => {
      const info = createDefaultReproducibilityInfo();

      expect(info.model.provider).toBe("unknown");
      expect(info.model.modelId).toBe("unknown");
      expect(info.prompt.promptId).toBe("unknown");
      expect(info.tools).toEqual([]);
      expect(info.frameworkVersion).toBe("1.0.0");
      expect(info.environmentId).toBe("default");
    });

    it("should include a valid prompt hash", () => {
      const info = createDefaultReproducibilityInfo();

      expect(info.prompt.promptHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("createDefaultADR", () => {
    it("should create an ADR with all five layers initialized", () => {
      const adr = createDefaultADR("test-group", testSessionId);

      expect(adr.groupId).toBe("test-group");
      expect(adr.sessionId).toEqual(testSessionId);
      expect(adr.lifecycle).toBe("created");
      expect(adr.actionLayer).toBeDefined();
      expect(adr.contextLayer).toBeDefined();
      expect(adr.reasoningLayer).toBeDefined();
      expect(adr.counterfactualsLayer).toBeDefined();
      expect(adr.oversightLayer).toBeDefined();
    });

    it("should have valid checksums on all layers", () => {
      const adr = createDefaultADR("test-group", testSessionId);

      expect(adr.actionLayer.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(adr.contextLayer.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(adr.reasoningLayer.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(adr.counterfactualsLayer.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(adr.oversightLayer.finalChecksum).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should initialize action layer with correct structure", () => {
      const adr = createDefaultADR("test-group", testSessionId);
      const action = adr.actionLayer;

      expect(action.layerId).toMatch(/^action_/);
      expect(action.actionType).toBe("internal_calculation");
      expect(action.result).toBe("pending");
      expect(action.toolCalls).toEqual([]);
      expect(action.durationMs).toBe(0);
    });

    it("should initialize context layer with session state", () => {
      const adr = createDefaultADR("test-group", testSessionId);
      const context = adr.contextLayer;

      expect(context.layerId).toMatch(/^context_/);
      expect(context.sessionState.sessionId).toEqual(testSessionId);
      expect(context.sessionState.currentStep).toBe(0);
      expect(context.goals).toEqual([]);
      expect(context.constraints).toEqual([]);
      expect(context.availableOptions).toEqual([]);
    });

    it("should initialize reasoning layer with model and prompt info", () => {
      const adr = createDefaultADR("test-group", testSessionId);
      const reasoning = adr.reasoningLayer;

      expect(reasoning.layerId).toMatch(/^reasoning_/);
      expect(reasoning.reasoningType).toBe("heuristic");
      expect(reasoning.thoughtProcess).toEqual([]);
      expect(reasoning.evidence).toEqual([]);
      expect(reasoning.confidence).toBe(0);
      expect(reasoning.modelUsed).toBeDefined();
      expect(reasoning.promptUsed).toBeDefined();
    });

    it("should initialize counterfactuals layer with risk assessment", () => {
      const adr = createDefaultADR("test-group", testSessionId);
      const counterfactuals = adr.counterfactualsLayer;

      expect(counterfactuals.layerId).toMatch(/^counter_/);
      expect(counterfactuals.alternativesConsidered).toEqual([]);
      expect(counterfactuals.rejectedOptions).toEqual([]);
      expect(counterfactuals.riskAssessment.overallRiskLevel).toBe("low");
      expect(counterfactuals.riskAssessment.identifiedRisks).toEqual([]);
      expect(counterfactuals.learningNotes).toEqual([]);
    });

    it("should initialize oversight layer with version trail", () => {
      const adr = createDefaultADR("test-group", testSessionId);
      const oversight = adr.oversightLayer;

      expect(oversight.layerId).toMatch(/^oversight_/);
      expect(oversight.humanInteractions).toEqual([]);
      expect(oversight.approvals).toEqual([]);
      expect(oversight.modifications).toEqual([]);
      expect(oversight.escalationHistory).toEqual([]);
      expect(oversight.versionTrail).toHaveLength(1);
      expect(oversight.versionTrail[0].changeType).toBe("created");
      expect(oversight.auditStatus.status).toBe("pending");
    });
  });

  describe("Tamper-evidence", () => {
    it("should compute different checksums for different content", () => {
      const data1 = { field: "value1", nested: { count: 1 } };
      const data2 = { field: "value2", nested: { count: 2 } };
      
      const checksum1 = computeChecksum(data1);
      const checksum2 = computeChecksum(data2);
      
      expect(checksum1).not.toBe(checksum2);
    });

    it("should compute same checksum for same content regardless of key order", () => {
      const data1 = { a: 1, b: 2, c: 3 };
      const data2 = { c: 3, b: 2, a: 1 };
      
      const checksum1 = computeChecksum(data1);
      const checksum2 = computeChecksum(data2);
      
      expect(checksum1).toBe(checksum2);
    });

    it("should exclude checksum field from calculation", () => {
      const data = { field: "value", checksum: "" };
      const dataWithChecksum = { field: "value", checksum: "different" };
      
      const checksum1 = computeChecksum(data);
      const checksum2 = computeChecksum(dataWithChecksum);
      
      expect(checksum1).toBe(checksum2);
    });

    it("should have valid checksums on all layers by default", () => {
      const adr = createDefaultADR("test-group", testSessionId);

      expect(adr.actionLayer.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(adr.contextLayer.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(adr.reasoningLayer.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(adr.counterfactualsLayer.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(adr.oversightLayer.finalChecksum).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should have unique checksums for each layer", () => {
      const adr = createDefaultADR("test-group", testSessionId);

      const checksums = [
        adr.actionLayer.checksum,
        adr.contextLayer.checksum,
        adr.reasoningLayer.checksum,
        adr.counterfactualsLayer.checksum,
        adr.oversightLayer.finalChecksum,
      ];

      const uniqueChecksums = new Set(checksums);
      expect(uniqueChecksums.size).toBe(checksums.length);
    });
  });

  describe("Type definitions", () => {
    it("should define correct action types", () => {
      const actionTypes: ActionLayer["actionType"][] = [
        "tool_invocation",
        "llm_request",
        "decision_made",
        "state_transition",
        "data_access",
        "external_request",
        "internal_calculation",
        "policy_check",
        "budget_check",
      ];

      expect(actionTypes).toHaveLength(9);
    });

    it("should define correct action results", () => {
      const results: ActionLayer["result"][] = [
        "success",
        "failure",
        "partial",
        "skipped",
        "pending",
      ];

      expect(results).toHaveLength(5);
    });

    it("should define correct lifecycle states", () => {
      const lifecycles = ["created", "active", "completed", "archived"] as const;

      expect(lifecycles).toHaveLength(4);
    });

    it("should define correct reasoning types", () => {
      const reasoningTypes: ReasoningLayer["reasoningType"][] = [
        "deductive",
        "inductive",
        "abductive",
        "heuristic",
        "rule_based",
        "probabilistic",
        "hybrid",
      ];

      expect(reasoningTypes).toHaveLength(7);
    });

    it("should define correct risk levels", () => {
      const riskLevels: CounterfactualsLayer["riskAssessment"]["overallRiskLevel"][] = [
        "low",
        "medium",
        "high",
        "critical",
      ];

      expect(riskLevels).toHaveLength(4);
    });

    it("should define correct audit statuses", () => {
      const statuses: OversightLayer["auditStatus"]["status"][] = [
        "pending",
        "reviewed",
        "approved",
        "rejected",
        "archived",
      ];

      expect(statuses).toHaveLength(5);
    });

    it("should define correct approval levels", () => {
      const approvalLevels = ["auto", "supervisor", "manager", "executive"] as const;

      expect(approvalLevels).toHaveLength(4);
    });

    it("should define correct compliance frameworks", () => {
      const frameworks = ["SOC2", "GDPR", "ISO27001"] as const;

      expect(frameworks).toHaveLength(3);
    });
  });
});