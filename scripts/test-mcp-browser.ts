#!/usr/bin/env bun
/**
 * MCP Browser Test Runner
 * 
 * Runs MCP-adjacent browser tests.
 *
 * Important contract boundary:
 * - This runner validates the Next.js/browser test surface.
 * - It does NOT validate the canonical MCP Streamable HTTP /mcp protocol gate.
 *   Use `RUN_MCP_TESTS=true ALLURA_MCP_HTTP_URL=... bun vitest run
 *   src/__tests__/mcp-streamable-http.test.ts` for that gate.
 *
 * The Vitest configuration aliases @mcp-docker/* imports to local mocks by
 * default, so an external mcp-docker CLI is not a normal prerequisite. Set
 * USE_REAL_MCP_DOCKER=true only when intentionally testing against real MCP
 * Docker servers.
 */

import { spawn } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { getPort } from "../src/lib/config/ports";

const PAPERCLIP_PORT = getPort("paperclip", "PAPERCLIP_PORT");
const TEST_TIMEOUT = 300000; // 5 minutes
const SCREENSHOT_DIR = "tests/mcp/fixtures/screenshots";

interface TestOptions {
  update?: boolean;
  verbose?: boolean;
  keepBrowser?: boolean;
  testNamePattern?: string;
  testPathPattern?: string;
}

async function runCommand(
  command: string,
  args: string[],
  options: { timeout?: number } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || TEST_TIMEOUT;
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "1" }
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    const timeoutId = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    child.on("close", (code) => {
      clearTimeout(timeoutId);
      resolve({ stdout, stderr, exitCode: code || 0 });
    });

    child.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

async function checkMcpServers(): Promise<boolean> {
  if (process.env.USE_REAL_MCP_DOCKER !== "true") {
    console.log("🔍 MCP Docker CLI check skipped");
    console.log("   Using Vitest aliases/mocks for @mcp-docker/* imports.");
    console.log("   Set USE_REAL_MCP_DOCKER=true to require real MCP Docker servers.");
    return true;
  }

  console.log("🔍 Checking MCP Docker servers...");

  try {
    // Check if MCP Docker is available. This path is opt-in because the
    // published package may not expose a runnable CLI in all environments.
    const result = await runCommand("bun", ["x", "mcp-docker", "status"], { timeout: 10000 });
    return result.exitCode === 0;
  } catch (error) {
    console.warn("⚠️  MCP Docker status check failed");
    console.warn("   Disable this check by unsetting USE_REAL_MCP_DOCKER.");
    console.warn(`   Cause: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function checkDevServer(): Promise<boolean> {
  console.log("🔍 Checking Next.js dev server...");
  console.log(`   Using port: ${PAPERCLIP_PORT}`);
  
  try {
    const response = await fetch(`http://localhost:${PAPERCLIP_PORT}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    console.warn(`⚠️  Dev server not responding at http://localhost:${PAPERCLIP_PORT}`);
    console.log("   Make sure to run: bun run dev");
    console.log(`   Or set PAPERCLIP_PORT environment variable`);
    return false;
  }
}

async function runTests(options: TestOptions): Promise<number> {
  const args = ["vitest", "run", "tests/mcp/"];

  if (options.update) {
    args.push("--update");
  }

  if (options.verbose) {
    args.push("--reporter=verbose");
  }

  if (options.testNamePattern) {
    args.push("-t", options.testNamePattern);
  }

  if (options.testPathPattern) {
    args.push(options.testPathPattern);
  }

  // Set environment variables
  const env = {
    ...process.env,
    KEEP_BROWSER_OPEN: options.keepBrowser ? "true" : "false",
    MCP_SCREENSHOT_DIR: SCREENSHOT_DIR
  };

  console.log("\n🧪 Running MCP browser tests...\n");
  
  const child = spawn("bun", args, {
    stdio: "inherit",
    env
  });

  return new Promise((resolve) => {
    child.on("close", (code) => {
      resolve(code || 0);
    });
  });
}

function parseArgs(): TestOptions {
  const options: TestOptions = {};
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--update":
      case "-u":
        options.update = true;
        break;
      case "--verbose":
      case "-v":
        options.verbose = true;
        break;
      case "--keep-browser":
      case "-k":
        options.keepBrowser = true;
        break;
      case "--testNamePattern":
      case "-t":
        options.testNamePattern = args[++i];
        break;
      case "--testPathPattern":
      case "-p":
        options.testPathPattern = args[++i];
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
MCP Browser Test Runner

Usage: bun run test:mcp:browser [options]

Options:
  -u, --update              Update screenshot baselines
  -v, --verbose             Verbose output
  -k, --keep-browser        Keep browser open after tests
  -t, --testNamePattern     Run tests matching pattern
  -p, --testPathPattern      Run tests in specific path
  -h, --help                Show this help

Examples:
  bun run test:mcp:browser                    # Run all MCP tests
  bun run test:mcp:browser --update           # Update baselines
  bun run test:mcp:browser -t "dashboard"     # Run dashboard tests
  bun run test:mcp:browser -v               # Verbose output
`);
}

async function main(): Promise<void> {
  console.log("🚀 MCP Browser Test Runner\n");

  const options = parseArgs();

  // Ensure screenshot directory exists
  if (!existsSync(SCREENSHOT_DIR)) {
    await import("fs/promises").then(fs => fs.mkdir(SCREENSHOT_DIR, { recursive: true }));
  }

  // Check prerequisites
  const mcpAvailable = await checkMcpServers();
  const devServerRunning = await checkDevServer();

  if (!mcpAvailable) {
    console.warn("\n⚠️  MCP Docker servers may not be available");
    console.log("   Tests will attempt to run anyway...\n");
  }

  if (!devServerRunning) {
    console.error("\n❌ Next.js dev server is not running!");
    console.log("   This is a browser/dev validation precondition, not a /mcp protocol failure.");
    console.log(`   Please start it with: PAPERCLIP_PORT=${PAPERCLIP_PORT} bun run dev`);
    console.log(`   Expected health endpoint: http://localhost:${PAPERCLIP_PORT}/api/health\n`);
    process.exit(1);
  }

  // Run tests
  const exitCode = await runTests(options);

  if (exitCode === 0) {
    console.log("\n✅ All MCP browser tests passed!");
  } else {
    console.log("\n❌ Some MCP browser tests failed");
    console.log(`   Screenshots saved to: ${SCREENSHOT_DIR}`);
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error("❌ Test runner failed:", error);
  process.exit(1);
});
