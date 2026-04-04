/**
 * Log Phase 3 and Phase 4 implementation events to PostgreSQL
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
      event_type: "phase_3_complete",
      agent_id: agentId,
      workflow_id: workflowId,
      step_id: "extraction-scripts",
      status: "completed",
      metadata: {
        phase: 3,
        description: "Created 4 extraction scripts for local source parsing",
        scripts: {
          agents: {
            file: "scripts/opencode-registry/extract-agents.ts",
            tests: 7,
            agents_extracted: 26,
            commit: "ad74719",
          },
          skills: {
            file: "scripts/opencode-registry/extract-skills.ts",
            tests: 10,
            skills_extracted: 85,
            commit: "2e846bf",
          },
          commands: {
            file: "scripts/opencode-registry/extract-commands.ts",
            tests: 12,
            commands_extracted: 20,
            commit: "0fff3bc",
          },
          workflows: {
            file: "scripts/opencode-registry/extract-workflows.ts",
            tests: 6,
            workflows_extracted: 75,
            commit: "bf60725",
          },
        },
        total_tests: 35,
        timestamp: now,
      },
    },
    {
      group_id: groupId,
      event_type: "phase_4_complete",
      agent_id: agentId,
      workflow_id: workflowId,
      step_id: "normalization-layer",
      status: "completed",
      metadata: {
        phase: 4,
        description: "Created normalization layer with relation graph",
        file: "scripts/opencode-registry/normalize.ts",
        tests: 11,
        relations: {
          agentToSkills: "Map<string, string[]>",
          agentToCommands: "Map<string, string[]>",
          agentToWorkflows: "Map<string, string[]>",
          commandToSkills: "Map<string, string[]>",
          workflowToAgent: "Map<string, string>",
        },
        backfills: ["skills->agents", "commands->agents"],
        commit: "83f353e",
        timestamp: now,
      },
    },
  ];

  console.log("Logging Phase 3-4 implementation events to PostgreSQL...");

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
