/**
 * RK-17 Fix: Dashboard Zod schema validation tests.
 *
 * Tests that:
 * 1. Valid mapped objects pass schema validation
 * 2. Malformed objects produce drift warnings (not crashes)
 * 3. Edge cases (missing fields, wrong types) are caught
 * 4. validateDashboardShape returns fallback data without throwing
 */
import { describe, it, expect, vi } from "vitest"
import {
  MetricSchema,
  MemorySchema,
  InsightSchema,
  EvidenceSchema,
  ActivityItemSchema,
  DashboardWarningSchema,
  SystemStatusSchema,
  GraphNodeSchema,
  GraphEdgeSchema,
  validateDashboardShape,
  validateDashboardArray,
} from "@/lib/dashboard/schemas"

// ─── Schema: Valid Data ───────────────────────────────────────

describe("Dashboard Zod schemas", () => {
  describe("MetricSchema", () => {
    it("accepts valid metric with string value", () => {
      const result = MetricSchema.safeParse({
        id: "pending-insights",
        label: "Pending Insights",
        value: 5,
        description: "Awaiting curator review",
        tone: "orange",
      })
      expect(result.success).toBe(true)
    })

    it("accepts metric with string value", () => {
      const result = MetricSchema.safeParse({
        id: "graph-connections",
        label: "Graph Connections",
        value: "42",
        description: "Memories in scope",
        tone: "blue",
      })
      expect(result.success).toBe(true)
    })

    it("rejects invalid tone", () => {
      const result = MetricSchema.safeParse({
        id: "test",
        label: "Test",
        value: 0,
        description: "Test",
        tone: "magenta",
      })
      expect(result.success).toBe(false)
    })
  })

  describe("MemorySchema", () => {
    const validMemory = {
      id: "mem-001",
      title: "Test memory",
      content: "Content here",
      type: "insight" as const,
      agent: "BROOKS_ARCHITECT",
      project: "Allura Core",
      timestamp: "2026-04-28T07:00:00.000Z",
      status: "approved" as const,
      evidenceIds: ["trace-1"],
      connectedMemoryCount: 3,
      tags: ["architecture", "decision"],
    }

    it("accepts valid memory", () => {
      const result = MemorySchema.safeParse(validMemory)
      expect(result.success).toBe(true)
    })

    it("accepts optional fields", () => {
      const result = MemorySchema.safeParse({
        ...validMemory,
        priority: "high" as const,
        confidence: 0.92,
      })
      expect(result.success).toBe(true)
    })

    it("rejects invalid type", () => {
      const result = MemorySchema.safeParse({
        ...validMemory,
        type: "invalid",
      })
      expect(result.success).toBe(false)
    })

    it("rejects negative connectedMemoryCount", () => {
      const result = MemorySchema.safeParse({
        ...validMemory,
        connectedMemoryCount: -1,
      })
      expect(result.success).toBe(false)
    })

    it("rejects confidence above 1", () => {
      const result = MemorySchema.safeParse({
        ...validMemory,
        confidence: 1.5,
      })
      expect(result.success).toBe(false)
    })
  })

  describe("InsightSchema", () => {
    const validInsight = {
      id: "ins-001",
      title: "Test insight",
      content: "Insight content",
      confidence: 0.85,
      status: "active" as const,
      event: "Promoted memory pattern",
      outcome: "Canonical insight stored",
      evidence: "trace-ref-1",
      agent: "Allura Curator",
      project: "Allura Core",
      createdAt: "2026-04-28T07:00:00.000Z",
    }

    it("accepts valid insight", () => {
      const result = InsightSchema.safeParse(validInsight)
      expect(result.success).toBe(true)
    })

    it("accepts deprecated status", () => {
      const result = InsightSchema.safeParse({
        ...validInsight,
        status: "deprecated",
      })
      expect(result.success).toBe(true)
    })

    it("rejects confidence above 1", () => {
      const result = InsightSchema.safeParse({
        ...validInsight,
        confidence: 5.0,
      })
      expect(result.success).toBe(false)
    })
  })

  describe("GraphNodeSchema", () => {
    it("accepts valid node", () => {
      const result = GraphNodeSchema.safeParse({
        id: "node-1",
        label: "BROOKS_ARCHITECT",
        type: "agent",
      })
      expect(result.success).toBe(true)
    })

    it("rejects invalid node type", () => {
      const result = GraphNodeSchema.safeParse({
        id: "node-1",
        label: "Test",
        type: "invalid_type",
      })
      expect(result.success).toBe(false)
    })
  })

  describe("GraphEdgeSchema", () => {
    it("accepts valid edge", () => {
      const result = GraphEdgeSchema.safeParse({
        id: "edge-1",
        source: "node-1",
        target: "node-2",
        label: "performed",
      })
      expect(result.success).toBe(true)
    })

    it("rejects invalid edge label", () => {
      const result = GraphEdgeSchema.safeParse({
        id: "edge-1",
        source: "node-1",
        target: "node-2",
        label: "invalid_relation",
      })
      expect(result.success).toBe(false)
    })
  })
})

// ─── Validation Helper ─────────────────────────────────────────

describe("validateDashboardShape", () => {
  it("returns zero drift for valid data", () => {
    const metric = {
      id: "test",
      label: "Test",
      value: 0,
      description: "Test",
      tone: "blue" as const,
    }
    const result = validateDashboardShape(MetricSchema, metric, "Metric")
    expect(result.driftCount).toBe(0)
    expect(result.warnings).toHaveLength(0)
  })

  it("returns drift warnings for invalid data without throwing", () => {
    const metric = {
      id: "",
      label: "",
      value: 0,
      description: "",
      tone: "magenta",
    }
    const result = validateDashboardShape(MetricSchema, metric as any, "Metric")
    expect(result.driftCount).toBeGreaterThan(0)
    expect(result.warnings.length).toBeGreaterThan(0)
    // Data still returned — dashboard keeps rendering
    expect(result.data).toBeDefined()
  })

  it("logs warnings to console", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const metric = {
      id: "",
      label: "Test",
      value: 0,
      description: "Test",
      tone: "magenta",
    }
    validateDashboardShape(MetricSchema, metric as any, "Metric")
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe("validateDashboardArray", () => {
  it("validates array and aggregates drift", () => {
    const items = [
      { id: "test-1", label: "Test", value: 0, description: "Test", tone: "blue" as const },
      { id: "", label: "Bad", value: 0, description: "Bad", tone: "magenta" },
    ]
    const result = validateDashboardArray(MetricSchema, items as any, "Metric")
    expect(result.driftCount).toBeGreaterThan(0)
    expect(result.data).toHaveLength(2)
  })
})