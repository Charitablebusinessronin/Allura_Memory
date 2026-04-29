/**
 * Workspace Isolation Tests
 *
 * Tests for:
 * - Boundary validation (path resolution, traversal prevention)
 * - Middleware (group_id extraction, strict/permissive modes)
 * - DB guard (query injection, group_id mismatch)
 * - FS guard (safe file ops within boundary)
 * - Health check (isolation status endpoint)
 * - Audit events (workspace.violation emission)
 *
 * FR-5, FR-6, NFR-4, NFR-5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Mock insertEvent before importing audit module ──────────────────────────

const mockInsertEvent = vi.fn();
vi.mock("@/lib/postgres/queries/insert-trace", () => ({
  insertEvent: (...args: unknown[]) => mockInsertEvent(...args),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  resolveWorkspacePath,
  isWithinWorkspace,
  isValidWorkspaceGroupId,
  isAllowedGroupId,
  assertWithinWorkspace,
  createWorkspaceBoundary,
  WORKSPACE_ROOT,
} from "@/lib/workspace/boundary";
import { WorkspaceViolationError } from "@/lib/workspace/errors";
import {
  safeReadFile,
  safeWriteFile,
  safeMkdir,
  safeReaddir,
  safeAccess,
} from "@/lib/workspace/fs-guard";
import {
  hasGroupIdFilter,
  guardSqlQuery,
  assertGroupIdMatch,
  guardCypherQuery,
  validateResultGroupId,
} from "@/lib/workspace/db-guard";
import {
  logWorkspaceViolation,
  getViolationSummary,
  resetViolationCounters,
} from "@/lib/workspace/audit";
import {
  withWorkspaceIsolation,
  extractGroupId,
  checkWorkspaceIsolation,
} from "@/middleware/workspace-isolation";
import { GET as healthIsolationGet } from "@/app/api/health/isolation/route";

// ── Boundary Tests ────────────────────────────────────────────────────────────

describe("Workspace Boundary", () => {
  describe("resolveWorkspacePath", () => {
    it("resolves a path within workspace", () => {
      const result = resolveWorkspacePath("test/file.txt", "/workspace");
      expect(result.withinBoundary).toBe(true);
      expect(result.absolutePath).toBe("/workspace/test/file.txt");
    });

    it("rejects path traversal to parent", () => {
      const result = resolveWorkspacePath("../etc/passwd", "/workspace");
      expect(result.withinBoundary).toBe(false);
    });

    it("rejects nested path traversal", () => {
      const result = resolveWorkspacePath("foo/../../etc/passwd", "/workspace");
      expect(result.withinBoundary).toBe(false);
    });

    it("rejects absolute path outside workspace", () => {
      const result = resolveWorkspacePath("/etc/passwd", "/workspace");
      expect(result.withinBoundary).toBe(false);
    });

    it("allows absolute path inside workspace", () => {
      const result = resolveWorkspacePath("/workspace/data/file.txt", "/workspace");
      expect(result.withinBoundary).toBe(true);
    });

    it("rejects null bytes", () => {
      expect(() => resolveWorkspacePath("file\0.txt", "/workspace")).toThrow("null bytes");
    });
  });

  describe("isWithinWorkspace", () => {
    it("returns true for valid path", () => {
      expect(isWithinWorkspace("test/file.txt", "/workspace")).toBe(true);
    });

    it("returns false for traversal", () => {
      expect(isWithinWorkspace("../../../etc/passwd", "/workspace")).toBe(false);
    });
  });

  describe("isValidWorkspaceGroupId", () => {
    it("accepts valid allura-* group_id", () => {
      expect(isValidWorkspaceGroupId("allura-test")).toBe(true);
      expect(isValidWorkspaceGroupId("allura-my-project-123")).toBe(true);
    });

    it("rejects invalid group_id", () => {
      expect(isValidWorkspaceGroupId("invalid")).toBe(false);
      expect(isValidWorkspaceGroupId("ALLURA-TEST")).toBe(false);
      expect(isValidWorkspaceGroupId("")).toBe(false);
      expect(isValidWorkspaceGroupId(null)).toBe(false);
    });
  });

  describe("assertWithinWorkspace", () => {
    it("does not throw for valid path", () => {
      expect(() => assertWithinWorkspace("test/file.txt", "/workspace")).not.toThrow();
    });

    it("throws for path outside workspace", () => {
      expect(() => assertWithinWorkspace("../../../etc/passwd", "/workspace")).toThrow(
        /outside workspace boundary/
      );
    });
  });

  describe("createWorkspaceBoundary", () => {
    it("creates boundary with correct id and paths", () => {
      const boundary = createWorkspaceBoundary("allura-test");
      expect(boundary.id).toBe("allura-test");
      expect(boundary.allowedGroupIds).toContain("allura-test");
      expect(boundary.allowedPaths[0]).toContain("allura-test");
    });
  });
});

// ── DB Guard Tests ────────────────────────────────────────────────────────────

describe("Database Guard", () => {
  describe("hasGroupIdFilter", () => {
    it("detects WHERE group_id =", () => {
      expect(hasGroupIdFilter("SELECT * FROM events WHERE group_id = $1")).toBe(true);
    });

    it("detects AND group_id =", () => {
      expect(hasGroupIdFilter("SELECT * FROM events WHERE status = 'ok' AND group_id = $1")).toBe(true);
    });

    it("returns false when missing", () => {
      expect(hasGroupIdFilter("SELECT * FROM events WHERE status = 'ok'")).toBe(false);
    });
  });

  describe("guardSqlQuery", () => {
    it("does not modify query that already has filter", () => {
      const q = guardSqlQuery("SELECT * FROM events WHERE group_id = $1", "allura-test");
      expect(q.filterInjected).toBe(false);
      expect(q.query).toBe("SELECT * FROM events WHERE group_id = $1");
    });

    it("injects WHERE for query without filter", () => {
      const q = guardSqlQuery("SELECT * FROM events", "allura-test");
      expect(q.filterInjected).toBe(true);
      expect(q.query).toContain("WHERE group_id = $1");
    });

    it("injects AND for query with existing WHERE", () => {
      const q = guardSqlQuery("SELECT * FROM events WHERE status = 'ok'", "allura-test");
      expect(q.filterInjected).toBe(true);
      expect(q.query).toContain("AND group_id = $1");
    });
  });

  describe("assertGroupIdMatch", () => {
    it("does not throw when matching", () => {
      expect(() => assertGroupIdMatch("allura-test", "allura-test")).not.toThrow();
    });

    it("throws WorkspaceViolationError when mismatch", () => {
      expect(() => assertGroupIdMatch("allura-other", "allura-test")).toThrow(
        WorkspaceViolationError
      );
    });
  });

  describe("guardCypherQuery", () => {
    it("does not modify query with existing group_id", () => {
      const q = guardCypherQuery("MATCH (i:Insight {group_id: 'allura-test'})", "allura-test");
      expect(q).toBe("MATCH (i:Insight {group_id: 'allura-test'})");
    });

    it("returns original if injection heuristic fails", () => {
      const original = "RETURN 1";
      expect(guardCypherQuery(original, "allura-test")).toBe(original);
    });
  });

  describe("validateResultGroupId", () => {
    it("does not throw for matching group_id", () => {
      expect(() =>
        validateResultGroupId({ group_id: "allura-test" }, "allura-test", "test")
      ).not.toThrow();
    });

    it("throws for missing group_id", () => {
      expect(() => validateResultGroupId({}, "allura-test", "test")).toThrow(
        WorkspaceViolationError
      );
    });

    it("throws for mismatched group_id", () => {
      expect(() =>
        validateResultGroupId({ group_id: "allura-other" }, "allura-test", "test")
      ).toThrow(WorkspaceViolationError);
    });
  });
});

// ── FS Guard Tests ────────────────────────────────────────────────────────────

describe("File System Guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetViolationCounters();
  });

  describe("safeReadFile", () => {
    it("throws WorkspaceViolationError for path outside workspace", async () => {
      await expect(safeReadFile("../../../etc/passwd")).rejects.toThrow(WorkspaceViolationError);
    });
  });

  describe("safeWriteFile", () => {
    it("throws WorkspaceViolationError for path outside workspace", async () => {
      await expect(safeWriteFile("../../../etc/passwd", "data")).rejects.toThrow(
        WorkspaceViolationError
      );
    });
  });

  describe("safeMkdir", () => {
    it("throws WorkspaceViolationError for path outside workspace", async () => {
      await expect(safeMkdir("../../../etc/passwd")).rejects.toThrow(WorkspaceViolationError);
    });
  });

  describe("safeReaddir", () => {
    it("throws WorkspaceViolationError for path outside workspace", async () => {
      await expect(safeReaddir("../../../etc")).rejects.toThrow(WorkspaceViolationError);
    });
  });

  describe("safeAccess", () => {
    it("throws WorkspaceViolationError for path outside workspace", async () => {
      await expect(safeAccess("../../../etc/passwd")).rejects.toThrow(WorkspaceViolationError);
    });
  });
});

// ── Middleware Tests ──────────────────────────────────────────────────────────

describe("Workspace Isolation Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetViolationCounters();
    mockInsertEvent.mockResolvedValue({ id: 1 });
  });

  afterEach(() => {
    delete process.env.WORKSPACE_ISOLATION_MODE;
  });

  describe("extractGroupId", () => {
    it("extracts from x-allura-group-id header", async () => {
      const req = new NextRequest("http://localhost/api/test", {
        headers: { "x-allura-group-id": "allura-test" },
      });
      expect(await extractGroupId(req)).toBe("allura-test");
    });

    it("extracts from query parameter", async () => {
      const req = new NextRequest("http://localhost/api/test?group_id=allura-test");
      expect(await extractGroupId(req)).toBe("allura-test");
    });

    it("extracts from JSON body", async () => {
      const req = new NextRequest("http://localhost/api/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ group_id: "allura-test" }),
      });
      expect(await extractGroupId(req)).toBe("allura-test");
    });

    it("returns null when missing", async () => {
      const req = new NextRequest("http://localhost/api/test");
      expect(await extractGroupId(req)).toBeNull();
    });
  });

  describe("withWorkspaceIsolation (strict mode)", () => {
    beforeEach(() => {
      process.env.WORKSPACE_ISOLATION_MODE = "strict";
    });

    it("allows valid group_id and calls handler", async () => {
      const handler = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
      const wrapped = withWorkspaceIsolation(handler);
      const req = new NextRequest("http://localhost/api/test", {
        headers: { "x-allura-group-id": "allura-test" },
      });

      const res = await wrapped(req);
      expect(res.status).toBe(200);
      expect(handler).toHaveBeenCalled();
    });

    it("rejects missing group_id with 403", async () => {
      const handler = vi.fn();
      const wrapped = withWorkspaceIsolation(handler);
      const req = new NextRequest("http://localhost/api/test");

      const res = await wrapped(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe("WS003");
      expect(handler).not.toHaveBeenCalled();
    });

    it("rejects invalid group_id with 403", async () => {
      const handler = vi.fn();
      const wrapped = withWorkspaceIsolation(handler);
      const req = new NextRequest("http://localhost/api/test", {
        headers: { "x-allura-group-id": "invalid" },
      });

      const res = await wrapped(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe("WS001");
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("withWorkspaceIsolation (permissive mode)", () => {
    beforeEach(() => {
      process.env.WORKSPACE_ISOLATION_MODE = "permissive";
    });

    it("allows missing group_id with violation flag", async () => {
      const handler = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
      const wrapped = withWorkspaceIsolation(handler);
      const req = new NextRequest("http://localhost/api/test");

      const res = await wrapped(req);
      expect(res.status).toBe(200);
      expect(handler).toHaveBeenCalled();
      const context = handler.mock.calls[0][1];
      expect(context.violation).toBe(true);
      expect(context.violationCode).toBe("WS003");
    });

    it("allows invalid group_id with violation flag", async () => {
      const handler = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
      const wrapped = withWorkspaceIsolation(handler);
      const req = new NextRequest("http://localhost/api/test", {
        headers: { "x-allura-group-id": "invalid" },
      });

      const res = await wrapped(req);
      expect(res.status).toBe(200);
      const context = handler.mock.calls[0][1];
      expect(context.violation).toBe(true);
      expect(context.violationCode).toBe("WS001");
    });
  });

  describe("checkWorkspaceIsolation", () => {
    it("returns valid for correct group_id", () => {
      const result = checkWorkspaceIsolation("allura-test");
      expect(result.valid).toBe(true);
    });

    it("returns invalid for missing group_id", () => {
      const result = checkWorkspaceIsolation("");
      expect(result.valid).toBe(false);
      expect(result.code).toBe("WS003");
    });

    it("returns invalid for bad format", () => {
      const result = checkWorkspaceIsolation("bad-format");
      expect(result.valid).toBe(false);
      expect(result.code).toBe("WS001");
    });
  });
});

// ── Health Check Tests ────────────────────────────────────────────────────────

describe("Health Check /api/health/isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetViolationCounters();
    delete process.env.WORKSPACE_ISOLATION_MODE;
  });

  it("returns ok when no violations", async () => {
    const res = await healthIsolationGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.boundaries).toEqual({
      fileSystem: true,
      database: true,
      api: true,
    });
    expect(body.violations.total).toBe(0);
    expect(body.violations.last24h).toBe(0);
  });

  it("returns degraded when violations exist", async () => {
    // Simulate a violation
    await logWorkspaceViolation({
      groupId: "allura-test",
      code: "WS001",
      message: "Test violation",
    });

    const res = await healthIsolationGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.violations.total).toBeGreaterThan(0);
  });

  it("returns correct mode", async () => {
    process.env.WORKSPACE_ISOLATION_MODE = "strict";
    const res = await healthIsolationGet();
    const body = await res.json();
    expect(body.mode).toBe("strict");
  });

  it("includes workspaceRoot in response", async () => {
    const res = await healthIsolationGet();
    const body = await res.json();
    expect(typeof body.workspaceRoot).toBe("string");
    expect(body.workspaceRoot).toContain(".openclaw/workspace");
  });
});

// ── Audit Event Tests ─────────────────────────────────────────────────────────

describe("Workspace Violation Audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetViolationCounters();
    mockInsertEvent.mockResolvedValue({ id: 1 });
  });

  it("emits workspace.violation event on logWorkspaceViolation", async () => {
    await logWorkspaceViolation({
      groupId: "allura-test",
      code: "WS001",
      message: "Test violation",
      attemptedPath: "/etc/passwd",
    });

    expect(mockInsertEvent).toHaveBeenCalledTimes(1);
    const call = mockInsertEvent.mock.calls[0][0] as Record<string, unknown>;
    expect(call.event_type).toBe("workspace.violation");
    expect(call.agent_id).toBe("workspace-guard");
    expect(call.schema_version).toBe(1);
    expect((call.metadata as Record<string, unknown>).code).toBe("WS001");
  });

  it("increments violation counters", async () => {
    await logWorkspaceViolation({ groupId: "allura-a", code: "WS001" });
    await logWorkspaceViolation({ groupId: "allura-b", code: "WS002" });

    const summary = getViolationSummary();
    expect(summary.total).toBe(2);
    expect(summary.recent.length).toBe(2);
  });

  it("does not throw when insertEvent fails", async () => {
    mockInsertEvent.mockRejectedValue(new Error("DB down"));

    await expect(
      logWorkspaceViolation({ groupId: "allura-test", code: "WS001" })
    ).resolves.not.toThrow();
  });

  it("resets counters on resetViolationCounters", async () => {
    await logWorkspaceViolation({ groupId: "allura-test", code: "WS001" });
    resetViolationCounters();
    const summary = getViolationSummary();
    expect(summary.total).toBe(0);
    expect(summary.recent.length).toBe(0);
  });
});

// ── Integration: End-to-end violation flow ────────────────────────────────────

describe("Integration: End-to-end violation flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetViolationCounters();
    mockInsertEvent.mockResolvedValue({ id: 1 });
    process.env.WORKSPACE_ISOLATION_MODE = "strict";
  });

  afterEach(() => {
    delete process.env.WORKSPACE_ISOLATION_MODE;
  });

  it("path traversal through middleware → fs guard → audit event", async () => {
    // Simulate a request that attempts path traversal
    const handler = vi.fn().mockImplementation(async (_req, context) => {
      // Handler tries to access a file outside workspace
      try {
        await safeReadFile("../../../etc/passwd");
      } catch (e) {
        if (e instanceof WorkspaceViolationError) {
          return new Response(JSON.stringify({ error: e.code }), { status: 500 });
        }
        throw e;
      }
      return new Response('{"ok":true}', { status: 200 });
    });

    const wrapped = withWorkspaceIsolation(handler);
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-allura-group-id": "allura-test" },
      method: "POST",
      body: JSON.stringify({ path: "../../../etc/passwd" }),
    });

    const res = await wrapped(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("WS002");
  });

  it("db group_id mismatch triggers audit", async () => {
    expect(() => assertGroupIdMatch("allura-evil", "allura-test")).toThrow(
      WorkspaceViolationError
    );

    // Audit is async; flush promises
    await new Promise((r) => setTimeout(r, 10));

    expect(mockInsertEvent).toHaveBeenCalled();
    const call = mockInsertEvent.mock.calls[0][0] as Record<string, unknown>;
    expect(call.event_type).toBe("workspace.violation");
  });
});
