/**
 * Notion Templates Tests
 * Story 2.5: Synchronize Best Designs to the Notion Registry
 */

import { describe, it, expect } from "vitest";
import {
  buildDesignPageTemplate,
  buildMinimalPageTemplate,
  buildDesignPageProperties,
  buildDesignPageBlocks,
  generateDesignSummary,
  generateHowToRunGuide,
  type AgentDesignSummary,
} from "./templates";
import type { EvaluationMetrics } from "../adas/types";

describe("Notion Templates", () => {
  const createMockDesign = (overrides?: Partial<AgentDesignSummary>): AgentDesignSummary => {
    const metrics: EvaluationMetrics = {
      accuracy: 0.85,
      cost: 0.0025,
      latency: 1500,
      composite: 0.82,
      tokens: {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        promptCost: 0.0015,
        completionCost: 0.001,
      },
      details: {
        testCasesExecuted: 10,
        testCasesPassed: 8,
        errors: [],
        warnings: [],
      },
    };

    return {
      designId: "design-123",
      name: "Test Agent Design",
      version: 1,
      domain: "code-assistant",
      description: "A test agent design for code assistance",
      score: 0.85,
      metrics,
      status: "approved",
      groupId: "group-456",
      createdAt: new Date("2024-01-15T10:00:00Z"),
      updatedAt: new Date("2024-01-15T12:00:00Z"),
      evidenceRef: "events:12345",
      adasRunId: "run-789",
      config: {
        systemPrompt: "You are a helpful code assistant.",
        model: {
          provider: "openai",
          modelId: "gpt-4",
          temperature: 0.7,
        },
        tools: [
          { name: "search", description: "Search for code" },
        ],
      },
      ...overrides,
    };
  };

  describe("generateDesignSummary", () => {
    it("should generate summary with basic info", () => {
      const design = createMockDesign();
      const summary = generateDesignSummary(design);

      expect(summary).toContain("Test Agent Design");
      expect(summary).toContain("code-assistant");
      expect(summary).toContain("85.00%");
    });

    it("should include configuration details", () => {
      const design = createMockDesign();
      const summary = generateDesignSummary(design);

      expect(summary).toContain("Configuration");
      expect(summary).toContain("System Prompt");
    });

    it("should handle design without config", () => {
      const design = createMockDesign({ config: {} });
      const summary = generateDesignSummary(design);

      expect(summary).toBeDefined();
    });

    it("should handle design without description", () => {
      const design = createMockDesign({ description: "" });
      const summary = generateDesignSummary(design);

      expect(summary).toContain("No description available");
    });
  });

  describe("generateHowToRunGuide", () => {
    it("should generate guide with prerequisites", () => {
      const design = createMockDesign();
      const guide = generateHowToRunGuide(design);

      expect(guide.prerequisites).toHaveLength(3);
      expect(guide.prerequisites).toContain("Access to the agent platform");
    });

    it("should include setup steps", () => {
      const design = createMockDesign();
      const guide = generateHowToRunGuide(design);

      expect(guide.setupSteps.length).toBeGreaterThan(0);
    });

    it("should include usage instructions", () => {
      const design = createMockDesign();
      const guide = generateHowToRunGuide(design);

      expect(guide.usageInstructions).toContain("Load the design configuration");
    });

    it("should generate code example", () => {
      const design = createMockDesign();
      const guide = generateHowToRunGuide(design);

      expect(guide.examples.join("\n")).toContain("initializeAgent");
      expect(guide.examples.join("\n")).toContain("design-123");
    });

    it("should handle design with tools", () => {
      const design = createMockDesign({
        config: {
          tools: [
            { name: "read_file", description: "Read file" },
            { name: "write_file", description: "Write file" },
          ],
        },
      });
      const guide = generateHowToRunGuide(design);

      const usageText = guide.usageInstructions.join(" ");
      expect(usageText).toContain("read_file, write_file");
    });
  });

  describe("buildDesignPageProperties", () => {
    it("should create properties with title", () => {
      const design = createMockDesign();
      const properties = buildDesignPageProperties(design);

      expect(properties.Title).toBeDefined();
      expect(properties.Title[0].title.text.content).toBe("Test Agent Design (v1)");
    });

    it("should create properties with design metadata", () => {
      const design = createMockDesign();
      const properties = buildDesignPageProperties(design);

      expect(properties.Design_ID).toBeDefined();
      expect(properties.Domain).toBeDefined();
      expect(properties.Score).toBeDefined();
      expect(properties.Status).toBeDefined();
    });

    it("should include evidence reference when available", () => {
      const design = createMockDesign();
      const properties = buildDesignPageProperties(design);

      expect(properties.Evidence_Ref).toBeDefined();
    });

    it("should handle design without evidence reference", () => {
      const design = createMockDesign({ evidenceRef: null });
      const properties = buildDesignPageProperties(design);

      expect(properties.Evidence_Ref).toBeUndefined();
    });

    it("should include metrics as JSON", () => {
      const design = createMockDesign();
      const properties = buildDesignPageProperties(design);

      expect(properties.Metrics_JSON).toBeDefined();
      const metricsContent = properties.Metrics_JSON?.rich_text?.[0]?.text?.content;
      expect(metricsContent).toBeDefined();
      expect(() => JSON.parse(metricsContent!)).not.toThrow();
    });
  });

  describe("buildDesignPageBlocks", () => {
    it("should create blocks with overview section", () => {
      const design = createMockDesign();
      const blocks = buildDesignPageBlocks(design, null);

      const hasOverview = blocks.some(
        (b) => "heading_1" in b && JSON.stringify(b).includes("Overview")
      );
      expect(hasOverview).toBe(true);
    });

    it("should create blocks with description section", () => {
      const design = createMockDesign();
      const blocks = buildDesignPageBlocks(design, null);

      const hasDescription = blocks.some(
        (b) => "heading_1" in b && JSON.stringify(b).includes("Description")
      );
      expect(hasDescription).toBe(true);
    });

    it("should create blocks with metrics section", () => {
      const design = createMockDesign();
      const blocks = buildDesignPageBlocks(design, null);

      const hasMetrics = blocks.some(
        (b) => "heading_1" in b && JSON.stringify(b).includes("Evaluation Metrics")
      );
      expect(hasMetrics).toBe(true);
    });

    it("should create blocks with how to run section", () => {
      const design = createMockDesign();
      const blocks = buildDesignPageBlocks(design, null);

      const hasHowToRun = blocks.some(
        (b) => "heading_1" in b && JSON.stringify(b).includes("How to Run")
      );
      expect(hasHowToRun).toBe(true);
    });

    it("should create blocks with evidence reference", () => {
      const design = createMockDesign();
      const blocks = buildDesignPageBlocks(design, "http://example.com/evidence/123");

      const hasEvidence = blocks.some(
        (b) => "heading_1" in b && JSON.stringify(b).includes("Evidence Reference")
      );
      expect(hasEvidence).toBe(true);
    });

    it("should handle design without evidence URL", () => {
      const design = createMockDesign({ evidenceRef: null });
      const blocks = buildDesignPageBlocks(design, null);

      const hasEvidenceSection = blocks.some(
        (b) => "heading_1" in b && JSON.stringify(b).includes("Evidence Reference")
      );
      expect(hasEvidenceSection).toBe(true);
    });

    it("should include callout with sync timestamp", () => {
      const design = createMockDesign();
      const blocks = buildDesignPageBlocks(design, null);

      const hasCallout = blocks.some(
        (b) => "callout" in b && JSON.stringify(b).includes("Synced at")
      );
      expect(hasCallout).toBe(true);
    });
  });

  describe("buildDesignPageTemplate", () => {
    it("should create complete template with all properties", () => {
      const design = createMockDesign();
      const template = buildDesignPageTemplate(design, "neo4j-123", "http://example.com/evidence");

      expect(template.properties).toBeDefined();
      expect(template.blocks).toBeDefined();
      expect(template.metadata).toBeDefined();
      expect(template.metadata.designId).toBe("design-123");
      expect(template.metadata.neo4jId).toBe("neo4j-123");
    });

    it("should work without evidence URL", () => {
      const design = createMockDesign();
      const template = buildDesignPageTemplate(design, "neo4j-123", null);

      expect(template.metadata.designId).toBe("design-123");
    });

    it("should include synced timestamp", () => {
      const design = createMockDesign();
      const template = buildDesignPageTemplate(design, "neo4j-123", null);

      expect(template.metadata.syncedAt).toBeInstanceOf(Date);
    });
  });

  describe("buildMinimalPageTemplate", () => {
    it("should create minimal template with properties only", () => {
      const design = createMockDesign();
      const template = buildMinimalPageTemplate(design, "neo4j-123");

      expect(template.properties).toBeDefined();
      expect(template.blocks).toHaveLength(0);
      expect(template.metadata.designId).toBe("design-123");
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long descriptions", () => {
      const longDescription = "A".repeat(10000);
      const design = createMockDesign({ description: longDescription });
      const summary = generateDesignSummary(design);

      expect(summary).toContain("A");
    });

    it("should handle special characters in names", () => {
      const design = createMockDesign({
        name: "Test Design: Special <Characters> & \"Quotes\"",
      });
      const properties = buildDesignPageProperties(design);

      expect(properties.Title[0].title.text.content).toBe(
        'Test Design: Special <Characters> & "Quotes" (v1)'
      );
    });

    it("should handle metrics with missing fields", () => {
      const metrics: EvaluationMetrics = {
        accuracy: 0.9,
        cost: 0.01,
        latency: 2000,
        composite: 0.88,
      };

      const design = createMockDesign({ metrics });
      const blocks = buildDesignPageBlocks(design, null);

      expect(blocks).toBeDefined();
      expect(blocks.length).toBeGreaterThan(0);
    });

    it("should handle errors in details", () => {
      const metrics: EvaluationMetrics = {
        accuracy: 0.7,
        cost: 0.05,
        latency: 3000,
        composite: 0.65,
        details: {
          testCasesExecuted: 10,
          testCasesPassed: 5,
          errors: ["Error 1", "Error 2"],
          warnings: ["Warning 1"],
        },
      };

      const design = createMockDesign({ metrics });
      const blocks = buildDesignPageBlocks(design, null);

      const blocksStr = JSON.stringify(blocks);
      expect(blocksStr).toContain("Error 1");
    });

    it("should handle empty config", () => {
      const design = createMockDesign({ config: {} });
      const summary = generateDesignSummary(design);

      expect(summary).toBeDefined();
    });

    it("should handle config with no model", () => {
      const design = createMockDesign({
        config: { systemPrompt: "Test" },
      });
      const guide = generateHowToRunGuide(design);

      expect(guide.setupSteps).toBeDefined();
    });
  });
});