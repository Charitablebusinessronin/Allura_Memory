import { describe, it, expect } from "vitest";
import { extractAgents } from "../../scripts/opencode-registry/extract-agents";
import { join } from "path";

describe("extractAgents", () => {
  const projectRoot = join(process.cwd());

  it("returns a non-empty array of agents", async () => {
    const agents = await extractAgents(projectRoot);
    expect(agents).toBeInstanceOf(Array);
    expect(agents.length).toBeGreaterThan(0);
  });

  it("extracts OpenCode agents including memory-orchestrator", async () => {
    const agents = await extractAgents(projectRoot);
    const orchestrator = agents.find((a) => a.id === "memory-orchestrator");
    expect(orchestrator).toBeDefined();
    expect(orchestrator?.type).toBe("OpenAgent");
    expect(orchestrator?.category).toBe("core");
    expect(orchestrator?.persona).toBe("Frederick P. Brooks Jr.");
    expect(orchestrator?.skills).toContain("skill:bmad-party-mode");
  });

  it("extracts BMad agents including at least one persona", async () => {
    const agents = await extractAgents(projectRoot);
    const bmadAgents = agents.filter(
      (a) => a.type === "BMad Persona" || a.type === "WDS Persona"
    );
    expect(bmadAgents.length).toBeGreaterThan(0);

    const mary = bmadAgents.find((a) => a.id === "bmad-agent-analyst");
    expect(mary).toBeDefined();
    expect(mary?.displayName).toBe("Mary");
    expect(mary?.category).toBe("bmm");
  });

  it("extracts WDS agents with correct type", async () => {
    const agents = await extractAgents(projectRoot);
    const wdsAgents = agents.filter((a) => a.type === "WDS Persona");
    expect(wdsAgents.length).toBeGreaterThan(0);

    const freya = wdsAgents.find((a) => a.id === "wds-agent-freya-ux");
    expect(freya).toBeDefined();
    expect(freya?.displayName).toBe("Freya");
    expect(freya?.category).toBe("wds");
  });

  it("extracts subagents as Specialist type", async () => {
    const agents = await extractAgents(projectRoot);
    const specialists = agents.filter((a) => a.type === "Specialist");
    expect(specialists.length).toBeGreaterThan(0);

    const scout = specialists.find((a) => a.id === "memory-scout");
    expect(scout).toBeDefined();
    expect(scout?.category).toBe("subagents/core");
  });

  it("sets groupId on all agents", async () => {
    const agents = await extractAgents(projectRoot);
    agents.forEach((agent) => {
      expect(agent.groupId).toBe("roninmemory");
    });
  });

  it("sets status to active on all agents", async () => {
    const agents = await extractAgents(projectRoot);
    agents.forEach((agent) => {
      expect(agent.status).toBe("active");
    });
  });
});
