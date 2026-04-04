// tests/opencode-registry/verify.test.ts

import { describe, it, expect } from "vitest";
import { verifySync } from "../../scripts/opencode-registry/verify";
import type { NormalizedRegistry } from "../../scripts/opencode-registry/normalize";
import type { NotionRegistryClient } from "../../src/lib/opencode-registry/notion-client";

function makeMockClient(notionAgents: any[] = []): NotionRegistryClient {
  return {
    queryAgents: async () => notionAgents,
    querySkills: async () => [],
    queryCommands: async () => [],
    queryWorkflows: async () => [],
    createAgent: async () => "",
    createSkill: async () => "",
    createCommand: async () => "",
    createWorkflow: async () => "",
    createSyncRun: async () => "",
    updateAgent: async () => {},
    updateSkill: async () => {},
    updateCommand: async () => {},
    updateWorkflow: async () => {},
  } as unknown as NotionRegistryClient;
}

function makeEmptyRegistry(): NormalizedRegistry {
  return {
    agents: [],
    skills: [],
    commands: [],
    workflows: [],
    relationGraph: {
      agentToSkills: new Map(),
      agentToCommands: new Map(),
      agentToWorkflows: new Map(),
      commandToSkills: new Map(),
      workflowToAgent: new Map(),
    },
  };
}

describe("verifySync", () => {
  it("should report no drift when local and notion are in sync", async () => {
    const registry = makeEmptyRegistry();
    const client = makeMockClient([]);

    const report = await verifySync(registry, client);

    expect(report.missingInNotion).toEqual([]);
    expect(report.missingInLocal).toEqual([]);
    expect(report.brokenLinks).toEqual([]);
  });

  it("should detect agents missing in Notion", async () => {
    const registry: NormalizedRegistry = {
      ...makeEmptyRegistry(),
      agents: [
        {
          id: "agent-1",
          displayName: "Agent One",
          type: "OpenAgent",
          status: "active",
          sourcePath: "src/agents/agent-1.md",
          skills: [],
          commands: [],
          workflows: [],
        },
      ],
    };
    const client = makeMockClient([]);

    const report = await verifySync(registry, client);

    expect(report.missingInNotion).toContain("agent-1");
    expect(report.missingInLocal).toEqual([]);
  });

  it("should detect agents missing in local", async () => {
    const registry = makeEmptyRegistry();
    const client = makeMockClient([{ id: "agent-2" }]);

    const report = await verifySync(registry, client);

    expect(report.missingInLocal).toContain("agent-2");
    expect(report.missingInNotion).toEqual([]);
  });

  it("should detect broken agent->skill links", async () => {
    const registry: NormalizedRegistry = {
      ...makeEmptyRegistry(),
      agents: [
        {
          id: "agent-1",
          displayName: "Agent One",
          type: "OpenAgent",
          status: "active",
          sourcePath: "src/agents/agent-1.md",
          skills: [],
          commands: [],
          workflows: [],
        },
      ],
      skills: [],
      relationGraph: {
        ...makeEmptyRegistry().relationGraph,
        agentToSkills: new Map([["agent-1", ["skill-missing"]]]),
      },
    };
    const client = makeMockClient([{ id: "agent-1" }]);

    const report = await verifySync(registry, client);

    expect(report.brokenLinks).toContainEqual({
      from: "agent-1",
      to: "skill-missing",
      relation: "agent->skill",
    });
  });

  it("should detect broken agent->command links", async () => {
    const registry: NormalizedRegistry = {
      ...makeEmptyRegistry(),
      agents: [
        {
          id: "agent-1",
          displayName: "Agent One",
          type: "OpenAgent",
          status: "active",
          sourcePath: "src/agents/agent-1.md",
          skills: [],
          commands: [],
          workflows: [],
        },
      ],
      commands: [],
      relationGraph: {
        ...makeEmptyRegistry().relationGraph,
        agentToCommands: new Map([["agent-1", ["cmd-missing"]]]),
      },
    };
    const client = makeMockClient([{ id: "agent-1" }]);

    const report = await verifySync(registry, client);

    expect(report.brokenLinks).toContainEqual({
      from: "agent-1",
      to: "cmd-missing",
      relation: "agent->command",
    });
  });

  it("should detect broken agent->workflow links", async () => {
    const registry: NormalizedRegistry = {
      ...makeEmptyRegistry(),
      agents: [
        {
          id: "agent-1",
          displayName: "Agent One",
          type: "OpenAgent",
          status: "active",
          sourcePath: "src/agents/agent-1.md",
          skills: [],
          commands: [],
          workflows: [],
        },
      ],
      workflows: [],
      relationGraph: {
        ...makeEmptyRegistry().relationGraph,
        agentToWorkflows: new Map([["agent-1", ["wf-missing"]]]),
      },
    };
    const client = makeMockClient([{ id: "agent-1" }]);

    const report = await verifySync(registry, client);

    expect(report.brokenLinks).toContainEqual({
      from: "agent-1",
      to: "wf-missing",
      relation: "agent->workflow",
    });
  });

  it("should detect broken command->skill links", async () => {
    const registry: NormalizedRegistry = {
      ...makeEmptyRegistry(),
      commands: [
        {
          id: "cmd-1",
          category: "memory",
          sourcePath: "src/commands/cmd-1.md",
          status: "active",
          skills: [],
          agents: [],
        },
      ],
      skills: [],
      relationGraph: {
        ...makeEmptyRegistry().relationGraph,
        commandToSkills: new Map([["cmd-1", ["skill-missing"]]]),
      },
    };
    const client = makeMockClient([]);

    const report = await verifySync(registry, client);

    expect(report.brokenLinks).toContainEqual({
      from: "cmd-1",
      to: "skill-missing",
      relation: "command->skill",
    });
  });

  it("should detect broken workflow->agent links", async () => {
    const registry: NormalizedRegistry = {
      ...makeEmptyRegistry(),
      workflows: [
        {
          code: "wf-1",
          sourcePath: "src/workflows/wf-1.md",
          status: "active",
        },
      ],
      agents: [],
      relationGraph: {
        ...makeEmptyRegistry().relationGraph,
        workflowToAgent: new Map([["wf-1", "agent-missing"]]),
      },
    };
    const client = makeMockClient([]);

    const report = await verifySync(registry, client);

    expect(report.brokenLinks).toContainEqual({
      from: "wf-1",
      to: "agent-missing",
      relation: "workflow->agent",
    });
  });

  it("should report no broken links when all relations resolve", async () => {
    const registry: NormalizedRegistry = {
      agents: [
        {
          id: "agent-1",
          displayName: "Agent One",
          type: "OpenAgent",
          status: "active",
          sourcePath: "src/agents/agent-1.md",
          skills: ["skill-1"],
          commands: ["cmd-1"],
          workflows: ["wf-1"],
        },
      ],
      skills: [
        {
          id: "skill-1",
          sourcePath: "src/skills/skill-1.md",
          status: "active",
          agents: ["agent-1"],
        },
      ],
      commands: [
        {
          id: "cmd-1",
          sourcePath: "src/commands/cmd-1.md",
          status: "active",
          skills: ["skill-1"],
          agents: ["agent-1"],
        },
      ],
      workflows: [
        {
          code: "wf-1",
          agent: "agent-1",
          sourcePath: "src/workflows/wf-1.md",
          status: "active",
        },
      ],
      relationGraph: {
        agentToSkills: new Map([["agent-1", ["skill-1"]]]),
        agentToCommands: new Map([["agent-1", ["cmd-1"]]]),
        agentToWorkflows: new Map([["agent-1", ["wf-1"]]]),
        commandToSkills: new Map([["cmd-1", ["skill-1"]]]),
        workflowToAgent: new Map([["wf-1", "agent-1"]]),
      },
    };
    const client = makeMockClient([{ id: "agent-1" }]);

    const report = await verifySync(registry, client);

    expect(report.missingInNotion).toEqual([]);
    expect(report.missingInLocal).toEqual([]);
    expect(report.brokenLinks).toEqual([]);
  });
});
