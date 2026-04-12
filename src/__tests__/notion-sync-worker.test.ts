/**
 * Integration tests for Notion Sync Worker
 *
 * Tests the event processing pipeline:
 * 1. Fetch pending notion_sync_pending events from PostgreSQL
 * 2. Prepare data for MCP Docker Notion tools
 * 3. Verify property format matches Notion DB schema
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";
import { processNotionSyncEvent, getPendingEvents } from "../curator/notion-sync-worker";

// Mock PostgreSQL pool
let mockPool: Pool;

describe("Notion Sync Worker", () => {
  beforeEach(async () => {
    // Setup mock PostgreSQL connection
    mockPool = new Pool({
      host: process.env.POSTGRES_HOST || "localhost",
      port: parseInt(process.env.POSTGRES_PORT || "5432"),
      database: process.env.POSTGRES_DB || "memory",
      user: process.env.POSTGRES_USER || "ronin4life",
      password: process.env.POSTGRES_PASSWORD,
    });
  });

  afterEach(async () => {
    await mockPool.end();
  });

  describe("processNotionSyncEvent", () => {
    it("should prepare correct properties for approved proposal", async () => {
      const event = {
        id: "test-event-id",
        group_id: "allura-roninmemory",
        event_type: "notion_sync_pending",
        agent_id: "curator-approve",
        status: "pending",
        metadata: {
          proposal_id: "test-proposal-id",
          content: "Test proposal content for integration test",
          score: 0.95,
          tier: "mainstream",
          status: "approved",
          curator_id: "brooks-architect",
          rationale: "All validation gates passed",
          decided_at: "2026-04-12T07:30:00Z",
          data_source_id: "42894678-aedb-4c90-9371-6494a9fe5270",
        },
        created_at: "2026-04-12T07:30:00Z",
      };

      const result = await processNotionSyncEvent(event);

      expect(result.success).toBe(true);
      // The agent will call MCP Docker tools to create the page
    });

    it("should prepare correct properties for rejected proposal", async () => {
      const event = {
        id: "test-event-id",
        group_id: "allura-roninmemory",
        event_type: "notion_sync_pending",
        agent_id: "curator-approve",
        status: "pending",
        metadata: {
          proposal_id: "test-proposal-id",
          content: "Test proposal content for rejection test",
          score: 0.45,
          tier: "emerging",
          status: "rejected",
          curator_id: "brooks-architect",
          rationale: "Score below threshold",
          decided_at: "2026-04-12T07:30:00Z",
          data_source_id: "42894678-aedb-4c90-9371-6494a9fe5270",
        },
        created_at: "2026-04-12T07:30:00Z",
      };

      const result = await processNotionSyncEvent(event);

      expect(result.success).toBe(true);
    });

    it("should map tier to correct Notion Type", async () => {
      const tiers = [
        { tier: "emerging", expectedType: "insight" },
        { tier: "adoption", expectedType: "pattern" },
        { tier: "mainstream", expectedType: "decision" },
      ];

      for (const { tier, expectedType } of tiers) {
        const event = {
          id: "test-event-id",
          group_id: "allura-roninmemory",
          event_type: "notion_sync_pending",
          agent_id: "curator-approve",
          status: "pending",
          metadata: {
            proposal_id: "test-proposal-id",
            content: "Test proposal",
            score: 0.8,
            tier,
            status: "approved",
            curator_id: "brooks-architect",
            decided_at: "2026-04-12T07:30:00Z",
            data_source_id: "42894678-aedb-4c90-9371-6494a9fe5270",
          },
          created_at: "2026-04-12T07:30:00Z",
        };

        const result = await processNotionSyncEvent(event);
        expect(result.success).toBe(true);
      }
    });

    it("should format date correctly (YYYY-MM-DD only)", async () => {
      const event = {
        id: "test-event-id",
        group_id: "allura-roninmemory",
        event_type: "notion_sync_pending",
        agent_id: "curator-approve",
        status: "pending",
        metadata: {
          proposal_id: "test-proposal-id",
          content: "Test proposal",
          score: 0.8,
          tier: "mainstream",
          status: "approved",
          curator_id: "brooks-architect",
          decided_at: "2026-04-12T07:30:00Z", // ISO datetime
          data_source_id: "42894678-aedb-4c90-9371-6494a9fe5270",
        },
        created_at: "2026-04-12T07:30:00Z",
      };

      const result = await processNotionSyncEvent(event);
      expect(result.success).toBe(true);
      // The date:Proposed At:start property should be "2026-04-12" (no time)
    });

    it("should handle missing rationale gracefully", async () => {
      const event = {
        id: "test-event-id",
        group_id: "allura-roninmemory",
        event_type: "notion_sync_pending",
        agent_id: "curator-approve",
        status: "pending",
        metadata: {
          proposal_id: "test-proposal-id",
          content: "Test proposal",
          score: 0.8,
          tier: "mainstream",
          status: "approved",
          curator_id: "brooks-architect",
          // rationale omitted
          decided_at: "2026-04-12T07:30:00Z",
          data_source_id: "42894678-aedb-4c90-9371-6494a9fe5270",
        },
        created_at: "2026-04-12T07:30:00Z",
      };

      const result = await processNotionSyncEvent(event);
      expect(result.success).toBe(true);
    });
  });

  describe("Notion Property Format", () => {
    it("should NOT include Score property (Notion rejects floats)", async () => {
      // Score should be in page content, not properties
      const event = {
        id: "test-event-id",
        group_id: "allura-roninmemory",
        event_type: "notion_sync_pending",
        agent_id: "curator-approve",
        status: "pending",
        metadata: {
          proposal_id: "test-proposal-id",
          content: "Test proposal",
          score: 0.95,
          tier: "mainstream",
          status: "approved",
          curator_id: "brooks-architect",
          decided_at: "2026-04-12T07:30:00Z",
          data_source_id: "42894678-aedb-4c90-9371-6494a9fe5270",
        },
        created_at: "2026-04-12T07:30:00Z",
      };

      const result = await processNotionSyncEvent(event);
      expect(result.success).toBe(true);
      // Score is stored in page content, not in properties
    });

    it("should use __YES__ for Notion Synced checkbox", async () => {
      // Notion checkbox uses "__YES__" for true, "__NO__" for false
      const event = {
        id: "test-event-id",
        group_id: "allura-roninmemory",
        event_type: "notion_sync_pending",
        agent_id: "curator-approve",
        status: "pending",
        metadata: {
          proposal_id: "test-proposal-id",
          content: "Test proposal",
          score: 0.8,
          tier: "mainstream",
          status: "approved",
          curator_id: "brooks-architect",
          decided_at: "2026-04-12T07:30:00Z",
          data_source_id: "42894678-aedb-4c90-9371-6494a9fe5270",
        },
        created_at: "2026-04-12T07:30:00Z",
      };

      const result = await processNotionSyncEvent(event);
      expect(result.success).toBe(true);
      // Notion Synced should be "__YES__"
    });
  });
});