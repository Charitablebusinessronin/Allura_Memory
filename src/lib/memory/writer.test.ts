/**
 * memory() wrapper tests
 *
 * Tests the write(), relate(), and read() API surface of the
 * Allura Neo4j write wrapper (src/lib/memory/writer.ts).
 *
 * Strategy: mock neo4j-driver entirely — no live DB required.
 * Each test gets a fresh session mock via the factory.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoist mock refs so they're available inside vi.mock factory ───────────────

const { mockSessionRun, mockSessionClose, mockDriver } = vi.hoisted(() => {
  const mockSessionRun = vi.fn();
  const mockSessionClose = vi.fn().mockResolvedValue(undefined);
  const mockDriver = {
    session: vi.fn().mockReturnValue({ run: mockSessionRun, close: mockSessionClose }),
  };
  return { mockSessionRun, mockSessionClose, mockDriver };
});

vi.mock("neo4j-driver", () => ({
  default: {
    driver: vi.fn().mockReturnValue(mockDriver),
    auth: {
      basic: vi.fn().mockReturnValue({ scheme: "basic", principal: "neo4j" }),
    },
  },
}));

// ── Set required env vars before module load ──────────────────────────────────

process.env.NEO4J_URI = "bolt://localhost:7687";
process.env.NEO4J_USER = "neo4j";
process.env.NEO4J_PASSWORD = "test-password";

// ── Import under test (after mocks are in place) ─────────────────────────────

// Reset module registry so the driver singleton is re-created with our mock
vi.resetModules();

import { memory } from "./writer";

// ─────────────────────────────────────────────────────────────────────────────

describe("memory().write()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionRun.mockResolvedValue({ records: [] });
  });

  it("returns a node_id when none is provided", async () => {
    const result = await memory().write({
      label: "Task",
      props: { goal: "test task", group_id: "allura-system", status: "complete" },
    });

    expect(result.node_id).toBeTruthy();
    expect(typeof result.node_id).toBe("string");
    expect(result.node_id.length).toBeGreaterThan(0);
  });

  it("preserves an explicit node_id from props", async () => {
    const id = "explicit-task-id-001";
    const result = await memory().write({
      label: "Task",
      props: { node_id: id, goal: "test", group_id: "allura-system", status: "complete" },
    });

    expect(result.node_id).toBe(id);
  });

  it("resolves node_id from task_id field", async () => {
    const result = await memory().write({
      label: "Task",
      props: { task_id: "task-uuid-xyz", goal: "test", group_id: "allura-system" },
    });

    expect(result.node_id).toBe("task-uuid-xyz");
  });

  it("resolves node_id from decision_id field", async () => {
    const result = await memory().write({
      label: "Decision",
      props: { decision_id: "dec-001", choice: "use Neo4j", group_id: "allura-system" },
    });

    expect(result.node_id).toBe("dec-001");
  });

  it("resolves node_id from lesson_id field", async () => {
    const result = await memory().write({
      label: "Lesson",
      props: { lesson_id: "lesson-001", learned: "always close sessions", group_id: "allura-system" },
    });

    expect(result.node_id).toBe("lesson-001");
  });

  it("calls session.run with MERGE Cypher containing the label", async () => {
    await memory().write({
      label: "Decision",
      props: { decision_id: "d-01", choice: "opus model", group_id: "allura-system" },
    });

    const [[cypher]] = mockSessionRun.mock.calls;
    expect(cypher).toContain("MERGE");
    expect(cypher).toContain("Decision");
    expect(cypher).toContain("node_id");
  });

  it("injects created_at and updated_at automatically", async () => {
    await memory().write({
      label: "Task",
      props: { goal: "check timestamps", group_id: "allura-system" },
    });

    const [, params] = mockSessionRun.mock.calls[0];
    expect(params.props.created_at).toBeTruthy();
    expect(params.props.updated_at).toBeTruthy();
  });

  it("preserves caller-supplied created_at", async () => {
    const ts = "2026-01-01T00:00:00.000Z";
    await memory().write({
      label: "Task",
      props: { goal: "preserve ts", group_id: "allura-system", created_at: ts },
    });

    const [, params] = mockSessionRun.mock.calls[0];
    expect(params.props.created_at).toBe(ts);
  });

  it("always calls session.close() — even on run success", async () => {
    await memory().write({
      label: "Task",
      props: { goal: "close test", group_id: "allura-system" },
    });

    expect(mockSessionClose).toHaveBeenCalledTimes(1);
  });

  it("calls session.close() even when session.run throws", async () => {
    mockSessionRun.mockRejectedValueOnce(new Error("Neo4j write failed"));

    await expect(
      memory().write({ label: "Task", props: { goal: "fail", group_id: "allura-system" } })
    ).rejects.toThrow("Neo4j write failed");

    expect(mockSessionClose).toHaveBeenCalledTimes(1);
  });

  it("writes relationship cypher when relationships array is provided", async () => {
    await memory().write({
      label: "Task",
      props: { task_id: "t-001", goal: "relate test", group_id: "allura-system" },
      relationships: [
        {
          type: "CONTRIBUTED",
          targetId: "memory-builder",
          targetLabel: "Person",
        },
      ],
    });

    // First run = MERGE node, second run = MERGE relationship
    expect(mockSessionRun).toHaveBeenCalledTimes(2);
    const [[, ], [relCypher]] = mockSessionRun.mock.calls;
    expect(relCypher).toContain("CONTRIBUTED");
    expect(relCypher).toContain("Person");
  });

  it("supports incoming relationship direction", async () => {
    await memory().write({
      label: "Task",
      props: { task_id: "t-002", goal: "incoming rel", group_id: "allura-system" },
      relationships: [
        {
          type: "INFORMED_BY",
          targetId: "d-001",
          targetLabel: "Decision",
          direction: "in",
        },
      ],
    });

    const [, [relCypher]] = mockSessionRun.mock.calls;
    // incoming: (target)-[:REL]->(n)
    expect(relCypher).toMatch(/\(target\)-\[:INFORMED_BY[^\]]*\]->\(n\)/);
  });

  it("supports relationship properties", async () => {
    await memory().write({
      label: "Task",
      props: { task_id: "t-003", goal: "rel props", group_id: "allura-system" },
      relationships: [
        {
          type: "CONTRIBUTED",
          targetId: "agent-001",
          targetLabel: "Person",
          props: { on: "2026-04-06", result: "complete" },
        },
      ],
    });

    const [, [relCypher, relParams]] = mockSessionRun.mock.calls;
    expect(relCypher).toContain("on:");
    expect(relCypher).toContain("result:");
    expect(relParams.rel_on).toBe("2026-04-06");
    expect(relParams.rel_result).toBe("complete");
  });

  it("uses custom targetKey when specified", async () => {
    await memory().write({
      label: "Task",
      props: { task_id: "t-004", goal: "custom key", group_id: "allura-system" },
      relationships: [
        {
          type: "PART_OF",
          targetId: "allura-system",
          targetLabel: "Project",
          targetKey: "group_id",
        },
      ],
    });

    const [, [relCypher]] = mockSessionRun.mock.calls;
    expect(relCypher).toContain("group_id");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("memory().relate()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionRun.mockResolvedValue({ records: [] });
  });

  it("calls session.run with MATCH + MERGE Cypher", async () => {
    await memory().relate({
      fromId: "t-001",
      fromLabel: "Task",
      toId: "d-001",
      toLabel: "Decision",
      type: "INFORMED_BY",
    });

    const [[cypher, params]] = mockSessionRun.mock.calls;
    expect(cypher).toContain("MATCH");
    expect(cypher).toContain("MERGE");
    expect(cypher).toContain("INFORMED_BY");
    expect(params.fromId).toBe("t-001");
    expect(params.toId).toBe("d-001");
  });

  it("includes relationship props in Cypher and params", async () => {
    await memory().relate({
      fromId: "agent-001",
      fromLabel: "Person",
      toId: "t-001",
      toLabel: "Task",
      type: "CONTRIBUTED",
      props: { on: "2026-04-06", result: "complete" },
    });

    const [[cypher, params]] = mockSessionRun.mock.calls;
    expect(cypher).toContain("on:");
    expect(params.on).toBe("2026-04-06");
    expect(params.result).toBe("complete");
  });

  it("closes session on success", async () => {
    await memory().relate({
      fromId: "a", fromLabel: "Task",
      toId: "b", toLabel: "Decision",
      type: "INFORMED_BY",
    });

    expect(mockSessionClose).toHaveBeenCalledTimes(1);
  });

  it("closes session even when run throws", async () => {
    mockSessionRun.mockRejectedValueOnce(new Error("relate failed"));

    await expect(
      memory().relate({ fromId: "a", fromLabel: "Task", toId: "b", toLabel: "Decision", type: "INFORMED_BY" })
    ).rejects.toThrow("relate failed");

    expect(mockSessionClose).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("memory().read()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no records", async () => {
    mockSessionRun.mockResolvedValue({ records: [] });

    const result = await memory().read("MATCH (n:Task) RETURN n LIMIT 0");
    expect(result).toEqual([]);
  });

  it("maps record keys to object properties", async () => {
    mockSessionRun.mockResolvedValue({
      records: [
        {
          keys: ["goal", "status"],
          get: (key: string) => key === "goal" ? "write tests" : "complete",
        },
      ],
    });

    const result = await memory().read<{ goal: string; status: string }>(
      "MATCH (t:Task) RETURN t.goal AS goal, t.status AS status LIMIT 1"
    );

    expect(result[0].goal).toBe("write tests");
    expect(result[0].status).toBe("complete");
  });

  it("unwraps node .properties when present", async () => {
    mockSessionRun.mockResolvedValue({
      records: [
        {
          keys: ["t"],
          get: () => ({ properties: { goal: "unwrap test", group_id: "allura-system" } }),
        },
      ],
    });

    const result = await memory().read("MATCH (t:Task) RETURN t LIMIT 1");
    expect((result[0] as { t: { goal: string } }).t).toEqual({ goal: "unwrap test", group_id: "allura-system" });
  });

  it("passes Cypher params to session.run", async () => {
    mockSessionRun.mockResolvedValue({ records: [] });

    await memory().read("MATCH (t:Task {goal: $goal}) RETURN t", { goal: "specific" });

    const [[, params]] = mockSessionRun.mock.calls;
    expect(params.goal).toBe("specific");
  });

  it("closes session after read", async () => {
    mockSessionRun.mockResolvedValue({ records: [] });
    await memory().read("MATCH (n) RETURN n LIMIT 0");
    expect(mockSessionClose).toHaveBeenCalledTimes(1);
  });

  it("closes session even when read throws", async () => {
    mockSessionRun.mockRejectedValueOnce(new Error("read failed"));

    await expect(
      memory().read("MATCH (n) RETURN n")
    ).rejects.toThrow("read failed");

    expect(mockSessionClose).toHaveBeenCalledTimes(1);
  });
});
