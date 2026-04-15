import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Traces",
  description: "Browse and filter audit trace events from PostgreSQL",
}

export default function TracesLayout({ children }: { children: React.ReactNode }) {
  return children
}
