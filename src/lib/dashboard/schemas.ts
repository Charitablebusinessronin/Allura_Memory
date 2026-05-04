/**
 * RK-17 Fix: Zod schemas for Dashboard API boundary validation.
 *
 * Problem: Dashboard mappers use defensive casting (str/num/record) that
 * silently converts malformed API responses to "Unknown"/0 instead of
 * surfacing schema violations. This creates shape drift between backend
 * responses and frontend expectations.
 *
 * Solution: Zod schemas at the API boundary. Mappers still produce
 * fallback values, but schemas validate the *output* of mappers and
 * log warnings when shape drift is detected.
 */
import { z } from "zod/v4"

// ─── Primitives ───────────────────────────────────────────────

const BadgeTone = z.enum(["blue", "orange", "green", "charcoal", "gold", "red", "muted"])
const DashboardStatus = z.enum(["healthy", "degraded", "unhealthy", "unknown"])
const MemoryStatus = z.enum(["pending", "approved", "rejected", "superseded", "active", "unknown"])
const InsightStatus = z.enum(["pending", "approved", "rejected", "superseded", "active", "deprecated", "unknown"])
const EvidenceStatus = z.enum(["pending", "approved", "rejected", "active", "superseded", "unknown"])
const ActivityKind = z.enum(["insight", "memory", "approval", "sync", "warning", "system"])
const MemoryType = z.enum(["event", "outcome", "insight", "memory"])
const GraphNodeType = z.enum(["agent", "event", "outcome", "insight", "project", "system", "memory", "evidence"])
const GraphEdgeLabel = z.enum(["performed", "resulted_in", "generated", "applies_to", "connected_to", "caused_by"])
const Priority = z.enum(["low", "medium", "high"])

// ─── Domain Schemas ───────────────────────────────────────────

export const MetricSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.union([z.string(), z.number()]),
  description: z.string(),
  tone: BadgeTone,
})

export const MemorySchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  content: z.string(),
  type: MemoryType,
  agent: z.string(),
  project: z.string(),
  timestamp: z.string().datetime({ offset: true }),
  status: MemoryStatus,
  priority: Priority.optional(),
  evidenceIds: z.array(z.string()),
  connectedMemoryCount: z.number().int().min(0),
  tags: z.array(z.string()),
  confidence: z.number().min(0).max(1).optional(),
})

export const InsightSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  content: z.string(),
  confidence: z.number().min(0).max(1),
  status: InsightStatus,
  event: z.string(),
  outcome: z.string(),
  evidence: z.string(),
  agent: z.string(),
  project: z.string(),
  createdAt: z.string().datetime({ offset: true }),
  evidenceId: z.string().optional(),
})

export const EvidenceSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  status: EvidenceStatus,
  rawLog: z.string(),
  source: z.string(),
  agent: z.string(),
  project: z.string(),
  timestamp: z.string().datetime({ offset: true }),
  tags: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()),
  relatedInsightId: z.string().optional(),
  relatedMemoryId: z.string().optional(),
})

export const ActivityItemSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  timestamp: z.string().datetime({ offset: true }),
  kind: ActivityKind,
  agent: z.string(),
})

export const DashboardWarningSchema = z.object({
  id: z.string().min(1),
  message: z.string(),
  source: z.string(),
})

export const SystemStatusSchema = z.object({
  status: DashboardStatus,
  components: z.array(z.object({
    name: z.string(),
    status: DashboardStatus,
    message: z.string().optional(),
    latency: z.number().optional(),
  })),
})

export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  type: GraphNodeType,
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const GraphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: GraphEdgeLabel,
  metadata: z.record(z.string(), z.unknown()).optional(),
})

// ─── Composite Schemas ────────────────────────────────────────

export const DashboardOverviewSchema = z.object({
  metrics: z.array(MetricSchema),
  activity: z.array(ActivityItemSchema),
  pendingInsights: z.array(InsightSchema),
  systemStatus: SystemStatusSchema,
  warnings: z.array(DashboardWarningSchema),
})

export const MemoryGraphResponseSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  totalEdges: z.number().int().min(0).optional(),
})

export const DashboardResultSchema = z.union([
  z.object({
    data: z.null(),
    error: z.string().min(1),
    degraded: z.boolean(),
    warnings: z.array(DashboardWarningSchema),
  }),
  z.object({
    data: z.unknown(), // validated separately per-type
    error: z.null(),
    degraded: z.boolean(),
    warnings: z.array(DashboardWarningSchema),
  }),
])

// ─── Validation Helper ─────────────────────────────────────────

export interface ValidationResult<T> {
  data: T
  warnings: string[]
  /** Number of fields that defaulted to fallback values */
  driftCount: number
}

/**
 * Validate a mapped dashboard object against its Zod schema.
 * Returns the validated data plus any shape-drift warnings.
 * Does NOT throw — logs warnings and returns the mapper output as-is
 * so the dashboard still renders even with minor drift.
 */
export function validateDashboardShape<T>(
  schema: z.ZodType<T>,
  data: T,
  label: string
): ValidationResult<T> {
  const result = schema.safeParse(data)
  if (result.success) {
    return { data, warnings: [], driftCount: 0 }
  }

  const warnings = result.error.issues.map((issue) => {
    const path = issue.path.join(".")
    return `${label}.${path}: ${issue.message} (got ${issue.code})`
  })

  // Log drift at warning level — don't crash the dashboard
  console.warn(`[dashboard:shape-drift] ${label}: ${warnings.length} schema violations`, {
    label,
    issues: result.error.issues.map((i) => ({
      path: i.path.join("."),
      code: i.code,
      expected: "expected" in i ? i.expected : undefined,
      received: "received" in i ? i.received : undefined,
    })),
  })

  return { data, warnings, driftCount: warnings.length }
}

/**
 * Validate an array of mapped objects, aggregating all drift warnings.
 */
export function validateDashboardArray<T>(
  schema: z.ZodType<T>,
  items: T[],
  label: string
): ValidationResult<T[]> {
  const allWarnings: string[] = []
  let totalDrift = 0

  const validated = items.map((item) => {
    const result = validateDashboardShape(schema, item, label)
    allWarnings.push(...result.warnings)
    totalDrift += result.driftCount
    return result.data
  })

  return { data: validated, warnings: allWarnings, driftCount: totalDrift }
}
