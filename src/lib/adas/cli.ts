/**
 * ADAS CLI - Automated Agent Design & Assistant System
 * 
 * Runs evolutionary search to design and evaluate agents
 * using real Ollama models.
 * 
 * Usage:
 *   npx tsx src/lib/adas/cli.ts --domain math --iterations 3 --population 3
 *   npx tsx src/lib/adas/cli.ts --help
 */

import { parseArgs } from "util";
import { OllamaClient } from "../ollama/client";
import {
  createEvaluationHarness,
  rankCandidates,
  getStableModels,
  getModelsByTier,
  type DomainConfig,
  type AgentDesign,
  type ModelConfig,
} from "./index";

// =============================================================================
// Domain Configurations
// =============================================================================

const DOMAINS: Record<string, DomainConfig> = {
  math: {
    domainId: "math",
    name: "Math Domain",
    description: "Basic arithmetic and math problem solving",
    groundTruth: [
      { id: "m1", input: "What is 2+2?", expectedOutput: "4" },
      { id: "m2", input: "What is 5*3?", expectedOutput: "15" },
      { id: "m3", input: "What is 10-7?", expectedOutput: "3" },
      { id: "m4", input: "What is 8/4?", expectedOutput: "2" },
      { id: "m5", input: "What is 6+9?", expectedOutput: "15" },
    ],
    accuracyWeight: 0.7,
    costWeight: 0.15,
    latencyWeight: 0.15,
  },
  reasoning: {
    domainId: "reasoning",
    name: "Reasoning Domain",
    description: "Logical reasoning and problem solving",
    groundTruth: [
      { id: "r1", input: "If all cats are animals, and Whiskers is a cat, what is Whiskers?", expectedOutput: "animal" },
      { id: "r2", input: "What comes next: 2, 4, 6, 8?", expectedOutput: "10" },
      { id: "r3", input: "Is a square a rectangle?", expectedOutput: "yes" },
    ],
    accuracyWeight: 0.6,
    costWeight: 0.2,
    latencyWeight: 0.2,
  },
  code: {
    domainId: "code",
    name: "Code Domain",
    description: "Simple code generation and explanation",
    groundTruth: [
      { id: "c1", input: "Write a function that returns the square of a number", expectedOutput: "function" },
      { id: "c2", input: "What does console.log do?", expectedOutput: "print" },
    ],
    accuracyWeight: 0.5,
    costWeight: 0.3,
    latencyWeight: 0.2,
  },
};

// =============================================================================
// Helpers
// =============================================================================

function createDesignFromModel(domain: string, model: ModelConfig): AgentDesign {
  const { randomUUID } = require("crypto");
  const strategies = ["cot", "react", "plan-and-execute", "reflexion"] as const;
  const prompts = [
    "You are a helpful assistant. Answer questions directly and accurately.",
    "You are a precise assistant. Think step by step and provide clear answers.",
    "You are a concise assistant. Give the most accurate answer possible.",
  ];

  return {
    design_id: randomUUID(),
    name: `${domain}-agent`,
    version: "1.0.0",
    domain,
    description: `Agent using ${model.modelId} with ${strategies[Math.floor(Math.random() * strategies.length)]} strategy`,
    config: {
      systemPrompt: prompts[Math.floor(Math.random() * prompts.length)],
      reasoningStrategy: strategies[Math.floor(Math.random() * strategies.length)],
      model,
    },
  };
}

// =============================================================================
// Main CLI
// =============================================================================

interface CliOptions {
  domain: string;
  iterations: number;
  population: number;
  eliteCount: number;
  modelTier: "stable" | "experimental" | "all";
  help: boolean;
}

function showHelp(): void {
  console.log(`
🤖 ADAS CLI - Automated Agent Design & Assistant System

USAGE:
  npx tsx src/lib/adas/cli.ts [OPTIONS]

OPTIONS:
  --domain <name>       Domain to use: math, reasoning, code (default: math)
  --iterations <n>       Number of search iterations (default: 3)
  --population <n>      Population size per iteration (default: 3)
  --elite-count <n>      Number of top candidates to keep (default: 2)
  --model-tier <tier>   Model tier: stable, experimental, all (default: stable)
  --help                Show this help message

EXAMPLES:
  npx tsx src/lib/adas/cli.ts --domain math --iterations 3
  npx tsx src/lib/adas/cli.ts --domain reasoning --population 5
  npx tsx src/lib/adas/cli.ts --domain code --model-tier experimental
`);
}

async function main(): Promise<void> {
  // Parse arguments
  const { values } = parseArgs({
    options: {
      domain: { type: "string", default: "math" },
      iterations: { type: "string", default: "3" },
      population: { type: "string", default: "3" },
      "elite-count": { type: "string", default: "2" },
      "model-tier": { type: "string", default: "stable" },
      help: { type: "boolean", default: false },
    },
  });

  const opts: CliOptions = {
    domain: values.domain as string,
    iterations: parseInt(values.iterations as string, 10),
    population: parseInt(values.population as string, 10),
    eliteCount: parseInt(values["elite-count"] as string, 10),
    modelTier: values["model-tier"] as "stable" | "experimental" | "all",
    help: values.help as boolean,
  };

  if (opts.help) {
    showHelp();
    return;
  }

  // Validate domain
  const domain = DOMAINS[opts.domain];
  if (!domain) {
    console.error(`❌ Unknown domain: ${opts.domain}`);
    console.log("Available domains:", Object.keys(DOMAINS).join(", "));
    process.exit(1);
  }

  // Get models based on tier
  let models = opts.modelTier === "all" 
    ? [...getModelsByTier("stable"), ...getModelsByTier("experimental")]
    : getModelsByTier(opts.modelTier);

  if (models.length === 0) {
    console.error(`❌ No models found for tier: ${opts.modelTier}`);
    process.exit(1);
  }

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           ADAS CLI - Evolutionary Agent Design             ║
╠══════════════════════════════════════════════════════════════╣
║ Domain:        ${domain.name.padEnd(40)}║
║ Iterations:    ${String(opts.iterations).padEnd(40)}║
║ Population:    ${String(opts.population).padEnd(40)}║
║ Elite Count:   ${String(opts.eliteCount).padEnd(40)}║
║ Model Tier:    ${opts.modelTier.padEnd(40)}║
╚══════════════════════════════════════════════════════════════╝
`);

  // Initialize Ollama client
  const ollama = new OllamaClient({ 
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434" 
  });
  console.log("✅ Ollama client initialized");
  console.log(`   Base URL: ${process.env.OLLAMA_BASE_URL || "http://localhost:11434"}`);
  console.log();

  console.log("🔬 Starting evolutionary search...\n");

  const allResults: Array<{
    iteration: number;
    ranked: Array<{ designId: string; name: string; composite: number; accuracy: number; cost: number; latency: number; rank: number }>;
    bestScore: number;
    bestModel: string;
  }> = [];

  // Run evolutionary iterations
  for (let iter = 0; iter < opts.iterations; iter++) {
    const iterStart = Date.now();
    console.log(`--- Iteration ${iter + 1}/${opts.iterations} ---`);

    // Generate random population for this iteration
    const designs: AgentDesign[] = [];
    for (let i = 0; i < opts.population; i++) {
      const model = models[i % models.length];
      const design = createDesignFromModel(domain.domainId, model);
      design.name = `${domain.domainId}-agent-${iter}-${i}`;
      designs.push(design);
    }

    // Evaluate each design - create fresh harness per design to avoid runId collision
    const results = [];
    for (const design of designs) {
      const harness = createEvaluationHarness({
        groupId: "adas-cli",
        domain,
      });
      
      const model = design.config.model!;
      
      const forwardFn = async (input: unknown): Promise<string> => {
        try {
          const result = await ollama.complete(String(input), model.modelId, {
            temperature: model.temperature ?? 0.7,
            num_predict: model.maxTokens ?? 200,
          });
          return result.text;
        } catch (err) {
          console.error(`   ⚠️  Ollama error for ${model.modelId}:`, (err as Error).message);
          return "Error: could not get response";
        }
      };

      try {
        const result = await harness.evaluateCandidate(design, forwardFn);
        results.push({
          designId: design.design_id,
          name: design.name,
          metrics: result.metrics,
        });
      } catch (err) {
        console.error(`   ❌ Evaluation failed for ${design.name}:`, (err as Error).message);
        results.push({
          designId: design.design_id,
          name: design.name,
          metrics: { accuracy: 0, cost: 0, latencyMs: 0, compositeScore: 0 },
        });
      }
    }

    const candidates = results;

    // Rank candidates
    const ranked = rankCandidates(candidates, {
      accuracyWeight: domain.accuracyWeight ?? 0.5,
      costWeight: domain.costWeight ?? 0.25,
      latencyWeight: domain.latencyWeight ?? 0.25,
    });

    const best = ranked[0];
    const iterTime = Date.now() - iterStart;
    console.log(`   ✅ Best: ${best.name}`);
    console.log(`      Model: ${designs.find(d => d.design_id === best.designId)?.config.model?.modelId ?? "N/A"}`);
    console.log(`      Score: ${best.composite?.toFixed(3) ?? "N/A"}`);
    console.log(`      Accuracy: ${((best.accuracy ?? 0) * 100).toFixed(0)}%`);
    console.log(`      Time: ${iterTime}ms\n`);

    allResults.push({
      iteration: iter + 1,
      ranked,
      bestScore: best.composite,
      bestModel: designs.find(d => d.design_id === best.designId)?.config.model?.modelId ?? "unknown",
    });
  }

  // Summary
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    SEARCH COMPLETE                         ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");

  const overallBest = allResults.reduce((best, r) => 
    r.bestScore > best.bestScore ? r : best, allResults[0]);

  const bestDesign = overallBest.ranked[0];
  console.log(`║ Best Design Found:`);
  console.log(`║   Name:    ${bestDesign.name.padEnd(44)}║`);
  console.log(`║   Model:   ${overallBest.bestModel.padEnd(44)}║`);
  console.log(`║   Score:   ${overallBest.bestScore.toFixed(3).padEnd(44)}║`);
  console.log(`║   Accuracy: ${((bestDesign.accuracy ?? 0) * 100).toFixed(0)}%`.padEnd(51) + "║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("\n🎉 ADAS search complete!");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
