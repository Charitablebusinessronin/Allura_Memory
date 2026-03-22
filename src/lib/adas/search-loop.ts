import { randomUUID } from "crypto";
import type { Pool } from "pg";
import { getPool } from "../postgres/connection";
import { insertEvent } from "../postgres/queries/insert-trace";
import type {
  AgentDesign,
  DomainConfig,
  ForwardFn,
  CandidateRanking,
  EvaluationMetrics,
} from "./types";
import { EvaluationHarness, createEvaluationHarness } from "./evaluation-harness";
import {
  createAgentDesign,
  generateRandomDesign,
  type SearchSpace,
  DEFAULT_SEARCH_SPACE,
} from "./agent-design";
import {
  applyMutations,
  crossoverDesigns,
  type MutationRecord,
  type MutationConfig,
  DEFAULT_MUTATION_CONFIG,
} from "./mutations";

/**
 * Meta Agent Search Loop
 * Story 2.2: Execute Meta Agent Search Loop
 *
 * Implements an evolutionary search algorithm that iteratively
 * improves agent designs through mutation, evaluation, and selection.
 */

/**
 * Search configuration
 */
export interface SearchConfig {
  /** Unique identifier for this search */
  searchId: string;
  /** Group ID for tenant isolation */
  groupId: string;
  /** Target domain */
  domain: DomainConfig;
  /** Maximum iterations (Kmax from NFR7) */
  maxIterations: number;
  /** Population size per iteration */
  populationSize: number;
  /** Number of top candidates to select as parents */
  eliteCount: number;
  /** Number of random mutations per parent */
  mutationsPerParent: number;
  /** Crossover rate for combining designs */
  crossoverRate: number;
  /** Early stopping threshold (stop if no improvement after N iterations) */
  earlyStoppingPatience: number;
  /** Minimum composite score to consider successful */
  successThreshold?: number;
  /** Search space configuration */
  searchSpace?: SearchSpace;
  /** Mutation configuration */
  mutationConfig?: MutationConfig;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Search iteration result
 */
export interface SearchIteration {
  iterationNumber: number;
  population: AgentDesign[];
  rankings: CandidateRanking[];
  bestDesign: AgentDesign;
  bestScore: number;
  mutations: MutationRecord[];
  startTime: Date;
  endTime: Date;
}

/**
 * Search result
 */
export interface SearchResult {
  searchId: string;
  groupId: string;
  domain: string;
  iterations: SearchIteration[];
  finalBestDesign: AgentDesign;
  finalBestScore: number;
  totalCandidates: number;
  totalMutations: number;
  converged: boolean;
  startedAt: Date;
  completedAt: Date;
}

/**
 * Search iteration result
 */
export interface SearchStateRecord {
  id: number;
  search_id: string;
  group_id: string;
  iteration: number;
  best_design_id: string;
  best_score: number;
  population_size: number;
  mutations_applied: number;
  created_at: Date;
}

/**
 * Design storage for PostgreSQL
 * Note: Design data is stored via events/outcomes tables for trace evidence
 */
export interface StoredDesign {
  design_id: string;
  search_id: string;
  group_id: string;
  parent_design_id: string | null;
  iteration: number;
  design_data: AgentDesign;
  metrics: EvaluationMetrics | null;
  created_at: Date;
}

/**
 * Meta Agent Search class
 */
export class MetaAgentSearch {
  private config: SearchConfig;
  private harness: EvaluationHarness;
  private pool: Pool;
  private iterationHistory: SearchIteration[] = [];
  private designStore: Map<string, AgentDesign> = new Map();
  private metricsStore: Map<string, EvaluationMetrics> = new Map();

  constructor(config: SearchConfig) {
    this.config = config;
    this.harness = createEvaluationHarness({
      groupId: config.groupId,
      domain: config.domain,
      verbose: config.verbose,
    });
    this.pool = getPool();
  }

  /**
   * Execute the search loop
   * Main entry point for AC1: produce multiple candidate AgentDesign iterations
   */
  async runSearch(
    forwardFnFactory: (design: AgentDesign) => ForwardFn<unknown, unknown>
  ): Promise<SearchResult> {
    const searchId = this.config.searchId;
    const startedAt = new Date();

    await this.logSearchStart();

    let population = await this.generateInitialPopulation();

    let bestScore = 0;
    let noImprovementCount = 0;
    let totalMutations = 0;

    for (let iteration = 0; iteration < this.config.maxIterations; iteration++) {
      const iterationStart = new Date();

      if (this.config.verbose) {
        console.log(`[Search ${searchId}] Iteration ${iteration}: Evaluating ${population.length} candidates`);
      }

      const forwardFns = population.map((d) => forwardFnFactory(d));

      const rankings = await this.harness.evaluateAndRank(
        population.map((design, i) => ({
          design,
          forwardFn: forwardFns[i]!,
        }))
      );

      for (let i = 0; i < population.length; i++) {
        const design = population[i]!;
        const ranking = rankings.find((r) => r.designId === design.design_id);
        if (ranking) {
          this.designStore.set(design.design_id, design);
          const metrics = await this.computeMetricsForDesign(design, forwardFns[i]!);
          if (metrics) {
            this.metricsStore.set(design.design_id, metrics);
          }
        }
      }

      const best = rankings[0];
      if (!best) {
        throw new Error("No candidates ranked in iteration");
      }

      const bestDesign = population.find((d) => d.design_id === best.designId);
      if (!bestDesign) {
        throw new Error("Best design not found in population");
      }

      const iterationRecord: SearchIteration = {
        iterationNumber: iteration,
        population: [...population],
        rankings,
        bestDesign,
        bestScore: best.composite,
        mutations: [],
        startTime: iterationStart,
        endTime: new Date(),
      };

      await this.logIterationResults(iterationRecord);

      if (best.composite > bestScore) {
        bestScore = best.composite;
        noImprovementCount = 0;
      } else {
        noImprovementCount++;
      }

      if (
        this.config.successThreshold !== undefined &&
        best.composite >= this.config.successThreshold
      ) {
        if (this.config.verbose) {
          console.log(`[Search ${searchId}] Success threshold reached: ${best.composite}`);
        }
        break;
      }

      if (noImprovementCount >= this.config.earlyStoppingPatience) {
        if (this.config.verbose) {
          console.log(`[Search ${searchId}] Early stopping: no improvement for ${noImprovementCount} iterations`);
        }
        break;
      }

      const { newPopulation, mutations } = await this.evolvePopulation(
        rankings,
        population,
        iteration
      );

      iterationRecord.mutations = mutations;
      totalMutations += mutations.length;

      population = newPopulation;
      this.iterationHistory.push(iterationRecord);
    }

    const completedAt = new Date();
    const finalBest = this.getBestDesign();

    await this.logSearchComplete(finalBest);

    return {
      searchId,
      groupId: this.config.groupId,
      domain: this.config.domain.domainId,
      iterations: this.iterationHistory,
      finalBestDesign: finalBest.design,
      finalBestScore: finalBest.score,
      totalCandidates: this.designStore.size,
      totalMutations,
      converged: this.config.maxIterations === this.iterationHistory.length,
      startedAt,
      completedAt,
    };
  }

  /**
   * Generate initial population
   * AC1: produces multiple candidate AgentDesign iterations
   */
  private async generateInitialPopulation(): Promise<AgentDesign[]> {
    const searchSpace = this.config.searchSpace ?? DEFAULT_SEARCH_SPACE;
    const population: AgentDesign[] = [];

    for (let i = 0; i < this.config.populationSize; i++) {
      const design = generateRandomDesign(this.config.domain.domainId, searchSpace);
      design.metadata = {
        ...design.metadata,
        createdAt: design.metadata?.createdAt ?? new Date(),
        createdBy: "meta-agent-initial",
        iterationNumber: 0,
      };
      population.push(design);
      this.designStore.set(design.design_id, design);
    }

    await this.logPopulationGenerated(population, 0);

    return population;
  }

  /**
   * Evolve population using selection, crossover, and mutation
   */
  private async evolvePopulation(
    rankings: CandidateRanking[],
    currentPopulation: AgentDesign[],
    iteration: number
  ): Promise<{ newPopulation: AgentDesign[]; mutations: MutationRecord[] }> {
    const eliteCount = Math.min(this.config.eliteCount, rankings.length);
    const elites: AgentDesign[] = [];
    const allMutations: MutationRecord[] = [];

    for (let i = 0; i < eliteCount; i++) {
      const ranking = rankings[i];
      if (ranking) {
        const design = currentPopulation.find((d) => d.design_id === ranking.designId);
        if (design) {
          elites.push(design);
        }
      }
    }

    const newPopulation: AgentDesign[] = [...elites];

    const targetSize = this.config.populationSize;
    const searchSpace = this.config.searchSpace ?? DEFAULT_SEARCH_SPACE;
    const mutationConfig = this.config.mutationConfig ?? DEFAULT_MUTATION_CONFIG;

    while (newPopulation.length < targetSize) {
      const parent1 = elites[Math.floor(Math.random() * elites.length)] ?? currentPopulation[0]!;
      let child: AgentDesign;

      if (Math.random() < this.config.crossoverRate && elites.length > 1) {
        const parent2 = elites[Math.floor(Math.random() * elites.length)] ?? parent1;
        const crossoverResult = crossoverDesigns(parent1, parent2, this.config.domain.domainId);
        child = crossoverResult.child;

        allMutations.push({
          mutationId: randomUUID(),
          parentDesignId: parent1.design_id,
          childDesignId: child.design_id,
          mutationType: "crossover",
          mutationDetails: crossoverResult.details,
          timestamp: new Date(),
        });
      } else {
        const mutationResult = applyMutations(
          parent1,
          this.config.mutationsPerParent,
          mutationConfig,
          searchSpace
        );
        child = mutationResult.design;
        allMutations.push(...mutationResult.mutations);
      }

      child = {
        ...child,
        metadata: {
          ...child.metadata,
          createdAt: new Date(),
          iterationNumber: iteration + 1,
        },
      };

      newPopulation.push(child);
      this.designStore.set(child.design_id, child);
    }

    await this.logPopulationEvolved(newPopulation, iteration, allMutations);

    return { newPopulation, mutations: allMutations };
  }

  /**
   * Compute metrics for a design
   */
  private async computeMetricsForDesign(
    design: AgentDesign,
    forwardFn: ForwardFn<unknown, unknown>
  ): Promise<EvaluationMetrics | null> {
    try {
      const result = await this.harness.evaluateCandidate(design, forwardFn);
      return result.metrics;
    } catch (error) {
      if (this.config.verbose) {
        console.error(`[Search] Failed to compute metrics for ${design.design_id}:`, error);
      }
      return null;
    }
  }

  /**
   * Get the best design from the search
   */
  private getBestDesign(): { design: AgentDesign; score: number } {
    let bestDesign: AgentDesign | null = null;
    let bestScore = 0;

    for (const [designId, metrics] of Array.from(this.metricsStore.entries())) {
      if (metrics.composite > bestScore) {
        bestScore = metrics.composite;
        const stored = this.designStore.get(designId);
        if (stored) {
          bestDesign = stored;
        }
      }
    }

    if (!bestDesign && this.iterationHistory.length > 0) {
      const lastIteration = this.iterationHistory[this.iterationHistory.length - 1];
      if (lastIteration) {
        bestDesign = lastIteration.bestDesign;
        bestScore = lastIteration.bestScore;
      }
    }

    if (!bestDesign) {
      const firstDesign = this.designStore.values().next().value;
      if (firstDesign) {
        bestDesign = firstDesign;
        bestScore = 0;
      } else {
        bestDesign = createAgentDesign({ domain: this.config.domain.domainId });
        bestScore = 0;
      }
    }

    return { design: bestDesign, score: bestScore };
  }

  /**
   * Log search start to PostgreSQL
   */
  private async logSearchStart(): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO adas_runs (group_id, run_id, domain, config, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          this.config.groupId,
          this.config.searchId,
          this.config.domain.domainId,
          JSON.stringify({
            maxIterations: this.config.maxIterations,
            populationSize: this.config.populationSize,
            eliteCount: this.config.eliteCount,
            successThreshold: this.config.successThreshold,
          }),
          "running",
        ]
      );

      await insertEvent({
        group_id: this.config.groupId,
        event_type: "search_started",
        agent_id: "meta-agent-search",
        workflow_id: this.config.searchId,
        metadata: {
          searchId: this.config.searchId,
          domain: this.config.domain.domainId,
          config: {
            maxIterations: this.config.maxIterations,
            populationSize: this.config.populationSize,
          },
        },
        status: "completed",
      });
    } catch (error) {
      if (this.config.verbose) {
        console.error("[Search] Failed to log search start:", error);
      }
    }
  }

  /**
   * Log iteration results to PostgreSQL
   * AC2: log each iteration as raw evidence
   */
  private async logIterationResults(iteration: SearchIteration): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE adas_runs 
         SET best_design_id = $1, best_score = $2 
         WHERE run_id = $3`,
        [
          iteration.bestDesign.design_id,
          iteration.bestScore,
          this.config.searchId,
        ]
      );

      await insertEvent({
        group_id: this.config.groupId,
        event_type: "search_iteration",
        agent_id: "meta-agent-search",
        workflow_id: this.config.searchId,
        metadata: {
          searchId: this.config.searchId,
          iteration: iteration.iterationNumber,
          bestDesignId: iteration.bestDesign.design_id,
          bestScore: iteration.bestScore,
          populationSize: iteration.population.length,
          mutationsCount: iteration.mutations.length,
        },
        status: "completed",
      });
    } catch (error) {
      if (this.config.verbose) {
        console.error("[Search] Failed to log iteration results:", error);
      }
    }
  }

  /**
   * Log population generated
   * Uses events table for trace evidence
   */
  private async logPopulationGenerated(
    population: AgentDesign[],
    iteration: number
  ): Promise<void> {
    try {
      await insertEvent({
        group_id: this.config.groupId,
        event_type: "population_generated",
        agent_id: "meta-agent-search",
        workflow_id: this.config.searchId,
        metadata: {
          searchId: this.config.searchId,
          iteration,
          populationSize: population.length,
          designIds: population.map((d) => d.design_id),
        },
        status: "completed",
      });
    } catch (error) {
      if (this.config.verbose) {
        console.error("[Search] Failed to log population:", error);
      }
    }
  }

  /**
   * Log population evolved
   * Uses events table for trace evidence
   */
  private async logPopulationEvolved(
    population: AgentDesign[],
    iteration: number,
    mutations: MutationRecord[]
  ): Promise<void> {
    try {
      await insertEvent({
        group_id: this.config.groupId,
        event_type: "population_evolved",
        agent_id: "meta-agent-search",
        workflow_id: this.config.searchId,
        metadata: {
          searchId: this.config.searchId,
          iteration,
          populationSize: population.length,
          mutationsCount: mutations.length,
          mutations: mutations.map((m) => ({
            mutationId: m.mutationId,
            type: m.mutationType,
            parentId: m.parentDesignId,
            childId: m.childDesignId,
          })),
        },
        status: "completed",
      });
    } catch (error) {
      if (this.config.verbose) {
        console.error("[Search] Failed to log population evolution:", error);
      }
    }
  }

  /**
   * Log search completion
   */
  private async logSearchComplete(result: { design: AgentDesign; score: number }): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE adas_runs 
         SET status = $1, best_design_id = $2, best_score = $3, completed_at = NOW()
         WHERE run_id = $4`,
        ["completed", result.design.design_id, result.score, this.config.searchId]
      );

      await insertEvent({
        group_id: this.config.groupId,
        event_type: "search_completed",
        agent_id: "meta-agent-search",
        workflow_id: this.config.searchId,
        metadata: {
          searchId: this.config.searchId,
          bestDesignId: result.design.design_id,
          bestScore: result.score,
          totalCandidates: this.designStore.size,
        },
        status: "completed",
      });
    } catch (error) {
      if (this.config.verbose) {
        console.error("[Search] Failed to log search completion:", error);
      }
    }
  }

  /**
   * Get iteration history
   */
  getIterationHistory(): SearchIteration[] {
    return [...this.iterationHistory];
  }

  /**
   * Get all designs generated during search
   */
  getAllDesigns(): AgentDesign[] {
    return [...Array.from(this.designStore.values())];
  }

  /**
   * Get metrics for a specific design
   */
  getDesignMetrics(designId: string): EvaluationMetrics | undefined {
    return this.metricsStore.get(designId);
  }
}

/**
 * Create a search configuration with defaults
 */
export function createSearchConfig(
  groupId: string,
  domain: DomainConfig,
  options: Partial<SearchConfig> = {}
): SearchConfig {
  return {
    searchId: options.searchId ?? randomUUID(),
    groupId,
    domain,
    maxIterations: options.maxIterations ?? 10,
    populationSize: options.populationSize ?? 5,
    eliteCount: options.eliteCount ?? 2,
    mutationsPerParent: options.mutationsPerParent ?? 2,
    crossoverRate: options.crossoverRate ?? 0.3,
    earlyStoppingPatience: options.earlyStoppingPatience ?? 3,
    successThreshold: options.successThreshold,
    searchSpace: options.searchSpace ?? DEFAULT_SEARCH_SPACE,
    mutationConfig: options.mutationConfig ?? DEFAULT_MUTATION_CONFIG,
    verbose: options.verbose ?? false,
  };
}

/**
 * Run a meta agent search
 * Convenience function for AC1, AC2, AC3
 */
export async function runMetaAgentSearch(
  groupId: string,
  domain: DomainConfig,
  forwardFnFactory: (design: AgentDesign) => ForwardFn<unknown, unknown>,
  options: Partial<SearchConfig> = {}
): Promise<SearchResult> {
  const config = createSearchConfig(groupId, domain, options);
  const search = new MetaAgentSearch(config);

  return search.runSearch(forwardFnFactory);
}