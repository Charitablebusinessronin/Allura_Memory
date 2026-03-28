#!/usr/bin/env tsx

/**
 * Session Logger
 * 
 * Logs session events to PostgreSQL memory system.
 * Uses direct SQL queries to bypass MCP client singleton issues.
 */

import { getPool, closePool } from "../src/lib/postgres/connection";

type Phase = "start" | "end";
type EventStatus = "pending" | "completed" | "failed" | "cancelled";

interface CliOptions {
  phase?: Phase;
  groupId?: string;
  workflowId?: string;
  taskId?: string;
  files?: string[];
  verify?: string[];
  agentId?: string;
  notes?: string;
  dryRun?: boolean;
  help?: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--phase":
        options.phase = argv[++i] as Phase;
        break;
      case "--group":
      case "--group-id":
        options.groupId = argv[++i];
        break;
      case "--workflow":
        options.workflowId = argv[++i];
        break;
      case "--task":
        options.taskId = argv[++i];
        break;
      case "--files":
        options.files = argv[++i]?.split(",").map((f) => f.trim()).filter(Boolean);
        break;
      case "--verify":
        options.verify = argv[++i]?.split(",").map((f) => f.trim()).filter(Boolean);
        break;
      case "--agent":
        options.agentId = argv[++i];
        break;
      case "--notes":
        options.notes = argv[++i];
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        if (arg.startsWith("--")) {
          console.warn(`Unknown option ${arg}`);
        }
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`Automate session logging via PostgreSQL memory system.

Usage:
  bunx tsx scripts/session-logger.ts --phase start --group myproject --workflow task-123 \
    --task TASK-001 --files src/foo.ts,src/bar.ts --verify "npm test" --notes "Starting work"

Options:
  --phase <start|end>      Session phase to log (required)
  --group <group_id>       Tenant/group identifier (required)
  --workflow <id>          Workflow or branch identifier
  --task <id>              Task/story identifier
  --files a,b,c            Comma-separated list of touched files
  --verify cmd1,cmd2       Comma-separated list of verification commands
  --agent <id>             Agent identifier override (default: roninmemory-agent)
  --notes <text>           Additional notes for metadata
  --dry-run                Print payload without writing to database
  --help                   Show this help message

Environment:
  POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
  MEMORY_AGENT (fallback for --agent)
`);
}

/**
 * Log event to PostgreSQL events table
 */
async function logEventToPostgres(
  groupId: string,
  eventType: string,
  agentId: string,
  workflowId: string,
  status: EventStatus,
  metadata: Record<string, unknown>
): Promise<{ eventId: number; success: boolean }> {
  const pool = getPool();

  const query = `
    INSERT INTO events (
      group_id,
      event_type,
      agent_id,
      workflow_id,
      status,
      metadata,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING id
  `;

  const values = [
    groupId,
    eventType,
    agentId,
    workflowId,
    status,
    JSON.stringify(metadata),
  ];

  const result = await pool.query(query, values);

  return {
    eventId: result.rows[0].id,
    success: true,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.phase || !["start", "end"].includes(args.phase)) {
    console.error("--phase <start|end> is required");
    process.exitCode = 1;
    return;
  }

  if (!args.groupId) {
    console.error("--group <group_id> is required");
    process.exitCode = 1;
    return;
  }

  // Map phase to valid event status
  const status: EventStatus = args.phase === "end" ? "completed" : "pending";
  const eventType = `session_${args.phase}`;

  const metadata: Record<string, unknown> = {};
  if (args.taskId) metadata.task_id = args.taskId;
  if (args.files?.length) metadata.files = args.files;
  if (args.verify?.length) metadata.verification_commands = args.verify;
  if (args.notes) metadata.notes = args.notes;

  const agentId = args.agentId ?? process.env.MEMORY_AGENT ?? "roninmemory-agent";
  const workflowId = args.workflowId ?? "session";

  if (args.dryRun) {
    console.log("[DRY RUN] Would log event:", {
      group_id: args.groupId,
      event_type: eventType,
      agent_id: agentId,
      workflow_id: workflowId,
      status,
      metadata,
    });
    return;
  }

  try {
    const result = await logEventToPostgres(
      args.groupId,
      eventType,
      agentId,
      workflowId,
      status,
      metadata
    );

    console.log(`✓ Logged session ${args.phase} event (ID: ${result.eventId}) for group ${args.groupId}`);
  } catch (error) {
    console.error("Failed to log session event:", error);
    process.exitCode = 1;
  } finally {
    // Clean up pool connection
    await closePool();
  }
}

main();
