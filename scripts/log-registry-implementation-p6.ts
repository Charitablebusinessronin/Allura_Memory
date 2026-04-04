/**
 * Log Phase 6 (final) implementation events to PostgreSQL
 */
import { insertEvent, type EventInsert } from "../src/lib/postgres/queries/insert-trace";

async function logImplementationEvents(): Promise<void> {
  const now = new Date().toISOString();
  const groupId = "roninmemory";
  const agentId = "memory-architect";
  const workflowId = "openagents-control-registry";

  const events: EventInsert[] = [
    {
      group_id: groupId,
      event_type: "phase_6_complete",
      agent_id: agentId,
      workflow_id: workflowId,
      step_id: "cli-commands",
      status: "completed",
      metadata: {
        phase: 6,
        description: "Added CLI scripts to package.json for registry sync operations",
        scripts: {
          "registry:sync": "bun run scripts/opencode-registry/sync.ts",
          "registry:dry-run": "bun run scripts/opencode-registry/sync.ts --dry-run",
        },
        commit: "2349fe6",
        timestamp: now,
      },
    },
    {
      group_id: groupId,
      event_type: "implementation_complete",
      agent_id: agentId,
      workflow_id: workflowId,
      step_id: "all-phases",
      status: "completed",
      metadata: {
        description: "OpenAgents Control Registry implementation complete — all 6 phases",
        phases: {
          1: "Notion Databases (5 registries created)",
          2: "TypeScript Types + Notion Client",
          3: "Extraction Scripts (4 extractors)",
          4: "Normalization Layer with Relation Graph",
          5: "Sync Engine with Drift Detection",
          6: "CLI Commands",
        },
        total_files_created: 15,
        total_tests: 70,
        total_commits: 12,
        postgres_events_logged: 5,
        timestamp: now,
      },
    },
  ];

  console.log("Logging Phase 6 (final) implementation events to PostgreSQL...");

  for (const event of events) {
    try {
      const record = await insertEvent(event);
      console.log(`✓ Logged ${event.event_type} (ID: ${record.id})`);
    } catch (error) {
      console.error(`✗ Failed to log ${event.event_type}:`, error);
    }
  }

  console.log("Done.");
}

logImplementationEvents().catch((err) => {
  console.error("Fatal error logging implementation events:", err);
  process.exit(1);
});
