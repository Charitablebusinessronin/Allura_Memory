/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest"
import { generateSyncKey, EVENT_TYPE_TO_TARGET } from "@/curator/notion-projection-sync"

describe("Notion Projection Sync", () => {
  describe("generateSyncKey", () => {
    it("generates consistent keys for the same event+target", () => {
      const key1 = generateSyncKey(123, "proposal")
      const key2 = generateSyncKey(123, "proposal")
      expect(key1).toBe(key2)
    })

    it("generates different keys for different targets", () => {
      const key1 = generateSyncKey(123, "proposal")
      const key2 = generateSyncKey(123, "insight")
      expect(key1).not.toBe(key2)
    })

    it("generates different keys for different events", () => {
      const key1 = generateSyncKey(123, "proposal")
      const key2 = generateSyncKey(456, "proposal")
      expect(key1).not.toBe(key2)
    })

    it("produces a 32-character hex string", () => {
      const key = generateSyncKey(123, "proposal")
      expect(key).toMatch(/^[0-9a-f]{32}$/)
    })
  })

  describe("EVENT_TYPE_TO_TARGET", () => {
    it("maps proposal events to proposal target", () => {
      expect(EVENT_TYPE_TO_TARGET["proposal_approved"]).toBe("proposal")
      expect(EVENT_TYPE_TO_TARGET["proposal_rejected"]).toBe("proposal")
    })

    it("maps memory promotion to insight target", () => {
      expect(EVENT_TYPE_TO_TARGET["memory_promoted"]).toBe("insight")
    })

    it("maps tool approval events to tool_approval target", () => {
      expect(EVENT_TYPE_TO_TARGET["tool_approved"]).toBe("tool_approval")
      expect(EVENT_TYPE_TO_TARGET["tool_denied"]).toBe("tool_approval")
    })

    it("maps execution events to execution_event target", () => {
      expect(EVENT_TYPE_TO_TARGET["execution_succeeded"]).toBe("execution_event")
      expect(EVENT_TYPE_TO_TARGET["execution_failed"]).toBe("execution_event")
      expect(EVENT_TYPE_TO_TARGET["execution_blocked"]).toBe("execution_event")
    })

    it("maps notion_sync_pending to proposal target (backward compat)", () => {
      expect(EVENT_TYPE_TO_TARGET["notion_sync_pending"]).toBe("proposal")
    })

    it("does not map unknown event types", () => {
      expect(EVENT_TYPE_TO_TARGET["unknown_event_type"]).toBeUndefined()
    })
  })
})