import { describe, expect, it, vi } from "vitest";
import { bootstrapMemoryServer } from "../mcp/startup";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("bootstrapMemoryServer", () => {
  it("resets budget state before warming and runs warmups in parallel", async () => {
    const events: string[] = [];
    const resetBudgetStateFn = vi.fn(() => {
      events.push("reset");
    });

    const connections = deferred<void>();
    const embedding = deferred<boolean>();

    const warmConnectionsFn = vi.fn(async () => {
      events.push("connections-start");
      await connections.promise;
      events.push("connections-end");
    });

    const warmEmbeddingFn = vi.fn(async () => {
      events.push("embedding-start");
      await embedding.promise;
      events.push("embedding-end");
      return true;
    });

    const boot = bootstrapMemoryServer({
      resetBudgetStateFn,
      warmConnectionsFn,
      warmEmbeddingFn,
    });

    expect(resetBudgetStateFn).toHaveBeenCalledTimes(1);
    expect(warmConnectionsFn).toHaveBeenCalledTimes(1);
    expect(warmEmbeddingFn).toHaveBeenCalledTimes(1);
    expect(events).toEqual(["reset", "connections-start", "embedding-start"]);

    let settled = false;
    boot.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    connections.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);

    embedding.resolve(true);
    await boot;
    expect(settled).toBe(true);
    expect(events).toContain("connections-end");
    expect(events).toContain("embedding-end");
  });

  it("keeps boot alive when a warmup fails", async () => {
    const boot = bootstrapMemoryServer({
      resetBudgetStateFn: vi.fn(),
      warmConnectionsFn: vi.fn(async () => {
        throw new Error("postgres unavailable");
      }),
      warmEmbeddingFn: vi.fn(async () => true),
    });

    await expect(boot).resolves.toBeUndefined();
  });
});
