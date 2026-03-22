/**
 * ADR Reasoning Tests
 * Story 3.5: Record Five-Layer Agent Decision Records
 * 
 * AC 1: Reasoning chain and counterfactuals captured
 * AC 2: Model, prompt, and tool versions recorded for reproducibility
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ReasoningCapture,
  CounterfactualsCapture,
  ReasoningManager,
  createReasoningCapture,
  createCounterfactualsCapture,
  createReasoningManager,
} from "./reasoning";
import type { ModelVersion, PromptVersion } from "./types";

describe("ADR Reasoning", () => {
  describe("ReasoningCapture", () => {
    let capture: ReasoningCapture;

    beforeEach(() => {
      capture = createReasoningCapture();
    });

    describe("setReasoningType", () => {
      it("should set the reasoning type", () => {
        capture.setReasoningType("deductive");
        const layer = capture.build();
        expect(layer.reasoningType).toBe("deductive");
      });

      it("should accept all reasoning types", () => {
        const types = ["deductive", "inductive", "abductive", "heuristic", "rule_based", "probabilistic", "hybrid"] as const;

        for (const type of types) {
          capture.setReasoningType(type);
          const layer = capture.build();
          expect(layer.reasoningType).toBe(type);
        }
      });
    });

    describe("setModel", () => {
      it("should set the model used for reproducibility", () => {
        const model: ModelVersion = {
          provider: "openai",
          modelId: "gpt-4-turbo",
          modelVersion: "2024-01-01",
          apiVersion: "v1",
        };

        capture.setModel(model);
        const layer = capture.build();

        expect(layer.modelUsed.provider).toBe("openai");
        expect(layer.modelUsed.modelId).toBe("gpt-4-turbo");
        expect(layer.modelUsed.modelVersion).toBe("2024-01-01");
        expect(layer.modelUsed.apiVersion).toBe("v1");
      });
    });

    describe("setPrompt", () => {
      it("should set the prompt used for reproducibility", () => {
        const prompt: PromptVersion = {
          promptId: "prompt-123",
          promptVersion: "2.0.0",
          promptHash: "abc123def456",
          templateVariables: { temperature: 0.7 },
        };

        capture.setPrompt(prompt);
        const layer = capture.build();

        expect(layer.promptUsed.promptId).toBe("prompt-123");
        expect(layer.promptUsed.promptVersion).toBe("2.0.0");
        expect(layer.promptUsed.promptHash).toBe("abc123def456");
        expect(layer.promptUsed.templateVariables).toEqual({ temperature: 0.7 });
      });
    });

    describe("setRawModelOutput", () => {
      it("should store raw model output for reproducibility", () => {
        const rawOutput = '{"choices":[{"message":{"content":"response"}}]}';

        capture.setRawModelOutput(rawOutput);
        const layer = capture.build();

        expect(layer.rawModelOutput).toBe(rawOutput);
      });
    });

    describe("setParsedOutput", () => {
      it("should store parsed output", () => {
        const parsed = { decision: "proceed", confidence: 0.95 };

        capture.setParsedOutput(parsed);
        const layer = capture.build();

        expect(layer.parsedOutput).toEqual(parsed);
      });
    });

    describe("setConfidence", () => {
      it("should set confidence between 0 and 1", () => {
        capture.setConfidence(0.75);
        const layer = capture.build();
        expect(layer.confidence).toBe(0.75);
      });

      it("should clamp confidence to valid range", () => {
        capture.setConfidence(1.5);
        let layer = capture.build();
        expect(layer.confidence).toBe(1);

        capture.reset();
        capture.setConfidence(-0.5);
        layer = capture.build();
        expect(layer.confidence).toBe(0);
      });
    });

    describe("addThoughtStep", () => {
      it("should add thought steps to the reasoning chain", () => {
        capture.addThoughtStep("First thought: analyze input", "The input needs analysis");
        capture.addThoughtStep("Second thought: evaluate options", "Consider all options", ["thought_0"]);

        const layer = capture.build();

        expect(layer.thoughtProcess).toHaveLength(2);
        expect(layer.thoughtProcess[0].thought).toBe("First thought: analyze input");
        expect(layer.thoughtProcess[0].stepNumber).toBe(1);
        expect(layer.thoughtProcess[1].dependencies).toEqual(["thought_0"]);
        expect(layer.thoughtProcess[1].stepNumber).toBe(2);
      });

      it("should auto-increment step numbers", () => {
        for (let i = 0; i < 5; i++) {
          capture.addThoughtStep(`Thought ${i + 1}`);
        }

        const layer = capture.build();

        for (let i = 0; i < 5; i++) {
          expect(layer.thoughtProcess[i].stepNumber).toBe(i + 1);
        }
      });

      it("should include timestamps", () => {
        capture.addThoughtStep("Test thought");
        const layer = capture.build();

        expect(layer.thoughtProcess[0].timestamp).toBeInstanceOf(Date);
      });
    });

    describe("addEvidence", () => {
      it("should add evidence of various types", () => {
        capture.addObservation("sensor-1", { reading: 42 }, 0.95);
        capture.addData("database", { records: 100 }, 1.0);
        capture.addRule("policy-A", { maxTokens: 1000 }, 1.0);
        capture.addHeuristic("pattern-match", { confidence: 0.8 }, 0.75);
        capture.addExternal("api-call", { result: "success" }, 0.9);

        const layer = capture.build();

        expect(layer.evidence).toHaveLength(5);
        expect(layer.evidence[0].type).toBe("observation");
        expect(layer.evidence[0].reliability).toBe(0.95);
        expect(layer.evidence[1].type).toBe("data");
        expect(layer.evidence[2].type).toBe("rule");
        expect(layer.evidence[3].type).toBe("heuristic");
        expect(layer.evidence[4].type).toBe("external");
      });

      it("should include evidence metadata", () => {
        capture.addEvidence("data", "source-123", { key: "value" }, 0.85);

        const layer = capture.build();

        expect(layer.evidence[0].evidenceId).toMatch(/^evidence_/);
        expect(layer.evidence[0].source).toBe("source-123");
        expect(layer.evidence[0].content).toEqual({ key: "value" });
        expect(layer.evidence[0].timestamp).toBeInstanceOf(Date);
      });
    });

    describe("build", () => {
      it("should compute checksum for the layer", () => {
        capture.addThoughtStep("Test thought");
        const layer = capture.build();

        expect(layer.checksum).toMatch(/^[a-f0-9]{64}$/);
      });

      it("should include all data in the layer", () => {
        capture.setReasoningType("deductive");
        capture.setConfidence(0.9);
        capture.addThoughtStep("Thought");
        capture.addEvidence("data", "source", {}, 1.0);

        const layer = capture.build();

        expect(layer.layerId).toMatch(/^reasoning_/);
        expect(layer.timestamp).toBeInstanceOf(Date);
        expect(layer.reasoningType).toBe("deductive");
        expect(layer.confidence).toBe(0.9);
        expect(layer.thoughtProcess).toHaveLength(1);
        expect(layer.evidence).toHaveLength(1);
      });
    });

    describe("reset", () => {
      it("should clear all recorded data", () => {
        capture.addThoughtStep("Thought");
        capture.addEvidence("data", "source", {}, 1.0);
        capture.reset();

        const layer = capture.build();

        expect(layer.thoughtProcess).toHaveLength(0);
        expect(layer.evidence).toHaveLength(0);
        expect(layer.confidence).toBe(0);
      });
    });
  });

  describe("CounterfactualsCapture", () => {
    let capture: CounterfactualsCapture;

    beforeEach(() => {
      capture = createCounterfactualsCapture();
    });

    describe("addAlternative", () => {
      it("should add considered alternatives", () => {
        capture.addAlternative(
          "Use approach A",
          "Expected 90% success rate",
          10,
          1000,
          0.85,
          1,
        );

        const layer = capture.build();

        expect(layer.alternativesConsidered).toHaveLength(1);
        expect(layer.alternativesConsidered[0].description).toBe("Use approach A");
        expect(layer.alternativesConsidered[0].estimatedOutcome).toBe("Expected 90% success rate");
        expect(layer.alternativesConsidered[0].evaluationScore).toBe(0.85);
        expect(layer.alternativesConsidered[0].ranking).toBe(1);
        expect(layer.alternativesConsidered[0].consideredAt).toBeInstanceOf(Date);
      });

      it("should track multiple alternatives", () => {
        capture.addAlternative("Approach A", "Outcome A", 10, 1000, 0.9, 1);
        capture.addAlternative("Approach B", "Outcome B", 5, 2000, 0.7, 2);
        capture.addAlternative("Approach C", "Outcome C", 15, 500, 0.95, 0);

        const layer = capture.build();

        expect(layer.alternativesConsidered).toHaveLength(3);
        expect(layer.alternativesConsidered.map(a => a.ranking)).toEqual([1, 2, 0]);
      });
    });

    describe("addRejectedOption", () => {
      it("should record rejected options with reasons", () => {
        capture.addRejectedOption(
          "Expensive approach",
          "Cost exceeds budget constraints",
          ["budget_limit", "roi_requirement"],
          true,
        );

        const layer = capture.build();

        expect(layer.rejectedOptions).toHaveLength(1);
        expect(layer.rejectedOptions[0].description).toBe("Expensive approach");
        expect(layer.rejectedOptions[0].rejectionReason).toBe("Cost exceeds budget constraints");
        expect(layer.rejectedOptions[0].rejectionCriteria).toEqual(["budget_limit", "roi_requirement"]);
        expect(layer.rejectedOptions[0].wouldHaveBeenViable).toBe(true);
      });
    });

    describe("addRisk", () => {
      it("should add risks to assessment", () => {
        capture.addRisk("Data breach", 0.3, 5, "security");
        capture.addRisk("Budget overrun", 0.5, 3, "financial");

        const layer = capture.build();

        expect(layer.riskAssessment.identifiedRisks).toHaveLength(2);
        expect(layer.riskAssessment.identifiedRisks[0].description).toBe("Data breach");
        expect(layer.riskAssessment.identifiedRisks[0].probability).toBe(0.3);
        expect(layer.riskAssessment.identifiedRisks[0].impact).toBe(5);
        expect(layer.riskAssessment.identifiedRisks[0].category).toBe("security");
      });

      it("should update overall risk level based on risks", () => {
        capture.addRisk("High risk", 0.8, 4, "security");
        let layer = capture.build();
        expect(layer.riskAssessment.overallRiskLevel).toBe("critical");

        capture.reset();
        capture.addRisk("Medium risk", 0.3, 2, "operational");
        layer = capture.build();
        expect(layer.riskAssessment.overallRiskLevel).toBe("medium");

        capture.reset();
        capture.addRisk("Low risk", 0.1, 1, "compliance");
        layer = capture.build();
        expect(layer.riskAssessment.overallRiskLevel).toBe("low");
      });

      it("should clamp probability and impact values", () => {
        capture.addRisk("Test risk", 1.5, 6, "security");
        const layer = capture.build();

        expect(layer.riskAssessment.identifiedRisks[0].probability).toBe(1);
        expect(layer.riskAssessment.identifiedRisks[0].impact).toBe(5);
      });
    });

    describe("addMitigation", () => {
      it("should add mitigation strategies for risks", () => {
        const risk = capture.addRisk("Security breach", 0.3, 4, "security");
        capture.addMitigation(risk.riskId, "Implement encryption", 0.8, true);

        const layer = capture.build();

        expect(layer.riskAssessment.mitigationStrategies).toHaveLength(1);
        expect(layer.riskAssessment.mitigationStrategies[0].description).toBe("Implement encryption");
        expect(layer.riskAssessment.mitigationStrategies[0].effectiveness).toBe(0.8);
        expect(layer.riskAssessment.mitigationStrategies[0].implemented).toBe(true);
      });
    });

    describe("addLearningNote", () => {
      it("should add learning notes", () => {
        capture.addLearningNote("Alternative approaches should be evaluated earlier");
        capture.addLearningNote("Budget constraints are hard limits");

        const layer = capture.build();

        expect(layer.learningNotes).toBeDefined();
        expect(layer.learningNotes!).toHaveLength(2);
        expect(layer.learningNotes![0]).toBe("Alternative approaches should be evaluated earlier");
      });
    });

    describe("build", () => {
      it("should compute checksum for the layer", () => {
        capture.addAlternative("Test", "Outcome", 0, 0, 1.0, 1);
        const layer = capture.build();

        expect(layer.checksum).toMatch(/^[a-f0-9]{64}$/);
      });

      it("should include all data in the layer", () => {
        capture.addAlternative("Alt", "Outcome", 10, 100, 0.9, 1);
        capture.addRejectedOption("Bad", "Too risky", [], false);
        capture.addRisk("Risk", 0.5, 3, "operational");
        capture.addLearningNote("Lesson learned");

        const layer = capture.build();

        expect(layer.layerId).toMatch(/^counter_/);
        expect(layer.alternativesConsidered).toHaveLength(1);
        expect(layer.rejectedOptions).toHaveLength(1);
        expect(layer.riskAssessment.identifiedRisks).toHaveLength(1);
        expect(layer.learningNotes).toHaveLength(1);
      });
    });

    describe("reset", () => {
      it("should clear all recorded data", () => {
        capture.addAlternative("Alt", "Outcome", 0, 0, 1.0, 1);
        capture.addRisk("Risk", 0.5, 3, "security");
        capture.reset();

        const layer = capture.build();

        expect(layer.alternativesConsidered).toHaveLength(0);
        expect(layer.riskAssessment.identifiedRisks).toHaveLength(0);
        expect(layer.riskAssessment.overallRiskLevel).toBe("low");
        expect(layer.riskAssessment.residualRisk).toBe(0);
      });
    });
  });

  describe("ReasoningManager", () => {
    let manager: ReasoningManager;
    const testModel: ModelVersion = {
      provider: "anthropic",
      modelId: "claude-3",
      modelVersion: "1.0.0",
    };
    const testPrompt: PromptVersion = {
      promptId: "prompt-001",
      promptVersion: "1.0.0",
      promptHash: "hash123",
    };

    beforeEach(() => {
      manager = createReasoningManager(testModel, testPrompt);
    });

    it("should coordinate reasoning and counterfactuals capture", () => {
      manager.addThought("Analyze input", "Input needs analysis", []);
      manager.addEvidence("data", "source", { value: 42 }, 1.0);
      manager.setConfidence(0.85);

      manager.addAlternative("Option A", "Good outcome", 10, 100, 0.9, 1);
      manager.rejectOption("Option B", "Too expensive", ["cost"], false);
      manager.addRisk("Budget Risk", 0.5, 3, "financial");

      const reasoningLayer = manager.buildReasoningLayer();
      const counterfactualsLayer = manager.buildCounterfactualsLayer();

      expect(reasoningLayer.thoughtProcess).toHaveLength(1);
      expect(reasoningLayer.evidence).toHaveLength(1);
      expect(reasoningLayer.confidence).toBe(0.85);
      expect(reasoningLayer.modelUsed.modelId).toBe("claude-3");

      expect(counterfactualsLayer.alternativesConsidered).toHaveLength(1);
      expect(counterfactualsLayer.rejectedOptions).toHaveLength(1);
      expect(counterfactualsLayer.riskAssessment.identifiedRisks).toHaveLength(1);
    });

    it("should allow setting raw model output for reproducibility", () => {
      manager.setModelOutput('{"result": "success"}', { result: "success" });

      const reasoningLayer = manager.buildReasoningLayer();

      expect(reasoningLayer.rawModelOutput).toBe('{"result": "success"}');
      expect(reasoningLayer.parsedOutput).toEqual({ result: "success" });
    });

    it("should reset both captures", () => {
      manager.addThought("Thought");
      manager.addAlternative("Alt", "Outcome", 0, 0, 1.0, 1);
      manager.reset();

      const reasoningLayer = manager.buildReasoningLayer();
      const counterfactualsLayer = manager.buildCounterfactualsLayer();

      expect(reasoningLayer.thoughtProcess).toHaveLength(0);
      expect(counterfactualsLayer.alternativesConsidered).toHaveLength(0);
    });

    it("should provide access to underlying captures", () => {
      const reasoningCapture = manager.getReasoningCapture();
      const counterfactualsCapture = manager.getCounterfactualsCapture();

      expect(reasoningCapture).toBeInstanceOf(ReasoningCapture);
      expect(counterfactualsCapture).toBeInstanceOf(CounterfactualsCapture);
    });
  });
});