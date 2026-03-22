import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../neo4j/connection", () => ({
  writeTransaction: vi.fn(),
}));

vi.mock("../postgres/queries/insert-trace", () => ({
  insertEvent: vi.fn().mockResolvedValue({ id: 1 }),
}));

import { writeTransaction } from "../neo4j/connection";
import { insertEvent } from "../postgres/queries/insert-trace";
import { storeMemory } from "./store";

describe("storeMemory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles native numeric versions from Neo4j", async () => {
    vi.mocked(writeTransaction).mockImplementationOnce(async (work) => {
      const tx = {
        run: vi.fn().mockResolvedValue({
          records: [
            {
              get: vi.fn((key: string) => {
                if (key === "id") return "memory.agent.test";
                if (key === "version") return 1;
                if (key === "created_at") {
                  return { toString: (): string => "2026-03-19T21:07:27.774Z" };
                }
                if (key === "status") return "draft";
                return null;
              }),
            },
          ],
        }),
      };

      return work(tx as never);
    });

    const result = await storeMemory({
      type: "Agent",
      topic_key: "memory.agent.test",
      content: "test content",
      group_id: "memory",
      confidence: 0.5,
      status: "draft",
    });

    expect(result.version).toBe(1);
    expect(result.id).toBe("memory.agent.test");
    expect(insertEvent).toHaveBeenCalledTimes(1);
  });

  it("handles Neo4j integer-like versions when superseding", async () => {
    vi.mocked(writeTransaction)
      .mockImplementationOnce(async (work) => {
        const tx = {
          run: vi.fn().mockResolvedValue({
            records: [
              {
                get: vi.fn((key: string) => {
                  if (key === "current_version") {
                    return { toNumber: () => 2 };
                  }

                  return null;
                }),
              },
            ],
          }),
        };

        return work(tx as never);
      })
      .mockImplementationOnce(async (work) => {
        const tx = {
          run: vi.fn().mockResolvedValue({
            records: [
              {
                get: vi.fn((key: string) => {
                  if (key === "id") return "memory.agent.test";
                  if (key === "version") return { toNumber: () => 3 };
                  if (key === "created_at") {
                    return { toString: (): string => "2026-03-19T21:07:27.774Z" };
                  }
                  if (key === "status") return "draft";
                  return null;
                }),
              },
            ],
          }),
        };

        return work(tx as never);
      });

    const result = await storeMemory({
      type: "Agent",
      topic_key: "memory.agent.test",
      content: "test content",
      group_id: "memory",
      superseded_id: "memory.agent.test",
      confidence: 0.5,
      status: "draft",
    });

    expect(result.version).toBe(3);
    expect(insertEvent).toHaveBeenCalledTimes(1);
  });
});
