import { randomUUID } from "crypto";
import type {
  AgentDesign,
  AgentDesignConfig,
  AgentDesignMetadata,
  AgentTool,
  ModelConfig,
  ReasoningStrategy,
} from "./types";

/**
 * Agent Design Representation
 * Story 2.2: Execute Meta Agent Search Loop
 *
 * Provides data structures and code generation for agent designs
 * that can be evolved by the meta agent search loop.
 */

/**
 * Prompt templates for different reasoning strategies
 */
export const PROMPT_TEMPLATES: Record<ReasoningStrategy, string> = {
  cot: `Think step by step to solve the given problem.

Steps:
1. Understand the problem
2. Break it down into sub-problems
3. Solve each sub-problem
4. Combine the solutions

Problem: {input}

Solution:`,
  react: `You are a reasoning agent that alternates between thinking and acting.

Available tools:
{tools}

Follow this pattern:
Thought: Analyze the current situation
Action: Use a tool if helpful
Observation: See the result
... repeat as needed ...
Thought: I know the final answer
Final Answer: [your answer]

Input: {input}`,
  "plan-and-execute": `You are a planning agent that creates a plan then executes it.

First, create a detailed plan:
1. Identify the goal
2. List the steps
3. For each step, determine actions
4. Execute the plan step by step
5. Verify the result

Goal: {input}

Plan:`,
  reflexion: `You are a reflexive agent that learns from mistakes.

Process:
1. Solve the problem initially
2. Critique your solution
3. Identify weaknesses
4. Improve and re-solve
5. Repeat until satisfied

Problem: {input}

Initial Solution:`,
  custom: `{custom_prompt}`,
};

/**
 * Tool library for agent designs
 * Available tools that can be selected by the search process
 */
export const TOOL_LIBRARY: AgentTool[] = [
  {
    name: "web_search",
    description: "Search the web for information",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "code_interpreter",
    description: "Execute code and return results",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Code to execute" },
        language: {
          type: "string",
          enum: ["python", "javascript", "typescript"],
        },
      },
      required: ["code"],
    },
  },
  {
    name: "file_read",
    description: "Read file contents",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path" },
      },
      required: ["path"],
    },
  },
  {
    name: "file_write",
    description: "Write content to a file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "memory_store",
    description: "Store information in memory",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Memory key" },
        value: { type: "string", description: "Value to store" },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "memory_retrieve",
    description: "Retrieve information from memory",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Memory key" },
      },
      required: ["key"],
    },
  },
  {
    name: "calculator",
    description: "Perform mathematical calculations",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Math expression" },
      },
      required: ["expression"],
    },
  },
  {
    name: "api_call",
    description: "Make HTTP API calls",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "API endpoint URL" },
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "DELETE"],
        },
        body: { type: "object" },
      },
      required: ["url", "method"],
    },
  },
];

/**
 * Model configurations available for selection
 */
export const MODEL_CONFIGS: ModelConfig[] = [
  { provider: "openai", modelId: "gpt-4o-mini", temperature: 0.7, maxTokens: 4096 },
  { provider: "openai", modelId: "gpt-4o", temperature: 0.7, maxTokens: 8192 },
  { provider: "openai", modelId: "gpt-4-turbo", temperature: 0.5, maxTokens: 4096 },
  { provider: "anthropic", modelId: "claude-3-haiku", temperature: 0.7, maxTokens: 4096 },
  { provider: "anthropic", modelId: "claude-3.5-sonnet", temperature: 0.7, maxTokens: 8192 },
];

/**
 * Reasoning strategies available for selection
 */
export const REASONING_STRATEGIES: ReasoningStrategy[] = [
  "cot",
  "react",
  "plan-and-execute",
  "reflexion",
];

/**
 * Search space configuration
 * Defines the space of possible agent configurations
 */
export interface SearchSpace {
  availableTools: AgentTool[];
  availableModels: ModelConfig[];
  availableStrategies: ReasoningStrategy[];
  promptMutations: {
    temperatureRange: [number, number];
    maxTokensRange: [number, number];
    mutationProbability: number;
  };
}

/**
 * Default search space configuration
 */
export const DEFAULT_SEARCH_SPACE: SearchSpace = {
  availableTools: TOOL_LIBRARY,
  availableModels: MODEL_CONFIGS,
  availableStrategies: REASONING_STRATEGIES,
  promptMutations: {
    temperatureRange: [0.0, 1.0],
    maxTokensRange: [1000, 16000],
    mutationProbability: 0.3,
  },
};

/**
 * Create a new agent design
 */
export function createAgentDesign(
  partial: Partial<AgentDesign> & { domain: string }
): AgentDesign {
  const designId = partial.design_id ?? randomUUID();
  const now = new Date();

  return {
    design_id: designId,
    name: partial.name ?? `agent-design-${designId.slice(0, 8)}`,
    version: partial.version ?? "1.0.0",
    domain: partial.domain,
    description: partial.description ?? "Generated agent design",
    config: {
      systemPrompt: partial.config?.systemPrompt,
      tools: partial.config?.tools ?? [],
      model: partial.config?.model ?? MODEL_CONFIGS[0],
      reasoningStrategy: partial.config?.reasoningStrategy ?? "cot",
      parameters: partial.config?.parameters ?? {},
    },
    metadata: {
      createdAt: partial.metadata?.createdAt ?? now,
      createdBy: partial.metadata?.createdBy ?? "meta-agent",
      parentDesignId: partial.metadata?.parentDesignId,
      iterationNumber: partial.metadata?.iterationNumber ?? 0,
      tags: partial.metadata?.tags ?? [],
    },
  };
}

/**
 * Generate system prompt from configuration
 */
export function generateSystemPrompt(
  strategy: ReasoningStrategy,
  customPrompt?: string,
  tools?: AgentTool[]
): string {
  const template = PROMPT_TEMPLATES[strategy];

  if (strategy === "custom" && customPrompt) {
    return customPrompt;
  }

  let prompt = template.replace("{input}", "[USER INPUT]");

  if (tools && tools.length > 0 && (strategy === "react" || strategy === "plan-and-execute")) {
    const toolDescriptions = tools
      .map((t) => `- ${t.name}: ${t.description}`)
      .join("\n");
    prompt = prompt.replace("{tools}", toolDescriptions);
  }

  return prompt;
}

/**
 * Generate executable code from agent design
 * Returns TypeScript code representation
 */
export function generateAgentCode(design: AgentDesign): string {
  const imports = generateImports(design);
  const config = generateConfigSection(design);
  const implementation = generateImplementation(design);
  const exports = generateExports(design);

  return `${imports}\n\n${config}\n\n${implementation}\n\n${exports}`;
}

/**
 * Generate imports section
 */
function generateImports(design: AgentDesign): string {
  const toolImports = (design.config.tools ?? [])
    .map((t) => t.name)
    .filter((name) => TOOL_LIBRARY.some((t) => t.name === name));

  const hasCodeInterpreter = toolImports.includes("code_interpreter");
  const hasMemory = toolImports.some((t) => t.startsWith("memory_"));

  let imports = `import type { ForwardFn } from "@lib/adas/types";\n`;
  imports += `import type { AgentDesign } from "@lib/adas/types";\n`;

  if (hasCodeInterpreter) {
    imports += `import { executeCode } from "@lib/tools/code-interpreter";\n`;
  }

  if (hasMemory) {
    imports += `import { memoryStore, memoryRetrieve } from "@lib/tools/memory";\n`;
  }

  return imports;
}

/**
 * Generate configuration section
 */
function generateConfigSection(design: AgentDesign): string {
  const config: AgentDesignConfig = {
    systemPrompt: design.config.systemPrompt,
    tools: design.config.tools,
    model: design.config.model,
    reasoningStrategy: design.config.reasoningStrategy,
    parameters: design.config.parameters,
  };

  return `/**
 * Agent Configuration
 * Generated by Meta Agent Search
 * Design ID: ${design.design_id}
 * Version: ${design.version}
 * Created: ${design.metadata?.createdAt?.toISOString() ?? new Date().toISOString()}
 */
export const CONFIG: AgentDesignConfig = ${JSON.stringify(config, null, 2)};`;
}

/**
 * Generate implementation section
 */
function generateImplementation(design: AgentDesign): string {
  const strategy = design.config.reasoningStrategy ?? "cot";
  const tools = design.config.tools ?? [];
  const toolNames = tools.map((t) => t.name);

  let implementation = `/**
 * Agent Implementation
 * Strategy: ${strategy}
 */
export async function execute(input: unknown): Promise<unknown> {
  const startTime = Date.now();
  
  try {
    const result = await executeWithStrategy(input);
    
    const latency = Date.now() - startTime;
    
    return {
      success: true,
      result,
      latency,
      designId: "${design.design_id}",
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      latency,
      designId: "${design.design_id}",
    };
  }
}

async function executeWithStrategy(input: unknown): Promise<unknown> {
`;

  switch (strategy) {
    case "cot":
      implementation += generateCoTImplementation(design);
      break;
    case "react":
      implementation += generateReActImplementation(design);
      break;
    case "plan-and-execute":
      implementation += generatePlanAndExecuteImplementation(design);
      break;
    case "reflexion":
      implementation += generateReflexionImplementation(design);
      break;
    default:
      implementation += generateDefaultImplementation(design);
  }

  implementation += `}
`;

  if (tools.length > 0) {
    implementation += `\n// Tool implementations\n`;
    implementation += generateToolImplementations(toolNames);
  }

  return implementation;
}

/**
 * Generate Chain-of-Thought implementation
 */
function generateCoTImplementation(design: AgentDesign): string {
  return `  // Chain-of-Thought Reasoning
  const thoughts: string[] = [];
  
  // Step 1: Analyze the input
  thoughts.push("Analyzing input: " + JSON.stringify(input));
  
  // Step 2: Break down into sub-problems
  thoughts.push("Breaking down into sub-problems");
  
  // Step 3: Solve each sub-problem
  thoughts.push("Solving sub-problems sequentially");
  
  // Step 4: Combine solutions
  thoughts.push("Combining solutions into final answer");
  
  return {
    thoughts,
    finalAnswer: "Processed with CoT reasoning",
  };
`;
}

/**
 * Generate ReAct implementation
 */
function generateReActImplementation(design: AgentDesign): string {
  const tools = design.config.tools ?? [];
  const toolList = tools.map((t) => t.name).join(", ");

  return `  // ReAct (Reasoning + Acting) Pattern
  let thought = "";
  let action: string | null = null;
  let observation = "";
  const maxIterations = 10;
  let iteration = 0;
  
  while (iteration < maxIterations) {
    // Thought phase
    thought = "Analyzing current state and determining next action";
    
    // Action phase
    action = decideAction(input, thought);
    
    if (action === "final_answer") {
      return { answer: observation, iterations: iteration };
    }
    
    // Observation phase
    observation = await executeTool(action);
    
    iteration++;
  }
  
  return { answer: observation, iterations: iteration };
}

function decideAction(input: unknown, thought: string): string {
  // Simplified action decision logic
  const tools = [${toolList}];
  return tools.length > 0 ? tools[0] : "final_answer";
`;
}

/**
 * Generate Plan-and-Execute implementation
 */
function generatePlanAndExecuteImplementation(design: AgentDesign): string {
  return `  // Plan-and-Execute Pattern
  
  // Phase 1: Planning
  const plan = createPlan(input);
  
  // Phase 2: Execution
  const results: unknown[] = [];
  for (const step of plan.steps) {
    const result = await executeStep(step);
    results.push(result);
  }
  
  // Phase 3: Verification
  const success = verifyResults(results);
  
  return {
    plan,
    results,
    success,
  };
}

function createPlan(input: unknown): { steps: string[] } {
  return {
    steps: [
      "Identify main objective",
      "Break into sub-tasks",
      "Execute each sub-task",
      "Verify and combine results",
    ],
  };
}

async function executeStep(step: string): Promise<unknown> {
  return { step, status: "completed" };
}

function verifyResults(results: unknown[]): boolean {
  return results.every((r) => r !== null && r !== undefined);
`;
}

/**
 * Generate Reflexion implementation
 */
function generateReflexionImplementation(design: AgentDesign): string {
  return `  // Reflexion Pattern
  
  let currentSolution: unknown = null;
  let critique = "";
  const maxRefinements = 3;
  let refinements = 0;
  
  // Initial solution
  currentSolution = await solveInitial(input);
  
  // Reflexive improvement loop
  while (refinements < maxRefinements) {
    // Critique the solution
    critique = critiqueSolution(currentSolution);
    
    // If critique is acceptable, we're done
    if (critique === "acceptable") {
      break;
    }
    
    // Improve based on critique
    currentSolution = await improve(currentSolution, critique);
    refinements++;
  }
  
  return {
    solution: currentSolution,
    refinements,
    finalCritique: critique,
  };
}

async function solveInitial(input: unknown): Promise<unknown> {
  return { input, initial: true };
}

function critiqueSolution(solution: unknown): string {
  return "needs improvement";
}

async function improve(solution: unknown, critique: string): Promise<unknown> {
  return { ...solution, critique, improved: true };
`;
}

/**
 * Generate default implementation
 */
function generateDefaultImplementation(design: AgentDesign): string {
  return `  // Default implementation
  return {
    result: input,
    processed: true,
    designId: "${design.design_id}",
  };
`;
}

/**
 * Generate tool implementations
 */
function generateToolImplementations(toolNames: string[]): string {
  const implementations: string[] = [];

  for (const toolName of toolNames) {
    switch (toolName) {
      case "code_interpreter":
        implementations.push(`
async function executeCode(code: string, language: string = "python"): Promise<unknown> {
  // Tool: code_interpreter
  return { code, language, result: "executed" };
}`);
        break;
      case "memory_store":
        implementations.push(`
async function memoryStore(key: string, value: string): Promise<void> {
  // Tool: memory_store
  // In production, this would interface with the memory system
}`);
        break;
      case "memory_retrieve":
        implementations.push(`
async function memoryRetrieve(key: string): Promise<unknown> {
  // Tool: memory_retrieve
  return { key, value: null };
}`);
        break;
      case "calculator":
        implementations.push(`
async function calculate(expression: string): Promise<number> {
  // Tool: calculator
  return 0;
}`);
        break;
      default:
        implementations.push(`
async function ${toolName}(params: unknown): Promise<unknown> {
  // Tool: ${toolName}
  return { result: "not implemented" };
}`);
    }
  }

  return implementations.join("\n");
}

/**
 * Generate exports section
 */
function generateExports(design: AgentDesign): string {
  return `/**
 * Export the agent forward function
 */
export const forward: ForwardFn<unknown, unknown> = async (input: unknown) => {
  return execute(input);
};

/**
 * Export the design for reference
 */
export { CONFIG as DESIGN_CONFIG };

/**
 * Design metadata
 */
export const DESIGN_ID = "${design.design_id}";
export const DESIGN_VERSION = "${design.version}";
export const DESIGN_DOMAIN = "${design.domain}";
`;
}

/**
 * Serialize agent design to JSON
 */
export function serializeDesign(design: AgentDesign): string {
  return JSON.stringify(design, null, 2);
}

/**
 * Deserialize agent design from JSON
 */
export function deserializeDesign(json: string): AgentDesign {
  const parsed = JSON.parse(json) as AgentDesign;

  if (parsed.metadata?.createdAt) {
    parsed.metadata.createdAt = new Date(parsed.metadata.createdAt);
  }

  return parsed;
}

/**
 * Clone an agent design with modifications
 */
export function cloneDesign(
  design: AgentDesign,
  modifications: Partial<AgentDesign> & { parentDesignId?: string }
): AgentDesign {
  const newDesignId = randomUUID();
  const now = new Date();

  return {
    design_id: newDesignId,
    name: modifications.name ?? `${design.name}-v2`,
    version: incrementVersion(design.version),
    domain: modifications.domain ?? design.domain,
    description: modifications.description ?? design.description,
    config: {
      systemPrompt: modifications.config?.systemPrompt ?? design.config.systemPrompt,
      tools: modifications.config?.tools ?? design.config.tools,
      model: modifications.config?.model ?? design.config.model,
      reasoningStrategy: modifications.config?.reasoningStrategy ?? design.config.reasoningStrategy,
      parameters: modifications.config?.parameters ?? design.config.parameters,
    },
    metadata: {
      createdAt: now,
      createdBy: design.metadata?.createdBy ?? "meta-agent",
      parentDesignId: modifications.parentDesignId ?? design.design_id,
      iterationNumber: (design.metadata?.iterationNumber ?? 0) + 1,
      tags: modifications.metadata?.tags ?? design.metadata?.tags ?? [],
    },
  };
}

/**
 * Increment semantic version
 */
function incrementVersion(version: string): string {
  const parts = version.split(".").map((p) => parseInt(p, 10));

  if (parts.length !== 3) {
    return "1.0.0";
  }

  parts[2] = (parts[2] ?? 0) + 1;

  return parts.join(".");
}

/**
 * Generate a random agent design from search space
 */
export function generateRandomDesign(
  domain: string,
  searchSpace: SearchSpace = DEFAULT_SEARCH_SPACE
): AgentDesign {
  const randomStrategy =
    searchSpace.availableStrategies[
      Math.floor(Math.random() * searchSpace.availableStrategies.length)
    ] ?? "cot";

  const randomModelIndex = Math.floor(
    Math.random() * searchSpace.availableModels.length
  );
  const randomModel = randomModelIndex < searchSpace.availableModels.length
    ? { ...searchSpace.availableModels[randomModelIndex] }
    : { ...MODEL_CONFIGS[0] };

  const numTools = Math.floor(Math.random() * 5) + 1;
  const shuffledTools = [...searchSpace.availableTools].sort(
    () => Math.random() - 0.5
  );
  const selectedTools = shuffledTools.slice(0, numTools);

  const tempRange = searchSpace.promptMutations.temperatureRange;
  const tokenRange = searchSpace.promptMutations.maxTokensRange;
  randomModel.temperature =
    tempRange[0] + Math.random() * (tempRange[1] - tempRange[0]);
  randomModel.maxTokens =
    Math.floor(tokenRange[0] + Math.random() * (tokenRange[1] - tokenRange[0]));

  const systemPrompt = generateSystemPrompt(
    randomStrategy,
    undefined,
    selectedTools
  );

  return createAgentDesign({
    domain,
    config: {
      systemPrompt,
      tools: selectedTools,
      model: randomModel,
      reasoningStrategy: randomStrategy,
      parameters: {},
    },
    metadata: {
      createdAt: new Date(),
      createdBy: "meta-agent-random",
      tags: ["generated", randomStrategy],
    },
  });
}

/**
 * Calculate diversity between two designs
 */
export function calculateDiversity(a: AgentDesign, b: AgentDesign): number {
  let differences = 0;
  let totalComparisons = 0;

  if (a.config.reasoningStrategy !== b.config.reasoningStrategy) {
    differences++;
  }
  totalComparisons++;

  const toolsA = new Set((a.config.tools ?? []).map((t) => t.name));
  const toolsB = new Set((b.config.tools ?? []).map((t) => t.name));
  const allTools = new Set([...Array.from(toolsA), ...Array.from(toolsB)]);

  if (allTools.size > 0) {
    const sharedTools = [...Array.from(toolsA)].filter((t) => toolsB.has(t)).length;
    const jaccardSimilarity =
      sharedTools / allTools.size;
    differences += 1 - jaccardSimilarity;
    totalComparisons++;
  }

  const tempA = a.config.model?.temperature ?? 0.7;
  const tempB = b.config.model?.temperature ?? 0.7;
  differences += Math.abs(tempA - tempB) / 1.0;
  totalComparisons++;

  return differences / totalComparisons;
}