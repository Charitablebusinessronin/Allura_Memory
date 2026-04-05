#!/usr/bin/env bun
/**
 * Check Ports Script
 * 
 * Verifies that required ports are available before starting services.
 */

import { getPortConfig, isPortAvailable, PORT_RANGES } from "../src/lib/config/ports";

const REQUIRED_PORTS = [
  { name: "Paperclip (Next.js)", key: "paperclip" as const },
  { name: "OpenClaw Gateway", key: "openclaw" as const },
  { name: "PostgreSQL", key: "postgres" as const },
  { name: "Neo4j HTTP", key: "neo4j_http" as const },
  { name: "Neo4j Bolt", key: "neo4j_bolt" as const },
];

async function checkPorts() {
  console.log("🔍 Checking port availability...\n");
  
  const config = getPortConfig();
  let allAvailable = true;
  
  for (const { name, key } of REQUIRED_PORTS) {
    const port = config[key];
    const range = PORT_RANGES[key];
    const available = await isPortAvailable(port);
    
    const status = available ? "✅" : "❌";
    const portSource = process.env[`${key.toUpperCase()}_PORT`] ? "(from env)" : "(default)";
    
    console.log(`${status} ${name}: port ${port} ${portSource}`);
    
    if (!available) {
      allAvailable = false;
      console.log(`   Port ${port} is in use. Set ${key.toUpperCase()}_PORT to a different value.`);
      console.log(`   Valid range: ${range.min}-${range.max}`);
    }
  }
  
  console.log("");
  
  if (allAvailable) {
    console.log("✅ All ports are available!");
    console.log("\nTo start services:");
    console.log("  bun run dev          # Start Paperclip on port", config.paperclip);
    console.log("  bun run mcp:http     # Start OpenClaw on port", config.openclaw);
    process.exit(0);
  } else {
    console.log("❌ Some ports are in use.");
    console.log("\nOptions:");
    console.log("  1. Stop conflicting services");
    console.log("  2. Set environment variables to use different ports:");
    console.log("     PAPERCLIP_PORT=3101 OPENCLAW_PORT=3201 bun run dev");
    console.log("  3. Generate random ports:");
    console.log("     bun run ports:generate >> .env.local");
    process.exit(1);
  }
}

checkPorts().catch((error) => {
  console.error("❌ Error checking ports:", error);
  process.exit(1);
});