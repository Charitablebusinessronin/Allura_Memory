import type React from "react"
import { GraphSkeleton } from "@/components/dashboard/SkeletonState"

export default function Loading(): React.ReactElement {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>
      <GraphSkeleton />
    </div>
  )
}
