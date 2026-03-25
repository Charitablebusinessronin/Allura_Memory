# ADAS: Automated Agent Design & Assistant System

> API documentation for the ADAS module. Handles evolutionary design, evaluation, and governance of AI agents.

---

## Overview

ADAS is a Docker-native system for designing, evaluating, and evolving AI agents using evolutionary search. It uses Ollama cloud models for LLM inference and implements HITL (Human-in-the-Loop) governance for agent promotion.

### Architecture

```
Meta Agent → Search Loop → Evaluation Harness → Sandbox → PostgreSQL/Neo4j
                                                            ↓
                                                    HITL Approval
                                                            ↓
                                                    Active AgentDesign
```

---

## Ollama Client (`src/lib/ollama/client.ts`)

### Setup

```typescript
import { OllamaClient, getOllamaClient } from '@/lib/ollama/client';

// From environment (OLLAMA_BASE_URL or OLLAMA_CLOUD_URL)
const client = OllamaClient.fromEnv();

// Direct configuration
const client = new OllamaClient({
  baseUrl: 'https://ollama.com',
  timeoutMs: 120_000,
});
```

### Methods

#### `listModels(): Promise<OllamaModel[]>`
Returns available Ollama models.

```typescript
const models = await client.listModels();
```

#### `complete(prompt, model, options?): Promise<OllamaCompletion>`
Generate completion with token tracking (used by EvaluationHarness).

```typescript
const result = await client.complete(
  'What is 2+2?',
  'qwen3-coder-next:cloud',
  { temperature: 0.7, num_predict: 4096 }
);

// result.text       — completion text
// result.usage      — { promptTokens, completionTokens, totalTokens }
// result.durationMs — execution time
```

#### `generate(req): Promise<GenerateResponse>`
Raw generate API with streaming support.

#### `chat(req): Promise<OllamaChatResponse>`
Chat completion for chat-optimized models.

---

## Model Configuration

### ModelTier

```typescript
type ModelTier = 'stable' | 'experimental';
// Stable: proven models for baseline comparisons
// Experimental: latest models, opt-in per search
```

### MODEL_CONFIGS

Located in `src/lib/adas/agent-design.ts`:

| modelId | Tier | Description |
|---------|------|-------------|
| `qwen3-coder-next:cloud` | Stable | Code generation specialist (80B) |
| `deepseek-v3.2:cloud` | Stable | General reasoning (671B) |
| `minimax-m2.7:cloud` | Experimental | Fast reasoning |
| `kimi-k2.5:cloud` | Experimental | Reasoning |
| `glm-5:cloud` | Experimental | General reasoning |
| `qwen3-vl:235b-cloud` | Experimental | Vision + reasoning (235B) |

### Helper Functions

```typescript
import {
  getModelsByTier,
  getStableModels,
  getExperimentalModels,
} from '@/lib/adas/agent-design';

// Filter by tier
const stable = getStableModels();
const experimental = getExperimentalModels();

// Or use in search config
const config = createSearchConfig({
  searchSpace: {
    availableModels: getModelsByTier('stable'), // baseline only
  },
});
```

### Adding New Models

```typescript
// src/lib/adas/agent-design.ts
{
  provider: "ollama",
  modelId: "new-model:cloud",
  temperature: 0.7,
  maxTokens: 8192,
  tier: "experimental",
  description: "What this model excels at",
}
```

---

## Agent Design

### AgentDesign Interface

```typescript
interface AgentDesign {
  design_id: string;
  name: string;
  version: string;
  domain: string;
  description: string;
  config: AgentDesignConfig;
  metadata?: AgentDesignMetadata;
}
```

### AgentDesignConfig

```typescript
interface AgentDesignConfig {
  systemPrompt?: string;
  tools?: AgentTool[];
  model?: ModelConfig;
  reasoningStrategy?: ReasoningStrategy;
  parameters?: Record<string, unknown>;
}
```

### ReasoningStrategy

```typescript
type ReasoningStrategy = 'cot' | 'react' | 'plan-and-execute' | 'reflexion' | 'custom';
// cot: Chain of Thought
// react: Reasoning + Acting
// plan-and-execute: Plan then execute
// reflexion: Self-correction loop
```

---

## Evaluation Harness

### Setup

```typescript
import { createEvaluationHarness } from '@/lib/adas';

const harness = createEvaluationHarness({
  groupId: 'my-project',
  domain: {
    domainId: 'math',
    name: 'Math Domain',
    description: 'Basic arithmetic evaluation',
    groundTruth: [
      { id: 't1', input: '2+2', expectedOutput: '4' },
      { id: 't2', input: '3*3', expectedOutput: '9' },
    ],
    accuracyWeight: 0.5,
    costWeight: 0.25,
    latencyWeight: 0.25,
  },
});
```

### Evaluate Candidate

```typescript
const result = await harness.evaluateCandidate(design, forwardFn);

// result.design      — the evaluated design
// result.metrics     — { accuracy, cost, latencyMs, compositeScore, tokenUsage }
// result.runId       — ADAS run ID
// result.passed      — whether it met domain thresholds
```

### DomainConfig

```typescript
interface DomainConfig {
  domainId: string;
  name: string;
  description: string;
  groundTruth: GroundTruthCase[];
  accuracyWeight: number;  // 0-1, default 0.5
  costWeight: number;       // 0-1, default 0.25
  latencyWeight: number;    // 0-1, default 0.25
}

interface GroundTruthCase {
  id: string;
  input: string;
  expectedOutput: string;
}
```

---

## Sandbox Execution

### Options

```typescript
interface SandboxOptions {
  timeoutMs: number;              // Max execution time
  maxCpuPercent: number;          // CPU limit (0-100)
  maxMemoryMB: number;            // Memory limit
  networkDisabled: boolean;       // No network access
  readOnlyRootFilesystem: boolean;
  maxProcesses: number;           // Max child processes
  maxOpenFiles: number;           // Max file descriptors
}
```

### Execute in Sandbox

```typescript
import {
  createSandboxExecutor,
  evaluateCandidateInSandbox,
  DEFAULT_KMAX_STEPS,
} from '@/lib/adas/sandbox';

const result = await evaluateCandidateInSandbox(
  design,
  domain,
  'my-project',
  { timeoutMs: 30_000 },
  DEFAULT_KMAX_STEPS  // 100
);
```

---

## Promotion Workflow

### Create Proposal

```typescript
import { createPromotionProposalManager } from '@/lib/adas';

const proposals = createPromotionProposalManager(session);

const proposal = await proposals.createProposal({
  designId: 'design-uuid',
  evidence: evaluationMetrics,
  submittedBy: 'adas-agent',
});
```

### Approval Workflow

```typescript
import { createApprovalWorkflowManager } from '@/lib/adas';

// Approve
await workflow.approveProposal({
  proposalId: proposal.id,
  approvedBy: 'human-reviewer',
  notes: 'Looks good',
});

// Reject
await workflow.rejectProposal({
  proposalId: proposal.id,
  rejectedBy: 'human-reviewer',
  reason: 'Needs more accuracy',
});
```

### Status Transitions

```
candidate → pending_approval → approved → active
                              ↘ rejected
```

---

## Search Loop

### Run Meta Agent Search

```typescript
import {
  MetaAgentSearch,
  createSearchConfig,
  getStableModels,
} from '@/lib/adas';

const search = new MetaAgentSearch(
  createSearchConfig({
    searchId: 'search-001',
    groupId: 'my-project',
    domain: mathDomain,
    maxIterations: 50,
    populationSize: 10,
    eliteCount: 2,
    mutationsPerParent: 3,
    crossoverRate: 0.3,
    searchSpace: {
      availableModels: getStableModels(),
      availableStrategies: ['cot', 'react'],
    },
  })
);

const result = await search.run();

// result.finalBestDesign   — best agent design found
// result.finalBestScore    — composite score
// result.totalCandidates   — number evaluated
// result.converged        — whether search converged
```

---

## Metrics

### Calculate Metrics

```typescript
import {
  calculateAccuracy,
  calculateCost,
  calculateCompositeScore,
  rankCandidates,
} from '@/lib/adas/metrics';

// Accuracy (% passed)
const accuracy = calculateAccuracy(results, groundTruth);

// Cost from token usage
const cost = calculateCost(tokenUsage, 'qwen3-coder-next:cloud');

// Composite score
const score = calculateCompositeScore(metrics, domainConfig);

// Rank multiple candidates
const ranked = rankCandidates(candidatesWithMetrics);
```

### MODEL_PRICING

```typescript
// Per 1M tokens (for cost calculation)
MODEL_PRICING['qwen3-coder-next:cloud'] = { prompt: 0.001, completion: 0.003 };
```

---

## Mutation & Crossover

### Available Mutations

```typescript
import {
  applyRandomMutation,
  mutatePrompt,
  changeModel,
  changeStrategy,
  mutateTemperature,
  crossoverDesigns,
} from '@/lib/adas/mutations';

// Random mutation
const mutated = applyRandomMutation(design, config);

// Specific mutations
const withNewModel = changeModel(design, newModelConfig);
const withNewStrategy = changeStrategy(design, 'react');

// Crossover (combine two designs)
const offspring = crossoverDesigns(designA, designB);
```

---

## Classes

### EvaluationHarness
Core component for measuring candidate agent designs.

### SandboxExecutor
Manages Docker-based isolated execution for agent candidates.

### SafetyMonitor
Monitors Docker containers for resource violations.

### PromotionDetector
Scans ADAS runs and identifies promotion candidates.

### PromotionProposalManager
Creates and manages AgentDesign proposals in Neo4j.

### MetaAgentSearch
Implements evolutionary search algorithm for agent design discovery.

---

## Environment Variables

```bash
# Ollama
OLLAMA_BASE_URL=https://ollama.com

# Memory Layer
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=memory
POSTGRES_USER=ronin4life
NEO4J_URI=bolt://localhost:7687

# ADAS Settings
ADAS_DEFAULT_POPULATION=10
ADAS_MAX_ITERATIONS=50
ADAS_STABLE_ONLY=false
```

---

## Docker Integration

### Container

```bash
# Build ADAS container
docker build -f skills/adas-agent/Dockerfile -t adas-agent:latest .

# Run with databases
docker compose up -d postgres neo4j
docker run --rm adas-agent:latest
```

### Sandbox

- Candidates execute in nested Docker container
- Network disabled by default
- Read-only filesystem
- Resource limits enforced
