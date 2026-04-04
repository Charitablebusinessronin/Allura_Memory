import { describe, it, expect, beforeEach } from "vitest";
import { normalizeRegistry } from "../../scripts/opencode-registry/normalize";
import type {
  CanonicalAgent,
  CanonicalSkill,
  CanonicalCommand,
  CanonicalWorkflow,
} from "../../src/lib/opencode-registry/types";

describe("normalizeRegistry", () => {
  let agents: CanonicalAgent[];
  let skills: CanonicalSkill[];
  let commands: CanonicalCommand[];
  let workflows: CanonicalWorkflow[];

  beforeEach(() => {
    agents = [
      {
        id: "agent-1",
        displayName: "Agent One",
        type: "OpenAgent",
        status: "active",
        sourcePath: ".opencode/agent/core/agent-1.md",
        skills: ["skill-a", "skill-b"],
        commands: ["cmd-x"],
        workflows: ["wf-1"],
      },
      {
        id: "agent-2",
        displayName: "Agent Two",
        type: "Specialist",
        status: "active",
        sourcePath: ".opencode/agent/subagents/agent-2.md",
        skills: [],
        commands: [],
        workflows: [],
      },
    ];

    skills = [
      {
        id: "skill-a",
        displayName: "Skill A",
        category: "context",
        sourcePath: ".opencode/skills/skill-a/SKILL.md",
        status: "active",
        agents: [],
      },
      {
        id: "skill-b",
        displayName: "Skill B",
        category: "research",
        sourcePath: ".opencode/skills/skill-b/SKILL.md",
        status: "active",
        agents: [],
      },
    ];

    commands = [
      {
        id: "cmd-x",
        intent: "Command X",
        category: "memory",
        sourcePath: ".opencode/commands/cmd-x.md",
        status: "active",
        skills: ["skill-a"],
        agents: [],
      },
    ];

    workflows = [
      {
        code: "wf-1",
        name: "Workflow One",
        module: "bmm",
        agent: "agent-1",
        sourcePath: "_bmad/bmm/workflows/wf-1/workflow.md",
        status: "active",
      },
      {
        code: "wf-2",
        name: "Workflow Two",
        module: "tea",
        agent: "agent-2",
        sourcePath: "_bmad/tea/workflows/wf-2/workflow.md",
        status: "active",
      },
    ];
  });

  it("builds relation graph from entities", () => {
    const result = normalizeRegistry(agents, skills, commands, workflows);

    expect(result).toHaveProperty("agents");
    expect(result).toHaveProperty("skills");
    expect(result).toHaveProperty("commands");
    expect(result).toHaveProperty("workflows");
    expect(result).toHaveProperty("relationGraph");
    expect(result.relationGraph).toHaveProperty("agentToSkills");
    expect(result.relationGraph).toHaveProperty("agentToCommands");
    expect(result.relationGraph).toHaveProperty("agentToWorkflows");
    expect(result.relationGraph).toHaveProperty("commandToSkills");
    expect(result.relationGraph).toHaveProperty("workflowToAgent");
  });

  it("links agents to skills correctly", () => {
    const result = normalizeRegistry(agents, skills, commands, workflows);

    expect(result.relationGraph.agentToSkills.size).toBe(1);
    expect(result.relationGraph.agentToSkills.get("agent-1")).toEqual([
      "skill-a",
      "skill-b",
    ]);
    expect(result.relationGraph.agentToSkills.has("agent-2")).toBe(false);
  });

  it("links agents to commands correctly", () => {
    const result = normalizeRegistry(agents, skills, commands, workflows);

    expect(result.relationGraph.agentToCommands.size).toBe(1);
    expect(result.relationGraph.agentToCommands.get("agent-1")).toEqual([
      "cmd-x",
    ]);
    expect(result.relationGraph.agentToCommands.has("agent-2")).toBe(false);
  });

  it("links agents to workflows correctly", () => {
    const result = normalizeRegistry(agents, skills, commands, workflows);

    expect(result.relationGraph.agentToWorkflows.has("agent-1")).toBe(true);
    expect(result.relationGraph.agentToWorkflows.get("agent-1")).toContain(
      "wf-1"
    );
    expect(result.relationGraph.agentToWorkflows.has("agent-2")).toBe(true);
    expect(result.relationGraph.agentToWorkflows.get("agent-2")).toContain(
      "wf-2"
    );
  });

  it("links commands to skills correctly", () => {
    const result = normalizeRegistry(agents, skills, commands, workflows);

    expect(result.relationGraph.commandToSkills.size).toBe(1);
    expect(result.relationGraph.commandToSkills.get("cmd-x")).toEqual([
      "skill-a",
    ]);
  });

  it("links workflows to agents correctly", () => {
    const result = normalizeRegistry(agents, skills, commands, workflows);

    expect(result.relationGraph.workflowToAgent.get("wf-1")).toBe("agent-1");
    expect(result.relationGraph.workflowToAgent.get("wf-2")).toBe("agent-2");
  });

  it("backfills reverse relations from skills to agents", () => {
    const result = normalizeRegistry(agents, skills, commands, workflows);

    const skillA = result.skills.find((s) => s.id === "skill-a");
    const skillB = result.skills.find((s) => s.id === "skill-b");

    expect(skillA?.agents).toContain("agent-1");
    expect(skillB?.agents).toContain("agent-1");
  });

  it("backfills reverse relations from commands to agents", () => {
    const result = normalizeRegistry(agents, skills, commands, workflows);

    const cmdX = result.commands.find((c) => c.id === "cmd-x");

    expect(cmdX?.agents).toContain("agent-1");
  });

  it("handles empty arrays gracefully", () => {
    const result = normalizeRegistry([], [], [], []);

    expect(result.agents).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.commands).toEqual([]);
    expect(result.workflows).toEqual([]);
    expect(result.relationGraph.agentToSkills.size).toBe(0);
    expect(result.relationGraph.agentToCommands.size).toBe(0);
    expect(result.relationGraph.agentToWorkflows.size).toBe(0);
    expect(result.relationGraph.commandToSkills.size).toBe(0);
    expect(result.relationGraph.workflowToAgent.size).toBe(0);
  });

  it("handles workflows without agent field", () => {
    const workflowWithoutAgent: CanonicalWorkflow = {
      code: "wf-orphan",
      name: "Orphan Workflow",
      module: "core",
      sourcePath: "_bmad/core/workflows/wf-orphan/workflow.md",
      status: "active",
    };

    const result = normalizeRegistry(
      agents,
      skills,
      commands,
      [workflowWithoutAgent]
    );

    expect(result.relationGraph.workflowToAgent.has("wf-orphan")).toBe(false);
  });

  it("does not duplicate workflow links when agent already has workflows", () => {
    const result = normalizeRegistry(agents, skills, commands, workflows);

    const agentWorkflows = result.relationGraph.agentToWorkflows.get("agent-1");
    const wf1Count = agentWorkflows?.filter((w) => w === "wf-1").length;
    expect(wf1Count).toBe(1);
  });
});
