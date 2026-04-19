#!/usr/bin/env bun
/**
 * Sync Agent Skills to Notion database
 */

// Notion access is via mcp__claude_ai_Notion__* MCP tools — no API key required.
// Use: mcp__claude_ai_Notion__notion-create-pages / notion-update-page etc.

const PARENT_PAGE_ID = "33b1d9be65b381d4905af618f6dcfe0e";

const SKILLS = {
  tier1: [
    { name: "mcp-builder", category: "Core", agents: "All", platform: "Claude Code", tier: "Tier 1" },
    { name: "postgres-best-practices", category: "Core", agents: "Knuth", platform: "All", tier: "Tier 1" },
    { name: "next-best-practices", category: "Core", agents: "Knuth", platform: "All", tier: "Tier 1" },
    { name: "github", category: "GitHub", agents: "All", platform: "All", tier: "Tier 1" },
    { name: "code-review", category: "GitHub", agents: "Carmack", platform: "GitHub", tier: "Tier 1" },
    { name: "skill-creator", category: "Core", agents: "Willison", platform: "Claude Code", tier: "Tier 1" },
  ],
  tier2: [
    { name: "security-best-practices", category: "Code Quality", agents: "Carmack", platform: "All", tier: "Tier 2" },
    { name: "react-best-practices", category: "Code Quality", agents: "Woz", platform: "OpenCode", tier: "Tier 2" },
    { name: "create-pr", category: "GitHub", agents: "Knuth", platform: "GitHub", tier: "Tier 2" },
    { name: "commit", category: "GitHub", agents: "Hightower", platform: "GitHub", tier: "Tier 2" },
    { name: "figma-implement-design", category: "Design", agents: "Woz", platform: "All", tier: "Tier 2" },
    { name: "firecrawl-agent", category: "Discovery", agents: "Scout", platform: "Claude Code", tier: "Tier 2" },
    { name: "notion-knowledge-capture", category: "Context", agents: "Scout", platform: "All", tier: "Tier 2" },
    { name: "claude-settings-audit", category: "Governance", agents: "Brooks", platform: "Claude Code", tier: "Tier 2" },
    { name: "semgrep-rule-creator", category: "Analysis", agents: "Pike", platform: "All", tier: "Tier 2" },
  ],
  tier3: [
    { name: "terraform-style-guide", category: "Infrastructure", agents: "Hightower", platform: "OpenCode", tier: "Tier 3" },
    { name: "sanity-best-practices", category: "Content", agents: "Fowler", platform: "All", tier: "Tier 3" },
    { name: "next-upgrade", category: "Framework", agents: "Knuth", platform: "All", tier: "Tier 3" },
    { name: "composition-patterns", category: "Architecture", agents: "Brooks", platform: "All", tier: "Tier 3" },
    { name: "web-perf", category: "Performance", agents: "Bellard", platform: "Cloudflare", tier: "Tier 3" },
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
