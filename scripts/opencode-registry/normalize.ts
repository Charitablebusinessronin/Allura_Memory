// scripts/opencode-registry/normalize.ts

import type {
  CanonicalAgent,
  CanonicalSkill,
  CanonicalCommand,
  CanonicalWorkflow,
} from "../../src/lib/opencode-registry/types";

export interface RelationGraph {
  agentToSkills: Map<string, string[]>;
  agentToCommands: Map<string, string[]>;
  agentToWorkflows: Map<string, string[]>;
  commandToSkills: Map<string, string[]>;
  workflowToAgent: Map<string, string>;
}

export interface NormalizedRegistry {
  agents: CanonicalAgent[];
  skills: CanonicalSkill[];
  commands: CanonicalCommand[];
  workflows: CanonicalWorkflow[];
  relationGraph: RelationGraph;
}

export function normalizeRegistry(
  agents: CanonicalAgent[],
  skills: CanonicalSkill[],
  commands: CanonicalCommand[],
  workflows: CanonicalWorkflow[]
): NormalizedRegistry {
  const relationGraph: RelationGraph = {
    agentToSkills: new Map(),
    agentToCommands: new Map(),
    agentToWorkflows: new Map(),
    commandToSkills: new Map(),
    workflowToAgent: new Map(),
  };

  for (const agent of agents) {
    if (agent.skills.length > 0) {
      relationGraph.agentToSkills.set(agent.id, agent.skills);
    }
    if (agent.commands.length > 0) {
      relationGraph.agentToCommands.set(agent.id, agent.commands);
    }
    if (agent.workflows.length > 0) {
      relationGraph.agentToWorkflows.set(agent.id, agent.workflows);
    }
  }

  for (const cmd of commands) {
    if (cmd.skills.length > 0) {
      relationGraph.commandToSkills.set(cmd.id, cmd.skills);
    }
  }

  for (const workflow of workflows) {
    if (workflow.agent) {
      relationGraph.workflowToAgent.set(workflow.code, workflow.agent);

      const agentWorkflows = relationGraph.agentToWorkflows.get(workflow.agent) || [];
      if (!agentWorkflows.includes(workflow.code)) {
        agentWorkflows.push(workflow.code);
        relationGraph.agentToWorkflows.set(workflow.agent, agentWorkflows);
      }
    }
  }

  for (const [agentId, skillIds] of relationGraph.agentToSkills) {
    for (const skillId of skillIds) {
      const skill = skills.find((s) => s.id === skillId);
      if (skill && !skill.agents.includes(agentId)) {
        skill.agents.push(agentId);
      }
    }
  }

  for (const [agentId, cmdIds] of relationGraph.agentToCommands) {
    for (const cmdId of cmdIds) {
      const cmd = commands.find((c) => c.id === cmdId);
      if (cmd && !cmd.agents.includes(agentId)) {
        cmd.agents.push(agentId);
      }
    }
  }

  return {
    agents,
    skills,
    commands,
    workflows,
    relationGraph,
  };
}

if (import.meta.main) {
  const { extractAgents } = await import("./extract-agents");
  const { extractSkills } = await import("./extract-skills");
  const { extractCommands } = await import("./extract-commands");
  const { extractWorkflows } = await import("./extract-workflows");

  const projectRoot = process.cwd();
  const [agents, skills, commands, workflows] = await Promise.all([
    extractAgents(projectRoot),
    extractSkills(projectRoot),
    extractCommands(projectRoot),
    extractWorkflows(projectRoot),
  ]);

  const normalized = normalizeRegistry(agents, skills, commands, workflows);

  console.log("=== Normalization Summary ===");
  console.log(`Agents: ${normalized.agents.length}`);
  console.log(`Skills: ${normalized.skills.length}`);
  console.log(`Commands: ${normalized.commands.length}`);
  console.log(`Workflows: ${normalized.workflows.length}`);
  console.log(`Agent->Skills links: ${normalized.relationGraph.agentToSkills.size}`);
  console.log(`Agent->Commands links: ${normalized.relationGraph.agentToCommands.size}`);
  console.log(`Agent->Workflows links: ${normalized.relationGraph.agentToWorkflows.size}`);
  console.log(`Command->Skills links: ${normalized.relationGraph.commandToSkills.size}`);
  console.log(`Workflow->Agent links: ${normalized.relationGraph.workflowToAgent.size}`);
}
