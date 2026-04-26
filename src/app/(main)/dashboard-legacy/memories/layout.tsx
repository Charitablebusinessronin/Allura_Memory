import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Memories (Admin)",
  description: "Browse and manage stored memories",
}

export default function MemoriesLayout({ children }: { children: React.ReactNode }) {
  return children
}
