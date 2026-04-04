// scripts/opencode-registry/sync.ts

import { extractAgents } from "./extract-agents";
import { extractSkills } from "./extract-skills";
import { extractCommands } from "./extract-commands";
import { extractWorkflows } from "./extract-workflows";
import { normalizeRegistry } from "./normalize";
import { verifySync } from "./verify";
import { logSyncRun } from "./sync-registry-logger";
import { NotionRegistryClient, createDefaultMcpExecutor } from "../../src/lib/opencode-registry/notion-client";
import { readFile } from "fs/promises";
import { join } from "path";
import type { SyncRun } from "../../src/lib/opencode-registry/types";

interface SyncOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

export async function syncRegistry(options: SyncOptions = {}): Promise<void> {
  const projectRoot = process.cwd();

  // Load database config
  const configPath = join(projectRoot, ".opencode/config/registry-databases.json");
  const configContent = await readFile(configPath, "utf-8");
  const config = JSON.parse(configContent);

  console.log("Extracting local entities...");
  const [agents, skills, commands, workflows] = await Promise.all([
    extractAgents(projectRoot),
    extractSkills(projectRoot),
    extractCommands(projectRoot),
    extractWorkflows(projectRoot),
  ]);

  console.log("Normalizing registry...");
  const normalized = normalizeRegistry(agents, skills, commands, workflows);

  console.log("Comparing with Notion...");
  const client = new NotionRegistryClient({
    databases: {
      agentsDbId: config.agents_db_id,
      skillsDbId: config.skills_db_id,
      commandsDbId: config.commands_db_id,
      workflowsDbId: config.workflows_db_id,
      syncRegistryDbId: config.sync_registry_db_id,
    },
    mcpExecutor: createDefaultMcpExecutor(),
  });

  const drift = await verifySync(normalized, client);

  if (options.dryRun) {
    console.log("DRY RUN - Would sync:");
    console.log(`  Agents: ${drift.missingInNotion.length} creates, ${drift.missingInLocal.length} orphaned in Notion`);
    console.log(`  Skills: ${normalized.skills.length} total`);
    console.log(`  Commands: ${normalized.commands.length} total`);
    console.log(`  Workflows: ${normalized.workflows.length} total`);
    console.log(`  Broken Links: ${drift.brokenLinks.length}`);
    return;
  }

  console.log("Upserting to Notion...");
  let syncedAgents = 0;
  let syncedSkills = 0;
  let syncedCommands = 0;
  let syncedWorkflows = 0;
  let updatedAgents = 0;

  // Create missing agents
  for (const agentId of drift.missingInNotion) {
    const agent = normalized.agents.find((a) => a.id === agentId);
    if (agent) {
      await client.createAgent(agent);
      syncedAgents++;
    }
  }

  // Update existing agents with field mismatches
  const notionAgents = await client.queryAgents();
  for (const mismatch of drift.fieldMismatches) {
    if (mismatch.entityType === "agent") {
      const notionPage = notionAgents.find((p: any) => p.id === mismatch.entityId);
      if (notionPage) {
        const updates: Record<string, any> = {};
        updates[mismatch.field] = mismatch.localValue;
        await client.updateAgent(notionPage.id, updates);
        updatedAgents++;
      }
    }
  }

  // Log sync run
  const syncRun: SyncRun = {
    runId: `sync-${Date.now()}`,
    runDate: new Date(),
    status: drift.brokenLinks.length > 0 ? "partial" : "success",
    agentsSynced: syncedAgents,
    skillsSynced: syncedSkills,
    commandsSynced: syncedCommands,
    workflowsSynced: syncedWorkflows,
    driftReport: JSON.stringify({
      ...drift,
      updatedAgents,
    }, null, 2),
    brokenLinks: drift.brokenLinks.length,
    missingLocal: drift.missingInLocal.length,
    missingNotion: drift.missingInNotion.length,
  };

  await logSyncRun(client, syncRun);

  console.log("Sync complete");
}

// CLI entry point
if (import.meta.main) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");

  syncRegistry({ dryRun, verbose }).catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  });
}
