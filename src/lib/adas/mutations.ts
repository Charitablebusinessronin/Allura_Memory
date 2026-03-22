import { randomUUID } from "crypto";
import type {
  AgentDesign,
  AgentDesignConfig,
  AgentTool,
  ModelConfig,
  ReasoningStrategy,
} from "./types";
import {
  createAgentDesign,
  cloneDesign,
  TOOL_LIBRARY,
  MODEL_CONFIGS,
  REASONING_STRATEGIES,
  DEFAULT_SEARCH_SPACE,
  type SearchSpace,
} from "./agent-design";

/**
 * Mutation Operators for Agent Design Search
 * Story 2.2: Execute Meta Agent Search Loop
 *
 * Implements mutation operators that modify agent designs
 * as part of the evolutionary search process.
 */

/**
 * Mutation configuration
 */
export interface MutationConfig {
  /** Probability of mutating the system prompt (0-1) */
  promptMutationProbability: number;
  /** Probability of adding a tool (0-1) */
  toolAddProbability: number;
  /** Probability of removing a tool (0-1) */
  toolRemoveProbability: number;
  /** Probability of changing model (0-1) */
  modelChangeProbability: number;
  /** Probability of changing reasoning strategy (0-1) */
  strategyChangeProbability: number;
  /** Temperature mutation range */
  temperatureMutationRange: number;
  /** MaxTokens mutation range */
  maxTokensMutationRange: number;
}

/**
 * Default mutation configuration
 */
export const DEFAULT_MUTATION_CONFIG: MutationConfig = {
  promptMutationProbability: 0.3,
  toolAddProbability: 0.2,
  toolRemoveProbability: 0.2,
  modelChangeProbability: 0.15,
  strategyChangeProbability: 0.25,
  temperatureMutationRange: 0.2,
  maxTokensMutationRange: 2000,
};

/**
 * Prompt mutation templates
 */
const PROMPT_MUTATIONS = [
  { type: "add_context", modifier: (p: string) => `${p}\n\nAdditional context: Consider edge cases and error handling.` },
  { type: "add_examples", modifier: (p: string) => `${p}\n\nExamples:\n- Input: example input\n- Output: example output` },
  { type: "add_constraints", modifier: (p: string) => `${p}\n\nConstraints:\n- Respond concisely\n- Be accurate` },
  { type: "refine_clarity", modifier: (p: string) => `Important: ${p}` },
  { type: "add_role", modifier: (p: string) => `You are an expert assistant.\n\n${p}` },
  { type: "add_steps", modifier: (p: string) => `${p}\n\nFollow these steps:\n1. Analyze\n2. Process\n3. Respond` },
];

/**
 * Mutation type for tracking
 */
export type MutationType =
  | "prompt_mutate"
  | "tool_add"
  | "tool_remove"
  | "tool_swap"
  | "model_change"
  | "temperature_mutate"
  | "max_tokens_mutate"
  | "strategy_change"
  | "parameter_add"
  | "crossover";

/**
 * Mutation record for logging
 */
export interface MutationRecord {
  mutationId: string;
  parentDesignId: string;
  childDesignId: string;
  mutationType: MutationType;
  mutationDetails: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Apply a random mutation to a design
 */
export function applyRandomMutation(
  design: AgentDesign,
  config: Partial<MutationConfig> = {},
  searchSpace: SearchSpace = DEFAULT_SEARCH_SPACE
): { design: AgentDesign; mutation: MutationRecord } {
  const fullConfig = { ...DEFAULT_MUTATION_CONFIG, ...config };

  const mutations: Array<{
    type: MutationType;
    probability: number;
    apply: () => { design: AgentDesign; details: Record<string, unknown> };
  }> = [
    {
      type: "prompt_mutate",
      probability: fullConfig.promptMutationProbability,
      apply: () => mutatePrompt(design, searchSpace),
    },
    {
      type: "tool_add",
      probability: fullConfig.toolAddProbability,
      apply: () => addTool(design, searchSpace),
    },
    {
      type: "tool_remove",
      probability: fullConfig.toolRemoveProbability,
      apply: () => removeTool(design),
    },
    {
      type: "model_change",
      probability: fullConfig.modelChangeProbability,
      apply: () => changeModel(design, searchSpace),
    },
    {
      type: "strategy_change",
      probability: fullConfig.strategyChangeProbability,
      apply: () => changeStrategy(design, searchSpace),
    },
  ];

  const eligibleMutations = mutations.filter((m) => Math.random() < m.probability);

  if (eligibleMutations.length === 0) {
    const defaultMutation = mutations[0];
    if (defaultMutation) {
      const result = defaultMutation.apply();
      return {
        design: result.design,
        mutation: createMutationRecord(
          design.design_id,
          result.design.design_id,
          defaultMutation.type,
          result.details
        ),
      };
    }
  }

  const selectedMutation = eligibleMutations[Math.floor(Math.random() * eligibleMutations.length)];

  if (!selectedMutation) {
    const result = mutatePrompt(design, searchSpace);
    return {
      design: result.design,
      mutation: createMutationRecord(
        design.design_id,
        result.design.design_id,
        "prompt_mutate",
        result.details
      ),
    };
  }

  const result = selectedMutation.apply();
  return {
    design: result.design,
    mutation: createMutationRecord(
      design.design_id,
      result.design.design_id,
      selectedMutation.type,
      result.details
    ),
  };
}

/**
 * Mutate the system prompt
 */
export function mutatePrompt(
  design: AgentDesign,
  searchSpace: SearchSpace = DEFAULT_SEARCH_SPACE
): { design: AgentDesign; details: Record<string, unknown> } {
  const currentPrompt = design.config.systemPrompt ?? "";
  const mutationTemplate =
    PROMPT_MUTATIONS[Math.floor(Math.random() * PROMPT_MUTATIONS.length)];

  if (!mutationTemplate) {
    return { design: cloneDesign(design, {}), details: { change: "none" } };
  }

  const newPrompt = mutationTemplate.modifier(currentPrompt);
  const mutationDetails = {
    type: mutationTemplate.type,
    originalLength: currentPrompt.length,
    newLength: newPrompt.length,
  };

  const updated = cloneDesign(design, {
    config: {
      ...design.config,
      systemPrompt: newPrompt,
    },
  });

  return { design: updated, details: mutationDetails };
}

/**
 * Add a random tool to the design
 */
export function addTool(
  design: AgentDesign,
  searchSpace: SearchSpace = DEFAULT_SEARCH_SPACE
): { design: AgentDesign; details: Record<string, unknown> } {
  const currentToolNames = new Set((design.config.tools ?? []).map((t) => t.name));
  const availableTools = searchSpace.availableTools.filter(
    (t) => !currentToolNames.has(t.name)
  );

  if (availableTools.length === 0) {
    return { design: cloneDesign(design, {}), details: { change: "none", reason: "no_tools_available" } };
  }

  const newTool = availableTools[Math.floor(Math.random() * availableTools.length)];

  if (!newTool) {
    return { design: cloneDesign(design, {}), details: { change: "none" } };
  }

  const updatedTools = [...(design.config.tools ?? []), newTool];

  const updated = cloneDesign(design, {
    config: {
      ...design.config,
      tools: updatedTools,
    },
  });

  return {
    design: updated,
    details: {
      addedTool: newTool.name,
      totalTools: updatedTools.length,
    },
  };
}

/**
 * Remove a random tool from the design
 */
export function removeTool(design: AgentDesign): { design: AgentDesign; details: Record<string, unknown> } {
  const currentTools = design.config.tools ?? [];

  if (currentTools.length === 0) {
    return { design: cloneDesign(design, {}), details: { change: "none", reason: "no_tools" } };
  }

  const toolIndexToRemove = Math.floor(Math.random() * currentTools.length);
  const removedTool = currentTools[toolIndexToRemove];

  if (!removedTool) {
    return { design: cloneDesign(design, {}), details: { change: "none" } };
  }

  const updatedTools = currentTools.filter((_, i) => i !== toolIndexToRemove);

  const updated = cloneDesign(design, {
    config: {
      ...design.config,
      tools: updatedTools,
    },
  });

  return {
    design: updated,
    details: {
      removedTool: removedTool.name,
      remainingTools: updatedTools.length,
    },
  };
}

/**
 * Change the model configuration
 */
export function changeModel(
  design: AgentDesign,
  searchSpace: SearchSpace = DEFAULT_SEARCH_SPACE
): { design: AgentDesign; details: Record<string, unknown> } {
  const availableModels = searchSpace.availableModels;
  const currentModelId = design.config.model?.modelId;

  const otherModels = availableModels.filter((m) => m.modelId !== currentModelId);

  if (otherModels.length === 0) {
    return { design: cloneDesign(design, {}), details: { change: "none", reason: "single_model" } };
  }

  const newModel = otherModels[Math.floor(Math.random() * otherModels.length)];

  if (!newModel) {
    return { design: cloneDesign(design, {}), details: { change: "none" } };
  }

  const updated = cloneDesign(design, {
    config: {
      ...design.config,
      model: { ...newModel },
    },
  });

  return {
    design: updated,
    details: {
      previousModel: currentModelId,
      newModel: newModel.modelId,
    },
  };
}

/**
 * Change the reasoning strategy
 */
export function changeStrategy(
  design: AgentDesign,
  searchSpace: SearchSpace = DEFAULT_SEARCH_SPACE
): { design: AgentDesign; details: Record<string, unknown> } {
  const availableStrategies = searchSpace.availableStrategies;
  const currentStrategy = design.config.reasoningStrategy;

  const otherStrategies = availableStrategies.filter((s) => s !== currentStrategy);

  if (otherStrategies.length === 0) {
    return { design: cloneDesign(design, {}), details: { change: "none", reason: "single_strategy" } };
  }

  const newStrategy = otherStrategies[Math.floor(Math.random() * otherStrategies.length)];

  if (!newStrategy) {
    return { design: cloneDesign(design, {}), details: { change: "none" } };
  }

  const updated = cloneDesign(design, {
    config: {
      ...design.config,
      reasoningStrategy: newStrategy,
    },
  });

  return {
    design: updated,
    details: {
      previousStrategy: currentStrategy,
      newStrategy,
    },
  };
}

/**
 * Mutate model temperature
 */
export function mutateTemperature(
  design: AgentDesign,
  range: number = 0.2
): { design: AgentDesign; details: Record<string, unknown> } {
  const currentTemp = design.config.model?.temperature ?? 0.7;
  const delta = (Math.random() - 0.5) * 2 * range;
  const newTemp = Math.max(0, Math.min(1, currentTemp + delta));

  const updated = cloneDesign(design, {
    config: {
      ...design.config,
      model: {
        ...design.config.model,
        temperature: newTemp,
      } as ModelConfig,
    },
  });

  return {
    design: updated,
    details: {
      previousTemperature: currentTemp,
      newTemperature: newTemp,
    },
  };
}

/**
 * Mutate max tokens
 */
export function mutateMaxTokens(
  design: AgentDesign,
  range: number = 2000
): { design: AgentDesign; details: Record<string, unknown> } {
  const currentTokens = design.config.model?.maxTokens ?? 4096;
  const delta = Math.floor((Math.random() - 0.5) * 2 * range);
  const newTokens = Math.max(1000, currentTokens + delta);

  const updated = cloneDesign(design, {
    config: {
      ...design.config,
      model: {
        ...design.config.model,
        maxTokens: newTokens,
      } as ModelConfig,
    },
  });

  return {
    design: updated,
    details: {
      previousMaxTokens: currentTokens,
      newMaxTokens: newTokens,
    },
  };
}

/**
 * Crossover two designs to create offspring
 */
export function crossoverDesigns(
  parent1: AgentDesign,
  parent2: AgentDesign,
  domain: string
): { child: AgentDesign; details: Record<string, unknown> } {
  const childId = randomUUID();

  const strategy: ReasoningStrategy =
    Math.random() < 0.5
      ? (parent1.config.reasoningStrategy ?? "cot")
      : (parent2.config.reasoningStrategy ?? "cot");

  const model: ModelConfig =
    Math.random() < 0.5
      ? (parent1.config.model ?? MODEL_CONFIGS[0]!)
      : (parent2.config.model ?? MODEL_CONFIGS[0]!);

  const tools1 = parent1.config.tools ?? [];
  const tools2 = parent2.config.tools ?? [];

  const allTools = [...tools1, ...tools2];
  const uniqueTools = new Map<string, AgentTool>();
  for (const tool of allTools) {
    uniqueTools.set(tool.name, tool);
  }

  const crossoverPoint = Math.floor(uniqueTools.size / 2);
  const selectedTools = [...Array.from(uniqueTools.values())].slice(0, crossoverPoint + 1);

  const prompt1 = parent1.config.systemPrompt ?? "";
  const prompt2 = parent2.config.systemPrompt ?? "";
  const promptParts1 = prompt1.split("\n").slice(0, Math.ceil(prompt1.split("\n").length / 2));
  const promptParts2 = prompt2.split("\n").slice(Math.floor(prompt2.split("\n").length / 2));
  const combinedPrompt = [...promptParts1, ...promptParts2].join("\n");

  const child = createAgentDesign({
    design_id: childId,
    domain,
    name: `crossover-${childId.slice(0, 8)}`,
    description: `Crossover of ${parent1.name} and ${parent2.name}`,
    version: "1.0.0",
    config: {
      systemPrompt: combinedPrompt,
      tools: selectedTools,
      model: { ...model },
      reasoningStrategy: strategy,
      parameters: { ...parent1.config.parameters, ...parent2.config.parameters },
    },
    metadata: {
      createdAt: new Date(),
      createdBy: "crossover",
      parentDesignId: parent1.design_id,
      tags: ["crossover", parent1.design_id.slice(0, 8), parent2.design_id.slice(0, 8)],
    },
  });

  return {
    child,
    details: {
      parent1Id: parent1.design_id,
      parent2Id: parent2.design_id,
      strategyFrom: strategy === parent1.config.reasoningStrategy ? "parent1" : "parent2",
      modelFrom: model.modelId === parent1.config.model?.modelId ? "parent1" : "parent2",
      toolsCount: selectedTools.length,
    },
  };
}

/**
 * Create a mutation record for logging
 */
function createMutationRecord(
  parentId: string,
  childId: string,
  type: MutationType,
  details: Record<string, unknown>
): MutationRecord {
  return {
    mutationId: randomUUID(),
    parentDesignId: parentId,
    childDesignId: childId,
    mutationType: type,
    mutationDetails: details,
    timestamp: new Date(),
  };
}

/**
 * Apply multiple mutations in sequence
 */
export function applyMutations(
  design: AgentDesign,
  count: number,
  config: Partial<MutationConfig> = {},
  searchSpace: SearchSpace = DEFAULT_SEARCH_SPACE
): { design: AgentDesign; mutations: MutationRecord[] } {
  let currentDesign = design;
  const mutations: MutationRecord[] = [];

  for (let i = 0; i < count; i++) {
    const result = applyRandomMutation(currentDesign, config, searchSpace);
    currentDesign = result.design;
    mutations.push(result.mutation);
  }

  currentDesign = {
    ...currentDesign,
    metadata: {
      ...currentDesign.metadata,
      createdAt: currentDesign.metadata?.createdAt ?? new Date(),
      iterationNumber: (design.metadata?.iterationNumber ?? 0) + count,
    },
  };

  return { design: currentDesign, mutations };
}