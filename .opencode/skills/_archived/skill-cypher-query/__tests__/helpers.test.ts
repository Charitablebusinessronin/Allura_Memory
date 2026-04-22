import { describe, expect, it } from "bun:test"

import { isReadOnlyCypher, requiresTenantScope } from "../src/index"

describe("skill-cypher-query helpers", () => {
  it("accepts read-only match queries", () => {
    expect(isReadOnlyCypher("MATCH (n) RETURN n LIMIT 1")).toBe(true)
  })

  it("rejects write queries", () => {
    expect(isReadOnlyCypher("MATCH (n) DELETE n")).toBe(false)
  })

  it("requires explicit tenant scope for normal queries", () => {
    expect(() => requiresTenantScope("MATCH (n) RETURN n", "allura-roninmemory")).toThrow()
    expect(() => requiresTenantScope("MATCH (n {group_id: $groupId}) RETURN n", "allura-roninmemory")).not.toThrow()
  })
})
