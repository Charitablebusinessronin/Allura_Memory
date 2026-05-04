export type DashboardStatus = "healthy" | "degraded" | "unhealthy" | "unknown"

export type BadgeTone = "blue" | "orange" | "green" | "charcoal" | "gold" | "red" | "muted"

export interface Metric {
  id: string
  label: string
  value: string | number
  description: string
  tone: BadgeTone
}

export interface Memory {
  id: string
  title: string
  content: string
  type: "event" | "outcome" | "insight" | "memory"
  agent: string
  project: string
  timestamp: string
  status: "pending" | "approved" | "rejected" | "superseded" | "active" | "unknown"
  priority?: "low" | "medium" | "high"
  evidenceIds: string[]
  connectedMemoryCount: number
  tags: string[]
  confidence?: number
}

export interface Insight {
  id: string
  title: string
  content: string
  confidence: number
  status: "pending" | "approved" | "rejected" | "superseded" | "active" | "deprecated" | "unknown"
  event: string
  outcome: string
  evidence: string
  agent: string
  project: string
  createdAt: string
  evidenceId?: string
}

export interface Evidence {
  id: string
  title: string
  status: "pending" | "approved" | "rejected" | "active" | "superseded" | "unknown"
  rawLog: string
  source: string
  agent: string
  project: string
  timestamp: string
  tags: string[]
  metadata: Record<string, unknown>
  relatedInsightId?: string
  relatedMemoryId?: string
}

export interface ActivityItem {
  id: string
  title: string
  description: string
  timestamp: string
  kind: "insight" | "memory" | "approval" | "sync" | "warning" | "system"
  agent: string
}

export type GraphNodeType = "agent" | "event" | "outcome" | "insight" | "project" | "system" | "memory" | "evidence"

export interface GraphNode {
  id: string
  label: string
  type: GraphNodeType
  metadata?: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label: "performed" | "resulted_in" | "generated" | "applies_to" | "connected_to" | "caused_by"
  metadata?: Record<string, unknown>
}

export interface DashboardWarning {
  id: string
  message: string
  source: string
}

export interface SystemStatus {
  status: DashboardStatus
  components: Array<{
    name: string
    status: DashboardStatus
    message?: string
    latency?: number
  }>
}

export interface DashboardOverview {
  metrics: Metric[]
  activity: ActivityItem[]
  pendingInsights: Insight[]
  systemStatus: SystemStatus
  warnings: DashboardWarning[]
}

export interface MemoryGraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
  totalEdges?: number
}

export interface DashboardResult<T> {
  data: T | null
  error: string | null
  degraded: boolean
  warnings: DashboardWarning[]
}

export type DecisionStatus = "decided" | "proposed" | "superseded" | "deferred" | "unknown"

export interface DecisionRecord {
  id: string
  title: string
  summary: string
  rationale: string
  status: DecisionStatus
  agentId: string
  groupId: string
  createdAt: string
  eventType: string
  metadata: Record<string, unknown>
}
