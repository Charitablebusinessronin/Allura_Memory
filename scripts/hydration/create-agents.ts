// scripts/hydration/create-agents.ts
// Hydrate Agents database from .opencode/agent files

import { findAgentFiles, categorizeAgent, parseAgentFile } from './parse-agent-files';
import { loadAgentMetadataLookup, DEFAULT_NOTION_GROUP_ID } from './agent-identity';
import { createNotionPage, DATABASE_IDS } from './notion-client';
import { transformAgentToNotion } from './transform-to-notion';

interface HydrationResult {
  totalAgents: number;
  created: number;
  skipped: number;
  errors: Array<{ agent: string; error: string }>;
}

/**
 * Hydrate Agents database from .opencode/agent files
 */
export async function hydrateAgents(baseDir: string): Promise<HydrationResult> {
  console.log('📥 Finding agent files...');
  const agentFiles = findAgentFiles(baseDir);
  const agentMetadataLookup = loadAgentMetadataLookup(baseDir);

  if (agentFiles.length === 0) {
    console.log('⚠️  No agent files found');
    return { totalAgents: 0, created: 0, skipped: 0, errors: [] };
  }

  console.log(`📄 Found ${agentFiles.length} agent file(s)`);

  const result: HydrationResult = {
    totalAgents: agentFiles.length,
    created: 0,
    skipped: 0,
    errors: [],
  };

  for (const agentFile of agentFiles) {
    try {
      console.log(`\n📖 Processing ${agentFile}...`);

      const parsed = parseAgentFile(baseDir, agentFile, agentMetadataLookup);
      const category = categorizeAgent(agentFile);

      console.log(`   ID: ${parsed.agentId}`);
      console.log(`   Name: ${parsed.name}`);
      console.log(`   Mode: ${parsed.mode}`);
      console.log(`   Category: ${category.category}${category.subcategory ? `/${category.subcategory}` : ''}`);

      // Transform to Notion properties
      const agentProps = transformAgentToNotion({
        name: parsed.name,
        type: parsed.mode === 'primary' ? 'OpenAgent' : 'Specialist',
        status: 'active',
        role: parsed.description.substring(0, 100),
        groupId: DEFAULT_NOTION_GROUP_ID,
        skills: parsed.permissions.task
          ? Object.keys(parsed.permissions.task).filter(k => parsed.permissions.task![k] === 'allow')
          : [],
        tokenBudget: parsed.temperature === 0 ? 100000 : 200000,
      });

      // Create Notion page
      const pageId = await createNotionPage(DATABASE_IDS.agents, agentProps);

      console.log(`   ✅ Created agent: ${parsed.name}`);
      result.created++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Error creating agent: ${errorMsg}`);
      result.errors.push({
        agent: agentFile,
        error: errorMsg,
      });
    }
  }

  console.log('\n📊 Hydration Summary:');
  console.log(`   Total agents: ${result.totalAgents}`);
  console.log(`   Created: ${result.created}`);
  console.log(`   Skipped: ${result.skipped}`);
  console.log(`   Errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    result.errors.forEach(({ agent, error }) => {
      console.log(`   ${agent}: ${error}`);
    });
  }

  return result;
}

// CLI entry point
if (import.meta.main) {
  const baseDir = process.cwd();
  hydrateAgents(baseDir)
    .then((result) => {
      if (result.errors.length > 0) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
