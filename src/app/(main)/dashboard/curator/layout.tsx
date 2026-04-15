import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Curator Queue",
  description: "Review and manage curator proposals - approve or reject insights pending promotion",
}

export default function CuratorLayout({ children }: { children: React.ReactNode }) {
  return children
}
