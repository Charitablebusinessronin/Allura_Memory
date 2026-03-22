import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import {
  MetaAgentSearch,
  createSearchConfig,
  runMetaAgentSearch,
  type SearchConfig,
  type SearchResult,
} from "./search-loop";
import type { AgentDesign, DomainConfig, ForwardFn, EvaluationMetrics } from "./types";
import { createAgentDesign, TOOL_LIBRARY, MODEL_CONFIGS } from "./agent-design";
import { closePool } from "../postgres/connection";
import { initializeSchema } from "../postgres/schema/index";

const mockDomain: DomainConfig = {
  domainId: "test-domain",
  name: "Test Domain",
  description: "Test domain for search loop tests",
  groundTruth: [
    {
      id: "test-1",
      input: "Test input",
      expectedOutput: "Test output",
    },
  ],
  accuracyWeight: 0.5,
  costWeight: 0.25,
  latencyWeight: 0.25,
};

const createMockForwardFn = (design: AgentDesign): ForwardFn<unknown, unknown> => {
  return async (input: unknown) => {
    return { result: `Processed: ${JSON.stringify(input)}`, design: design.design_id };
  };
};

describe("SearchLoop Module", () => {
  beforeAll(async () => {
    process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
    process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5432";
    process.env.POSTGRES_DB = process.env.POSTGRES_DB || "memory";
    process.env.POSTGRES_USER = process.env.POSTGRES_USER || "ronin4life";
    process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "KaminaTHC*";

    const result = await initializeSchema();
    expect(result.success).toBe(true);
  });

  afterAll(async () => {
    await closePool();
  });

  describe("createSearchConfig", () => {
    it("should create config with defaults", () => {
      const config = createSearchConfig("test-group", mockDomain);

      expect(config.searchId).toBeDefined();
      expect(config.groupId).toBe("test-group");
      expect(config.domain).toBe(mockDomain);
      expect(config.maxIterations).toBe(10);
      expect(config.populationSize).toBe(5);
      expect(config.eliteCount).toBe(2);
      expect(config.mutationsPerParent).toBe(2);
      expect(config.crossoverRate).toBe(0.3);
      expect(config.earlyStoppingPatience).toBe(3);
    });

    it("should accept custom options", () => {
      const config = createSearchConfig("test-group", mockDomain, {
        maxIterations: 20,
        populationSize: 10,
        eliteCount: 3,
        successThreshold: 0.9,
      });

      expect(config.maxIterations).toBe(20);
      expect(config.populationSize).toBe(10);
      expect(config.eliteCount).toBe(3);
      expect(config.successThreshold).toBe(0.9);
    });

    it("should generate unique search IDs", () => {
      const config1 = createSearchConfig("group", mockDomain);
      const config2 = createSearchConfig("group", mockDomain);

      expect(config1.searchId).not.toBe(config2.searchId);
    });
  });

  describe("MetaAgentSearch", () => {
    let searchConfig: SearchConfig;

    beforeEach(() => {
      searchConfig = createSearchConfig("test-group", mockDomain, {
        maxIterations: 2,
        populationSize: 3,
        eliteCount: 1,
        earlyStoppingPatience: 3,
        verbose: false,
      });
    });

    describe("constructor", () => {
      it("should create a search instance", () => {
        const search = new MetaAgentSearch(searchConfig);

        expect(search).toBeDefined();
        expect(search.getIterationHistory()).toEqual([]);
        expect(search.getAllDesigns()).toEqual([]);
      });
    });

    describe("runSearch", () => {
      it("should handle failed forward functions gracefully", async () => {
        const config = createSearchConfig("test-group", mockDomain, {
          maxIterations: 1,
          populationSize: 2,
        });
        const search = new MetaAgentSearch(config);

        const failedForwardFn: ForwardFn<unknown, unknown> = async () => {
          throw new Error("Forward function failed");
        };

        const result = await search.runSearch(() => failedForwardFn);

        expect(result).toBeDefined();
        expect(result.finalBestDesign).toBeDefined();
      }, 10000);
    });

    describe("get methods", () => {
      it("should return empty iteration history before search", () => {
        const search = new MetaAgentSearch(searchConfig);

        expect(search.getIterationHistory()).toEqual([]);
        expect(search.getAllDesigns()).toEqual([]);
      });

      it("should return undefined for non-existent design metrics", () => {
        const search = new MetaAgentSearch(searchConfig);

        expect(search.getDesignMetrics("non-existent")).toBeUndefined();
      });
    });
  });

  describe("Integration Tests", () => {
    it("should generate initial population of correct size", async () => {
      const config = createSearchConfig("test-group", mockDomain, {
        maxIterations: 1,
        populationSize: 3,
      });

      const search = new MetaAgentSearch(config);

      const result = await search.runSearch(createMockForwardFn);

      expect(result.totalCandidates).toBeGreaterThanOrEqual(3);
    }, 15000);

    it("should run for specified iterations", async () => {
      const config = createSearchConfig("test-group", mockDomain, {
        maxIterations: 2,
        populationSize: 2,
        earlyStoppingPatience: 10,
      });

      const search = new MetaAgentSearch(config);

      const result = await search.runSearch(createMockForwardFn);

      expect(result.iterations.length).toBeGreaterThanOrEqual(1);
      expect(result.iterations.length).toBeLessThanOrEqual(2);
    }, 15000);

    it("should return a final best design", async () => {
      const config = createSearchConfig("test-group", mockDomain, {
        maxIterations: 1,
        populationSize: 2,
      });

      const search = new MetaAgentSearch(config);

      const result = await search.runSearch(createMockForwardFn);

      expect(result.finalBestDesign).toBeDefined();
      expect(result.finalBestDesign.design_id).toBeDefined();
      expect(result.finalBestDesign.domain).toBe(mockDomain.domainId);
      expect(result.finalBestScore).toBeGreaterThanOrEqual(0);
    }, 15000);

    it("should use evaluation harness for scoring (AC3)", async () => {
      const config = createSearchConfig("test-group", mockDomain, {
        maxIterations: 1,
        populationSize: 2,
      });

      const search = new MetaAgentSearch(config);

      const result = await search.runSearch(createMockForwardFn);

      for (const iteration of result.iterations) {
        expect(iteration.rankings).toBeDefined();
        expect(iteration.rankings.length).toBeGreaterThan(0);
        expect(iteration.rankings[0]?.composite).toBeDefined();
        expect(iteration.rankings[0]?.accuracy).toBeDefined();
        expect(iteration.rankings[0]?.cost).toBeDefined();
        expect(iteration.rankings[0]?.latency).toBeDefined();
      }
    }, 15000);

    it("should log iterations (AC2)", async () => {
      const config = createSearchConfig("test-group", mockDomain, {
        maxIterations: 2,
        populationSize: 2,
      });

      const search = new MetaAgentSearch(config);

      const result = await search.runSearch(createMockForwardFn);

      expect(result.iterations[0]?.startTime).toBeInstanceOf(Date);
      expect(result.iterations[0]?.endTime).toBeInstanceOf(Date);
      expect(result.iterations[0]?.mutations).toBeDefined();
    }, 15000);
  });

  describe("Search Result Properties", () => {
    it("should include search metadata in result", async () => {
      const config = createSearchConfig("test-group", mockDomain, {
        maxIterations: 1,
        populationSize: 2,
      });

      const search = new MetaAgentSearch(config);

      const result = await search.runSearch(createMockForwardFn);

      expect(result.searchId).toBe(config.searchId);
      expect(result.groupId).toBe("test-group");
      expect(result.domain).toBe(mockDomain.domainId);
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
    }, 15000);

    it("should track total mutations", async () => {
      const config = createSearchConfig("test-group", mockDomain, {
        maxIterations: 1,
        populationSize: 3,
        mutationsPerParent: 2,
      });

      const search = new MetaAgentSearch(config);

      const result = await search.runSearch(createMockForwardFn);

      expect(result.totalMutations).toBeGreaterThanOrEqual(0);
    }, 15000);
  });

  describe("Edge Cases", () => {
    it("should handle early stopping on success threshold", async () => {
      const config = createSearchConfig("test-group", mockDomain, {
        maxIterations: 10,
        populationSize: 2,
        successThreshold: 10.0,
      });

      const search = new MetaAgentSearch(config);

      const result = await search.runSearch(createMockForwardFn);

      expect(result.iterations.length).toBeLessThan(10);
    }, 15000);

    it("should handle population size of 1", async () => {
      const config = createSearchConfig("test-group", mockDomain, {
        maxIterations: 1,
        populationSize: 1,
        eliteCount: 1,
      });

      const search = new MetaAgentSearch(config);

      const result = await search.runSearch(createMockForwardFn);

      expect(result).toBeDefined();
      expect(result.finalBestDesign).toBeDefined();
    }, 15000);
  });
});