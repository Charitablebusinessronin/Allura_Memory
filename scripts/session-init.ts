#!/usr/bin/env bun
/**
 * Session Initialization Protocol
 * 
 * REQUIRED: Run at start of EVERY session before any other work
 * This ensures memory system is always used correctly.
 */

import { execSync } from "child_process";

console.log("🧠 SESSION INITIALIZATION - Memory System Protocol\n");

// === PHASE 1: Container Health Check ===
console.log("📋 Phase 1: Checking container health...");

try {
  const pgStatus = execSync("docker exec knowledge-postgres pg_isready -U ronin4life -d memory", { encoding: "utf-8" });
  console.log("   ✅ PostgreSQL: Ready");
} catch {
  console.error("   ❌ PostgreSQL: Not running. Start with: docker compose up -d knowledge-postgres");
  process.exit(1);
}

try {
  const neoStatus = execSync("docker exec knowledge-neo4j cypher-shell -u neo4j -p 'Kamina2025*' 'RETURN 1'", { encoding: "utf-8" });
  console.log("   ✅ Neo4j: Ready");
} catch {
  console.error("   ❌ Neo4j: Not running. Start with: docker compose up -d knowledge-neo4j");
  process.exit(1);
}

// === PHASE 2: MCP Server Configuration ===
console.log("\n📋 Phase 2: Configuring MCP servers...");
console.log("   (MCP tools already configured via MCP_DOCKER)");
console.log("   - database-server: postgresql+asyncpg://ronin4life:***@host.docker.internal:5432/memory");
console.log("   - neo4j-cypher: bolt://host.docker.internal:7687");

// === PHASE 3: Memory Hydration ===
console.log("\n📋 Phase 3: Hydrating context from memory...");

// Query recent events
console.log("\n   📝 Recent PostgreSQL Events (roninmemory):");
try {
  const eventsOutput = execSync(
    `docker exec knowledge-postgres psql -U ronin4life -d memory -c "SELECT event_type, created_at FROM events WHERE group_id = 'roninmemory' ORDER BY created_at DESC LIMIT 3"`,
    { encoding: "utf-8" }
  );
  console.log(eventsOutput.split("\n").slice(2, -3).join("\n"));
} catch (e) {
  console.log("   (No recent events or query failed)");
}

// Query recent insights
console.log("\n   🧠 Recent Neo4j Insights:");
try {
  const insightsOutput = execSync(
    `docker exec knowledge-neo4j cypher-shell -u neo4j -p 'Kamina2025*' "MATCH (i:Insight) WHERE i.status = 'active' RETURN i.name, i.confidence, i.created_at ORDER BY i.created_at DESC LIMIT 3"`,
    { encoding: "utf-8" }
  );
  console.log(insightsOutput);
} catch (e) {
  console.log("   (No active insights or query failed)");
}

// === PHASE 4: Log Session Start ===
console.log("\n📋 Phase 4: Logging session start...");

const timestamp = new Date().toISOString();
const sessionId = `session_${Date.now()}`;

try {
  execSync(
    `docker exec knowledge-postgres psql -U ronin4life -d memory -c "INSERT INTO events (event_type, group_id, agent_id, status, metadata, created_at) VALUES ('session_start', 'roninmemory', 'roninmemory-agent', 'pending', '{\\"session_id\\": \\"${sessionId}\\", \\"timestamp\\": \\"${timestamp}\\"}', NOW())"`,
    { encoding: "utf-8" }
  );
  console.log("   ✅ Session logged to PostgreSQL");
} catch (e) {
  console.log("   ⚠️ Could not log session (non-critical)");
}

// === PHASE 5: Summary ===
console.log("\n" + "=".repeat(50));
console.log("✅ SESSION INITIALIZATION COMPLETE");
console.log("=".repeat(50));
console.log("\n🎯 Available MCP Tools:");
console.log("   • MCP_DOCKER_query_database - Natural language SQL queries");
console.log("   • MCP_DOCKER_execute_sql - Raw SQL execution");
console.log("   • MCP_DOCKER_read_neo4j_cypher - Read Cypher queries");
console.log("   • MCP_DOCKER_write_neo4j_cypher - Write Cypher queries");
console.log("   • MCP_DOCKER_insert_data - Log events");
console.log("\n📊 Memory System Stats:");
console.log("   • Use MCP tools for ALL database operations");
console.log("   • Log every significant event via MCP_DOCKER_insert_data");
console.log("   • Query insights before making decisions");
console.log("   • Create Neo4j nodes for curated knowledge");
console.log("\n🚀 Ready to work!\n");

// Export session info for use
console.log(`export SESSION_ID="${sessionId}"`);
console.log(`export SESSION_TIMESTAMP="${timestamp}"`);
