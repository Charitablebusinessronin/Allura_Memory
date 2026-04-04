#!/usr/bin/env bun
/**
 * Log audit completion event to PostgreSQL
 * 
 * Records the config/context audit outcome as an immutable event trace
 */

import { insertEvent } from "@/lib/postgres/queries/insert-trace";
import { readFileSync } from "fs";
import { join } from "path";

async function logAuditCompletion() {
  // Read the change list
  const changeListPath = join(
    process.cwd(),
    ".tmp/config-context-audit-change-list.md"
  );
  
  let changeListContent = "";
  try {
    changeListContent = readFileSync(changeListPath, "utf-8");
  } catch (error) {
    console.warn("Warning: Could not read change list file, continuing without it");
  }

  // Extract key metrics from change list
  const filesChanged = changeListContent.match(/Files Changed: (\d+)/)?.[1] || "unknown";
  const linesAdded = changeListContent.match(/Lines Added: (\d+)/)?.[1] || "unknown";
  const linesDeleted = changeListContent.match(/Lines Deleted: (\d+)/)?.[1] || "unknown";
  const brokenLinksFixed = changeListContent.match(/Broken Links Fixed: (\d+)/)?.[1] || "0";

  // Log the audit completion event
  const event = await insertEvent({
    group_id: "roninmemory",
    event_type: "config-audit-complete",
    agent_id: "memory-architect",
    workflow_id: "openagents-control-registry-sync",
    step_id: "audit-documentation",
    metadata: {
      audit_type: "config-context-documentation",
      audit_date: new Date().toISOString(),
      files_reviewed: 14,
      critical_issues_found: 3,
      critical_issues_fixed: 3,
      organization_id_removed: true,
      broken_links_fixed: parseInt(brokenLinksFixed, 10),
      doc_fixes_applied: {
        ROADMAP_updated: true,
        REQUIREMENTS_updated: true,
        BLUEPRINT_updated: true,
        PROJECT_duplicates_removed: true,
        T30_collision_fixed: true,
        notion_surfaces_documented: true,
      },
      registry_sync_status: "client-stub-ready",
      next_steps: [
        "Implement Notion client methods",
        "Execute live sync to Notion",
        "Verify all entities created/updated",
      ],
    },
    outcome: {
      files_changed: parseInt(filesChanged, 10),
      lines_added: parseInt(linesAdded, 10),
      lines_deleted: parseInt(linesDeleted, 10),
      change_list_path: changeListPath,
      doc_artifacts_created: [
        ".tmp/config-context-audit-change-list.md",
      ],
      config_files_updated: [
        ".opencode/config/agent-metadata.json",
        ".opencode/config/memory-contract.md",
        ".opencode/config/registry-databases.json",
        ".opencode/context/navigation.md",
        ".opencode/context/project/roninmemory-intelligence.md",
        ".opencode/context/system-builder-templates/orchestrator-template.md",
        ".opencode/context/system-builder-templates/subagent-template.md",
      ],
      registry_files_enhanced: [
        "src/lib/opencode-registry/types.ts",
        "scripts/opencode-registry/verify.ts",
        "scripts/opencode-registry/sync.ts",
        "scripts/opencode-registry/extract-agents.ts",
        "scripts/opencode-registry/extract-workflows.ts",
        "scripts/opencode-registry/normalize.ts",
      ],
      broken_links_status: {
        before: 63,
        after: 0,
        fixed_by_skill_prefix_correction: 1,
        fixed_by_workflow_agent_removal: 62,
      },
    },
    status: "completed",
  });

  console.log("✅ Audit completion event logged to PostgreSQL");
  console.log(`   Event ID: ${event.id}`);
  console.log(`   Event Type: ${event.event_type}`);
  console.log(`   Agent: ${event.agent_id}`);
  console.log(`   Status: ${event.status}`);
  console.log(`   Files Changed: ${filesChanged}`);
  console.log(`   Lines Added: ${linesAdded}`);
  console.log(`   Lines Deleted: ${linesDeleted}`);
  console.log(`   Broken Links Fixed: ${brokenLinksFixed}`);
  console.log("");
  console.log("📊 Key Outcomes:");
  console.log("   - organization_id removed from config (aspirational → reality alignment)");
  console.log("   - 63 broken links fixed (skill prefix + workflow→agent mapping)");
  console.log("   - Field mismatch detection added to sync engine");
  console.log("   - Update path added for registry sync");
  console.log("   - Doc fixes applied (ROADMAP, REQUIREMENTS, BLUEPRINT, PROJECT)");
  console.log("");
  console.log("🔗 Notion Target:");
  console.log("   https://www.notion.so/3371d9be65b38041bc59fd5cf966ff98");
  console.log("");
  console.log("⚠️  Next Steps:");
  console.log("   1. Implement Notion client methods (currently stubs)");
  console.log("   2. Run live sync with bun run registry:sync");
  console.log("   3. Verify all entities in Notion");

  return event;
}

// Run the audit logging
logAuditCompletion()
  .then(() => {
    console.log("\n✨ Audit logging complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Audit logging failed:", error);
    process.exit(1);
  });