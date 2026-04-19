/**
 * Tests for Agent Manifest — Team RAM naming and fallback_model
 */

import { describe, it, expect } from "vitest";
import {
  AGENT_MANIFEST,
  AGENT_IDS,
  CI_AGENTS,
  getAgentById,
  getAgentsForEvent,
} from "./agent-manifest";

// ── Team RAM Canonical Set ──────────────────────────────────────────────

const TEAM_RAM_IDS = [
  "brooks",
  "jobs",
  "pike",
  "fowler",
  "scout",
  "woz",
  "bellard",
  "carmack",
  "knuth",
  "hightower",
];

const LEGACY_OMO_IDS = [
  "turing",
  "berners-lee",
  "hopper",
  "cerf",
  "torvalds",
  "liskov",
  "dijkstra",
  "hinton",
];

describe("Agent Manifest — Team RAM Naming", () => {
  it("should contain exactly 10 Team RAM agents", () => {
    expect(AGENT_IDS).toHaveLength(10);
  });

  it("should contain all Team RAM agent IDs", () => {
    for (const id of TEAM_RAM_IDS) {
      expect(AGENT_IDS).toContain(id);
    }
  });

  it("should NOT contain any legacy OmO agent IDs", () => {
    for (const id of LEGACY_OMO_IDS) {
      expect(AGENT_IDS).not.toContain(id);
    }
  });

  it("should have carmack instead of dijkstra", () => {
    expect(AGENT_MANIFEST.has("carmack")).toBe(true);
    expect(AGENT_MANIFEST.has("dijkstra")).toBe(false);
  });

  it("should have hightower in the manifest", () => {
    expect(AGENT_MANIFEST.has("hightower")).toBe(true);
  });

  it("should have correct persona names for Team RAM", () => {
    const expectedPersonas: Record<string, string> = {
      brooks: "Frederick Brooks",
      jobs: "Steve Jobs",
      pike: "Rob Pike",
      fowler: "Martin Fowler",
      scout: "Scout",
      woz: "Steve Wozniak",
      bellard: "Fabrice Bellard",
      carmack: "John Carmack",
      knuth: "Donald Knuth",
      hightower: "Kelsey Hightower",
    };

    for (const [id, persona] of Object.entries(expectedPersonas)) {
      const entry = getAgentById(id);
      expect(entry.persona).toBe(persona);
    }
  });
});

describe("Agent Manifest — fallback_model", () => {
  it("should have primaryModel and fallbackModel on all agents", () => {
    for (const id of TEAM_RAM_IDS) {
      const entry = getAgentById(id);
      expect(entry.primaryModel).toBeDefined();
      expect(entry.primaryModel).not.toBe("");
      expect(entry.fallbackModel).toBeDefined();
      expect(entry.fallbackModel).not.toBe("");
    }
  });

  it("should have correct primary/fallback for brooks", () => {
    const brooks = getAgentById("brooks");
    expect(brooks.primaryModel).toBe("openai/gpt-5.4");
    expect(brooks.fallbackModel).toBe("ollama-cloud/kimi-k2.5");
  });

  it("should have correct primary/fallback for carmack", () => {
    const carmack = getAgentById("carmack");
    expect(carmack.primaryModel).toBe("ollama-cloud/qwen3-coder-next");
    expect(carmack.fallbackModel).toBe("ollama-cloud/glm-5.1");
  });

  it("should have correct primary/fallback for hightower", () => {
    const hightower = getAgentById("hightower");
    expect(hightower.primaryModel).toBe("openai/gpt-5.4");
    expect(hightower.fallbackModel).toBe("ollama-cloud/kimi-k2.5");
  });

  it("should have consistent fallback assignments per agent-routing.md", () => {
    // Verify fallback assignments match the routing table in agent-routing.md
    const expectedFallbacks: Record<string, string> = {
      brooks: "ollama-cloud/kimi-k2.5",
      jobs: "openai/gpt-5.4",
      pike: "ollama-cloud/kimi-k2.5",
      fowler: "ollama-cloud/qwen3-coder-next",
      scout: "openai/gpt-5.4-mini",
      woz: "ollama-cloud/glm-5.1",
      bellard: "ollama-cloud/qwen3-coder-next",
      carmack: "ollama-cloud/glm-5.1",
      knuth: "openai/gpt-5.4-mini",
      hightower: "ollama-cloud/kimi-k2.5",
    };

    for (const [id, expectedFallback] of Object.entries(expectedFallbacks)) {
      const entry = getAgentById(id);
      expect(entry.fallbackModel).toBe(expectedFallback);
    }
  });
});

describe("Agent Manifest — CI Routing", () => {
  it("should route pull_request events to pike", () => {
    const agents = getAgentsForEvent("pull_request", "opened");
    const agentIds = agents.map((a) => a.id);
    expect(agentIds).toContain("pike");
  });

  it("should route issues events to brooks", () => {
    const agents = getAgentsForEvent("issues", "opened");
    const agentIds = agents.map((a) => a.id);
    expect(agentIds).toContain("brooks");
  });

  it("should NOT route pull_request to dijkstra (removed)", () => {
    const agents = getAgentsForEvent("pull_request", "opened");
    const agentIds = agents.map((a) => a.id);
    expect(agentIds).not.toContain("dijkstra");
  });

  it("should list CI agents correctly", () => {
    const ciAgentIds = CI_AGENTS.map((a) => a.id);
    expect(ciAgentIds).toContain("brooks");
    expect(ciAgentIds).toContain("pike");
    expect(ciAgentIds).toContain("fowler");
    expect(ciAgentIds).toContain("knuth");
  });
});

describe("Agent Manifest — getAgentById", () => {
  it("should throw for unknown agent ID", () => {
    expect(() => getAgentById("unknown-agent")).toThrow("Agent not found");
  });

  it("should throw for legacy OmO agent ID", () => {
    expect(() => getAgentById("dijkstra")).toThrow("Agent not found");
    expect(() => getAgentById("turing")).toThrow("Agent not found");
  });
});