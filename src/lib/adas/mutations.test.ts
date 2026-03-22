import { describe, it, expect, beforeEach } from "vitest";
import {
  applyRandomMutation,
  applyMutations,
  mutatePrompt,
  addTool,
  removeTool,
  changeModel,
  changeStrategy,
  mutateTemperature,
  mutateMaxTokens,
  crossoverDesigns,
  DEFAULT_MUTATION_CONFIG,
  type MutationConfig,
  type MutationRecord,
} from "./mutations";
import { createAgentDesign, TOOL_LIBRARY, MODEL_CONFIGS, DEFAULT_SEARCH_SPACE } from "./agent-design";
import type { AgentDesign } from "./types";

describe("Mutations Module", () => {
  describe("applyRandomMutation", () => {
    it("should apply a mutation to a design", () => {
      const design = createAgentDesign({
        domain: "test",
        config: { reasoningStrategy: "cot" },
      });

      const result = applyRandomMutation(design);

      expect(result.design).toBeDefined();
      expect(result.design.design_id).toBeDefined();
      expect(result.mutation).toBeDefined();
      expect(result.mutation.mutationId).toBeDefined();
      expect(result.mutation.parentDesignId).toBe(design.design_id);
      expect(result.mutation.childDesignId).toBe(result.design.design_id);
      expect(result.mutation.timestamp).toBeInstanceOf(Date);
    });

    it("should create a different design after mutation", () => {
      const design = createAgentDesign({
        domain: "test",
        config: {
          reasoningStrategy: "cot",
          model: { ...MODEL_CONFIGS[0]!, temperature: 0.7 },
        },
      });

      const result = applyRandomMutation(design);

      expect(result.design.design_id).not.toBe(design.design_id);
      expect(result.design.metadata?.parentDesignId).toBe(design.design_id);
    });

    it("should respect custom mutation config", () => {
      const design = createAgentDesign({
        domain: "test",
        config: { reasoningStrategy: "cot" },
      });

      const config: Partial<MutationConfig> = {
        promptMutationProbability: 1.0,
        toolAddProbability: 0,
        toolRemoveProbability: 0,
        modelChangeProbability: 0,
        strategyChangeProbability: 0,
      };

      const result = applyRandomMutation(design, config);

      expect(result.mutation.mutationType).toBe("prompt_mutate");
    });
  });

  describe("mutatePrompt", () => {
    it("should modify the system prompt", () => {
      const design = createAgentDesign({
        domain: "test",
        config: {
          systemPrompt: "Original prompt",
        },
      });

      const result = mutatePrompt(design);

      expect(result.design.config.systemPrompt).not.toBe("Original prompt");
      expect(result.design.config.systemPrompt?.length).toBeGreaterThan("Original prompt".length);
      expect(result.details).toHaveProperty("type");
    });

    it("should work with empty prompt", () => {
      const design = createAgentDesign({
        domain: "test",
        config: {},
      });

      const result = mutatePrompt(design);

      expect(result.design.config.systemPrompt).toBeDefined();
    });
  });

  describe("addTool", () => {
    it("should add a tool to the design", () => {
      const design = createAgentDesign({
        domain: "test",
        config: { tools: [] },
      });

      const result = addTool(design);

      expect(result.design.config.tools?.length).toBeGreaterThan(0);
      expect(result.details).toHaveProperty("addedTool");
      expect(result.details).toHaveProperty("totalTools");
    });

    it("should not add duplicate tools", () => {
      const existingTools = [TOOL_LIBRARY[0]!];
      const design = createAgentDesign({
        domain: "test",
        config: { tools: [...existingTools] },
      });

      const result = addTool(design);

      const toolNames = result.design.config.tools?.map((t) => t.name) ?? [];
      const uniqueNames = [...new Set(toolNames)];
      expect(uniqueNames.length).toBe(toolNames.length);
    });

    it("should return same design if no tools available", () => {
      const design = createAgentDesign({
        domain: "test",
        config: { tools: [...TOOL_LIBRARY] },
      });

      const result = addTool(design);

      expect(result.details.change).toBe("none");
    });
  });

  describe("removeTool", () => {
    it("should remove a tool from the design", () => {
      const design = createAgentDesign({
        domain: "test",
        config: { tools: [TOOL_LIBRARY[0]!, TOOL_LIBRARY[1]!] },
      });

      const result = removeTool(design);

      expect(result.design.config.tools?.length).toBe(1);
      expect(result.details).toHaveProperty("removedTool");
    });

    it("should return same design if no tools", () => {
      const design = createAgentDesign({
        domain: "test",
        config: { tools: [] },
      });

      const result = removeTool(design);

      expect(result.details.change).toBe("none");
      expect(result.details.reason).toBe("no_tools");
    });
  });

  describe("changeModel", () => {
    it("should change to a different model", () => {
      const design = createAgentDesign({
        domain: "test",
        config: { model: MODEL_CONFIGS[0]! },
      });

      const result = changeModel(design);

      expect(result.details).toHaveProperty("previousModel");
      expect(result.details).toHaveProperty("newModel");
      if (result.details.change !== "none") {
        expect(result.design.config.model?.modelId).not.toBe(MODEL_CONFIGS[0]!.modelId);
      }
    });

    it("should work with limited search space", () => {
      const searchSpace = {
        ...DEFAULT_SEARCH_SPACE,
        availableModels: [MODEL_CONFIGS[0]!],
      };

      const design = createAgentDesign({
        domain: "test",
        config: { model: MODEL_CONFIGS[0]! },
      });

      const result = changeModel(design, searchSpace);

      expect(result.details.change).toBe("none");
      expect(result.details.reason).toBe("single_model");
    });
  });

  describe("changeStrategy", () => {
    it("should change the reasoning strategy", () => {
      const design = createAgentDesign({
        domain: "test",
        config: { reasoningStrategy: "cot" },
      });

      const result = changeStrategy(design);

      expect(result.design).toBeDefined();
      expect(result.details).toHaveProperty("previousStrategy");
      expect(result.details).toHaveProperty("newStrategy");
    });
  });

  describe("mutateTemperature", () => {
    it("should modify temperature within range", () => {
      const design = createAgentDesign({
        domain: "test",
        config: {
          model: { ...MODEL_CONFIGS[0]!, temperature: 0.5 },
        },
      });

      const result = mutateTemperature(design, 0.2);

      expect(result.design.config.model?.temperature).toBeGreaterThanOrEqual(0);
      expect(result.design.config.model?.temperature).toBeLessThanOrEqual(1);
      expect(result.details).toHaveProperty("previousTemperature");
      expect(result.details).toHaveProperty("newTemperature");
    });

    it("should clamp temperature to valid range", () => {
      const design = createAgentDesign({
        domain: "test",
        config: {
          model: { ...MODEL_CONFIGS[0]!, temperature: 0.99 },
        },
      });

      for (let i = 0; i < 100; i++) {
        const result = mutateTemperature({ ...design, design_id: `test-${i}` }, 0.2);
        expect(result.design.config.model?.temperature).toBeGreaterThanOrEqual(0);
        expect(result.design.config.model?.temperature).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("mutateMaxTokens", () => {
    it("should modify maxTokens", () => {
      const design = createAgentDesign({
        domain: "test",
        config: {
          model: { ...MODEL_CONFIGS[0]!, maxTokens: 4096 },
        },
      });

      const result = mutateMaxTokens(design, 2000);

      expect(result.design.config.model?.maxTokens).toBeGreaterThanOrEqual(1000);
      expect(result.details).toHaveProperty("previousMaxTokens");
      expect(result.details).toHaveProperty("newMaxTokens");
    });
  });

  describe("crossoverDesigns", () => {
    it("should combine traits from both parents", () => {
      const parent1 = createAgentDesign({
        domain: "test",
        config: {
          reasoningStrategy: "cot",
          model: MODEL_CONFIGS[0]!,
          tools: [TOOL_LIBRARY[0]!],
        },
      });

      const parent2 = createAgentDesign({
        domain: "test",
        config: {
          reasoningStrategy: "react",
          model: MODEL_CONFIGS[1]!,
          tools: [TOOL_LIBRARY[1]!, TOOL_LIBRARY[2]!],
        },
      });

      const result = crossoverDesigns(parent1, parent2, "test");

      expect(result.child).toBeDefined();
      expect(result.child.design_id).not.toBe(parent1.design_id);
      expect(result.child.design_id).not.toBe(parent2.design_id);
      expect(result.details).toHaveProperty("parent1Id");
      expect(result.details).toHaveProperty("parent2Id");
      expect(result.child.metadata?.parentDesignId).toBe(parent1.design_id);
    });

    it("should inherit from either parent", () => {
      const parent1 = createAgentDesign({
        domain: "test",
        config: { reasoningStrategy: "cot" },
      });

      const parent2 = createAgentDesign({
        domain: "test",
        config: { reasoningStrategy: "react" },
      });

      const strategies = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const result = crossoverDesigns(parent1, parent2, "test");
        strategies.add(result.child.config.reasoningStrategy ?? "");
      }

      expect(strategies.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe("applyMutations", () => {
    it("should apply multiple mutations sequentially", () => {
      const design = createAgentDesign({
        domain: "test",
        config: { reasoningStrategy: "cot" },
      });

      const result = applyMutations(design, 3);

      expect(result.design).toBeDefined();
      expect(result.mutations).toHaveLength(3);
      expect(result.design.metadata?.iterationNumber).toBe(3);
    });

    it("should chain mutations correctly", () => {
      const design = createAgentDesign({
        domain: "test",
        config: { reasoningStrategy: "cot" },
      });

      const result = applyMutations(design, 2);

      expect(result.mutations[0]?.parentDesignId).toBe(design.design_id);
      expect(result.mutations[1]?.parentDesignId).toBe(result.mutations[0]?.childDesignId);
    });
  });

  describe("DEFAULT_MUTATION_CONFIG", () => {
    it("should have valid probabilities", () => {
      expect(DEFAULT_MUTATION_CONFIG.promptMutationProbability).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_MUTATION_CONFIG.promptMutationProbability).toBeLessThanOrEqual(1);
      expect(DEFAULT_MUTATION_CONFIG.toolAddProbability).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_MUTATION_CONFIG.toolAddProbability).toBeLessThanOrEqual(1);
      expect(DEFAULT_MUTATION_CONFIG.toolRemoveProbability).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_MUTATION_CONFIG.toolRemoveProbability).toBeLessThanOrEqual(1);
    });
  });
});