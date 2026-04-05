#!/usr/bin/env bun
/**
 * Script to initialize Allura Agent Memory Nodes in Neo4j
 * 
 * Usage: bun run scripts/initialize-agent-memory.ts
 */

import "../src/lib/neo4j/connection";
import {
  createAgentGroup,
  initializeDefaultAgents,
  verifyAgentNodes,
  closeDriver,
} from "../src/lib/neo4j/client";

const GROUP_ID = "allura-default";
const GROUP_NAME = "Allura Agent Team";

async function main() {
  try {
    console.log("╔═══════════════════════════════════════════════════════╗");
    console.log("║   Initializing Allura Agent Memory Nodes              ║");
    console.log("╚═══════════════════════════════════════════════════════╝");
    console.log();

    // Step 1: Create agent group
    console.log("Step 1: Creating agent group...");
    try {
      const group = await createAgentGroup(GROUP_ID, GROUP_NAME);
      console.log(`✓ Agent group created: ${group.group_id} (${group.id})`);
    } catch (error: any) {
      if (error.name === "AgentConflictError") {
        console.log(`✓ Agent group already exists: ${GROUP_ID}`);
      } else {
        throw error;
      }
    }
    console.log();

    // Step 2: Initialize default agents
    console.log("Step 2: Creating 7 Memory{Role} agents...");
    const agents = await initializeDefaultAgents(GROUP_ID);
    
    console.log();
    console.log("╔═══════════════════════════════════════════════════════╗");
    console.log("║   Created Agent Nodes                                 ║");
    console.log("╠═══════════════════════════════════════════════════════╣");
    
    agents.forEach((agent, index) => {
      console.log(`║ ${index + 1}. ${agent.name}`);
      console.log(`║    ID: ${agent.agent_id}`);
      console.log(`║    Role: ${agent.role}`);
      console.log(`║    Model: ${agent.model}`);
      console.log(`║    Status: ${agent.status}`);
      console.log(`║    Group: ${agent.group_id}`);
      console.log("║");
    });
    
    console.log("╚═══════════════════════════════════════════════════════╝");
    console.log();

    // Step 3: Verify creation
    console.log("Step 3: Verifying agent nodes...");
    const verification = await verifyAgentNodes(GROUP_ID);
    
    console.log();
    console.log("╔═══════════════════════════════════════════════════════╗");
    console.log("║   Verification Results                                 ║");
    console.log("╠═══════════════════════════════════════════════════════╣");
    console.log(`║   Total agents: ${verification.total}`);
    console.log("║");
    console.log("║   Agents by ID:");
    verification.agents.forEach((agent) => {
      console.log(`║     - ${agent.agent_id}: ${agent.name} (${agent.status})`);
    });
    console.log("╚═══════════════════════════════════════════════════════╝");
    console.log();

    console.log("✅ Agent memory nodes initialized successfully");
  } catch (error: any) {
    console.error("❌ Error initializing agent memory nodes:");
    console.error(error);
    process.exit(1);
  } finally {
    await closeDriver();
  }
}

main();