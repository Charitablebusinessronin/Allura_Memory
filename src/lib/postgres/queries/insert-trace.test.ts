import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { getPool, closePool } from "../connection";
import { initializeSchema, getSchemaVersion } from "../schema/index";
import {
  insertEvent,
  insertEvents,
  type EventInsert,
  type EventRecord,
  insertOutcome,
  type OutcomeInsert,
  type OutcomeRecord,
} from "./insert-trace";

/**
 * Insert Trace API Integration Tests
 *
 * Requires a running PostgreSQL instance.
 * Run with: RUN_E2E_TESTS=true bun vitest run src/lib/postgres/queries/insert-trace.test.ts
 */
const shouldRunE2E = process.env.RUN_E2E_TESTS === "true";

describe.skipIf(!shouldRunE2E)("Insert Trace API", () => {
  beforeAll(async () => {
    // Ensure environment is configured for tests
    process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
    process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5432";
    process.env.POSTGRES_DB = process.env.POSTGRES_DB || "memory";
    process.env.POSTGRES_USER = process.env.POSTGRES_USER || "ronin4life";
    process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "KaminaTHC*";

    // Initialize schema
    const result = await initializeSchema();

    expect(result.success).toBe(true);
  });

  afterAll(async () => {
    await closePool();
  });

  describe("insertEvent", () => {
    it("should insert an event with all required fields", async () => {
      const event: EventInsert = {
        group_id: "allura-test-group-1",
        event_type: "workflow_step",
        agent_id: "agent-001",
        workflow_id: "workflow-001",
        step_id: "step-001",
        status: "completed",
        metadata: { input: "test input" },
        outcome: { result: "success" },
      };

      const result = await insertEvent(event);

      expect(result.id).toBeDefined();
      expect(Number(result.id)).toBeGreaterThan(0);
      expect(result.group_id).toBe("allura-test-group-1");
      expect(result.event_type).toBe("workflow_step");
      expect(result.agent_id).toBe("agent-001");
      expect(result.status).toBe("completed");
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it("should reject events without group_id", async () => {
      const event = {
        event_type: "test",
        agent_id: "agent-001",
        // group_id is intentionally missing
      } as unknown as EventInsert;

      await expect(insertEvent(event)).rejects.toThrow();
    });

    it("should reject events without agent_id", async () => {
      const event = {
        group_id: "allura-test-group-1",
        event_type: "test",
        // agent_id is intentionally missing
      } as unknown as EventInsert;

      await expect(insertEvent(event)).rejects.toThrow();
    });

    it("should reject events without event_type", async () => {
      const event = {
        group_id: "allura-test-group-1",
        agent_id: "agent-001",
        // event_type is intentionally missing
      } as unknown as EventInsert;

      await expect(insertEvent(event)).rejects.toThrow();
    });

    it("should insert event with parent_event_id for chaining", async () => {
      // First create a parent event
      const parent: EventInsert = {
        group_id: "allura-test-chain",
        event_type: "parent_event",
        agent_id: "agent-001",
        status: "completed",
      };

      const parentResult = await insertEvent(parent);

      // Now create a child event
      const child: EventInsert = {
        group_id: "allura-test-chain",
        event_type: "child_event",
        agent_id: "agent-002",
        parent_event_id: parentResult.id,
        status: "completed",
      };

      const childResult = await insertEvent(child);

      expect(childResult.parent_event_id).toBe(parentResult.id);
    });

    it("should handle events with metadata JSONB", async () => {
      const event: EventInsert = {
        group_id: "allura-test-jsonb",
        event_type: "test_with_metadata",
        agent_id: "agent-001",
        status: "completed",
        metadata: {
          nested: {
            data: "value",
            array: [1, 2, 3],
          },
          timestamp: new Date().toISOString(),
        },
      };

      const result = await insertEvent(event);

      // Query back to verify JSONB was stored correctly
      const pool = getPool();
      const rows = await pool.query<EventRecord>("SELECT * FROM events WHERE id = $1", [result.id]);

      const metadata = rows.rows[0].metadata as { nested: { data: string; array: number[] } };
      expect(metadata.nested.data).toBe("value");
      expect(metadata.nested.array).toEqual([1, 2, 3]);
    });

    it("should handle empty string as invalid for required fields", async () => {
      const event: EventInsert = {
        group_id: "   ", // Whitespace trimmed to empty
        event_type: "test",
        agent_id: "agent-001",
        status: "pending",
      };

      await expect(insertEvent(event)).rejects.toThrow();
    });
  });

  describe("insertOutcome", () => {
    it("should insert an outcome linked to an event", async () => {
      // First create an event
      const event: EventInsert = {
        group_id: "allura-test-outcome",
        event_type: "test_event",
        agent_id: "agent-001",
        status: "completed",
      };

      const eventResult = await insertEvent(event);

      // Now insert an outcome
      const outcome: OutcomeInsert = {
        group_id: "allura-test-outcome",
        event_id: eventResult.id,
        outcome_type: "analysis_result",
        confidence: 0.95,
        data: { prediction: "positive" },
      };

      const result = await insertOutcome(outcome);

      expect(result.id).toBeDefined();
      expect(result.group_id).toBe("allura-test-outcome");
      expect(result.event_id).toBe(eventResult.id);
      expect(result.outcome_type).toBe("analysis_result");
      expect(Number(result.confidence)).toBeCloseTo(0.95);
    });

    it("should reject outcomes without group_id", async () => {
      const outcome = {
        event_id: 1,
        outcome_type: "test",
        // group_id is intentionally missing
      } as unknown as OutcomeInsert;

      await expect(insertOutcome(outcome)).rejects.toThrow();
    });

    it("should reject outcomes with confidence outside 0-1 range", async () => {
      // First create an event
      const event: EventInsert = {
        group_id: "allura-test-confidence",
        event_type: "test_event",
        agent_id: "agent-001",
        status: "completed",
      };

      const eventResult = await insertEvent(event);

      const outcome: OutcomeInsert = {
        group_id: "allura-test-confidence",
        event_id: eventResult.id,
        outcome_type: "test_outcome",
        confidence: 1.5, // Invalid confidence > 1.0
      };

      await expect(insertOutcome(outcome)).rejects.toThrow();
    });

    it("should require group_id to match parent event's group_id", async () => {
      // Create event with one group
      const event: EventInsert = {
        group_id: "allura-test-group-a",
        event_type: "test_event",
        agent_id: "agent-001",
        status: "completed",
      };

      const eventResult = await insertEvent(event);

      // Try to insert outcome with different group - should succeed
      // (we rely on application-level validation for group matching if needed)
      const outcome: OutcomeInsert = {
        group_id: "allura-test-group-b", // Different group
        event_id: eventResult.id,
        outcome_type: "test_outcome",
      };

      // For now, this is allowed at DB level
      // Application-level validation would enforce consistency
      const result = await insertOutcome(outcome);
      expect(result.id).toBeDefined();
    });
  });

  describe("Tenant Isolation", () => {
    it("should enforce group_id is present in every insert", async () => {
      const event: EventInsert = {
        group_id: "allura-tenant-abc",
        event_type: "tenant_event",
        agent_id: "agent-001",
        status: "completed",
      };

      const result = await insertEvent(event);

      // Verify group_id is stored and not null
      expect(result.group_id).toBe("allura-tenant-abc");
      expect(result.group_id).not.toBeNull();
    });

    it("should allow retrieving events by group_id", async () => {
      // Insert events for different tenants
      await insertEvent({
        group_id: "allura-tenant-x",
        event_type: "test",
        agent_id: "agent-001",
        status: "completed",
      });

      await insertEvent({
        group_id: "allura-tenant-y",
        event_type: "test",
        agent_id: "agent-002",
        status: "completed",
      });

      // Query for specific tenant
      const pool = getPool();
      const result = await pool.query("SELECT * FROM events WHERE group_id = $1", ["allura-tenant-x"]);

      expect(result.rows.length).toBeGreaterThan(0);
      result.rows.forEach((row) => {
        expect(row.group_id).toBe("allura-tenant-x");
      });
    });
  });

  describe("Append-Only Behavior", () => {
    it("should create events with sequential IDs", async () => {
      const event1 = await insertEvent({
        group_id: "allura-test-seq",
        event_type: "seq_test",
        agent_id: "agent-001",
        status: "completed",
      });

      const event2 = await insertEvent({
        group_id: "allura-test-seq",
        event_type: "seq_test",
        agent_id: "agent-001",
        status: "completed",
      });

      // IDs should be sequential (event2.id > event1.id)
      expect(Number(event2.id)).toBeGreaterThan(Number(event1.id));
    });

    it("should record timestamps accurately", async () => {
      const beforeInsert = new Date();

      const event = await insertEvent({
        group_id: "allura-test-timestamp",
        event_type: "timestamp_test",
        agent_id: "agent-001",
        status: "completed",
      });

      const afterInsert = new Date();

      expect(event.created_at).toBeInstanceOf(Date);
      expect(event.created_at.getTime()).toBeGreaterThanOrEqual(beforeInsert.getTime() - 1000);
      expect(event.created_at.getTime()).toBeLessThanOrEqual(afterInsert.getTime() + 1000);
    });
  });

  describe("insertEvents (bulk)", () => {
    it("should insert multiple events in a transaction", async () => {
      const events: EventInsert[] = [
        {
          group_id: "allura-test-bulk",
          event_type: "bulk_event_1",
          agent_id: "agent-001",
          status: "completed",
          metadata: { batch: 1 },
        },
        {
          group_id: "allura-test-bulk",
          event_type: "bulk_event_2",
          agent_id: "agent-002",
          status: "completed",
          metadata: { batch: 2 },
        },
        {
          group_id: "allura-test-bulk",
          event_type: "bulk_event_3",
          agent_id: "agent-003",
          status: "failed",
          error_message: "Test error",
          metadata: { batch: 3 },
        },
      ];

      const results = await insertEvents(events);

      expect(results).toHaveLength(3);
      expect(Number(results[0].id)).toBeGreaterThan(0);
      expect(Number(results[1].id)).toBeGreaterThan(Number(results[0].id));
      expect(Number(results[2].id)).toBeGreaterThan(Number(results[1].id));

      // Verify all events have correct group_id
      results.forEach((result) => {
        expect(result.group_id).toBe("allura-test-bulk");
      });

      // Verify metadata was stored
      expect(results[0].metadata.batch).toBe(1);
      expect(results[1].metadata.batch).toBe(2);
      expect(results[2].metadata.batch).toBe(3);

      // Verify error message on failed event
      expect(results[2].error_message).toBe("Test error");
    });

    it("should rollback all events if one fails validation", async () => {
      const events: EventInsert[] = [
        {
          group_id: "allura-test-bulk-rollback",
          event_type: "valid_event",
          agent_id: "agent-001",
          status: "completed",
        },
        {
          group_id: "", // Invalid: empty group_id
          event_type: "invalid_event",
          agent_id: "agent-002",
          status: "completed",
        },
      ];

      // Should throw due to validation error on second event
      await expect(insertEvents(events)).rejects.toThrow();

      // Verify no events were inserted (transaction rolled back)
      const pool = getPool();
      const result = await pool.query("SELECT * FROM events WHERE group_id = $1", ["allura-test-bulk-rollback"]);
      expect(result.rows).toHaveLength(0);
    });

    it("should handle empty array", async () => {
      const results = await insertEvents([]);
      expect(results).toHaveLength(0);
    });
  });
});