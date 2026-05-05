import type React from "react"
import { GraphSkeleton } from "@/components/dashboard/SkeletonState"

export default function Loading(): React.ReactElement {
  return (
    <div
      className="-mx-4 -my-6 sm:-mx-6 sm:-my-8 lg:-mx-8 flex flex-col"
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <GraphSkeleton />
    </div>
  )
}
