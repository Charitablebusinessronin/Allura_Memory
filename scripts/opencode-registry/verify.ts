// scripts/opencode-registry/verify.ts

import type { NormalizedRegistry } from "./normalize";
import type { NotionRegistryClient } from "../../src/lib/opencode-registry/notion-client";
import type { DriftReport, FieldMismatch } from "../../src/lib/opencode-registry/types";

function notionPageToLocal(notionPage: any, type: "agent" | "skill" | "command" | "workflow"): Record<string, any> {
  const props = notionPage.properties || {};
  const result: Record<string, any> = {};

  if (type === "agent") {
    result.id = props.Name?.title?.[0]?.plain_text || props.Name?.title?.[0]?.text?.content || "";
    result.displayName = props["Display Name"]?.rich_text?.[0]?.plain_text || "";
    result.category = props.Category?.select?.name || "";
    result.type = props.Type?.select?.name || "";
    result.status = props.Status?.select?.name || "";
    result.sourcePath = props["Source Path"]?.rich_text?.[0]?.plain_text || "";
  } else if (type === "skill") {
    result.id = props.Name?.title?.[0]?.plain_text || props.Name?.title?.[0]?.text?.content || "";
    result.category = props.Category?.select?.name || "";
    result.status = props.Status?.select?.name || "";
    result.sourcePath = props["Source Path"]?.rich_text?.[0]?.plain_text || "";
  } else if (type === "command") {
    result.id = props.Name?.title?.[0]?.plain_text || props.Name?.title?.[0]?.text?.content || "";
    result.category = props.Category?.select?.name || "";
    result.status = props.Status?.select?.name || "";
    result.sourcePath = props["Source Path"]?.rich_text?.[0]?.plain_text || "";
  } else if (type === "workflow") {
    result.code = props.Code?.title?.[0]?.plain_text || props.Code?.title?.[0]?.text?.content || "";
    result.name = props.Name?.rich_text?.[0]?.plain_text || "";
    result.module = props.Module?.select?.name || "";
    result.phase = props.Phase?.select?.name || "";
    result.status = props.Status?.select?.name || "";
    result.sourcePath = props["Source Path"]?.rich_text?.[0]?.plain_text || "";
  }

  return result;
}

function compareFields(
  local: Record<string, any>,
  notion: Record<string, any>,
  id: string,
  type: string
): FieldMismatch[] {
  const mismatches: FieldMismatch[] = [];
  const keysToCompare = Object.keys(local).filter((k) => k !== "sourcePath");

  for (const key of keysToCompare) {
    const localVal = local[key];
    const notionVal = notion[key];

    // Normalize undefined/null/empty
    const normLocal = localVal ?? "";
    const normNotion = notionVal ?? "";

    if (String(normLocal).trim() !== String(normNotion).trim()) {
      mismatches.push({
        entityId: id,
        entityType: type,
        field: key,
        localValue: String(normLocal),
        notionValue: String(normNotion),
      });
    }
  }

  return mismatches;
}

export async function verifySync(
  local: NormalizedRegistry,
  client: NotionRegistryClient
): Promise<DriftReport> {
  const notionAgents = await client.queryAgents();
  const localAgentIds = new Set(local.agents.map((a) => a.id));
  const notionAgentIds = new Set(notionAgents.map((a: any) => a.id));

  const missingInNotion = [...localAgentIds].filter((id) => !notionAgentIds.has(id));
  const missingInLocal = [...notionAgentIds].filter((id) => !localAgentIds.has(id));

  // Check field mismatches
  const fieldMismatches: FieldMismatch[] = [];

  for (const localAgent of local.agents) {
    const notionPage = notionAgents.find((p: any) => p.id === localAgent.id);
    if (notionPage) {
      const notionLocal = notionPageToLocal(notionPage, "agent");
      const localObj = {
        id: localAgent.id,
        displayName: localAgent.displayName || "",
        category: localAgent.category,
        type: localAgent.type,
        status: localAgent.status,
      };
      fieldMismatches.push(...compareFields(localObj, notionLocal, localAgent.id, "agent"));
    }
  }

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
    fieldMismatches,
    brokenLinks,
  };
}
