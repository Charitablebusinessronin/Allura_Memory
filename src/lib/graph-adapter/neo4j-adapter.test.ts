import { describe, expect, it, vi } from "vitest"

import { Neo4jGraphAdapter } from "./neo4j-adapter"

describe("Neo4jGraphAdapter", () => {
  function makeRecord(fields: Record<string, unknown>) {
    return {
      get: (key: string) => fields[key],
    }
  }

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

  it("maps list records with Neo4j temporal values without throwing", async () => {
    const close = vi.fn()
    const run = vi
      .fn()
      .mockResolvedValueOnce({ records: [makeRecord({ total: { toNumber: () => 1 } })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({
            id: "mem-001",
            content: "live memory",
            score: 0.91,
            provenance: "conversation",
            user_id: "ronin704",
            created_at: {
              year: { low: 2026 },
              month: { low: 5 },
              day: { low: 17 },
              hour: { low: 6 },
              minute: { low: 45 },
              second: { low: 30 },
              nanosecond: { low: 123000000 },
              toString: () => "2026-05-17T06:45:30.123000000Z",
            },
            version: { toNumber: () => 2 },
            tags: ["live-data"],
            group_id: "allura-system",
            schema_version: { toNumber: () => 1 },
          }),
        ],
      })
    const session = { run, close }
    const driver = {
      session: vi.fn(() => session),
    }

    const adapter = new Neo4jGraphAdapter(driver as never)

    const result = await adapter.listMemories({
      group_id: "allura-system" as never,
      user_id: null,
    })

    expect(result.total).toBe(1)
    expect(result.memories[0]).toMatchObject({
      id: "mem-001",
      content: "live memory",
      created_at: "2026-05-17T06:45:30.123Z",
      group_id: "allura-system",
      version: 2,
      tags: ["live-data"],
    })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it("uses a safe fallback timestamp for legacy records with missing dates", async () => {
    const close = vi.fn()
    const run = vi
      .fn()
      .mockResolvedValueOnce({ records: [makeRecord({ total: { toNumber: () => 1 } })] })
      .mockResolvedValueOnce({
        records: [
          makeRecord({
            id: "mem-legacy",
            content: "legacy memory",
            score: 0.7,
            provenance: "conversation",
            user_id: null,
            created_at: undefined,
            version: { toNumber: () => 1 },
            tags: [],
            group_id: "allura-system",
          }),
        ],
      })
    const session = { run, close }
    const driver = {
      session: vi.fn(() => session),
    }

    const adapter = new Neo4jGraphAdapter(driver as never)

    const result = await adapter.listMemories({
      group_id: "allura-system" as never,
      user_id: null,
    })

    expect(result.memories[0]?.created_at).toBe("1970-01-01T00:00:00.000Z")
    expect(close).toHaveBeenCalledTimes(1)
  })
})
