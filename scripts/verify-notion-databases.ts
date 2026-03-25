#!/usr/bin/env node
import { config } from "dotenv";
config();

import { getNotionClient } from "../src/lib/notion/client";

const REQUIRED_PROPERTIES = {
  insights: ["Name", "Confidence", "Status", "Neo4j ID"],
  agents: ["Name", "Module", "Platform", "Status", "Confidence"],
};

async function verifyDatabase(databaseId: string, name: string) {
  console.log(`\n🔍 Checking ${name} (${databaseId})...`);
  
  const client = getNotionClient();
  
  try {
    // Query database to verify access
    const result = await client.queryDatabase(databaseId, { page_size: 1 });
    console.log(`  ✅ Database accessible (${result.results.length} entries found)`);
    
    if (result.results.length > 0) {
      const props = result.results[0].properties;
      console.log(`  📋 Properties: ${Object.keys(props).join(", ")}`);
    }
    
    return true;
  } catch (error) {
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  console.log("🔧 Notion Database Verification\n");
  
  // Check env vars
  const knowledgeDb = process.env.NOTION_KNOWLEDGE_DB_ID;
  const insightsDb = process.env.NOTION_INSIGHTS_DB_ID;
  const agentsDb = process.env.NOTION_AGENTS_DB_ID;
  
  if (!knowledgeDb || !insightsDb || !agentsDb) {
    console.error("❌ Missing database IDs in .env");
    console.log("   NOTION_KNOWLEDGE_DB_ID:", knowledgeDb || "MISSING");
    console.log("   NOTION_INSIGHTS_DB_ID:", insightsDb || "MISSING");
    console.log("   NOTION_AGENTS_DB_ID:", agentsDb || "MISSING");
    process.exit(1);
  }
  
  console.log("Environment variables:");
  console.log(`  NOTION_API_KEY: ${process.env.NOTION_API_KEY?.slice(0, 10)}... (${process.env.NOTION_API_KEY?.length} chars)`);
  console.log(`  NOTION_KNOWLEDGE_DB_ID: ${knowledgeDb}`);
  console.log(`  NOTION_INSIGHTS_DB_ID: ${insightsDb}`);
  console.log(`  NOTION_AGENTS_DB_ID: ${agentsDb}`);
  
  // Verify each database
  const results = await Promise.all([
    verifyDatabase(knowledgeDb, "Knowledge Base"),
    verifyDatabase(insightsDb, "Insights"),
    verifyDatabase(agentsDb, "Agents Registry"),
  ]);
  
  console.log("\n" + "=".repeat(50));
  
  if (results.every(r => r)) {
    console.log("✅ All databases verified successfully!");
    console.log("\nNext steps:");
    console.log("  1. Share each database with your Notion integration");
    console.log("  2. Run: npm run curator:run");
    console.log("  3. Check Notion for promoted insights");
  } else {
    console.log("❌ Some databases failed verification");
    console.log("\nTo fix:");
    console.log("  1. Ensure databases exist in Notion");
    console.log("  2. Share them with your integration:");
    console.log("     - Open database in Notion");
    console.log("     - Click '...' → 'Add connections'");
    console.log("     - Select your integration");
    process.exit(1);
  }
}

main().catch(console.error);
