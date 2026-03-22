import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  getTraceDetails,
  getInsightsByTraceRef,
  getAuditTrailForInsight,
  generateAuditReport,
  linkInsightToTrace,
  unlinkInsightFromTrace,
  AuditNavigationError,
} from "./trace-navigation";
import { getPool, closePool } from "../postgres/connection";
import { getDriver, closeDriver } from "../neo4j/connection";
import { insertEvent, type EventInsert } from "../postgres/queries/insert-trace";
import { createInsight, type InsightInsert } from "../neo4j/queries/insert-insight";
import { formatTraceRef } from "../validation/trace-ref";

describe("trace-navigation", () => {
  const testGroupId = "trace-nav-test-group";
  const testAgentId = "trace-nav-agent";

  let testEventId: number;

  beforeAll(async () => {
    // Configure PostgreSQL
    process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || "localhost";
    process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || "5432";
    process.env.POSTGRES_DB = process.env.POSTGRES_DB || "memory";
    process.env.POSTGRES_USER = process.env.POSTGRES_USER || "ronin4life";
    process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "KaminaTHC*";

    // Configure Neo4j
    process.env.NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
    process.env.NEO4J_USER = process.env.NEO4J_USER || "neo4j";
    process.env.NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "KaminaTHC*";
    process.env.NEO4J_DATABASE = process.env.NEO4J_DATABASE || "neo4j";

    // Clean up any previous test data
    const pool = getPool();
    await pool.query("DELETE FROM events WHERE group_id = $1", [testGroupId]);

    const driver = getDriver();
    const session = driver.session();
    try {
      await session.run(
        "MATCH (i:Insight) WHERE i.group_id = $group_id DETACH DELETE i",
        { group_id: testGroupId }
      );
      await session.run(
        "MATCH (h:InsightHead) WHERE h.group_id = $group_id DETACH DELETE h",
        { group_id: testGroupId }
      );
    } finally {
      await session.close();
    }
  });

  afterAll(async () => {
    // Clean up test data
    const pool = getPool();
    await pool.query("DELETE FROM events WHERE group_id = $1", [testGroupId]);

    const driver = getDriver();
    const session = driver.session();
    try {
      await session.run(
        "MATCH (i:Insight) WHERE i.group_id = $group_id DETACH DELETE i",
        { group_id: testGroupId }
      );
      await session.run(
        "MATCH (h:InsightHead) WHERE h.group_id = $group_id DETACH DELETE h",
        { group_id: testGroupId }
      );
    } finally {
      await session.close();
    }

    await closePool();
    await closeDriver();
  });

  beforeEach(async () => {
    // Clean up before each test
    const pool = getPool();
    await pool.query("DELETE FROM events WHERE group_id = $1", [testGroupId]);

    const driver = getDriver();
    const session = driver.session();
    try {
      await session.run(
        "MATCH (i:Insight) WHERE i.group_id = $group_id DETACH DELETE i",
        { group_id: testGroupId }
      );
      await session.run(
        "MATCH (h:InsightHead) WHERE h.group_id = $group_id DETACH DELETE h",
        { group_id: testGroupId }
      );
    } finally {
      await session.close();
    }
  });

  // =========================================================================
  // getTraceDetails Tests
  // =========================================================================

  describe("getTraceDetails", () => {
    it("should return trace details for existing event", async () => {
      // Create a test event
      const event = await insertEvent({
        group_id: testGroupId,
        event_type: "test-trace-event",
        agent_id: testAgentId,
        metadata: { key: "value" },
        outcome: { result: "success" },
      });
      testEventId = event.id;

      const traceRef = formatTraceRef("events", testEventId);
      const details = await getTraceDetails(traceRef);

      expect(details).not.toBeNull();
      expect(details?.table).toBe("events");
      expect(details?.id).toBe(testEventId);
      expect(details?.group_id).toBe(testGroupId);
      expect(details?.event_type).toBe("test-trace-event");
    });

    it("should return null for non-existent event", async () => {
      const details = await getTraceDetails("events:999999999");
      expect(details).toBeNull();
    });

    it("should return null for invalid trace_ref", async () => {
      const details = await getTraceDetails("invalid:ref");
      expect(details).toBeNull();
    });
  });

  // =========================================================================
  // getInsightsByTraceRef Tests
  // =========================================================================

  describe("getInsightsByTraceRef", () => {
    it("should return insights linked to a trace", async () => {
      // Create a test event
      const event = await insertEvent({
        group_id: testGroupId,
        event_type: "linked-event",
        agent_id: testAgentId,
      });
      testEventId = event.id;

      // Create insight linked to the event
      await createInsight({
        insight_id: "linked-insight-1",
        group_id: testGroupId,
        content: "This insight is derived from an event",
        confidence: 0.9,
        source_ref: formatTraceRef("events", testEventId),
      });

      const traceRef = formatTraceRef("events", testEventId);
      const insights = await getInsightsByTraceRef(traceRef, testGroupId);

      expect(insights.length).toBe(1);
      expect(insights[0].insight_id).toBe("linked-insight-1");
      expect(insights[0].trace_refs).toContain(traceRef);
    });

    it("should filter by group_id", async () => {
      // Create a test event
      const event = await insertEvent({
        group_id: testGroupId,
        event_type: "filtered-event",
        agent_id: testAgentId,
      });

      const timestamp = Date.now();

      // Create insight in test group
      await createInsight({
        insight_id: `filtered-insight-${timestamp}`,
        group_id: testGroupId,
        content: "Test insight",
        confidence: 0.8,
        source_ref: formatTraceRef("events", event.id),
      });

      // Create insight in different group
      await createInsight({
        insight_id: `other-group-insight-${timestamp}`,
        group_id: "other-group-audit",
        content: "Other group insight",
        confidence: 0.8,
        source_ref: formatTraceRef("events", event.id),
      });

      const insights = await getInsightsByTraceRef(
        formatTraceRef("events", event.id),
        testGroupId
      );

      expect(insights.length).toBe(1);
      expect(insights[0].group_id).toBe(testGroupId);
    });

    it("should return empty array for non-linked trace", async () => {
      const insights = await getInsightsByTraceRef("events:999999999", testGroupId);
      expect(insights).toHaveLength(0);
    });
  });

  // =========================================================================
  // linkInsightToTrace Tests
  // =========================================================================

  describe("linkInsightToTrace", () => {
    it("should link insight to existing trace", async () => {
      // Create event
      const event = await insertEvent({
        group_id: testGroupId,
        event_type: "link-test-event",
        agent_id: testAgentId,
      });

      // Create insight without source_ref
      await createInsight({
        insight_id: "unlinked-insight",
        group_id: testGroupId,
        content: "Unlinked insight",
        confidence: 0.9,
      });

      const traceRef = formatTraceRef("events", event.id);
      const result = await linkInsightToTrace("unlinked-insight", testGroupId, traceRef);

      expect(result).toBe(true);

      // Verify link
      const insights = await getInsightsByTraceRef(traceRef, testGroupId);
      expect(insights.length).toBe(1);
      expect(insights[0].insight_id).toBe("unlinked-insight");
    });

    it("should throw for non-existent trace", async () => {
      await createInsight({
        insight_id: "test-insight-nonexistent-trace",
        group_id: testGroupId,
        content: "Test",
        confidence: 0.9,
      });

      await expect(
        linkInsightToTrace("test-insight-nonexistent-trace", testGroupId, "events:999999999")
      ).rejects.toThrow(AuditNavigationError);
    });
  });

  // =========================================================================
  // unlinkInsightFromTrace Tests
  // =========================================================================

  describe("unlinkInsightFromTrace", () => {
    it("should unlink insight from trace", async () => {
      // Create event and linked insight
      const event = await insertEvent({
        group_id: testGroupId,
        event_type: "unlink-test-event",
        agent_id: testAgentId,
      });

      await createInsight({
        insight_id: "linked-unlink-test",
        group_id: testGroupId,
        content: "Linked insight",
        confidence: 0.9,
        source_ref: formatTraceRef("events", event.id),
      });

      // Unlink
      const result = await unlinkInsightFromTrace("linked-unlink-test", testGroupId);
      expect(result).toBe(true);

      // Verify unlink
      const insights = await getInsightsByTraceRef(
        formatTraceRef("events", event.id),
        testGroupId
      );
      expect(insights).toHaveLength(0);
    });
  });

  // =========================================================================
  // getAuditTrailForInsight Tests
  // =========================================================================

  describe("getAuditTrailForInsight", () => {
    it("should return audit trail for linked insight", async () => {
      // Create event
      const event = await insertEvent({
        group_id: testGroupId,
        event_type: "audit-trail-event",
        agent_id: testAgentId,
        metadata: { context: "test" },
      });

      // Create linked insight
      await createInsight({
        insight_id: "audit-trail-insight",
        group_id: testGroupId,
        content: "Audit trail test insight",
        confidence: 0.95,
        source_ref: formatTraceRef("events", event.id),
      });

      const audit = await getAuditTrailForInsight("audit-trail-insight", testGroupId);

      expect(audit).not.toBeNull();
      expect(audit?.insight_id).toBe("audit-trail-insight");
      expect(audit?.trace_ref).toBe(formatTraceRef("events", event.id));
      expect(audit?.trace_table).toBe("events");
      expect(audit?.trace_id).toBe(Number(event.id));
      expect(audit?.event_type).toBe("audit-trail-event");
    });

    it("should return null for non-existent insight", async () => {
      const audit = await getAuditTrailForInsight("non-existent-insight", testGroupId);
      expect(audit).toBeNull();
    });

    it("should return null for insight without trace_ref", async () => {
      await createInsight({
        insight_id: "unlinked-audit-insight",
        group_id: testGroupId,
        content: "Unlinked insight",
        confidence: 0.8,
      });

      const audit = await getAuditTrailForInsight("unlinked-audit-insight", testGroupId);
      expect(audit).toBeNull();
    });
  });

  // =========================================================================
  // generateAuditReport Tests
  // =========================================================================

  describe("generateAuditReport", () => {
    it("should generate report for group", async () => {
      // Create events
      const event1 = await insertEvent({
        group_id: testGroupId,
        event_type: "report-event-1",
        agent_id: testAgentId,
      });

      const event2 = await insertEvent({
        group_id: testGroupId,
        event_type: "report-event-2",
        agent_id: testAgentId,
      });

      // Create linked insights
      await createInsight({
        insight_id: "report-insight-1",
        group_id: testGroupId,
        content: "Report insight 1",
        confidence: 0.9,
        source_ref: formatTraceRef("events", event1.id),
      });

      await createInsight({
        insight_id: "report-insight-2",
        group_id: testGroupId,
        content: "Report insight 2",
        confidence: 0.8,
        source_ref: formatTraceRef("events", event2.id),
      });

      const report = await generateAuditReport(testGroupId);

      expect(report.length).toBe(2);
      expect(report[0].insight_id).toMatch(/report-insight-[12]/);
      expect(report[1].insight_id).toMatch(/report-insight-[12]/);
    });

    it("should return empty report for group with no linked insights", async () => {
      // Create unlinked insight
      await createInsight({
        insight_id: "unlinked-report-insight",
        group_id: testGroupId,
        content: "Unlinked",
        confidence: 0.7,
      });

      const report = await generateAuditReport(testGroupId);
      expect(report).toHaveLength(0);
    });

    it("should skip insights with invalid trace_refs", async () => {
      // Clean up any previous insights in this group
      const driver = getDriver();
      const session = driver.session();
      try {
        await session.run(
          "MATCH (i:Insight) WHERE i.group_id = $group_id DETACH DELETE i",
          { group_id: testGroupId }
        );
        await session.run(
          "MATCH (h:InsightHead) WHERE h.group_id = $group_id DETACH DELETE h",
          { group_id: testGroupId }
        );
      } finally {
        await session.close();
      }

      // Create insight with non-existent trace_ref
      await createInsight({
        insight_id: "invalid-trace-insight-skip",
        group_id: testGroupId,
        content: "Invalid trace",
        confidence: 0.7,
        source_ref: "events:999999999", // Non-existent but valid format
      });

      const report = await generateAuditReport(testGroupId);
      // Should return empty because trace doesn't exist
      expect(report).toHaveLength(0);
    });
  });

  // =========================================================================
  // Integration Tests
  // =========================================================================

  describe("integration", () => {
    it("should support full audit workflow", async () => {
      // 1. Create event
      const event = await insertEvent({
        group_id: testGroupId,
        event_type: "full-workflow-event",
        agent_id: testAgentId,
        metadata: { source: "test" },
      });

      // 2. Create insight linked to event
      const insight = await createInsight({
        insight_id: "full-workflow-insight",
        group_id: testGroupId,
        content: "Full workflow test",
        confidence: 0.9,
        source_ref: formatTraceRef("events", event.id),
      });

      // 3. Get trace details
      const traceDetails = await getTraceDetails(formatTraceRef("events", event.id));
      expect(traceDetails).not.toBeNull();
      expect(traceDetails?.event_type).toBe("full-workflow-event");

      // 4. Get insights by trace
      const insights = await getInsightsByTraceRef(
        formatTraceRef("events", event.id),
        testGroupId
      );
      expect(insights).toHaveLength(1);
      expect(insights[0].insight_id).toBe("full-workflow-insight");

      // 5. Get audit trail
      const audit = await getAuditTrailForInsight("full-workflow-insight", testGroupId);
      expect(audit).not.toBeNull();
      expect(audit?.trace_id).toBe(Number(event.id));

      // 6. Generate report
      const report = await generateAuditReport(testGroupId);
      expect(report.length).toBe(1);
      expect(report[0].insight_id).toBe("full-workflow-insight");
    });
  });
});