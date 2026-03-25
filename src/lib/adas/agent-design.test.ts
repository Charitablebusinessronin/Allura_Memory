import { describe, it, expect, beforeEach } from "vitest";
import {
  createAgentDesign,
  generateSystemPrompt,
  generateAgentCode,
  serializeDesign,
  deserializeDesign,
  cloneDesign,
  generateRandomDesign,
  calculateDiversity,
  TOOL_LIBRARY,
  MODEL_CONFIGS,
  REASONING_STRATEGIES,
  PROMPT_TEMPLATES,
  DEFAULT_SEARCH_SPACE,
  type SearchSpace,
} from "./agent-design";
import type { AgentDesign } from "./types";

describe("AgentDesign Module", () => {
  describe("createAgentDesign", () => {
    it("should create a design with required fields", () => {
      const design = createAgentDesign({ domain: "test-domain" });

      expect(design.design_id).toBeDefined();
      expect(design.design_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(design.domain).toBe("test-domain");
      expect(design.name).toContain("agent-design");
      expect(design.version).toBe("1.0.0");
      expect(design.config).toBeDefined();
      expect(design.metadata?.createdAt).toBeInstanceOf(Date);
    });

    it("should accept partial configuration", () => {
      const design = createAgentDesign({
        design_id: "custom-id",
        domain: "custom-domain",
        name: "Custom Agent",
        description: "A custom agent design",
        config: {
          systemPrompt: "Test prompt",
          reasoningStrategy: "react",
          model: {
            provider: "ollama",
            modelId: "qwen3-coder-next:cloud",
            tier: "stable",
          },
        },
        metadata: {
          createdAt: new Date(),
          createdBy: "test",
          tags: ["test", "custom"],
        },
      });

      expect(design.design_id).toBe("custom-id");
      expect(design.domain).toBe("custom-domain");
      expect(design.name).toBe("Custom Agent");
      expect(design.description).toBe("A custom agent design");
      expect(design.config.systemPrompt).toBe("Test prompt");
      expect(design.config.reasoningStrategy).toBe("react");
      expect(design.config.model?.modelId).toBe("qwen3-coder-next:cloud");
      expect(design.config.model?.tier).toBe("stable");
      expect(design.metadata?.createdBy).toBe("test");
      expect(design.metadata?.tags).toEqual(["test", "custom"]);
    });

    it("should use default model config when not provided", () => {
      const design = createAgentDesign({ domain: "test" });

      expect(design.config.model).toEqual(MODEL_CONFIGS[0]);
    });
  });

  describe("generateSystemPrompt", () => {
    it("should generate CoT prompt", () => {
      const prompt = generateSystemPrompt("cot");

      expect(prompt).toContain("Think step by step");
      expect(prompt).toContain("Steps:");
    });

    it("should generate ReAct prompt with tools", () => {
      const tools = [TOOL_LIBRARY[0]!, TOOL_LIBRARY[1]!];
      const prompt = generateSystemPrompt("react", undefined, tools);

      expect(prompt).toContain("Thought:");
      expect(prompt).toContain("Action:");
      expect(prompt).toContain("web_search");
      expect(prompt).toContain("code_interpreter");
    });

    it("should generate custom prompt", () => {
      const customPrompt = "This is my custom prompt.";
      const prompt = generateSystemPrompt("custom", customPrompt);

      expect(prompt).toBe(customPrompt);
    });

    it("should generate plan-and-execute prompt", () => {
      const prompt = generateSystemPrompt("plan-and-execute");

      expect(prompt).toContain("planning");
      expect(prompt).toContain("Plan:");
    });

    it("should generate reflexion prompt", () => {
      const prompt = generateSystemPrompt("reflexion");

      expect(prompt).toContain("reflexive");
      expect(prompt).toContain("Critique");
    });
  });

  describe("generateAgentCode", () => {
    it("should generate valid TypeScript code", () => {
      const design = createAgentDesign({
        domain: "test-domain",
        config: {
          reasoningStrategy: "cot",
          tools: [TOOL_LIBRARY[0]!],
          model: MODEL_CONFIGS[0],
        },
      });

      const code = generateAgentCode(design);

      expect(code).toContain("import type { ForwardFn }");
      expect(code).toContain("export const CONFIG: AgentDesignConfig");
      expect(code).toContain("export async function execute");
      expect(code).toContain("export const forward: ForwardFn");
      expect(code).toContain("export const DESIGN_ID");
      expect(code).toContain("export const DESIGN_VERSION");
    });

    it("should include design ID and version in code", () => {
      const design = createAgentDesign({
        design_id: "test-design-123",
        domain: "test",
        version: "2.0.0",
      });

      const code = generateAgentCode(design);

      expect(code).toContain("test-design-123");
      expect(code).toContain("2.0.0");
    });

    it("should generate code with tools", () => {
      const design = createAgentDesign({
        domain: "test",
        config: {
          tools: [TOOL_LIBRARY[0]!, TOOL_LIBRARY[2]!],
        },
      });

      const code = generateAgentCode(design);

      expect(code).toContain("web_search");
      expect(code).toContain("file_read");
    });

    it("should include system prompt in config", () => {
      const design = createAgentDesign({
        domain: "test",
        config: {
          systemPrompt: "Test system prompt",
        },
      });

      const code = generateAgentCode(design);

      expect(code).toContain("Test system prompt");
    });
  });

  describe("serializeDesign / deserializeDesign", () => {
    it("should round-trip a design", () => {
      const original = createAgentDesign({
        domain: "test-domain",
        config: {
          reasoningStrategy: "react",
          tools: [TOOL_LIBRARY[0]!],
        },
      });

      const json = serializeDesign(original);
      const restored = deserializeDesign(json);

      expect(restored.design_id).toBe(original.design_id);
      expect(restored.domain).toBe(original.domain);
      expect(restored.config.reasoningStrategy).toBe("react");
      expect(restored.config.tools).toHaveLength(1);
      expect(restored.metadata?.createdAt).toBeInstanceOf(Date);
    });

    it("should produce valid JSON", () => {
      const design = createAgentDesign({ domain: "test" });
      const json = serializeDesign(design);

      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe("cloneDesign", () => {
    it("should create a child design with parent reference", () => {
      const parent = createAgentDesign({
        domain: "test",
        config: { reasoningStrategy: "cot" },
      });

      const child = cloneDesign(parent, { parentDesignId: parent.design_id });

      expect(child.design_id).not.toBe(parent.design_id);
      expect(child.metadata?.parentDesignId).toBe(parent.design_id);
      expect(child.metadata?.iterationNumber).toBe(1);
      expect(child.version).not.toBe(parent.version);
    });

    it("should increment version number", () => {
      const parent = createAgentDesign({
        domain: "test",
        version: "1.0.0",
      });

      const child = cloneDesign(parent, { parentDesignId: parent.design_id });

      expect(child.version).toBe("1.0.1");
    });

    it("should preserve domain and config", () => {
      const parent = createAgentDesign({
        domain: "test-domain",
        config: {
          reasoningStrategy: "react",
          tools: [TOOL_LIBRARY[0]!],
        },
      });

      const child = cloneDesign(parent, { parentDesignId: parent.design_id });

      expect(child.domain).toBe(parent.domain);
      expect(child.config.reasoningStrategy).toBe("react");
      expect(child.config.tools).toHaveLength(1);
    });
  });

  describe("generateRandomDesign", () => {
    it("should generate a random design", () => {
      const design = generateRandomDesign("test-domain");

      expect(design.design_id).toBeDefined();
      expect(design.domain).toBe("test-domain");
      expect(design.config.reasoningStrategy).toBeDefined();
      expect(design.config.model).toBeDefined();
      expect(design.config.tools).toBeInstanceOf(Array);
      expect(design.config.systemPrompt).toBeDefined();
    });

    it("should use custom search space", () => {
      const customSpace: SearchSpace = {
        availableTools: [TOOL_LIBRARY[0]!],
        availableModels: [MODEL_CONFIGS[0]!],
        availableStrategies: ["cot"],
        promptMutations: {
          temperatureRange: [0.3, 0.7],
          maxTokensRange: [2000, 4000],
          mutationProbability: 0.5,
        },
      };

      const design = generateRandomDesign("test", customSpace);

      expect(design.config.tools?.length).toBeLessThanOrEqual(1);
      expect(design.config.reasoningStrategy).toBe("cot");
      expect(design.config.model?.modelId).toBe(MODEL_CONFIGS[0]!.modelId);
    });

    it("should generate different designs on each call", () => {
      const design1 = generateRandomDesign("test");
      const design2 = generateRandomDesign("test");

      expect(design1.design_id).not.toBe(design2.design_id);
    });
  });

  describe("calculateDiversity", () => {
    it("should return 0 for identical designs", () => {
      const design = createAgentDesign({
        domain: "test",
        config: { reasoningStrategy: "cot", model: MODEL_CONFIGS[0]! },
      });

      const diversity = calculateDiversity(design, design);

      expect(diversity).toBe(0);
    });

    it("should return higher values for different strategies", () => {
      const design1 = createAgentDesign({
        domain: "test",
        config: { reasoningStrategy: "cot" },
      });

      const design2 = createAgentDesign({
        domain: "test",
        config: { reasoningStrategy: "react" },
      });

      const diversity = calculateDiversity(design1, design2);

      expect(diversity).toBeGreaterThan(0);
    });

    it("should account for tool differences", () => {
      const design1 = createAgentDesign({
        domain: "test",
        config: { tools: [] },
      });

      const design2 = createAgentDesign({
        domain: "test",
        config: { tools: [TOOL_LIBRARY[0]!] },
      });

      const diversity = calculateDiversity(design1, design2);

      expect(diversity).toBeGreaterThan(0);
    });

    it("should account for temperature differences", () => {
      const design1 = createAgentDesign({
        domain: "test",
        config: {
          model: { ...MODEL_CONFIGS[0]!, temperature: 0.3 },
        },
      });

      const design2 = createAgentDesign({
        domain: "test",
        config: {
          model: { ...MODEL_CONFIGS[0]!, temperature: 0.9 },
        },
      });

      const diversity = calculateDiversity(design1, design2);

      expect(diversity).toBeGreaterThan(0);
      expect(diversity).toBeLessThan(1);
    });
  });

  describe("Constants and Defaults", () => {
    it("should have correct PROMPT_TEMPLATES", () => {
      expect(PROMPT_TEMPLATES.cot).toBeDefined();
      expect(PROMPT_TEMPLATES.react).toBeDefined();
      expect(PROMPT_TEMPLATES["plan-and-execute"]).toBeDefined();
      expect(PROMPT_TEMPLATES.reflexion).toBeDefined();
      expect(PROMPT_TEMPLATES.custom).toBeDefined();
    });

    it("should have correct TOOL_LIBRARY", () => {
      expect(TOOL_LIBRARY.length).toBeGreaterThan(0);
      expect(TOOL_LIBRARY[0]?.name).toBe("web_search");
      expect(TOOL_LIBRARY[1]?.name).toBe("code_interpreter");
    });

    it("should have correct MODEL_CONFIGS", () => {
      expect(MODEL_CONFIGS.length).toBeGreaterThan(0);
      expect(MODEL_CONFIGS[0]?.provider).toBe("ollama");
      expect(MODEL_CONFIGS[0]?.modelId).toBe("qwen3-coder-next:cloud");
      expect(MODEL_CONFIGS[0]?.tier).toBe("stable");
    });

    it("should have correct REASONING_STRATEGIES", () => {
      expect(REASONING_STRATEGIES).toContain("cot");
      expect(REASONING_STRATEGIES).toContain("react");
      expect(REASONING_STRATEGIES).toContain("plan-and-execute");
      expect(REASONING_STRATEGIES).toContain("reflexion");
    });

    it("should have correct DEFAULT_SEARCH_SPACE", () => {
      expect(DEFAULT_SEARCH_SPACE.availableTools).toEqual(TOOL_LIBRARY);
      expect(DEFAULT_SEARCH_SPACE.availableModels).toEqual(MODEL_CONFIGS);
      expect(DEFAULT_SEARCH_SPACE.availableStrategies).toEqual(REASONING_STRATEGIES);
      expect(DEFAULT_SEARCH_SPACE.promptMutations.temperatureRange).toEqual([0.0, 1.0]);
    });
  });
});