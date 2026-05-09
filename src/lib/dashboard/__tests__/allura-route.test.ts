import { describe, expect, it } from "vitest"

import { ALLURA_ROUTE_SECTIONS, getAlluraRoutePolicy } from "@/lib/dashboard/allura-route"

describe("/allura route contract", () => {
  it("binds to the allura-brain adapter policy", () => {
    const policy = getAlluraRoutePolicy()

    expect(policy.adapter_id).toBe("allura-brain")
    expect(policy.route).toBe("/allura")
    expect(policy.system_of_record).toBe("allura-brain")
    expect(policy.read_policy.type).toBe("authenticated")
    expect(policy.write_policy.min_role).toBe("admin")
    expect(policy.degradation_behavior).toBe("warn")
    expect(policy.evidence_policy).toBe("full")
  })

  it("declares the first parity slice sections without sample data", () => {
    expect(ALLURA_ROUTE_SECTIONS.map((section) => section.id)).toEqual([
      "memories",
      "insights",
      "trace-logs",
      "provenance",
      "extracted-facts",
      "approval-queue",
    ])

    for (const section of ALLURA_ROUTE_SECTIONS) {
      expect(section.sourceOfTruth).toBe("allura-brain")
      expect(section.usesSampleData).toBe(false)
    }
  })
})
