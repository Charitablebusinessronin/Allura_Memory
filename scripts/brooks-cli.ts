#!/usr/bin/env bun
/**
 * Brooks CLI — Interactive Command Interface
 *
 * Provides the menu-driven interface for the Brooks session system.
 *
 * Usage: bun run scripts/brooks-cli.ts [command]
 *   or:  ./brooks [command]
 *
 * Commands:
 *   start       — Initialize session with auto-save
 *   status      — Show checkpoint status
 *   verify      — Verify checkpoint system health
 *   end         — End current session
 *   menu        — Show full menu
 *   help        — Show this help
 */

import { initializeSession, setPhase, endSession, showCheckpointStatus } from "./brooks-session-start";
import { verifyCheckpoints } from "./verify-checkpoints";
import { closePool } from "../src/lib/postgres/connection";

const MENU = `
╔═══════════════════════════════════════════════════════════════╗
║                    ALLURA MEMORY MENU                        ║
╠═══════════════════════════════════════════════════════════════╣
║  [1] 🚀 Start Session      — Load memory, verify infra       ║
║  [2] 📋 Create Task        — Generate structured task         ║
║  [3] 🎉 Party Mode         — Launch parallel agents           ║
║  [4] 📝 Quick Update        — Sync docs with memory            ║
║  [5] 🔍 Code Review        — Surgical team review             ║
║  [6] 📊 Dashboard           — View system status               ║
║  [7] 🧠 Memory Query       — Search Allura Brain              ║
║  [8] 📤 Promote            — HITL promotion workflow           ║
║  [9] 🏁 End Session        — Persist and archive              ║
║  [0] ❓ Help               — Show this menu                    ║
╚═══════════════════════════════════════════════════════════════╝
`;

const COMPACT_MENU = "CA · VA · WS · NX · CH · MH · PM · DA";

async function showHelp(): Promise<void> {
  console.log(`
Brooks CLI — Allura Memory Command Interface

Usage: bun run scripts/brooks-cli.ts <command>

Commands:
  start       Initialize new session with auto-save every 5 minutes
  status      Show current checkpoint status
  verify      Verify checkpoint system health
  phase <name>  Update current phase (DEV, CODE_REVIEW, etc.)
  end         End current session gracefully
  menu        Show full interactive menu
  help        Show this help message

Quick Start:
  bun run session:start          # Start session with auto-save
  bun run session:verify           # Verify checkpoints working

Environment:
  GROUP_ID    Override default group ID (default: allura-roninmemory)
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || "menu";

  try {
    switch (command) {
      case "start":
      case "1":
        await initializeSession();
        console.log("\n💡 Use 'bun run brooks-cli phase <name>' to update phase");
        console.log("   Use 'bun run brooks-cli end' to end session");
        break;

      case "status":
      case "6":
        await showCheckpointStatus();
        break;

      case "verify":
        const result = await verifyCheckpoints();
        process.exit(result.healthy ? 0 : 1);

      case "phase":
        const phaseName = args[1];
        if (!phaseName) {
          console.error("❌ Phase name required. Usage: brooks-cli phase <DEV|CODE_REVIEW|...>");
          process.exit(1);
        }
        await setPhase(phaseName.toUpperCase());
        break;

      case "end":
      case "9":
        const summary = args.slice(1).join(" ") || "Session completed";
        await endSession(summary);
        break;

      case "menu":
      case "0":
      case "help":
      case "-h":
      case "--help":
        console.log(MENU);
        await showHelp();
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log("\nRun 'bun run brooks-cli help' for usage.");
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Command failed:", error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}

export { MENU, COMPACT_MENU };
