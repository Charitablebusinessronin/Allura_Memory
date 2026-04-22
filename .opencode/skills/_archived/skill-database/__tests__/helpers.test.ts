import { describe, expect, it } from "bun:test"

import { isReadOnlySql, normalizeOrderBy, validateGroupIdOrWildcard } from "../src/index"

describe("skill-database helpers", () => {
  it("accepts read-only select queries", () => {
    expect(isReadOnlySql("SELECT * FROM events WHERE group_id = $1")).toBe(true)
  })

  it("rejects insert queries from execute_sql", () => {
    expect(isReadOnlySql("INSERT INTO events (event_type) VALUES ('x')")).toBe(false)
  })

  it("allows only safe order clauses", () => {
    expect(normalizeOrderBy("created_at DESC")).toBe("created_at DESC")
    expect(() => normalizeOrderBy("created_at; DROP TABLE events")).toThrow()
  })

  it("validates group ids", () => {
    expect(validateGroupIdOrWildcard("allura-roninmemory")).toBe("allura-roninmemory")
  })
})
