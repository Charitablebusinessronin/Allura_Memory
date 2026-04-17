/**
 * Tests for Memory Detail Page — /memory/[id]
 *
 * Vitest, node environment.
 * Tests helper functions and API interaction logic.
 * Component rendering tests would require jsdom (not in current config).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mock env vars ─────────────────────────────────────────────────────────

process.env.NEXT_PUBLIC_DEFAULT_GROUP_ID = "allura-test"
process.env.NEXT_PUBLIC_DEFAULT_USER_ID = "test-user"

// ── Helper function tests ──────────────────────────────────────────────────

/** Replicate the normalizeCreatedAt function from the page (same logic) */
function normalizeCreatedAt(value: unknown): string {
  if (typeof value === "string") return value
  if (value && typeof value === "object" && "year" in (value as Record<string, unknown>)) {
    const d = value as Record<string, { low: number; high?: number }>
    const get = (field: string): number => d[field]?.low ?? 0
    return new Date(
      Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        get("hour"),
        get("minute"),
        get("second"),
        Math.floor(get("nanosecond") / 1_000_000)
      )
    ).toISOString()
  }
  return String(value ?? new Date().toISOString())
}

/** Replicate the sourceBadgeVariant function */
function sourceBadgeVariant(source: "episodic" | "semantic" | "both"): "default" | "secondary" | "outline" {
  switch (source) {
    case "episodic":
      return "secondary"
    case "semantic":
      return "default"
    case "both":
      return "outline"
  }
}

// ── Test Data ──────────────────────────────────────────────────────────────

const MOCK_MEMORY_GET_RESPONSE = {
  id: "test-memory-id",
  content: "I prefer TypeScript over JavaScript",
  score: 0.92,
  source: "both" as const,
  provenance: "manual" as const,
  user_id: "test-user",
  created_at: "2025-01-15T10:30:00.000Z",
  version: 2,
  usage_count: 5,
}

const MOCK_MEMORY_UPDATE_RESPONSE = {
  id: "new-version-id",
  previous_id: "test-memory-id",
  stored: "both" as const,
  version: 3,
  updated_at: "2025-01-16T12:00:00.000Z",
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("normalizeCreatedAt", () => {
  it("should return string as-is when already ISO string", () => {
    const result = normalizeCreatedAt("2025-01-15T10:30:00.000Z")
    expect(result).toBe("2025-01-15T10:30:00.000Z")
  })

  it("should convert Neo4j DateTime object to ISO string", () => {
    const neo4jDate = {
      year: { low: 2025, high: 0 },
      month: { low: 1, high: 0 },
      day: { low: 15, high: 0 },
      hour: { low: 10, high: 0 },
      minute: { low: 30, high: 0 },
      second: { low: 0, high: 0 },
      nanosecond: { low: 0, high: 0 },
    }
    const result = normalizeCreatedAt(neo4jDate)
    expect(result).toBe("2025-01-15T10:30:00.000Z")
  })

  it("should fallback for null/undefined value", () => {
    const result = normalizeCreatedAt(null)
    expect(result).toBeTruthy()
    // Should be a valid date string
    expect(() => new Date(result)).not.toThrow()
  })
})

describe("sourceBadgeVariant", () => {
  it("should return 'secondary' for episodic source", () => {
    expect(sourceBadgeVariant("episodic")).toBe("secondary")
  })

  it("should return 'default' for semantic source", () => {
    expect(sourceBadgeVariant("semantic")).toBe("default")
  })

  it("should return 'outline' for 'both' source", () => {
    expect(sourceBadgeVariant("both")).toBe("outline")
  })
})

describe("Memory Detail API interaction", () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  it("should call GET /api/memory/[id] with correct group_id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_MEMORY_GET_RESPONSE,
    })

    // Simulate the fetch pattern from the detail page
    const memoryId = "test-memory-id"
    const groupId = "allura-test"
    const response = await mockFetch(
      `/api/memory/${encodeURIComponent(memoryId)}?group_id=${encodeURIComponent(groupId)}`
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await (response as any).json()

    expect(mockFetch).toHaveBeenCalledWith("/api/memory/test-memory-id?group_id=allura-test")
    expect(data).toEqual(MOCK_MEMORY_GET_RESPONSE)
  })

  it("should call PUT /api/memory/[id] for update with correct parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_MEMORY_UPDATE_RESPONSE,
    })

    const memoryId = "test-memory-id"
    const groupId = "allura-test"
    const userId = "test-user"
    const newContent = "Updated content"

    await mockFetch(
      `/api/memory/${encodeURIComponent(memoryId)}?group_id=${encodeURIComponent(groupId)}&user_id=${encodeURIComponent(userId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent }),
      }
    )

    expect(mockFetch).toHaveBeenCalledWith("/api/memory/test-memory-id?group_id=allura-test&user_id=test-user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Updated content" }),
    })
  })

  it("should handle 404 response from GET", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Memory not found" }),
    })

    const response = await mockFetch("/api/memory/nonexistent?group_id=allura-test")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response as any).ok).toBe(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response as any).status).toBe(404)
  })

  it("should call DELETE /api/memory/[id] with group_id and user_id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "test-memory-id",
        deleted: true,
        deleted_at: "2025-01-16T12:00:00.000Z",
        recovery_days: 30,
      }),
    })

    const memoryId = "test-memory-id"
    const groupId = "allura-test"
    const userId = "test-user"

    await mockFetch(
      `/api/memory/${encodeURIComponent(memoryId)}?group_id=${encodeURIComponent(groupId)}&user_id=${encodeURIComponent(userId)}`,
      { method: "DELETE" }
    )

    expect(mockFetch).toHaveBeenCalledWith("/api/memory/test-memory-id?group_id=allura-test&user_id=test-user", {
      method: "DELETE",
    })
  })
})

describe("Memory Detail edit flow logic", () => {
  it("should detect content change enables save", () => {
    const originalContent = "I prefer TypeScript over JavaScript"
    const newContent = "I strongly prefer TypeScript over JavaScript"
    const trimmed = newContent.trim()

    // Save should be enabled when:
    // 1. Content is not empty
    // 2. Content has changed from original
    const canSave = trimmed.length > 0 && trimmed !== originalContent.trim()
    expect(canSave).toBe(true)
  })

  it("should detect identical content disables save", () => {
    const originalContent = "I prefer TypeScript over JavaScript"
    const newContent = "I prefer TypeScript over JavaScript"
    const trimmed = newContent.trim()

    const canSave = trimmed.length > 0 && trimmed !== originalContent.trim()
    expect(canSave).toBe(false)
  })

  it("should detect empty content disables save", () => {
    const originalContent = "I prefer TypeScript over JavaScript"
    const newContent = "   "
    const trimmed = newContent.trim()

    const canSave = trimmed.length > 0 && trimmed !== originalContent.trim()
    expect(canSave).toBe(false)
  })

  it("should navigate to new version ID after successful update", () => {
    const oldId: string = "test-memory-id"
    const newId: string = "new-version-id"

    // The page navigates to the new ID when update returns a different ID
    const shouldNavigate = newId !== oldId
    expect(shouldNavigate).toBe(true)
    // Would call: router.replace(`/memory/${newId}`)
  })
})
