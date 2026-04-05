/**
 * Trace Logger Tests - Story 1.1 with ARCH-001 Integration
 * RK-01: Tenant Isolation Enforcement
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";
import {
  logTrace,
  getTracesByAgent,
  getTracesByType,
  getTraceById,
  countTraces,
  TraceValidationError,
  type TraceLog,
} from "./trace-logger";
import { getPool, closePool } from "./connection";

describe("TraceLogger - Story 1.1 + ARCH-001", () => {
  // Use valid allura-{org} format for test group ID
  const testGroupId = "allura-test";
  const testAgentId = "memory-builder-test";

  beforeEach(async () => {
    // Ensure pool is ready
    const pool = getPool();
  });

  afterEach(async () => {
    // Clean up test traces
    const pool = getPool();
    await pool.query(
      "DELETE FROM events WHERE group_id = $1 AND agent_id LIKE $2",
      [testGroupId, `${testAgentId}%`]
    );
  });

  describe("RK-01: Tenant Isolation Validation", () => {
    describe("logTrace - rejects invalid group_id formats", () => {
      it("should reject 'roninmemory' with RK-01 error", async () => {
        const trace: TraceLog = {
          agent_id: testAgentId,
          group_id: "roninmemory",
          trace_type: "contribution",
          content: "Test content",
          confidence: 0.9,
        };

        await expect(logTrace(trace)).rejects.toThrow(TraceValidationError);
        
        try {
          await logTrace(trace);
        } catch (error) {
          expect(error).toBeInstanceOf(TraceValidationError);
          expect((error as TraceValidationError).message).toContain("RK-01");
          expect((error as TraceValidationError).message).toContain("allura-{org}");
        }
      });

      it("should reject 'roninclaw-memory' (legacy format) with RK-01", async () => {
        const trace: TraceLog = {
          agent_id: testAgentId,
          group_id: "roninclaw-memory",
          trace_type: "contribution",
          content: "Test content",
          confidence: 0.9,
        };

        await expect(logTrace(trace)).rejects.toThrow(TraceValidationError);
        
        try {
          await logTrace(trace);
        } catch (error) {
          expect((error as TraceValidationError).message).toContain("RK-01");
        }
      });

      it("should reject uppercase 'ALLURA-FAITH-MEATS' with RK-01", async () => {
        const trace: TraceLog = {
          agent_id: testAgentId,
          group_id: "ALLURA-FAITH-MEATS",
          trace_type: "contribution",
          content: "Test content",
          confidence: 0.9,
        };

        await expect(logTrace(trace)).rejects.toThrow(TraceValidationError);
      });

      it("should reject 'allura' without org suffix", async () => {
        const trace: TraceLog = {
          agent_id: testAgentId,
          group_id: "allura",
          trace_type: "contribution",
          content: "Test content",
          confidence: 0.9,
        };

        await expect(logTrace(trace)).rejects.toThrow(TraceValidationError);
      });

      it("should reject empty group_id with RK-01", async () => {
        const trace: TraceLog = {
          agent_id: testAgentId,
          group_id: "",
          trace_type: "contribution",
          content: "Test content",
          confidence: 0.9,
        };

        await expect(logTrace(trace)).rejects.toThrow(TraceValidationError);
      });

      it("should accept valid allura-{org} format", async () => {
        const trace: TraceLog = {
          agent_id: testAgentId,
          group_id: testGroupId, // allura-test
          trace_type: "contribution",
          content: "Valid group_id format",
          confidence: 0.85,
        };

        const result = await logTrace(trace);
        expect(result.group_id).toBe(testGroupId);
        expect(result.id).toBeDefined();
      });

      it("should accept all known allura workspaces", async () => {
        const workspaces = [
          "allura-faith-meats",
          "allura-creative",
          "allura-personal",
          "allura-nonprofit",
          "allura-audits",
          "allura-haccp",
          "allura-default",
        ];

        for (const workspace of workspaces) {
          // Clean up after each workspace test
          const pool = getPool();
          
          const trace: TraceLog = {
            agent_id: testAgentId,
            group_id: workspace,
            trace_type: "contribution",
            content: `Test for ${workspace}`,
            confidence: 0.8,
          };

          const result = await logTrace(trace);
          expect(result.group_id).toBe(workspace);

          // Clean up
          await pool.query(
            "DELETE FROM events WHERE group_id = $1 AND agent_id = $2",
            [workspace, testAgentId]
          );
        }
      });
    });

    describe("getTracesByAgent - enforces tenant isolation", () => {
      it("should reject invalid group_id with RK-01", async () => {
        await expect(getTracesByAgent(testAgentId, "roninmemory", 10)).rejects.toThrow(
          TraceValidationError
        );
        
        try {
          await getTracesByAgent(testAgentId, "roninmemory", 10);
        } catch (error) {
          expect((error as TraceValidationError).message).toContain("RK-01");
        }
      });

      it("should return empty array for cross-tenant queries", async () => {
        // Create trace in allura-test
        await logTrace({
          agent_id: testAgentId,
          group_id: testGroupId,
          trace_type: "contribution",
          content: "Test trace",
          confidence: 0.9,
        });

        // Query from different tenant - should return empty
        const results = await getTracesByAgent(testAgentId, "allura-other-tenant", 10);
        expect(results.length).toBe(0);
      });

      it("should return results for valid group_id", async () => {
        await logTrace({
          agent_id: testAgentId,
          group_id: testGroupId,
          trace_type: "contribution",
          content: "Test trace",
          confidence: 0.9,
        });

        const results = await getTracesByAgent(testAgentId, testGroupId, 10);
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results[0].group_id).toBe(testGroupId);
      });
    });

    describe("getTracesByType - enforces tenant isolation", () => {
      it("should reject invalid group_id with RK-01", async () => {
        await expect(getTracesByType("contribution", "roninmemory", 10)).rejects.toThrow(
          TraceValidationError
        );
        
        try {
          await getTracesByType("contribution", "roninmemory", 10);
        } catch (error) {
          expect((error as TraceValidationError).message).toContain("RK-01");
        }
      });

      it("should only return traces for the specified tenant", async () => {
        // Create traces in different tenants (will fail because of validation)
        // We can only create traces with valid allura-* group_ids
        await logTrace({
          agent_id: testAgentId,
          group_id: testGroupId,
          trace_type: "decision",
          content: "Decision trace",
          confidence: 0.9,
        });

        const results = await getTracesByType("decision", testGroupId, 10);
        expect(results.every((t) => t.group_id === testGroupId)).toBe(true);
      });
    });

    describe("getTraceById - enforces tenant isolation", () => {
      it("should reject invalid group_id with RK-01", async () => {
        await expect(getTraceById(1, "roninmemory")).rejects.toThrow(
          TraceValidationError
        );
        
        try {
          await getTraceById(1, "roninmemory");
        } catch (error) {
          expect((error as TraceValidationError).message).toContain("RK-01");
        }
      });

      it("should return null for cross-tenant queries", async () => {
        // Create trace in allura-test
        const created = await logTrace({
          agent_id: testAgentId,
          group_id: testGroupId,
          trace_type: "contribution",
          content: "Test trace",
          confidence: 0.85,
        });

        // Query from different tenant - should return null
        const result = await getTraceById(created.id, "allura-other-tenant");
        expect(result).toBeNull();
      });

      it("should return trace for same tenant", async () => {
        const created = await logTrace({
          agent_id: testAgentId,
          group_id: testGroupId,
          trace_type: "contribution",
          content: "Test trace",
          confidence: 0.85,
        });

        const retrieved = await getTraceById(created.id, testGroupId);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.group_id).toBe(testGroupId);
      });
    });

    describe("countTraces - enforces tenant isolation", () => {
      it("should reject invalid group_id with RK-01", async () => {
        await expect(countTraces("roninmemory")).rejects.toThrow(
          TraceValidationError
        );
        
        try {
          await countTraces("roninmemory");
        } catch (error) {
          expect((error as TraceValidationError).message).toContain("RK-01");
        }
      });

      it("should count traces for valid group_id", async () => {
        const initialCount = await countTraces(testGroupId);

        await logTrace({
          agent_id: testAgentId,
          group_id: testGroupId,
          trace_type: "contribution",
          content: "Test",
          confidence: 0.8,
        });

        const newCount = await countTraces(testGroupId);
        expect(newCount).toBe(initialCount + 1);
      });
    });
  });

  describe("logTrace - basic functionality", () => {
    it("should log a valid trace", async () => {
      const trace: TraceLog = {
        agent_id: testAgentId,
        group_id: testGroupId,
        trace_type: "contribution",
        content: "Test trace content",
        confidence: 0.85,
      };

      const result = await logTrace(trace);

      expect(result.id).toBeDefined();
      expect(result.group_id).toBe(testGroupId);
      expect(result.agent_id).toBe(testAgentId);
      expect(result.event_type).toBe("trace.contribution");
      expect(result.metadata.confidence).toBe(0.85);
      expect(result.status).toBe("completed");
    });

    it("should reject empty agent_id", async () => {
      const trace: TraceLog = {
        agent_id: "",
        group_id: testGroupId,
        trace_type: "contribution",
        content: "Test content",
        confidence: 0.9,
      };

      await expect(logTrace(trace)).rejects.toThrow(TraceValidationError);
    });

    it("should reject invalid trace_type", async () => {
      const trace = {
        agent_id: testAgentId,
        group_id: testGroupId,
        trace_type: "invalid-type" as any,
        content: "Test content",
        confidence: 0.9,
      };

      await expect(logTrace(trace)).rejects.toThrow(TraceValidationError);
    });

    it("should reject confidence < 0", async () => {
      const trace: TraceLog = {
        agent_id: testAgentId,
        group_id: testGroupId,
        trace_type: "contribution",
        content: "Test content",
        confidence: -0.1,
      };

      await expect(logTrace(trace)).rejects.toThrow(TraceValidationError);
    });

    it("should reject confidence > 1", async () => {
      const trace: TraceLog = {
        agent_id: testAgentId,
        group_id: testGroupId,
        trace_type: "contribution",
        content: "Test content",
        confidence: 1.5,
      };

      await expect(logTrace(trace)).rejects.toThrow(TraceValidationError);
    });

    it("should log all trace types", async () => {
      const traceTypes: Array<"contribution" | "decision" | "learning" | "error"> = [
        "contribution",
        "decision",
        "learning",
        "error",
      ];

      for (const traceType of traceTypes) {
        const trace: TraceLog = {
          agent_id: testAgentId,
          group_id: testGroupId,
          trace_type: traceType,
          content: `Test ${traceType}`,
          confidence: 0.8,
        };

        const result = await logTrace(trace);
        expect(result.event_type).toBe(`trace.${traceType}`);
      }
    });
  });

  describe("TraceValidationError - includes RK-01 code", () => {
    it("should have code property set to TENANT_ERROR_CODE", () => {
      const error = new TraceValidationError("Test error");
      expect(error.code).toBe("RK-01");
      expect(error.name).toBe("TraceValidationError");
    });

    it("should include RK-01 in error message from tenant validation", async () => {
      const trace: TraceLog = {
        agent_id: testAgentId,
        group_id: "invalid-group",
        trace_type: "contribution",
        content: "Test",
        confidence: 0.9,
      };

      try {
        await logTrace(trace);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TraceValidationError);
        expect((error as TraceValidationError).message).toContain("RK-01");
        expect((error as TraceValidationError).code).toBe("RK-01");
      }
    });
  });

  describe("Append-only enforcement", () => {
    it("should create traces with created_at timestamp", async () => {
      const trace: TraceLog = {
        agent_id: testAgentId,
        group_id: testGroupId,
        trace_type: "contribution",
        content: "Test trace",
        confidence: 0.85,
      };

      const result = await logTrace(trace);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.inserted_at).toBeInstanceOf(Date);
    });

    it("should set status to completed", async () => {
      const trace: TraceLog = {
        agent_id: testAgentId,
        group_id: testGroupId,
        trace_type: "error",
        content: "Error trace",
        confidence: 0.5,
      };

      const result = await logTrace(trace);
      expect(result.status).toBe("completed");
    });
  });

  describe("Query filtering", () => {
    it("should filter by agent_id and group_id", async () => {
      // Create traces
      await logTrace({
        agent_id: testAgentId,
        group_id: testGroupId,
        trace_type: "contribution",
        content: "Trace 1",
        confidence: 0.9,
      });

      await logTrace({
        agent_id: testAgentId,
        group_id: testGroupId,
        trace_type: "decision",
        content: "Trace 2",
        confidence: 0.85,
      });

      const results = await getTracesByAgent(testAgentId, testGroupId, 10);

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0].agent_id).toBe(testAgentId);
      expect(results.every((r) => r.group_id === testGroupId)).toBe(true);
    });

    it("should filter by trace_type and group_id", async () => {
      await logTrace({
        agent_id: testAgentId,
        group_id: testGroupId,
        trace_type: "decision",
        content: "Decision trace",
        confidence: 0.9,
      });

      await logTrace({
        agent_id: testAgentId,
        group_id: testGroupId,
        trace_type: "error",
        content: "Error trace",
        confidence: 0.5,
      });

      const decisionTraces = await getTracesByType("decision", testGroupId, 10);
      expect(decisionTraces.every((t) => t.event_type === "trace.decision")).toBe(true);
    });

    it("should respect limit parameter", async () => {
      // Create 5 traces
      for (let i = 0; i < 5; i++) {
        await logTrace({
          agent_id: testAgentId,
          group_id: testGroupId,
          trace_type: "contribution",
          content: `Trace ${i}`,
          confidence: 0.8,
        });
      }

      const results = await getTracesByAgent(testAgentId, testGroupId, 2);
      expect(results.length).toBe(2);
    });

    it("should return null for non-existent ID", async () => {
      const result = await getTraceById(999999999, testGroupId);
      expect(result).toBeNull();
    });
  });
});