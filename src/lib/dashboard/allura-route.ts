import { createDefaultRegistry, getAdapter } from "@/lib/adapter-registry"
import type { AdapterDeclaration } from "@/lib/adapter-registry"

export type AlluraRouteSectionId =
  | "memories"
  | "insights"
  | "trace-logs"
  | "provenance"
  | "extracted-facts"
  | "approval-queue"

export interface AlluraRouteSection {
  id: AlluraRouteSectionId
  label: string
  description: string
  sourceOfTruth: AdapterDeclaration["system_of_record"]
  readMode: "live" | "derived"
  usesSampleData: false
}

export const ALLURA_ROUTE_SECTIONS: AlluraRouteSection[] = [
  {
    id: "memories",
    label: "Memories",
    description: "Approved and episodic memories returned by the governed memory APIs.",
    sourceOfTruth: "allura-brain",
    readMode: "live",
    usesSampleData: false,
  },
  {
    id: "insights",
    label: "Insights",
    description: "Curated insight records and active semantic knowledge.",
    sourceOfTruth: "allura-brain",
    readMode: "live",
    usesSampleData: false,
  },
  {
    id: "trace-logs",
    label: "Trace Logs",
    description: "Append-only trace evidence from PostgreSQL-backed memory events.",
    sourceOfTruth: "allura-brain",
    readMode: "live",
    usesSampleData: false,
  },
  {
    id: "provenance",
    label: "Provenance",
    description: "Agent, project, and graph relationships derived from memory evidence.",
    sourceOfTruth: "allura-brain",
    readMode: "derived",
    usesSampleData: false,
  },
  {
    id: "extracted-facts",
    label: "Extracted Facts",
    description: "Fact-like evidence surfaced from traces and insight candidates.",
    sourceOfTruth: "allura-brain",
    readMode: "derived",
    usesSampleData: false,
  },
  {
    id: "approval-queue",
    label: "Approval Queue",
    description: "Pending canonical proposals requiring curator/HITL approval.",
    sourceOfTruth: "allura-brain",
    readMode: "live",
    usesSampleData: false,
  },
]

export function getAlluraRoutePolicy(): AdapterDeclaration {
  const registry = createDefaultRegistry()
  const adapter = getAdapter(registry, "allura-brain")

  if (!adapter) {
    throw new Error("Allura Brain adapter is not registered")
  }

  return adapter
}
