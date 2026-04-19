#!/usr/bin/env bun
/**
 * Seed PostgreSQL with Awesome Agent Skills data
 */

import { getPool } from "../src/lib/postgres/connection";

const GROUP_ID = "allura-roninmemory";

async function seedAgentSkills() {
  console.log("🌱 Seeding agent_skills to PostgreSQL...\n");
  
  const pool = getPool();

  try {
    // Create table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_skills (
        id SERIAL PRIMARY KEY,
        skill_name VARCHAR(255) NOT NULL,
        skill_category VARCHAR(100),
        tier INT DEFAULT 3,
        agent_id VARCHAR(50),
        platform VARCHAR(50),
        description TEXT,
        group_id VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT group_id_required CHECK (group_id IS NOT NULL),
        UNIQUE(skill_name, agent_id, group_id)
      )
    `);
    console.log("✅ Created agent_skills table");

    // Tier 1 skills
    const tier1 = [
      { name: "mcp-builder", category: "core", agent: "all", platform: "claude-code" },
      { name: "postgres-best-practices", category: "core", agent: "knuth", platform: "all" },
      { name: "next-best-practices", category: "core", agent: "knuth", platform: "all" },
      { name: "github", category: "github", agent: "all", platform: "all" },
      { name: "code-review", category: "github", agent: "carmack", platform: "github" },
      { name: "skill-creator", category: "core", agent: "willison", platform: "claude-code" },
    ];

    // Tier 2 skills
    const tier2 = [
      { name: "security-best-practices", category: "code-quality", agent: "carmack", platform: "all" },
      { name: "react-best-practices", category: "code-quality", agent: "woz", platform: "opencode" },
      { name: "create-pr", category: "github", agent: "knuth", platform: "github" },
      { name: "commit", category: "github", agent: "hightower", platform: "github" },
      { name: "figma-implement-design", category: "design", agent: "woz", platform: "all" },
      { name: "firecrawl-agent", category: "discovery", agent: "scout", platform: "claude-code" },
      { name: "notion-knowledge-capture", category: "context", agent: "scout", platform: "all" },
      { name: "claude-settings-audit", category: "governance", agent: "brooks", platform: "claude-code" },
      { name: "semgrep-rule-creator", category: "analysis", agent: "pike", platform: "all" },
    ];

    // Tier 3 skills
    const tier3 = [
      { name: "terraform-style-guide", category: "infrastructure", agent: "hightower", platform: "opencode" },
      { name: "sanity-best-practices", category: "content", agent: "fowler", platform: "all" },
      { name: "next-upgrade", category: "framework", agent: "knuth", platform: "all" },
      { name: "composition-patterns", category: "architecture", agent: "brooks", platform: "all" },
      { name: "web-perf", category: "performance", agent: "bellard", platform: "cloudflare" },
    ];

    const allAgents = ["brooks", "jobs", "pike", "fowler", "scout", "woz", "bellard", "carmack", "knuth", "hightower"];

    const insertSkill = async (tier: number, skill: any) => {
      const agents = skill.agent === "all" ? allAgents : [skill.agent];
      for (const agentId of agents) {
        await pool.query(
          `INSERT INTO agent_skills (skill_name, skill_category, tier, agent_id, platform, group_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (skill_name, agent_id, group_id) DO NOTHING`,
          [skill.name, skill.category, tier, agentId, skill.platform, GROUP_ID]
        );
      }
    };

    console.log("\n📦 Inserting Tier 1 (6 skills)...");
    for (const skill of tier1) await insertSkill(1, skill);
    console.log("✅ Tier 1 complete");
    
    console.log("\n📦 Inserting Tier 2 (9 skills)...");
    for (const skill of tier2) await insertSkill(2, skill);
    console.log("✅ Tier 2 complete");
    
    console.log("\n📦 Inserting Tier 3 (5 skills)...");
    for (const skill of tier3) await insertSkill(3, skill);
    console.log("✅ Tier 3 complete");

    const result = await pool.query(
      `SELECT tier, COUNT(*) as count FROM agent_skills WHERE group_id = $1 GROUP BY tier ORDER BY tier`,
      [GROUP_ID]
    );

    console.log("\n✅ Seeded complete!");
    console.log("📊 Results:", result.rows);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    pool.end();
  }
}

seedAgentSkills();
