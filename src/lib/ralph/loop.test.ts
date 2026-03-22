/**
 * Ralph Loop Tests
 * Story 3.4: Execute Iterative Ralph Development Loops
 * 
 * AC 1: Agent continues to refine output despite setbacks
 * AC 2: Loop terminates when promise detected or Kmax reached
 * AC 3: Agent self-corrects and retries with modified approach
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RalphLoop, createRalphLoop, runRalphLoop } from "./loop";
import type { RalphState, RalphPlan, RalphCallbacks } from "./types";
import type { SessionId, HaltReason } from "../budget/types";

describe("RalphLoop", () => {
  let sessionId: SessionId;

  beforeEach(() => {
    sessionId = {
      groupId: "test-group",
      agentId: "test-agent",
      sessionId: "test-session",
    };
  });

  describe("AC 1: Continues to refine output despite setbacks", () => {
    it("should continue iterations after errors", async () => {
      let iterations = 0;
      let output = "";

      const callbacks = {
        act: async () => {
          iterations++;
          if (iterations < 3) {
            // Self-corrector will classify as transient and retry
            throw new Error("Transient temporary failure - will retry");
          }
          output = `result-${iterations}`;
          return output;
        },
        check: async (out: string) => out.includes("result"),
        onError: () => {}, // Handle error but continue
      };

      const result = await runRalphLoop(
        sessionId,
        "start",
        "result",
        callbacks.act,
        { maxIterations: 10, enableSelfCorrection: true },
        callbacks.check,
      );

      // Should have continued despite error
      expect(iterations).toBeGreaterThanOrEqual(3);
      expect(result.success).toBe(true);
    });

    it("should track errors and corrections", async () => {
      let iterations = 0;
      const errors: string[] = [];

      const actFn = async () => {
        iterations++;
        if (iterations < 4) {
          throw new Error("Transient test error");
        }
        return `output-${iterations}`;
      };

      const checkFn = async (out: string) => out.startsWith("output");

      const result = await runRalphLoop(
        sessionId,
        "start",
        "output",
        actFn,
        { maxIterations: 10, enableSelfCorrection: true },
        checkFn,
      );

      // Should have recorded errors before succeeding
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.success).toBe(true);
    });

    it("should maintain state through iterations", async () => {
      const states: RalphState[] = [];

      const actFn = async () => {
        return "output";
      };

      const callbacks: RalphCallbacks = {
        act: actFn,
        check: async () => true,
      };

      const loop = createRalphLoop(sessionId, "input", "output", { maxIterations: 5 }, callbacks);

      await loop.execute();
      const finalState = loop.getState();

      expect(finalState.iterationsUsed).toBeLessThanOrEqual(5);
    });
  });

  describe("AC 2: Terminates when promise detected or Kmax reached", () => {
    it("should terminate when promise is detected", async () => {
      let iterations = 0;

      const actFn = async () => {
        iterations++;
        return `iteration-${iterations}`;
      };

      const checkFn = async (out: string) => out === "iteration-3";

      const result = await runRalphLoop(sessionId, "start", "iteration-3", actFn, { maxIterations: 10 }, checkFn);

      expect(result.success).toBe(true);
      expect(result.completionPromiseMet).toBe(true);
      expect(result.iterations).toBe(3);
    });

    it("should terminate when Kmax is reached without promise", async () => {
      let iterations = 0;

      const actFn = async () => {
        iterations++;
        return `iteration-${iterations}`;
      };

      const checkFn = async () => false; // Never complete

      const result = await runRalphLoop(
        sessionId,
        "start",
        "NEVER_MATCH",
        actFn,
        { maxIterations: 5 },
        checkFn,
      );

      expect(result.success).toBe(false);
      expect(result.completionPromiseMet).toBe(false);
      expect(result.haltReason?.type).toBe("kmax_exceeded");
      expect(iterations).toBe(5);
    });

    it("should terminate early on completion before Kmax", async () => {
      let iterations = 0;

      const actFn = async () => {
        iterations++;
        return `${iterations}`;
      };

      const checkFn = async (out: string) => out === "2";

      const result = await runRalphLoop(
        sessionId,
        "start",
        "2",
        actFn,
        { maxIterations: 100 },
        checkFn,
      );

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(2);
      expect(result.iterations).toBeLessThan(100);
    });
  });

  describe("AC 3: Self-corrects and retries with modified approach", () => {
    it("should apply backoff after errors", async () => {
      let errorCount = 0;
      const backoffTimes: number[] = [];

      const actFn = async () => {
        errorCount++;
        if (errorCount < 3) {
          throw new Error("Temporary failure");
        }
        return "success";
      };

      const startTime = Date.now();
      const result = await runRalphLoop(
        sessionId,
        "start",
        "success",
        actFn,
        {
          maxIterations: 10,
          backoffStrategy: {
            type: "exponential",
            initialDelayMs: 10,
            maxDelayMs: 100,
            multiplier: 2,
            jitterMs: 0,
          },
        },
      );

      // Should have eventually succeeded
      expect(result.success).toBe(true);
      // Should have recorded corrections
      expect(result.corrections.length).toBeGreaterThan(0);
    });

    it("should classify errors appropriately", async () => {
      const errors: string[] = [];
      let iterations = 0;

      const result = await runRalphLoop(
        sessionId,
        "start",
        "success",
        async () => {
          iterations++;
          if (iterations === 1) {
            throw new Error("Operation timeout exceeded");
          }
          if (iterations === 2) {
            throw new Error("Rate limit exceeded for API");
          }
          return "success";
        },
        { maxIterations: 10, enableSelfCorrection: true },
      );

      // Should have recorded errors
      expect(result.errors.length).toBeGreaterThan(0);
      // First error classification
      expect(result.errors[0].classification).toBe("timeout");
    });

    it("should abort on critical errors", async () => {
      const actFn = async () => {
        throw new Error("Critical system failure");
      };

      const result = await runRalphLoop(
        sessionId,
        "start",
        "never",
        actFn,
        { maxIterations: 10 },
      );

      expect(result.success).toBe(false);
      expect(result.haltReason?.type).toBe("critical_error");
    });

    it("should escalate after max retries", async () => {
      let attempts = 0;

      const actFn = async () => {
        attempts++;
        throw new Error("Non-critical but persistent error");
      };

      const result = await runRalphLoop(
        sessionId,
        "start",
        "never",
        actFn,
        {
          maxIterations: 10,
          enableSelfCorrection: true,
        },
      );

      // Should stop after exhausting retries
      expect(result.success).toBe(false);
      expect(attempts).toBeLessThanOrEqual(10);
    });
  });

  describe("Phase execution", () => {
    it("should cycle through perceive-plan-act-check-adapt phases", async () => {
      const phases: string[] = [];

      const callbacks: RalphCallbacks = {
        perceive: async () => {
          phases.push("perceive");
          return {
            timestamp: new Date(),
            context: undefined,
            history: [],
            budgetStatus: {
              tokensUsed: 0,
              toolCallsUsed: 0,
              timeElapsedMs: 0,
              costUsedUsd: 0,
              stepsCompleted: 0,
              budgetRemaining: 10,
            },
            stuckPatterns: [],
          };
        },
        plan: async () => {
          phases.push("plan");
          return {
            description: "Test plan",
            steps: [],
            estimatedIterations: 2,
            successCriteria: [],
            risks: [],
            modificationCount: 0,
          };
        },
        act: async () => {
          phases.push("act");
          return "result";
        },
        check: async () => {
          phases.push("check");
          return true;
        },
        adapt: async () => {
          phases.push("adapt");
          return {
            continue: false,
            reason: "Complete",
            nextPhase: "adapt",
          };
        },
      };

      const loop = createRalphLoop(
        sessionId,
        "start",
        "result",
        { maxIterations: 5 },
        callbacks,
      );

      await loop.execute();

      // Should have called perceive, plan, act, check at least once
      expect(phases).toContain("perceive");
      expect(phases).toContain("plan");
      expect(phases).toContain("act");
      expect(phases).toContain("check");
    });

    it("should track step history", async () => {
      let iterations = 0;

      const actFn = async () => {
        iterations++;
        return `output-${iterations}`;
      };

      const checkFn = async (out: string) => iterations >= 3;

      const result = await runRalphLoop(
        sessionId,
        "start",
        "output-3",
        actFn,
        { maxIterations: 5 },
        checkFn,
      );

      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps[result.steps.length - 1].output).toContain("output");
    });
  });

  describe("State management", () => {
    it("should provide current state for monitoring", async () => {
      let checkCount = 0;

      const actFn = async () => {
        checkCount++;
        return `output-${checkCount}`;
      };

      const checkFn = async () => checkCount >= 2;

      const loop = createRalphLoop(
        sessionId,
        "start",
        "output-2",
        { maxIterations: 5 },
        { act: actFn, check: checkFn },
      );

      const stateBefore = loop.getState();
      expect(stateBefore.currentIteration).toBe(0);

      const result = await loop.execute();

      const stateAfter = loop.getState();
      expect(result.iterations).toBeGreaterThan(0);
    });

    it("should allow external halt", async () => {
      let iterations = 0;
      let halted = false;

      const loop = createRalphLoop(
        sessionId,
        "start",
        "never-match",
        { maxIterations: 100 },
        {
          act: async () => {
            iterations++;
            return `output-${iterations}`;
          },
          check: async () => {
            // Halt after 3 iterations
            if (iterations >= 3 && !halted) {
              halted = true;
              loop.halt({ type: "critical_error", error: "External halt" });
            }
            return false;
          },
        },
      );

      const result = await loop.execute();

      expect(result.success).toBe(false);
      expect(result.haltReason?.type).toBe("critical_error");
      expect(iterations).toBeLessThanOrEqual(4);
    });
  });

  describe("Callbacks", () => {
    it("should call onProgress callback for each step", async () => {
      const progressSteps: number[] = [];
      let iterations = 0;

      const loop = createRalphLoop(
        sessionId,
        "start",
        "done",
        { maxIterations: 5 },
        {
          act: async () => {
            iterations++;
            return `done-${iterations}`;
          },
          check: async () => iterations >= 2,
          onProgress: (step) => {
            progressSteps.push(step.iteration);
          },
        },
      );

      await loop.execute();

      expect(progressSteps.length).toBeGreaterThan(0);
    });

    it("should call onError callback for errors", async () => {
      const errors: string[] = [];
      let count = 0;

      const loop = createRalphLoop(
        sessionId,
        "start",
        "done",
        { maxIterations: 5 },
        {
          act: async () => {
            count++;
            if (count < 2) {
              throw new Error("Test error");
            }
            return "done";
          },
          check: async () => count >= 2,
          onError: (error) => {
            errors.push(error.message);
          },
        },
      );

      await loop.execute();

      expect(errors.length).toBeGreaterThan(0);
    });

    it("should call onHalt callback when halted", async () => {
      const halts: string[] = [];
      let iterations = 0;

      const loop = createRalphLoop(
        sessionId,
        "start",
        "never",
        { maxIterations: 3 },
        {
          act: async () => {
            iterations++;
            return "never done";
          },
          check: async () => false,
          onHalt: (reason: HaltReason) => {
            halts.push(reason.type);
          },
        },
      );

      await loop.execute();

      expect(halts.length).toBeGreaterThan(0);
      expect(halts[0]).toBe("kmax_exceeded");
    });
  });

  describe("Edge cases", () => {
    it("should handle synchronous completion on first iteration", async () => {
      const result = await runRalphLoop(
        sessionId,
        "immediate-result",
        "immediate-result",
        async () => "immediate-result",
        { maxIterations: 5 },
        async () => true,
      );

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(1);
    });

    it("should handle empty output", async () => {
      const result = await runRalphLoop(
        sessionId,
        "",
        "",
        async () => "",
        { maxIterations: 5 },
      );

      expect(result.success).toBe(true);
    });

    it("should handle complex output objects", async () => {
      const complexOutput = { data: { nested: [1, 2, 3] }, status: "complete" };

      const result = await runRalphLoop(
        sessionId,
        { input: "test" },
        { type: "condition", check: (out: typeof complexOutput) => out.status === "complete" },
        async () => complexOutput,
        { maxIterations: 5 },
      );

      expect(result.success).toBe(true);
      expect(result.output).toEqual(complexOutput);
    });

    it("should throw on double execution", async () => {
      const loop = createRalphLoop(
        sessionId,
        "start",
        "done",
        { maxIterations: 5 },
        { act: async () => "done", check: async () => true },
      );

      const promise1 = loop.execute();
      
      await expect(async () => {
        await loop.execute();
      }).rejects.toThrow("already running");

      await promise1;
    });
  });
});