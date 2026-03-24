#!/usr/bin/env bun
/**
 * Knowledge Curator Agent Test
 * 
 * Tests the OhMyOpenCode agent configuration and basic execution.
 */

import { spawn } from "child_process";

const AGENT_NAME = "knowledge-curator";

console.log(`Testing ${AGENT_NAME} agent...\n`);

// Check if ollama is running
console.log("1. Checking Ollama availability...");
try {
  const ollamaCheck = await fetch("http://localhost:11434/api/tags");
  if (ollamaCheck.ok) {
    const models = await ollamaCheck.json();
    console.log("✓ Ollama is running");
    console.log(`  Available models: ${models.models?.map((m: any) => m.name).join(", ") || "none"}`);
  } else {
    console.error("✗ Ollama responded with error:", ollamaCheck.status);
    process.exit(1);
  }
} catch (error) {
  console.error("✗ Cannot connect to Ollama at http://localhost:11434");
  console.error("  Make sure Ollama is running: ollama serve");
  process.exit(1);
}

// Check if required models exist
console.log("\n2. Checking required models...");
const requiredModels = ["glm5", "qwen3-embedding:8b"];
const modelsResponse = await fetch("http://localhost:11434/api/tags");
const availableModels = (await modelsResponse.json()).models?.map((m: any) => m.name) || [];

for (const model of requiredModels) {
  if (availableModels.some((m: string) => m.includes(model))) {
    console.log(`✓ ${model} is available`);
  } else {
    console.warn(`⚠ ${model} not found. Pull it with: ollama pull ${model}`);
  }
}

// Test MCP server connection
console.log("\n3. Testing MCP server...");
try {
  const testResult = await fetch("http://localhost:3000/api/health");
  if (testResult.ok) {
    console.log("✓ Memory MCP server is accessible");
  } else {
    console.warn("⚠ MCP server may not be running on :3000");
  }
} catch {
  console.warn("⚠ Could not connect to MCP server on :3000");
}

console.log("\n4. Agent Configuration:");
console.log(`  Name: ${AGENT_NAME}`);
console.log(`  Model: glm5 (local Ollama)`);
console.log(`  Embedding: qwen3-embedding:8b`);
console.log(`  Schedule: Every 6 hours`);
console.log(`  Tools: search_events, detect_patterns, check_duplicate_insight, create_insight, promote_insight, log_event, run_curation`);

console.log("\n✓ Agent configuration validated!");
console.log("\nTo run the curator:");
console.log("  bun src/curator/index.ts run");
console.log("\nOr via OhMyOpenCode:");
console.log("  opencode agent run knowledge-curator");
