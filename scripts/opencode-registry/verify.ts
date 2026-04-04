// scripts/opencode-registry/verify.ts

import type { NormalizedRegistry } from "./normalize";
import type { NotionRegistryClient } from "../../src/lib/opencode-registry/notion-client";
import type { DriftReport } from "../../src/lib/opencode-registry/types";

export async function verifySync(
  local: NormalizedRegistry,
  client: NotionRegistryClient
): Promise<DriftReport> {
  const notionAgents = await client.queryAgents();
  const localAgentIds = new Set(local.agents.map((a) => a.id));
  const notionAgentIds = new Set(notionAgents.map((a: any) => a.id));

  const missingInNotion = [...localAgentIds].filter((id) => !notionAgentIds.has(id));
  const missingInLocal = [...notionAgentIds].filter((id) => !localAgentIds.has(id));

  // Check broken links
  const brokenLinks: Array<{ from: string; to: string; relation: string }> = [];

  for (const [agentId, skillIds] of local.relationGraph.agentToSkills) {
    for (const skillId of skillIds) {
      const skillExists = local.skills.some((s) => s.id === skillId);
      if (!skillExists) {
        brokenLinks.push({ from: agentId, to: skillId, relation: "agent->skill" });
      }
    }
  }

  for (const [agentId, cmdIds] of local.relationGraph.agentToCommands) {
    for (const cmdId of cmdIds) {
      const cmdExists = local.commands.some((c) => c.id === cmdId);
      if (!cmdExists) {
        brokenLinks.push({ from: agentId, to: cmdId, relation: "agent->command" });
      }
    }
  }

  for (const [agentId, wfIds] of local.relationGraph.agentToWorkflows) {
    for (const wfId of wfIds) {
      const wfExists = local.workflows.some((w) => w.code === wfId);
      if (!wfExists) {
        brokenLinks.push({ from: agentId, to: wfId, relation: "agent->workflow" });
      }
    }
  }

  for (const [cmdId, skillIds] of local.relationGraph.commandToSkills) {
    for (const skillId of skillIds) {
      const skillExists = local.skills.some((s) => s.id === skillId);
      if (!skillExists) {
        brokenLinks.push({ from: cmdId, to: skillId, relation: "command->skill" });
      }
    }
  }

  for (const [wfCode, agentId] of local.relationGraph.workflowToAgent) {
    const agentExists = local.agents.some((a) => a.id === agentId);
    if (!agentExists) {
      brokenLinks.push({ from: wfCode, to: agentId, relation: "workflow->agent" });
    }
  }

  return {
    missingInNotion,
    missingInLocal,
    fieldMismatches: [],
    brokenLinks,
  };
}
