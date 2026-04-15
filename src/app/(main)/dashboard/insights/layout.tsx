import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Insights",
  description: "Browse knowledge graph insights from Neo4j",
}

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return children
}
