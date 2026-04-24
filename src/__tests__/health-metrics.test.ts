/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { GET } from "@/app/api/health/metrics/route"

describe("Health Metrics Endpoint", () => {
  describe("Response structure", () => {
    it("returns a well-formed MetricsResponse object", async () => {
      const response = await GET(new Request("http://localhost:4748/api/health/metrics"))
      const body = await response.json()

      // Must have top-level keys
      expect(body).toHaveProperty("timestamp")
      expect(body).toHaveProperty("queue")
      expect(body).toHaveProperty("recall")
      expect(body).toHaveProperty("storage")
      expect(body).toHaveProperty("degraded")
    })

    it("returns queue metrics with correct structure", async () => {
      const response = await GET(new Request("http://localhost:4748/api/health/metrics"))
      const body = await response.json()

      expect(body.queue).toHaveProperty("pending_count")
      expect(body.queue).toHaveProperty("oldest_age_hours")
      expect(body.queue).toHaveProperty("approved_24h")
      expect(body.queue).toHaveProperty("rejected_24h")

      expect(typeof body.queue.pending_count).toBe("number")
      expect(typeof body.queue.oldest_age_hours).toBe("number")
    })

    it("returns recall metrics", async () => {
      const response = await GET(new Request("http://localhost:4748/api/health/metrics"))
      const body = await response.json()

      expect(body.recall).toHaveProperty("search_available")
      expect(typeof body.recall.search_available).toBe("boolean")
    })

    it("returns storage metrics for both postgres and neo4j", async () => {
      const response = await GET(new Request("http://localhost:4748/api/health/metrics"))
      const body = await response.json()

      expect(body.storage.postgres).toHaveProperty("status")
      expect(body.storage.postgres).toHaveProperty("latency_ms")
      expect(body.storage.postgres).toHaveProperty("total_memories")

      expect(body.storage.neo4j).toHaveProperty("status")
      expect(body.storage.neo4j).toHaveProperty("latency_ms")
    })

    it("returns degraded counters", async () => {
      const response = await GET(new Request("http://localhost:4748/api/health/metrics"))
      const body = await response.json()

      expect(body.degraded).toHaveProperty("neo4j_unavailable")
      expect(body.degraded).toHaveProperty("scope_error")
      expect(body.degraded).toHaveProperty("embedding_failures")
      expect(body.degraded).toHaveProperty("promotion_failures_24h")

      expect(typeof body.degraded.neo4j_unavailable).toBe("number")
    })
  })
})