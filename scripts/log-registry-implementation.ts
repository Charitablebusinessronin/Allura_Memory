/**
 * Log Phase 1 and Phase 2 implementation events to PostgreSQL
 * Records the OpenAgents Control Registry build progress
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
      event_type: "phase_1_complete",
      agent_id: agentId,
      workflow_id: workflowId,
      step_id: "notion-databases",
      status: "completed",
      metadata: {
        phase: 1,
        description: "Created 5 Notion databases under OpenAgents Control page",
        hub_page_id: "3371d9be65b38041bc59fd5cf966ff98",
        databases: {
          agents: {
            database_id: "8a75d2a6acd74a6cb623b19edf8e84d5",
            data_source_id: "168db212-cb13-48b4-b28b-43ac85b9c5da",
            properties: 13,
            views: 4,
          },
          skills: {
            database_id: "05a9c3be3c3e490583d0d56eabce05aa",
            data_source_id: "dcdf82cb-060e-476a-b3b1-763a0ffd88c9",
            properties: 10,
            views: 4,
          },
          commands: {
            database_id: "349b3d3a8d114566807a9fa3ed9cea24",
            data_source_id: "5f0f0afc-86aa-4485-8cb2-ebd012755546",
            properties: 10,
            views: 4,
          },
          workflows: {
            database_id: "342102a1ead644d2a43b0b9990fe43c5",
            data_source_id: "f9f87e8c-d042-4052-ab1c-7be757a0873d",
            properties: 10,
            views: 4,
          },
          sync_registry: {
            database_id: "5184e2ae-8d52-409a-8e2e-96816658a37c",
            data_source_id: "cb39b70a-1a1f-459a-9d3d-bf708d4dea9c",
            properties: 11,
            views: 4,
          },
        },
        config_file: ".opencode/config/registry-databases.json",
        timestamp: now,
      },
    },
    {
      group_id: groupId,
      event_type: "phase_2_complete",
      agent_id: agentId,
      workflow_id: workflowId,
      step_id: "typescript-types-and-client",
      status: "completed",
      metadata: {
        phase: 2,
        description: "Created TypeScript types and Notion client wrapper",
        files: {
          types: "src/lib/opencode-registry/types.ts",
          client: "src/lib/opencode-registry/notion-client.ts",
          test: "tests/opencode-registry/notion-client.test.ts",
        },
        types_exported: [
          "AgentType",
          "AgentCategory",
          "EntityStatus",
          "SkillCategory",
          "CommandCategory",
          "WorkflowModule",
          "WorkflowPhase",
          "SyncStatus",
          "RequiredTool",
          "CanonicalAgent",
          "CanonicalSkill",
          "CanonicalCommand",
          "CanonicalWorkflow",
          "SyncRun",
          "DriftReport",
        ],
        client_methods: [
          "queryAgents",
          "querySkills",
          "queryCommands",
          "queryWorkflows",
          "createAgent",
          "createSkill",
          "createCommand",
          "createWorkflow",
          "createSyncRun",
          "updateAgent",
          "updateSkill",
          "updateCommand",
          "updateWorkflow",
        ],
        tests_passing: 4,
        commits: ["ff74449", "33bd1f4"],
        timestamp: now,
      },
    },
  ];

  console.log("Logging implementation events to PostgreSQL...");

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
