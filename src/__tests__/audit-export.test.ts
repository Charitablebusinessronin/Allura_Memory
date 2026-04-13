/**
 * Audit Export Tests
 *
 * Tests for CSV serialization, audit query builder, and API route.
 * Phase 7: SOC2 Compliance — Audit Log CSV Export
 */

import { describe, it, expect } from "vitest";
import {
  escapeCsvValue,
  serializeToCsv,
  createCsvStream,
  type CsvRow,
} from "@/lib/csv/serialize";
import {
  buildAuditQuery,
  auditQuerySchema,
  type AuditQueryInput,
} from "@/lib/audit/query-builder";

// ─────────────────────────────────────────────────────────────────────────────
// CSV SERIALIZATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("escapeCsvValue", () => {
  it("should return empty string for null", () => {
    expect(escapeCsvValue(null)).toBe("");
  });

  it("should return empty string for undefined", () => {
    expect(escapeCsvValue(undefined)).toBe("");
  });

  it("should return empty string for empty string", () => {
    expect(escapeCsvValue("")).toBe("");
  });

  it("should not quote simple values", () => {
    expect(escapeCsvValue("hello")).toBe("hello");
  });

  it("should not quote numbers", () => {
    expect(escapeCsvValue(42)).toBe("42");
  });

  it("should not quote simple strings without special chars", () => {
    expect(escapeCsvValue("allura-test")).toBe("allura-test");
  });

  it("should quote values containing commas", () => {
    expect(escapeCsvValue("hello,world")).toBe('"hello,world"');
  });

  it("should quote values containing double quotes by doubling them", () => {
    expect(escapeCsvValue('say "hello"')).toBe('"say ""hello"""');
  });

  it("should quote values containing newlines", () => {
    expect(escapeCsvValue("line1\nline2")).toBe('"line1\nline2"');
  });

  it("should quote values containing carriage returns", () => {
    expect(escapeCsvValue("line1\rline2")).toBe('"line1\rline2"');
  });

  it("should handle values with multiple special characters", () => {
    // Comma + quotes + newline
    expect(escapeCsvValue('he said "yes", then\nleft')).toBe(
      '"he said ""yes"", then\nleft"'
    );
  });

  it("should convert Date objects to strings", () => {
    const date = new Date("2026-04-12T00:00:00.000Z");
    expect(escapeCsvValue(date)).toBe("2026-04-12T00:00:00.000Z");
  });

  it("should convert numbers to strings", () => {
    expect(escapeCsvValue(3.14)).toBe("3.14");
  });

  it("should convert booleans to strings", () => {
    expect(escapeCsvValue(true)).toBe("true");
    expect(escapeCsvValue(false)).toBe("false");
  });

  it("should handle JSON strings with special characters", () => {
    const json = '{"key": "value, with comma"}';
    expect(escapeCsvValue(json)).toBe('"{""key"": ""value, with comma""}"');
  });
});

describe("serializeToCsv", () => {
  it("should produce a valid CSV with headers and rows", () => {
    const headers = ["id", "name", "status"];
    const rows: CsvRow[] = [
      [1, "Alice", "active"],
      [2, "Bob", "inactive"],
    ];

    const csv = serializeToCsv(headers, rows);

    expect(csv).toBe(
      [
        "id,name,status",
        "1,Alice,active",
        "2,Bob,inactive",
      ].join("\n")
    );
  });

  it("should handle empty rows", () => {
    const headers = ["id", "name"];
    const csv = serializeToCsv(headers, []);

    expect(csv).toBe("id,name");
  });

  it("should properly escape values in rows", () => {
    const headers = ["id", "description"];
    const rows: CsvRow[] = [
      [1, 'Has "quotes" and, commas'],
    ];

    const csv = serializeToCsv(headers, rows);

    expect(csv).toContain('1,"Has ""quotes"" and, commas"');
  });

  it("should handle null values as empty fields", () => {
    const headers = ["id", "value"];
    const rows: CsvRow[] = [[1, null]];

    const csv = serializeToCsv(headers, rows);

    expect(csv).toBe("id,value\n1,");
  });

  it("should produce audit-compatible CSV format", () => {
    const headers = [
      "id",
      "group_id",
      "agent_id",
      "event_type",
      "status",
      "created_at",
      "metadata",
    ];
    const rows: CsvRow[] = [
      [
        1,
        "allura-test",
        "memory-orchestrator",
        "trace.contribution",
        "completed",
        "2026-04-12T10:00:00.000Z",
        '{"confidence":0.9}',
      ],
    ];

    const csv = serializeToCsv(headers, rows);
    const lines = csv.split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      "id,group_id,agent_id,event_type,status,created_at,metadata"
    );
    // metadata contains quotes and commas, so it should be quoted
    expect(lines[1]).toContain('allura-test');
    expect(lines[1]).toContain('memory-orchestrator');
  });
});

describe("createCsvStream", () => {
  it("should produce the same output as serializeToCsv for small datasets", () => {
    const headers = ["id", "name", "status"];
    const rows: CsvRow[] = [
      [1, "Alice", "active"],
      [2, "Bob", "inactive"],
    ];

    const stream = createCsvStream(headers);
    stream.writeHeader();
    for (const row of rows) {
      stream.writeRow(row);
    }

    const streamResult = stream.getString();
    const serializeResult = serializeToCsv(headers, rows);

    expect(streamResult).toBe(serializeResult);
  });

  it("should track row count correctly", () => {
    const stream = createCsvStream(["id", "name"]);
    stream.writeHeader();

    expect(stream.getRowCount()).toBe(0);

    stream.writeRow([1, "Alice"]);
    expect(stream.getRowCount()).toBe(1);

    stream.writeRow([2, "Bob"]);
    expect(stream.getRowCount()).toBe(2);
  });

  it("should throw if writeRow is called before writeHeader", () => {
    const stream = createCsvStream(["id", "name"]);

    expect(() => stream.writeRow([1, "Alice"])).toThrow(
      "Must call writeHeader() before writeRow()"
    );
  });

  it("should throw if writeHeader is called twice", () => {
    const stream = createCsvStream(["id", "name"]);
    stream.writeHeader();

    expect(() => stream.writeHeader()).toThrow(
      "CSV header already written"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT QUERY BUILDER TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("auditQuerySchema", () => {
  it("should validate minimal valid input", () => {
    const result = auditQuerySchema.safeParse({
      group_id: "allura-test",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.group_id).toBe("allura-test");
      expect(result.data.limit).toBe(1000); // default
      expect(result.data.offset).toBe(0); // default
    }
  });

  it("should validate full input with all filters", () => {
    const result = auditQuerySchema.safeParse({
      group_id: "allura-test",
      from: "2026-01-01T00:00:00Z",
      to: "2026-12-31T23:59:59Z",
      agent_id: "memory-orchestrator",
      event_type: "trace.contribution",
      limit: 500,
      offset: 100,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.group_id).toBe("allura-test");
      expect(result.data.from).toBe("2026-01-01T00:00:00Z");
      expect(result.data.agent_id).toBe("memory-orchestrator");
      expect(result.data.limit).toBe(500);
    }
  });

  it("should reject missing group_id", () => {
    const result = auditQuerySchema.safeParse({
      limit: 100,
    });

    expect(result.success).toBe(false);
  });

  it("should reject limit exceeding maximum", () => {
    const result = auditQuerySchema.safeParse({
      group_id: "allura-test",
      limit: 50000,
    });

    expect(result.success).toBe(false);
  });

  it("should reject negative offset", () => {
    const result = auditQuerySchema.safeParse({
      group_id: "allura-test",
      offset: -1,
    });

    expect(result.success).toBe(false);
  });

  it("should coerce string limit to number", () => {
    const result = auditQuerySchema.safeParse({
      group_id: "allura-test",
      limit: "500",
      offset: "0",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(500);
      expect(result.data.offset).toBe(0);
    }
  });

  it("should accept date-only format for from/to", () => {
    const result = auditQuerySchema.safeParse({
      group_id: "allura-test",
      from: "2026-01-01",
      to: "2026-12-31",
    });

    expect(result.success).toBe(true);
  });
});

describe("buildAuditQuery", () => {
  it("should build a query with only group_id", () => {
    const params: AuditQueryInput = {
      group_id: "allura-test",
      limit: 1000,
      offset: 0,
    };

    const { query, values, countQuery, countValues } = buildAuditQuery(params);

    // Query should have group_id filter
    expect(query).toContain("group_id = $1");
    expect(values[0]).toBe("allura-test");

    // Should have LIMIT and OFFSET parameters
    expect(query).toContain("LIMIT");
    expect(query).toContain("OFFSET");

    // Count query should have same group_id filter
    expect(countQuery).toContain("group_id = $1");
    expect(countValues[0]).toBe("allura-test");
  });

  it("should add date range filters", () => {
    const params: AuditQueryInput = {
      group_id: "allura-test",
      from: "2026-01-01",
      to: "2026-12-31",
      limit: 1000,
      offset: 0,
    };

    const { query, values } = buildAuditQuery(params);

    expect(query).toContain("created_at >= $2");
    expect(query).toContain("created_at <= $3");
    expect(values).toContain("2026-01-01");
    expect(values).toContain("2026-12-31");
  });

  it("should add agent_id filter", () => {
    const params: AuditQueryInput = {
      group_id: "allura-test",
      agent_id: "memory-orchestrator",
      limit: 1000,
      offset: 0,
    };

    const { query, values } = buildAuditQuery(params);

    expect(query).toContain("agent_id = $2");
    expect(values).toContain("memory-orchestrator");
  });

  it("should add event_type filter", () => {
    const params: AuditQueryInput = {
      group_id: "allura-test",
      event_type: "trace.contribution",
      limit: 1000,
      offset: 0,
    };

    const { query, values } = buildAuditQuery(params);

    expect(query).toContain("event_type = $2");
    expect(values).toContain("trace.contribution");
  });

  it("should combine multiple filters correctly", () => {
    const params: AuditQueryInput = {
      group_id: "allura-test",
      from: "2026-01-01",
      agent_id: "memory-orchestrator",
      event_type: "trace.contribution",
      limit: 500,
      offset: 100,
    };

    const { query, values } = buildAuditQuery(params);

    // All filters should be present
    expect(query).toContain("group_id = $1");
    expect(query).toContain("created_at >= $2");
    expect(query).toContain("agent_id = $3");
    expect(query).toContain("event_type = $4");

    // Values should be in order
    expect(values[0]).toBe("allura-test");
    expect(values[1]).toBe("2026-01-01");
    expect(values[2]).toBe("memory-orchestrator");
    expect(values[3]).toBe("trace.contribution");
    expect(values[4]).toBe(500); // limit
    expect(values[5]).toBe(100); // offset
  });

  it("should always include group_id in count query", () => {
    const params: AuditQueryInput = {
      group_id: "allura-test",
      agent_id: "test-agent",
      limit: 1000,
      offset: 0,
    };

    const { countQuery, countValues } = buildAuditQuery(params);

    expect(countQuery).toContain("group_id = $1");
    expect(countValues[0]).toBe("allura-test");
    // Count query should NOT have limit/offset
    expect(countQuery).not.toContain("LIMIT");
    expect(countQuery).not.toContain("OFFSET");
  });

  it("should use parameterized queries (no string interpolation)", () => {
    const params: AuditQueryInput = {
      group_id: "allura-test'; DROP TABLE events;--",
      limit: 1000,
      offset: 0,
    };

    const { query, values } = buildAuditQuery(params);

    // The malicious input should be a parameter value, not interpolated into the query
    expect(query).not.toContain("DROP TABLE");
    expect(values[0]).toBe("allura-test'; DROP TABLE events;--");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION-STYLE TESTS (without live DB)
// ─────────────────────────────────────────────────────────────────────────────

describe("CSV export format compliance", () => {
  it("should produce RFC 4180 compliant CSV for audit events", () => {
    // Simulate audit event data
    const events = [
      {
        id: 1,
        group_id: "allura-test",
        agent_id: "memory-orchestrator",
        event_type: "trace.contribution",
        status: "completed",
        created_at: "2026-04-12T10:00:00.000Z",
        metadata: '{"confidence":0.9,"source":"manual"}',
      },
      {
        id: 2,
        group_id: "allura-test",
        agent_id: "memory-architect",
        event_type: "trace.decision",
        status: "pending",
        created_at: "2026-04-12T11:00:00.000Z",
        metadata: '{"confidence":0.7,"notes":"Contains, commas"}',
      },
    ];

    const headers = [
      "id",
      "group_id",
      "agent_id",
      "event_type",
      "status",
      "created_at",
      "metadata",
    ];

    const rows: CsvRow[] = events.map((e) => [
      e.id,
      e.group_id,
      e.agent_id,
      e.event_type,
      e.status,
      e.created_at,
      e.metadata,
    ]);

    const csv = serializeToCsv(headers, rows);
    const lines = csv.split("\n");

    // Header row
    expect(lines[0]).toBe(
      "id,group_id,agent_id,event_type,status,created_at,metadata"
    );

    // First data row — metadata contains commas so it's quoted
    expect(lines[1]).toContain("allura-test");
    expect(lines[1]).toContain("memory-orchestrator");

    // Second data row — metadata with commas should be properly escaped
    expect(lines[2]).toContain("memory-architect");
    // The metadata JSON contains commas, so the entire field is quoted
    // and internal quotes are doubled
    expect(lines[2]).toMatch(/confidence/);
    expect(lines[2]).toMatch(/0\.7/);
  });

  it("should handle events with null metadata", () => {
    const headers = ["id", "group_id", "metadata"];
    const rows: CsvRow[] = [[1, "allura-test", null]];

    const csv = serializeToCsv(headers, rows);

    expect(csv).toBe("id,group_id,metadata\n1,allura-test,");
  });

  it("should handle events with special characters in all fields", () => {
    const headers = ["id", "agent_id", "event_type", "metadata"];
    const rows: CsvRow[] = [
      [
        1,
        'agent "with quotes"',
        "type,with comma",
        '{"key": "value\nwith newline"}',
      ],
    ];

    const csv = serializeToCsv(headers, rows);

    // All three special fields should be properly quoted
    expect(csv).toContain('"agent ""with quotes"""');
    expect(csv).toContain('"type,with comma"');
    // The metadata JSON contains quotes, commas, and newlines — all should be escaped
    // In CSV: internal quotes are doubled, so "key" becomes ""key""
    expect(csv).toContain('""key""');
    expect(csv).toContain("value");
  });
})