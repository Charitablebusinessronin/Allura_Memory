import { describe, expect, it, vi } from "vitest"

import { Neo4jGraphAdapter } from "./neo4j-adapter"

describe("Neo4jGraphAdapter", () => {
  it("filters deprecated memories from full-text search", async () => {
    const close = vi.fn()
    const run = vi.fn().mockResolvedValue({ records: [] })
    const session = { run, close }
    const driver = {
      session: vi.fn(() => session),
    }

    const adapter = new Neo4jGraphAdapter(driver as never)

    await adapter.searchMemories({
      query: "architecture decisions",
      group_id: "allura-system" as never,
      limit: 5,
    })

    expect(run).toHaveBeenCalledTimes(1)
    const [cypher] = run.mock.calls[0]
    expect(cypher).toContain("coalesce(m.deprecated, false) = false")
    expect(cypher).toContain("NOT (m)<-[:SUPERSEDES]-()")
    expect(close).toHaveBeenCalledTimes(1)
  })
})
