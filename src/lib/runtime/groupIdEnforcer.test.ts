/**
 * Group ID Enforcer Tests
 * Validates the Semantic Firewall rejects unauthorized requests
 */

import { describe, expect, it, vi } from "vitest";
import {
  validateRequestIdentity,
  groupIdEnforcer,
  wrapToolHandler,
  type RequestLike,
  type ResponseLike,
} from "./groupIdEnforcer";

describe("validateRequestIdentity", () => {
  it("rejects requests without group_id", () => {
    const req: RequestLike = {
      method: "POST",
      body: {},
    };

    const result = validateRequestIdentity(req);

    expect(result.allowed).toBe(false);
    expect(result.error).toContain("Missing group_id");
  });

  it("rejects requests with invalid group_id format", () => {
    const req: RequestLike = {
      method: "POST",
      body: { group_id: "INVALID GROUP ID" },
    };

    const result = validateRequestIdentity(req);

    expect(result.allowed).toBe(false);
    expect(result.error).toContain("Invalid group_id");
  });

  it("accepts requests with valid group_id", () => {
    const req: RequestLike = {
      method: "POST",
      body: { group_id: "roninmemory" },
    };

    const result = validateRequestIdentity(req);

    expect(result.allowed).toBe(true);
    expect(result.group_id).toBe("roninmemory");
  });

  it("accepts requests with valid AIC header", () => {
    const req: RequestLike = {
      method: "POST",
      body: { group_id: "roninmemory" },
      headers: { "x-agent-identity": "memory-orchestrator:v1:1234567890:abc123" },
    };

    const result = validateRequestIdentity(req);

    expect(result.allowed).toBe(true);
    expect(result.agent_identity).toBe("memory-orchestrator:v1:1234567890:abc123");
  });

  it("rejects requests with malformed AIC", () => {
    const req: RequestLike = {
      method: "POST",
      body: { group_id: "roninmemory" },
      headers: { "x-agent-identity": "bad-format" },
    };

    const result = validateRequestIdentity(req);

    expect(result.allowed).toBe(false);
    expect(result.error).toContain("Agent Identity Card");
  });
});

describe("groupIdEnforcer middleware", () => {
  it("calls next() for valid requests", () => {
    const req: RequestLike = {
      method: "POST",
      body: { group_id: "roninmemory" },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as ResponseLike;
    const next = vi.fn();

    groupIdEnforcer(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 400 for missing group_id", () => {
    const req: RequestLike = {
      method: "POST",
      body: {},
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as ResponseLike;
    const next = vi.fn();

    groupIdEnforcer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("Missing group_id") })
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe("wrapToolHandler", () => {
  it("rejects tool calls without group_id", async () => {
    const handler = vi.fn().mockResolvedValue({ success: true });
    const wrapped = wrapToolHandler(handler);

    await expect(wrapped({})).rejects.toThrow("missing group_id");
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects tool calls with invalid group_id", async () => {
    const handler = vi.fn().mockResolvedValue({ success: true });
    const wrapped = wrapToolHandler(handler);

    await expect(wrapped({ group_id: "BAD ID" })).rejects.toThrow("Tool invocation rejected");
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler for valid group_id", async () => {
    const handler = vi.fn().mockResolvedValue({ success: true });
    const wrapped = wrapToolHandler(handler);

    const result = await wrapped({ group_id: "roninmemory", query: "test" });

    expect(handler).toHaveBeenCalledWith({ group_id: "roninmemory", query: "test" });
    expect(result).toEqual({ success: true });
  });
});
