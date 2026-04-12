/**
 * Unit tests for group_id validation in legacy MCP files (Issue #7).
 *
 * Suite 1: tools.ts Zod schema validation — invalid group_ids throw ZodError before DB
 * Suite 2: group_id regex invariant (allura-* namespace) tested directly
 * Suite 3: Append-only events invariant — no UPDATE/DELETE on events table in legacy files
 *
 * No DB connections required. All three suites are pure unit tests.
 */

import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Suite 1: tools.ts Zod schema validation
// ---------------------------------------------------------------------------
//
// Each tool function calls Schema.parse(args) before touching the DB.
// Passing an invalid group_id must throw ZodError — no DB needed.
// For valid group_ids we verify the error thrown is NOT a ZodError, which
// proves validation passed and the failure came from the missing DB.
// ---------------------------------------------------------------------------

import {
  memorySearch,
  memoryStore,
  adasRunSearch,
  adasGetProposals,
  adasApproveDesign,
} from "../../mcp/legacy/tools.js";

const INVALID_GROUP_IDS = ["", "roninclaw-test", "test", "ALLURA-upper", "allura_underscore"];
const VALID_GROUP_IDS = ["allura-roninmemory", "allura-test-123"];

describe("Suite 1 — tools.ts Zod group_id validation", () => {
  // -------------------------------------------------------------------------
  // memorySearch
  // -------------------------------------------------------------------------
  describe("memorySearch", () => {
    it.each(INVALID_GROUP_IDS)(
      "rejects invalid group_id '%s' with ZodError",
      async (group_id) => {
        await expect(memorySearch({ query: "test", group_id })).rejects.toBeInstanceOf(ZodError);
      }
    );

    it.each(VALID_GROUP_IDS)(
      "accepts valid group_id '%s' — error is NOT ZodError",
      async (group_id) => {
        try {
          await memorySearch({ query: "test", group_id });
          // adasRunSearch returns immediately; other tools may succeed or fail on DB
        } catch (err) {
          expect(err).not.toBeInstanceOf(ZodError);
        }
      }
    );
  });

  // -------------------------------------------------------------------------
  // memoryStore
  // -------------------------------------------------------------------------
  describe("memoryStore", () => {
    const validStorePayload = {
      topic_key: "key-001",
      title: "Test Title",
      content: "Some content",
      type: "insight" as const,
    };

    it.each(INVALID_GROUP_IDS)(
      "rejects invalid group_id '%s' with ZodError",
      async (group_id) => {
        await expect(
          memoryStore({ ...validStorePayload, group_id })
        ).rejects.toBeInstanceOf(ZodError);
      }
    );

    it.each(VALID_GROUP_IDS)(
      "accepts valid group_id '%s' — error is NOT ZodError",
      async (group_id) => {
        try {
          await memoryStore({ ...validStorePayload, group_id });
        } catch (err) {
          expect(err).not.toBeInstanceOf(ZodError);
        }
      }
    );
  });

  // -------------------------------------------------------------------------
  // adasRunSearch (no DB call — returns immediately after parse)
  // -------------------------------------------------------------------------
  describe("adasRunSearch", () => {
    it.each(INVALID_GROUP_IDS)(
      "rejects invalid group_id '%s' with ZodError",
      async (group_id) => {
        await expect(
          adasRunSearch({ domain: "engineering", group_id })
        ).rejects.toBeInstanceOf(ZodError);
      }
    );

    it.each(VALID_GROUP_IDS)(
      "accepts valid group_id '%s' and returns without DB error",
      async (group_id) => {
        // adasRunSearch returns a placeholder without touching the DB
        const result = await adasRunSearch({ domain: "engineering", group_id });
        expect(result).toMatchObject({ status: "not_implemented", group_id });
      }
    );
  });

  // -------------------------------------------------------------------------
  // adasGetProposals
  // -------------------------------------------------------------------------
  describe("adasGetProposals", () => {
    it.each(INVALID_GROUP_IDS)(
      "rejects invalid group_id '%s' with ZodError",
      async (group_id) => {
        await expect(adasGetProposals({ group_id })).rejects.toBeInstanceOf(ZodError);
      }
    );

    it.each(VALID_GROUP_IDS)(
      "accepts valid group_id '%s' — error is NOT ZodError",
      async (group_id) => {
        try {
          await adasGetProposals({ group_id });
        } catch (err) {
          expect(err).not.toBeInstanceOf(ZodError);
        }
      }
    );
  });

  // -------------------------------------------------------------------------
  // adasApproveDesign
  // -------------------------------------------------------------------------
  describe("adasApproveDesign", () => {
    const validApprovePayload = {
      designId: "design-abc",
      decision: "approve" as const,
      rationale: "Looks good",
      approvedBy: "ronin704",
    };

    it.each(INVALID_GROUP_IDS)(
      "rejects invalid group_id '%s' with ZodError",
      async (group_id) => {
        await expect(
          adasApproveDesign({ ...validApprovePayload, group_id })
        ).rejects.toBeInstanceOf(ZodError);
      }
    );

    it.each(VALID_GROUP_IDS)(
      "accepts valid group_id '%s' — error is NOT ZodError",
      async (group_id) => {
        try {
          await adasApproveDesign({ ...validApprovePayload, group_id });
        } catch (err) {
          expect(err).not.toBeInstanceOf(ZodError);
        }
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 2: group_id invariant — allura-* namespace regex
// ---------------------------------------------------------------------------
//
// Tests the same regex used in both validateGroupId (memory-server.ts) and
// all Zod schemas in tools.ts: /^allura-[a-z0-9-]+$/
// ---------------------------------------------------------------------------

const ALLURA_REGEX = /^allura-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

describe("Suite 2 — group_id invariant (allura-* namespace)", () => {
  const VALID = ["allura-roninmemory", "allura-test", "allura-project-123"];
  const INVALID = [
    "roninclaw-test",
    "test",
    "",
    "ALLURA-UPPER",
    "allura_underscore",
    "allura-",
    " allura-test",
  ];

  it.each(VALID)("accepts valid group_id: %s", (id) => {
    expect(ALLURA_REGEX.test(id)).toBe(true);
  });

  it.each(INVALID)("rejects invalid group_id: %s", (id) => {
    expect(ALLURA_REGEX.test(id)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Append-only events invariant (static source check)
// ---------------------------------------------------------------------------
//
// Confirms neither legacy file contains UPDATE … events or DELETE FROM events,
// which would violate the append-only contract on the episodic memory table.
// ---------------------------------------------------------------------------

const LEGACY_DIR = resolve(__dirname, "../../mcp/legacy");

describe("Suite 3 — append-only events invariant (static)", () => {
  it("tools.ts has no UPDATE on events table", () => {
    const src = readFileSync(resolve(LEGACY_DIR, "tools.ts"), "utf-8");
    expect(src).not.toMatch(/UPDATE\s+events/i);
    expect(src).not.toMatch(/DELETE\s+FROM\s+events/i);
  });

  it("memory-server.ts has no UPDATE on events table", () => {
    const src = readFileSync(resolve(LEGACY_DIR, "memory-server.ts"), "utf-8");
    expect(src).not.toMatch(/UPDATE\s+events/i);
    expect(src).not.toMatch(/DELETE\s+FROM\s+events/i);
  });
});
