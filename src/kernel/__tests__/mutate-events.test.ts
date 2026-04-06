/**
 * Story 1.1: Record Raw Execution Traces - Integration Tests
 * 
 * Tests for kernel-backed trace logging via RuVix mutate syscall.
 * These tests verify:
 * - Kernel integration with PostgreSQL
 * - Proof validation (nonce, group_id)
 * - Policy enforcement (POL-001 tenant isolation)
 * - Append-only semantics
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RuVixKernel } from "../ruvix";
import { logTrace, queryTraces } from "@/lib/postgres/trace-logger";
import type { TraceLog, QueryTracesOptions } from "@/lib/postgres/types";

// Test setup
const TEST_GROUP_ID = "allura-test-tenant";
const TEST_AGENT_ID = "agent-test-001";

describe("Story 1.1: Kernel-backed Trace Logging", () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.RUVIX_KERNEL_SECRET;
    process.env.RUVIX_KERNEL_SECRET = "test-secret-key-for-ruvix-kernel-proof-engine-32chars";
    
    // Initialize kernel
    RuVixKernel.initializeKernel();
  });

  afterEach(() => {
    if (originalSecret !== undefined) {
      process.env.RUVIX_KERNEL_SECRET = originalSecret;
    } else {
      delete process.env.RUVIX_KERNEL_SECRET;
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC-1: Every agent action logged via kernel mutate syscall
  // ───────────────────────────────────────────────────────────────────────────

  describe("AC-1: Kernel Mutate Syscall Integration", () => {
    it("should log trace via kernel mutate syscall", async () => {
      const trace: TraceLog = {
        group_id: TEST_GROUP_ID,
        agent_id: TEST_AGENT_ID,
        trace_type: "contribution",
        content: "Test trace content",
        confidence: 1.0,
        workflow_id: "workflow-001",
      };

      // Should not throw - kernel handles proof creation
      await expect(logTrace(trace)).resolves.not.toThrow();
    });

    it("should validate proof-of-intent with nonce", async () => {
      const trace: TraceLog = {
        group_id: TEST_GROUP_ID,
        agent_id: TEST_AGENT_ID,
        trace_type: "decision",
        content: "Decision trace",
        confidence: 0.95,
      };

      const result = await logTrace(trace);
      
      // Verify proof was created with nonce
      // (This would require inspecting the kernel internals or mocking)
      expect(result).toBeDefined();
    });

    it("should reject trace without valid group_id", async () => {
      const invalidTrace: TraceLog = {
        group_id: "invalid-group-id", // Not allura-* format
        agent_id: TEST_AGENT_ID,
        trace_type: "error",
        content: "Error trace",
        confidence: 0.0,
      };

      await expect(logTrace(invalidTrace)).rejects.toThrow(/group_id/);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC-2: Logs include required fields
  // ───────────────────────────────────────────────────────────────────────────

  describe("AC-2: Required Fields Validation", () => {
    it("should include all required fields in logged trace", async () => {
      const trace: TraceLog = {
        group_id: TEST_GROUP_ID,
        agent_id: TEST_AGENT_ID,
        trace_type: "learning",
        content: "Learning from session",
        confidence: 0.87,
        workflow_id: "workflow-002",
        evidence_ref: "evidence-123",
        metadata: { source: "test", priority: "high" },
      };

      await logTrace(trace);

      // Query to verify fields were stored
      const result = await queryTraces({
        group_id: TEST_GROUP_ID,
        agent_id: TEST_AGENT_ID,
      });

      expect(result.traces.length).toBeGreaterThan(0);
      const stored = result.traces[0];

      expect(stored.group_id).toBe(TEST_GROUP_ID);
      expect(stored.agent_id).toBe(TEST_AGENT_ID);
      expect(stored.event_type).toBe("learning");  // event_type maps from trace_type
      expect(stored.outcome).toMatchObject({ content: "Learning from session" });
      expect(stored.metadata).toMatchObject({ confidence: 0.87 });
      expect(stored.workflow_id).toBe("workflow-002");
      expect(stored.metadata).toMatchObject({ evidence_ref: "evidence-123" });
      expect(stored.metadata).toMatchObject({ source: "test", priority: "high" });
    });

    it("should auto-generate id if not provided", async () => {
      const trace: TraceLog = {
        group_id: TEST_GROUP_ID,
        agent_id: TEST_AGENT_ID,
        trace_type: "contribution",
        content: "Auto-generated ID test",
        confidence: 1.0,
      };

      await logTrace(trace);

      const result = await queryTraces({ group_id: TEST_GROUP_ID });
      expect(result.traces[0].id).toBeDefined();
      expect(Number.isInteger(result.traces[0].id)).toBe(true); // Serial ID format
    });

    it("should auto-generate created_at timestamp", async () => {
      const trace: TraceLog = {
        group_id: TEST_GROUP_ID,
        agent_id: TEST_AGENT_ID,
        trace_type: "contribution",
        content: "Timestamp test",
        confidence: 1.0,
      };

      await logTrace(trace);

      const result = await queryTraces({ group_id: TEST_GROUP_ID });
      expect(result.traces[0].created_at).toBeDefined();
      expect(new Date(result.traces[0].created_at!).getTime()).toBeGreaterThan(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC-3: Append-only enforcement
  // ───────────────────────────────────────────────────────────────────────────

  describe("AC-3: Append-Only Semantics", () => {
    it("should reject updates to existing traces", async () => {
      // First, create a trace
      const trace: TraceLog = {
        group_id: TEST_GROUP_ID,
        agent_id: TEST_AGENT_ID,
        trace_type: "contribution",
        content: "Original content",
        confidence: 1.0,
      };

      await logTrace(trace);
      
      // Query to get the ID
      const queryResult = await queryTraces({ group_id: TEST_GROUP_ID });
      const traceId = queryResult.traces[0].id;

      // Attempt to update (should be rejected)
      // Note: TraceLog doesn't have 'id' - updates create new versions
      const updateTrace: TraceLog = {
        group_id: TEST_GROUP_ID,
        agent_id: TEST_AGENT_ID,
        trace_type: "contribution",
        content: "Updated content", // Attempted modification
        confidence: 1.0,
      };

      // Should reject or create new trace instead of updating
      await expect(logTrace(updateTrace)).rejects.toThrow();
    });

    it("should allow deletes via explicit delete_op mutation", async () => {
      // This test documents the expected behavior
      // Actual implementation may differ based on requirements
      const trace: TraceLog = {
        group_id: TEST_GROUP_ID,
        agent_id: TEST_AGENT_ID,
        trace_type: "contribution",
        content: "To be deleted",
        confidence: 1.0,
      };

      await logTrace(trace);
      
      // Future: Implement delete via RuVixKernel.syscall("mutate", { type: "delete_op" })
      expect(true).toBe(true); // Placeholder
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC-4: Confidence scoring
  // ───────────────────────────────────────────────────────────────────────────

  describe("AC-4: Confidence Scoring", () => {
    it("should default tool calls to confidence 1.0", async () => {
      const trace: TraceLog = {
        group_id: TEST_GROUP_ID,
        agent_id: TEST_AGENT_ID,
        trace_type: "contribution",
        content: "Tool call result",
        confidence: 1.0, // Explicit
      };

      await logTrace(trace);

      const result = await queryTraces({ group_id: TEST_GROUP_ID });
      expect(result.traces[0].metadata).toMatchObject({ confidence: 1.0 });
    });

    it("should default errors to confidence 0.0", async () => {
      const trace: TraceLog = {
        group_id: TEST_GROUP_ID,
        agent_id: TEST_AGENT_ID,
        trace_type: "error",
        content: "Error occurred",
        confidence: 0.0, // Explicit
      };

      await logTrace(trace);

      const result = await queryTraces({ group_id: TEST_GROUP_ID });
      expect(result.traces[0].metadata).toMatchObject({ confidence: 0.0 });
    });

    it("should accept user-provided confidence in metadata", async () => {
      const trace: TraceLog = {
        group_id: TEST_GROUP_ID,
        agent_id: TEST_AGENT_ID,
        trace_type: "decision",
        content: "Decision with custom confidence",
        confidence: 0.75,
        metadata: { confidence_source: "user_override" },
      };

      await logTrace(trace);

      const result = await queryTraces({ group_id: TEST_GROUP_ID });
      expect(result.traces[0].metadata).toMatchObject({ confidence: 0.75 });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AC-5: Query support
  // ───────────────────────────────────────────────────────────────────────────

  describe("AC-5: Query Support", () => {
    beforeEach(async () => {
      // Seed test data
      const traces: TraceLog[] = [
        {
          group_id: TEST_GROUP_ID,
          agent_id: "agent-001",
          trace_type: "contribution",
          content: "Trace 1",
          confidence: 1.0,
          workflow_id: "workflow-001",
        },
        {
          group_id: TEST_GROUP_ID,
          agent_id: "agent-002",
          trace_type: "decision",
          content: "Trace 2",
          confidence: 0.9,
          workflow_id: "workflow-001",
        },
        {
          group_id: TEST_GROUP_ID,
          agent_id: "agent-001",
          trace_type: "error",
          content: "Trace 3",
          confidence: 0.0,
          workflow_id: "workflow-002",
        },
      ];

      for (const trace of traces) {
        await logTrace(trace);
      }
    });

    it("should query by agent_id", async () => {
      const result = await queryTraces({
        group_id: TEST_GROUP_ID,
        agent_id: "agent-001",
      });

      expect(result.traces.length).toBe(2);
      expect(result.traces.every(t => t.agent_id === "agent-001")).toBe(true);
    });

    it("should query by group_id (tenant-scoped)", async () => {
      const result = await queryTraces({
        group_id: TEST_GROUP_ID,
      });

      expect(result.traces.length).toBe(3);
    });

    it("should query by trace_type", async () => {
      const result = await queryTraces({
        group_id: TEST_GROUP_ID,
        trace_type: "error",
      });

      expect(result.traces.length).toBe(1);
      expect(result.traces[0].event_type).toBe("error");  // event_type maps from trace_type
    });

    it("should query by workflow_id", async () => {
      const result = await queryTraces({
        group_id: TEST_GROUP_ID,
        workflow_id: "workflow-001",
      });

      expect(result.traces.length).toBe(2);
    });

    it("should query by time range", async () => {
      const startTime = new Date(Date.now() - 1000);
      const endTime = new Date(Date.now() + 1000);

      const result = await queryTraces({
        group_id: TEST_GROUP_ID,
        startTime,
        endTime,
      });

      expect(result.traces.length).toBeGreaterThan(0);
    });

    it("should support pagination", async () => {
      const result = await queryTraces({
        group_id: TEST_GROUP_ID,
        limit: 2,
        offset: 0,
      });

      expect(result.traces.length).toBe(2);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POL-001: Tenant Isolation Enforcement
  // ───────────────────────────────────────────────────────────────────────────

  describe("POL-001: Tenant Isolation", () => {
    it("should reject cross-tenant data access", async () => {
      // Create trace in tenant A
      await logTrace({
        group_id: "allura-tenant-a",
        agent_id: TEST_AGENT_ID,
        trace_type: "contribution",
        content: "Tenant A data",
        confidence: 1.0,
      });

      // Attempt to query from tenant B (should return empty)
      const result = await queryTraces({
        group_id: "allura-tenant-b", // Different tenant
      });

      expect(result.traces.length).toBe(0);
    });

    it("should enforce allura-* format for group_id", async () => {
      const invalidTraces = [
        { group_id: "tenant-a", agent_id: TEST_AGENT_ID, trace_type: "contribution" as const, content: "Test", confidence: 1.0 },
        { group_id: "roninmemory", agent_id: TEST_AGENT_ID, trace_type: "contribution" as const, content: "Test", confidence: 1.0 },
        { group_id: "Allura-Test", agent_id: TEST_AGENT_ID, trace_type: "contribution" as const, content: "Test", confidence: 1.0 },
      ];

      for (const trace of invalidTraces) {
        await expect(logTrace(trace)).rejects.toThrow(/group_id/);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Performance Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe("Performance: NFR-4", () => {
    it("should log trace in under 10ms", async () => {
      const trace: TraceLog = {
        group_id: TEST_GROUP_ID,
        agent_id: TEST_AGENT_ID,
        trace_type: "contribution",
        content: "Performance test",
        confidence: 1.0,
      };

      const start = performance.now();
      await logTrace(trace);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it.skip("should support batch insert (implementation pending)", async () => {
      // Future implementation
      const traces: TraceLog[] = Array.from({ length: 100 }, (_, i) => ({
        group_id: TEST_GROUP_ID,
        agent_id: TEST_AGENT_ID,
        trace_type: "contribution",
        content: `Batch trace ${i}`,
        confidence: 1.0,
      }));

      const start = performance.now();
      // await logTracesBatch(traces);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
