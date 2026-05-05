import type React from "react"
import { MetricCardsSkeleton, SearchResultsSkeleton } from "@/components/dashboard/SkeletonState"

export default function Loading(): React.ReactElement {
  return (
    <div className="space-y-8">
      <MetricCardsSkeleton />
      <SearchResultsSkeleton />
    </div>
  )
}
