import { describe, expect, it } from "vitest";

import { NotionRegistryClient } from "../../src/lib/opencode-registry/notion-client";

describe("NotionRegistryClient", () => {
  it("should instantiate with valid config", () => {
    const config = {
      agentsDbId: "test-agents-db",
      skillsDbId: "test-skills-db",
      commandsDbId: "test-commands-db",
      workflowsDbId: "test-workflows-db",
      syncRegistryDbId: "test-sync-db",
    };

    const client = new NotionRegistryClient(config);

    expect(client).toBeInstanceOf(NotionRegistryClient);
  });

  it("should return empty arrays from query methods", async () => {
    const client = new NotionRegistryClient({
      agentsDbId: "agents",
      skillsDbId: "skills",
      commandsDbId: "commands",
      workflowsDbId: "workflows",
      syncRegistryDbId: "sync",
    });

    expect(await client.queryAgents()).toEqual([]);
    expect(await client.querySkills()).toEqual([]);
    expect(await client.queryCommands()).toEqual([]);
    expect(await client.queryWorkflows()).toEqual([]);
  });

  it("should return empty strings from create methods", async () => {
    const client = new NotionRegistryClient({
      agentsDbId: "agents",
      skillsDbId: "skills",
      commandsDbId: "commands",
      workflowsDbId: "workflows",
      syncRegistryDbId: "sync",
    });

    expect(
      await client.createAgent({
        id: "test-agent",
        displayName: "Test Agent",
        type: "OpenAgent",
        status: "active",
        sourcePath: "src/test",
        skills: [],
        commands: [],
        workflows: [],
      }),
    ).toBe("");

    expect(
      await client.createSkill({
        id: "test-skill",
        sourcePath: "src/test",
        status: "active",
        agents: [],
      }),
    ).toBe("");

    expect(
      await client.createCommand({
        id: "test-cmd",
        sourcePath: "src/test",
        status: "active",
        skills: [],
        agents: [],
      }),
    ).toBe("");

    expect(
      await client.createWorkflow({
        code: "test-wf",
        sourcePath: "src/test",
        status: "active",
      }),
    ).toBe("");

    expect(
      await client.createSyncRun({
        runId: "run-1",
        runDate: new Date(),
        status: "success",
        agentsSynced: 0,
        skillsSynced: 0,
        commandsSynced: 0,
        workflowsSynced: 0,
        brokenLinks: 0,
        missingLocal: 0,
        missingNotion: 0,
      }),
    ).toBe("");
  });

  it("should not throw from update methods", async () => {
    const client = new NotionRegistryClient({
      agentsDbId: "agents",
      skillsDbId: "skills",
      commandsDbId: "commands",
      workflowsDbId: "workflows",
      syncRegistryDbId: "sync",
    });

    await expect(client.updateAgent("page-1", { status: "active" })).resolves.toBeUndefined();
    await expect(client.updateSkill("page-1", { status: "active" })).resolves.toBeUndefined();
    await expect(client.updateCommand("page-1", { status: "active" })).resolves.toBeUndefined();
    await expect(client.updateWorkflow("page-1", { status: "active" })).resolves.toBeUndefined();
  });
});
