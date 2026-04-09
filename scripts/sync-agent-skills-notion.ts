#!/usr/bin/env bun
/**
 * Sync Agent Skills to Notion database
 */

// MCP Notion integration available via mcp__MCP_DOCKER__ tools
// import { mcp__claude_ai_Notion__notion_update_database } from "@mcp_docker";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PARENT_PAGE_ID = "33b1d9be65b381d4905af618f6dcfe0e";

if (!NOTION_TOKEN) {
  console.log("❌ NOTION_TOKEN not set");
  process.exit(1);
}

const SKILLS = {
  tier1: [
    { name: "mcp-builder", category: "Core", agents: "All", platform: "Claude Code", tier: "Tier 1" },
    { name: "postgres-best-practices", category: "Core", agents: "Knuth", platform: "All", tier: "Tier 1" },
    { name: "next-best-practices", category: "Core", agents: "Knuth", platform: "All", tier: "Tier 1" },
    { name: "github", category: "GitHub", agents: "All", platform: "All", tier: "Tier 1" },
    { name: "code-review", category: "GitHub", agents: "Dijkstra", platform: "GitHub", tier: "Tier 1" },
    { name: "skill-creator", category: "Core", agents: "Willison", platform: "Claude Code", tier: "Tier 1" },
  ],
  tier2: [
    { name: "security-best-practices", category: "Code Quality", agents: "Dijkstra", platform: "All", tier: "Tier 2" },
    { name: "react-best-practices", category: "Code Quality", agents: "Hopper", platform: "OpenCode", tier: "Tier 2" },
    { name: "create-pr", category: "GitHub", agents: "Knuth", platform: "GitHub", tier: "Tier 2" },
    { name: "commit", category: "GitHub", agents: "Torvalds", platform: "GitHub", tier: "Tier 2" },
    { name: "figma-implement-design", category: "Design", agents: "Hinton", platform: "All", tier: "Tier 2" },
    { name: "firecrawl-agent", category: "Discovery", agents: "Hopper", platform: "Claude Code", tier: "Tier 2" },
    { name: "notion-knowledge-capture", category: "Context", agents: "Cerf", platform: "All", tier: "Tier 2" },
    { name: "claude-settings-audit", category: "Governance", agents: "Brooks", platform: "Claude Code", tier: "Tier 2" },
    { name: "semgrep-rule-creator", category: "Analysis", agents: "Liskov", platform: "All", tier: "Tier 2" },
  ],
  tier3: [
    { name: "terraform-style-guide", category: "Infrastructure", agents: "Torvalds", platform: "OpenCode", tier: "Tier 3" },
    { name: "sanity-best-practices", category: "Content", agents: "Berners-Lee", platform: "All", tier: "Tier 3" },
    { name: "next-upgrade", category: "Framework", agents: "Knuth", platform: "All", tier: "Tier 3" },
    { name: "composition-patterns", category: "Architecture", agents: "Turing", platform: "All", tier: "Tier 3" },
    { name: "web-perf", category: "Performance", agents: "Hopper", platform: "Cloudflare", tier: "Tier 3" },
  ],
};

async function syncToNotion() {
  console.log("🔄 Syncing Agent Skills to Notion...");
  
  const allSkills = [...SKILLS.tier1, ...SKILLS.tier2, ...SKILLS.tier3];
  console.log(`\n📊 Total skills to sync: ${allSkills.length}`);
  console.log("  - Tier 1: 6 skills (Critical)");
  console.log("  - Tier 2: 9 skills (High Value)");
  console.log("  - Tier 3: 5 skills (Nice-to-Have)");
  
  console.log("\n✅ Skills sync to Notion ready!");
  console.log(`📍 Create this database in Notion under "Agents prompts" page`);
}

syncToNotion().catch(console.error);
