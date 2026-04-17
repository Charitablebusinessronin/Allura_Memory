import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Traces",
  description: "Redirected to /dashboard/audit (AD-18)",
}

export default function TracesLayout({ children }: { children: React.ReactNode }) {
  return children
}
