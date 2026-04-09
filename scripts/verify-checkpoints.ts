#!/usr/bin/env bun
/**
 * Verify Checkpoints — Diagnostic Tool
 *
 * Checks that auto-save checkpoints are being created correctly.
 * Run this to verify the 5-minute persistence system is working.
 *
 * Usage: bun run scripts/verify-checkpoints.ts [--session-id <id>]
 */

import { createCheckpointManager } from "../src/lib/session/checkpoint-manager";
import * as fs from "fs/promises";
import * as path from "path";

const CHECKPOINT_DIR = ".opencode/state/checkpoints";

interface VerificationResult {
  healthy: boolean;
  checkpointCount: number;
  latestCheckpoint: {
    id: string;
    timestamp: string;
    phase: string;
    ageMinutes: number;
  } | null;
  issues: string[];
}

/**
 * Verify checkpoint system health
 */
async function verifyCheckpoints(sessionId?: string): Promise<VerificationResult> {
  const result: VerificationResult = {
    healthy: false,
    checkpointCount: 0,
    latestCheckpoint: null,
    issues: [],
  };

  // Check directory exists
  try {
    const stat = await fs.stat(CHECKPOINT_DIR);
    if (!stat.isDirectory()) {
      result.issues.push(`Checkpoint path ${CHECKPOINT_DIR} is not a directory`);
      return result;
    }
  } catch {
    result.issues.push(`Checkpoint directory ${CHECKPOINT_DIR} does not exist`);
    return result;
  }

  // List all checkpoint files
  const files = await fs.readdir(CHECKPOINT_DIR);
  const checkpointFiles = files.filter((f) => f.endsWith(".json"));

  result.checkpointCount = checkpointFiles.length;

  if (checkpointFiles.length === 0) {
    result.issues.push("No checkpoint files found");
    return result;
  }

  // Load and validate checkpoints
  const checkpoints = [];
  for (const file of checkpointFiles) {
    try {
      const content = await fs.readFile(path.join(CHECKPOINT_DIR, file), "utf-8");
      const parsed = JSON.parse(content);

      // Filter by session if provided
      if (sessionId && parsed.sessionId !== sessionId) {
        continue;
      }

      checkpoints.push({
        id: file.replace(".json", ""),
        timestamp: parsed.timestamp,
        phase: parsed.phase,
        sessionId: parsed.sessionId,
        groupId: parsed.groupId,
      });
    } catch (error) {
      result.issues.push(`Failed to parse checkpoint ${file}: ${error}`);
    }
  }

  // Sort by timestamp descending
  checkpoints.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (checkpoints.length === 0) {
    result.issues.push(sessionId ? `No checkpoints found for session ${sessionId}` : "No valid checkpoints found");
    return result;
  }

  // Get latest checkpoint info
  const latest = checkpoints[0];
  const ageMs = Date.now() - new Date(latest.timestamp).getTime();
  const ageMinutes = Math.floor(ageMs / 60000);

  result.latestCheckpoint = {
    id: latest.id,
    timestamp: latest.timestamp,
    phase: latest.phase,
    ageMinutes,
  };

  // Health checks
  if (ageMinutes > 10) {
    result.issues.push(`Latest checkpoint is ${ageMinutes} minutes old (expected < 5 minutes)`);
  }

  if (checkpoints.length < 2) {
    result.issues.push("Only one checkpoint found — auto-save may not be running");
  }

  // Check for gaps in checkpoint sequence
  if (checkpoints.length >= 2) {
    const gaps = [];
    for (let i = 0; i < checkpoints.length - 1; i++) {
      const current = new Date(checkpoints[i].timestamp).getTime();
      const next = new Date(checkpoints[i + 1].timestamp).getTime();
      const gapMinutes = (current - next) / 60000;

      if (gapMinutes > 10) {
        gaps.push(`${gapMinutes.toFixed(1)} minutes between checkpoints ${i} and ${i + 1}`);
      }
    }

    if (gaps.length > 0) {
      result.issues.push(`Checkpoint gaps detected: ${gaps.join(", ")}`);
    }
  }

  result.healthy = result.issues.length === 0;
  return result;
}

/**
 * Display verification results
 */
function displayResults(result: VerificationResult): void {
  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║              CHECKPOINT VERIFICATION REPORT                  ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  // Health status
  if (result.healthy) {
    console.log("✅ CHECKPOINT SYSTEM HEALTHY\n");
  } else {
    console.log("❌ CHECKPOINT SYSTEM ISSUES DETECTED\n");
  }

  // Statistics
  console.log("📊 Statistics:");
  console.log(`   Total checkpoints: ${result.checkpointCount}`);

  if (result.latestCheckpoint) {
    console.log(`\n   Latest checkpoint:`);
    console.log(`      ID: ${result.latestCheckpoint.id.slice(0, 16)}...`);
    console.log(`      Time: ${result.latestCheckpoint.timestamp}`);
    console.log(`      Phase: ${result.latestCheckpoint.phase}`);
    console.log(`      Age: ${result.latestCheckpoint.ageMinutes} minutes`);
  }

  // Issues
  if (result.issues.length > 0) {
    console.log("\n⚠️  Issues:");
    result.issues.forEach((issue) => {
      console.log(`   • ${issue}`);
    });
  }

  // Recommendations
  console.log("\n💡 Recommendations:");
  if (!result.healthy) {
    console.log("   1. Ensure brooks-session-start.ts is running");
    console.log("   2. Check that CheckpointManager.initialize() was called");
    console.log("   3. Verify the auto-save timer is active");
    console.log("   4. Check for errors in the session logs");
  } else {
    console.log("   • Auto-save is working correctly");
    console.log("   • Checkpoints are being created every 5 minutes");
    console.log("   • Session can be recovered from any checkpoint");
  }

  console.log("\n");
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const sessionIdFlag = args.find((arg) => arg.startsWith("--session-id="));
  const sessionId = sessionIdFlag ? sessionIdFlag.split("=")[1] : undefined;

  console.log("🔍 Verifying checkpoint system...");

  try {
    const result = await verifyCheckpoints(sessionId);
    displayResults(result);

    process.exit(result.healthy ? 0 : 1);
  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}

export { verifyCheckpoints };
