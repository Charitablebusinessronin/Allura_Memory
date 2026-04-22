import { describe, expect, it } from "bun:test"

import { validateGroupIdOrWildcard } from "../src/index"

describe("skill-neo4j-memory helpers", () => {
  it("accepts a valid tenant group", () => {
    expect(validateGroupIdOrWildcard("allura-roninmemory")).toBe("allura-roninmemory")
  })

  it("accepts wildcard group", () => {
    expect(validateGroupIdOrWildcard("allura-*")).toBe("allura-*")
  })

  it("rejects invalid group ids", () => {
    expect(() => validateGroupIdOrWildcard("roninclaw-test")).toThrow()
  })
})
