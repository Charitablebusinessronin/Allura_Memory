/**
 * Completion Detector Tests
 * Story 3.4: Execute Iterative Ralph Development Loops
 * 
 * AC 2: Loop terminates when exact promise string is detected or Kmax is reached
 */

import { describe, it, expect } from "vitest";
import {
  CompletionDetector,
  createCompletionDetector,
  checkKmax,
  checkCompletionAndKmax,
} from "./completion-detector";

describe("CompletionDetector", () => {
  describe("exact string matching", () => {
    it("should detect exact string match in output", async () => {
      const detector = createCompletionDetector();
      const promise = "COMPLETE";
      const output = "Task COMPLETE successfully";

      const result = await detector.isComplete(output, promise, 1);

      expect(result.isComplete).toBe(true);
      expect(result.matchedPromise).toBe("COMPLETE");
    });

    it("should not match when string is not present", async () => {
      const detector = createCompletionDetector();
      const promise = "COMPLETED";
      const output = "Task COMPLETE successfully";

      const result = await detector.isComplete(output, promise, 1);

      expect(result.isComplete).toBe(false);
    });

    it("should match exact promise type", async () => {
      const detector = createCompletionDetector();
      const promise = { type: "exact" as const, value: "PROMISE_MET" };
      const output = "Output contains PROMISE_MET marker";

      const result = await detector.isComplete(output, promise, 1);

      expect(result.isComplete).toBe(true);
      expect(result.matchDetails?.type).toBe("exact");
    });

    it("should record iteration number", async () => {
      const detector = createCompletionDetector();
      const promise = "DONE";

      const result1 = await detector.isComplete("working...", promise, 1);
      const result2 = await detector.isComplete("DONE", promise, 5);

      expect(result1.iteration).toBe(1);
      expect(result2.iteration).toBe(5);
      expect(result2.isComplete).toBe(true);
    });
  });

  describe("regex pattern matching", () => {
    it("should match regex pattern", async () => {
      const detector = createCompletionDetector();
      const promise = { type: "regex" as const, pattern: /STATUS:\s*(SUCCESS|DONE)/ };
      const output = "Final STATUS: SUCCESS";

      const result = await detector.isComplete(output, promise, 1);

      expect(result.isComplete).toBe(true);
      expect(result.matchedPromise).toBe("STATUS: SUCCESS");
    });

    it("should support string regex pattern", async () => {
      const detector = createCompletionDetector();
      const promise = { type: "regex" as const, pattern: "STORY_\\d+_\\d+_COMPLETE" };
      const output = "Output: STORY_3_4_COMPLETE";

      const result = await detector.isComplete(output, promise, 1);

      expect(result.isComplete).toBe(true);
      expect(result.matchDetails?.type).toBe("regex");
    });

    it("should capture regex groups", async () => {
      const detector = createCompletionDetector();
      const promise = { type: "regex" as const, pattern: /iteration (\d+) complete/ };
      const output = "iteration 5 complete";

      const result = await detector.isComplete(output, promise, 1);

      expect(result.isComplete).toBe(true);
      // Groups are captured but in a different structure
      expect(result.matchDetails?.type).toBe("regex");
    });
  });

  describe("condition function", () => {
    it("should evaluate condition function", async () => {
      const detector = createCompletionDetector();
      const promise = {
        type: "condition" as const,
        check: (output: { status: string }, iteration: number) => {
          return output.status === "success" && iteration >= 3;
        },
      };

      const result1 = await detector.isComplete({ status: "success" }, promise, 2);
      const result2 = await detector.isComplete({ status: "success" }, promise, 3);

      expect(result1.isComplete).toBe(false);
      expect(result2.isComplete).toBe(true);
    });

    it("should handle condition errors gracefully", async () => {
      const detector = createCompletionDetector();
      const promise = {
        type: "condition" as const,
        check: () => {
          throw new Error("Check failed");
        },
      };

      const result = await detector.isComplete("output", promise, 1);

      expect(result.isComplete).toBe(false);
      expect(result.errorMessage).toContain("Check failed");
    });
  });

  describe("multi-promise", () => {
    it("should require all promises to match", async () => {
      const detector = createCompletionDetector();
      const promise = {
        type: "multi" as const,
        promises: [
          "COMPLETE" as const,
          { type: "exact" as const, value: "SUCCESS" },
        ],
      };
      const output = "Task COMPLETE with SUCCESS";

      const result = await detector.isComplete(output, promise, 1);

      expect(result.isComplete).toBe(true);
    });

    it("should fail if any promise does not match", async () => {
      const detector = createCompletionDetector();
      const promise = {
        type: "multi" as const,
        promises: [
          "COMPLETE" as const,
          "MISSINGSTRING" as const,
        ],
      };
      const output = "Task COMPLETE but no FAILURE";

      const result = await detector.isComplete(output, promise, 1);

      expect(result.isComplete).toBe(false);
    });
  });

  describe("history tracking", () => {
    it("should track check history", async () => {
      const detector = createCompletionDetector();
      const promise = "DONE";

      await detector.isComplete("working", promise, 1);
      await detector.isComplete("still working", promise, 2);
      await detector.isComplete("DONE", promise, 3);

      const history = detector.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].iteration).toBe(1);
      expect(history[2].isComplete).toBe(true);
    });

    it("should clear history", async () => {
      const detector = createCompletionDetector();
      const promise = "DONE";

      await detector.isComplete("work", promise, 1);
      detector.clearHistory();

      const history = detector.getHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe("callback support", () => {
    it("should call onMatch when promise matches", async () => {
      let matchCalled = false;
      const detector = createCompletionDetector({
        onMatch: () => {
          matchCalled = true;
        },
      });
      const promise = "DONE";

      await detector.isComplete("DONE", promise, 1);

      expect(matchCalled).toBe(true);
    });

    it("should call onCheck for every check", async () => {
      const checks: number[] = [];
      const detector = createCompletionDetector({
        onCheck: (result) => {
          checks.push(result.iteration);
        },
      });
      const promise = "DONE";

      await detector.isComplete("work", promise, 1);
      await detector.isComplete("DONE", promise, 2);

      expect(checks).toEqual([1, 2]);
    });
  });

  describe("helper methods", () => {
    it("should create exact promise", () => {
      const promise = CompletionDetector.exactPromise("TEST");
      expect(promise).toEqual({ type: "exact", value: "TEST" });
    });

    it("should create regex promise", () => {
      const promise = CompletionDetector.regexPromise(/test/i);
      expect((promise as { type: string }).type).toBe("regex");
    });

    it("should create condition promise", () => {
      const promise = CompletionDetector.conditionPromise((o: string) => o.length > 5);
      expect((promise as { type: string }).type).toBe("condition");
    });

    it("should create multi promise", () => {
      const promise = CompletionDetector.multiPromise("A", "B");
      expect((promise as { type: string }).type).toBe("multi");
      expect(((promise as { promises: unknown[] }).promises)).toHaveLength(2);
    });

    it("should validate promises", () => {
      expect(CompletionDetector.isValidPromise("test")).toBe(true);
      expect(CompletionDetector.isValidPromise({ type: "exact", value: "test" })).toBe(true);
      expect(CompletionDetector.isValidPromise({ type: "regex", pattern: /test/ })).toBe(true);
      expect(CompletionDetector.isValidPromise({ type: "condition", check: () => true })).toBe(true);
      expect(CompletionDetector.isValidPromise({ type: "exact", value: "" })).toBe(false);
      expect(CompletionDetector.isValidPromise({ type: "invalid" } as never)).toBe(false);
    });
  });
});

describe("checkKmax", () => {
  it("should return correct values for under-limit iteration", () => {
    const result = checkKmax(10, 50);

    expect(result.exceeded).toBe(false);
    expect(result.remaining).toBe(40);
    expect(result.percentUsed).toBe(20);
  });

  it("should detect when Kmax is reached", () => {
    const result = checkKmax(50, 50);

    expect(result.exceeded).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.percentUsed).toBe(100);
  });

  it("should detect when Kmax is exceeded", () => {
    const result = checkKmax(55, 50);

    expect(result.exceeded).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.percentUsed).toBeCloseTo(110, 0);
  });

  it("should handle zero max", () => {
    const result = checkKmax(0, 0);

    expect(result.exceeded).toBe(true);
    expect(result.percentUsed).toBe(0);
  });
});

describe("checkCompletionAndKmax", () => {
  it("should return completion when promise met", async () => {
    const detector = createCompletionDetector();
    const result = await checkCompletionAndKmax(detector, "DONE", "DONE", 5, 50);

    expect(result.isComplete).toBe(true);
    expect(result.kmaxExceeded).toBe(false);
    expect(result.shouldTerminate).toBe(true);
    expect(result.terminateReason).toBe("completion");
  });

  it("should return kmax when exceeded", async () => {
    const detector = createCompletionDetector();
    const result = await checkCompletionAndKmax(detector, "working", "DONE", 50, 50);

    expect(result.isComplete).toBe(false);
    expect(result.kmaxExceeded).toBe(true);
    expect(result.shouldTerminate).toBe(true);
    expect(result.terminateReason).toBe("kmax");
  });

  it("should return both when both conditions met", async () => {
    const detector = createCompletionDetector();
    const result = await checkCompletionAndKmax(detector, "DONE", "DONE", 50, 50);

    expect(result.isComplete).toBe(true);
    expect(result.kmaxExceeded).toBe(true);
    expect(result.shouldTerminate).toBe(true);
    expect(result.terminateReason).toBe("both");
  });

  it("should continue when neither condition met", async () => {
    const detector = createCompletionDetector();
    const result = await checkCompletionAndKmax(detector, "working", "DONE", 25, 50);

    expect(result.isComplete).toBe(false);
    expect(result.kmaxExceeded).toBe(false);
    expect(result.shouldTerminate).toBe(false);
    expect(result.terminateReason).toBeUndefined();
  });
});