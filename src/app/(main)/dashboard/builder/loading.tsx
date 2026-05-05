import type React from "react"
import { MetricCardsSkeleton } from "@/components/dashboard/SkeletonState"

export default function Loading(): React.ReactElement {
  return (
    <div className="space-y-8">
      <MetricCardsSkeleton />
    </div>
  )
}
