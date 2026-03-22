/**
 * Insight Curator Pipeline - Entry Point
 * 
 * Usage:
 *   npx tsx src/curator/index.ts run
 *   npx tsx src/curator/index.ts approve <sourceInsightId> [approvedBy]
 *   npx tsx src/curator/index.ts reject <sourceInsightId> <reason>
  npx tsx src/curator/index.ts revoke <sourceInsightId> <reason>
 * 
 * Environment Variables:
 *   MCP_EMBEDDED=true      - Run in embedded mode (called from MCP server)
 *   NEO4J_URI              - Neo4j connection URI
 *   NEO4J_USER             - Neo4j username
 *   NEO4J_PASSWORD         - Neo4j password
 *   POSTGRES_HOST          - PostgreSQL host
 *   POSTGRES_PORT          - PostgreSQL port
 *   POSTGRES_DB            - PostgreSQL database
 *   POSTGRES_USER          - PostgreSQL user
 *   POSTGRES_PASSWORD      - PostgreSQL password
 */

import 'dotenv/config';
import { createCuratorRuntime } from "./service-factory";
import { logger } from "../shared/logger";

async function main(): Promise<void> {
  const command = process.argv[2];

  const { curatorService, approvalSyncService } = createCuratorRuntime();

  try {
    switch (command) {
      case "run":
        logger.info("Starting curator run...");
        const decisions = await curatorService.run();
        logger.info(`Curator run complete. ${decisions.length} insights processed.`);
        
        // Print summary
        const promoted = decisions.filter(d => d.action === "promoted").length;
        const duplicates = decisions.filter(d => d.action === "duplicate").length;
        const blocked = decisions.filter(d => d.action === "blocked").length;
        const errors = decisions.filter(d => d.action === "error").length;
        console.log(`\nSummary: ${promoted} promoted, ${duplicates} duplicates, ${blocked} blocked, ${errors} errors`);
        break;

      case "approve": {
        const sourceInsightId = process.argv[3];
        const approvedBy = process.argv[4] || "Sabir";

        if (!sourceInsightId) {
          console.error("Usage: curator approve <sourceInsightId> [approvedBy]");
          process.exit(1);
        }

        logger.info(`Approving insight ${sourceInsightId} by ${approvedBy}...`);
        await approvalSyncService.approveInsight(sourceInsightId, approvedBy);
        logger.info("Approval complete.");
        break;
      }

      case "reject": {
        const sourceInsightId = process.argv[3];
        const reason = process.argv[4];

        if (!sourceInsightId || !reason) {
          console.error("Usage: curator reject <sourceInsightId> <reason>");
          process.exit(1);
        }

        logger.info(`Rejecting insight ${sourceInsightId}: ${reason}`);
        await approvalSyncService.rejectInsight(sourceInsightId, reason);
        logger.info("Rejection complete.");
        break;
      }


      case "revoke": {
        const sourceInsightId = process.argv[3];
        const reason = process.argv[4];

        if (!sourceInsightId || !reason) {
          console.error("Usage: curator revoke <sourceInsightId> <reason>");
          process.exit(1);
        }

        logger.info(`Revoking insight ${sourceInsightId}: ${reason}`);
        await approvalSyncService.revokeInsight(sourceInsightId, reason);
        logger.info("Revocation complete.");
        break;
      }

      case "help":
      case "--help":
      case "-h":
        printHelp();
        break;

      default:
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    logger.error("Curator pipeline failed:", { 
      error: error instanceof Error ? error.message : String(error) 
    });
    console.error("\nError:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
Insight Curator Pipeline

Usage:
  npx tsx src/curator/index.ts run
  npx tsx src/curator/index.ts approve <sourceInsightId> [approvedBy]
  npx tsx src/curator/index.ts reject <sourceInsightId> <reason>
  npx tsx src/curator/index.ts revoke <sourceInsightId> <reason>

Commands:
  run      Run the curator to promote insights to Notion
  approve  Mark a promoted insight as approved (human review)
  reject   Mark a promoted insight as rejected (human review)
  revoke   Revoke an approved insight while preserving history

Examples:
  npx tsx src/curator/index.ts run
  npx tsx src/curator/index.ts approve insight_123 Sabir
  npx tsx src/curator/index.ts reject insight_456 "Duplicate of existing insight"
  npx tsx src/curator/index.ts revoke insight_789 "Incorrect policy promotion"

Environment Variables:
  MCP_EMBEDDED=true      Run in embedded mode (called from MCP server)
  NEO4J_URI             Neo4j connection URI (default: bolt://localhost:7687)
  NEO4J_USER            Neo4j username (default: neo4j)
  NEO4J_PASSWORD        Neo4j password
  POSTGRES_HOST         PostgreSQL host (default: localhost)
  POSTGRES_PORT         PostgreSQL port (default: 5432)
  POSTGRES_DB           PostgreSQL database (default: memory)
  POSTGRES_USER         PostgreSQL user
  POSTGRES_PASSWORD     PostgreSQL password

NPM Scripts:
  npm run curator:run
  npm run curator:approve -- <sourceInsightId> [approvedBy]
  npm run curator:reject -- <sourceInsightId> <reason>
`);
}

main();