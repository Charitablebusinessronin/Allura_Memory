/**
 * allura:drift — Drift Detection Script
 * Compares: opencode.json agents <> filesystem .md files <> Notion registry slugs
 * Runs in Docker. Never on local machine directly.
 *
 * Usage: bun run scripts/drift-detection.ts
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentEntry {
  name: string;
  file: string;
}

interface DriftReport {
  timestamp: string;
  agents_in_config: string[];
  files_on_disk: string[];
  missing_files: string[];    // in config, no .md file
  unregistered_files: string[]; // .md file exists, not in config
  ghost_notion_slugs: string[]; // Notion entries with no matching config agent
  status: 'clean' | 'drifted';
}

// ── Config ────────────────────────────────────────────────────────────────────

const OPENCODE_JSON_PATH = join(process.cwd(), '.opencode', 'opencode.json');
const AGENT_DIR = join(process.cwd(), '.opencode', 'agent');
const SUBAGENT_DIRS = [
  join(AGENT_DIR, 'subagents', 'core'),
  join(AGENT_DIR, 'subagents', 'code'),
  join(AGENT_DIR, 'subagents', 'development'),
  join(AGENT_DIR, 'subagents', 'system-builder'),
  join(AGENT_DIR, 'subagents', 'utils'),
];

// Known ghost slugs from the Notion registry (roninmemory- prefix)
// These are stale entries that pre-date the current agent architecture
const KNOWN_GHOST_SLUGS = [
  'roninmemory-MemoryOrchestrator',
  'roninmemory-MemoryArchitect',
  'roninmemory-MemoryBuilder',
  'roninmemory-MemoryGuardian',
  'roninmemory-MemoryCurator',
  'roninmemory-MemoryChronicler',
  'roninmemory-MemoryScout',
  'roninmemory-MemoryArchivist',
  'roninmemory-MemoryValidator',
  'roninmemory-MemoryTester',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function read_opencode_agents(): AgentEntry[] {
  if (!existsSync(OPENCODE_JSON_PATH)) {
    console.warn(`⚠️  opencode.json not found at: ${OPENCODE_JSON_PATH}`);
    return [];
  }
  const raw = JSON.parse(readFileSync(OPENCODE_JSON_PATH, 'utf-8'));
  // opencode.json agents block may be at root or under "agents" key
  const agents = raw.agents ?? raw;
  if (!Array.isArray(agents)) {
    console.warn('⚠️  opencode.json agents is not an array — check structure');
    return [];
  }
  return agents as AgentEntry[];
}

function list_md_files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .map(f => join(dir, f));
}

function collect_all_agent_files(): string[] {
  const top_level = list_md_files(AGENT_DIR);
  const subagent_files = SUBAGENT_DIRS.flatMap(d => list_md_files(d));
  return [...top_level, ...subagent_files];
}

function relative_path(absolute: string): string {
  return absolute.replace(process.cwd() + '/', '');
}

// ── Archive ghost Notion entries ──────────────────────────────────────────────
// This function is called when the Notion MCP tool is available (OpenCode context).
// In a standalone bun run, it logs the slugs to archive instead.

async function archive_ghost_notion_entries(ghost_slugs: string[]): Promise<void> {
  if (ghost_slugs.length === 0) {
    console.log('✅ No ghost Notion entries to archive.');
    return;
  }

  console.log(`\n🗑️  Ghost Notion slugs to archive (${ghost_slugs.length}):`);
  ghost_slugs.forEach(slug => console.log(`   - ${slug}`));

  // When running in OpenCode with Notion MCP available:
  // For each slug, search Notion registry, set status = 'archived'
  // This is handled by MemoryOrganizer agent via the allura:drift command
  // In standalone mode, output the archive list for manual review
  console.log('\n📋 Action required: archive these slugs in Notion Agent Registry');
  console.log('   Run `allura:drift` in OpenCode to execute automatically via MemoryOrganizer');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run_drift_detection(): Promise<DriftReport> {
  console.log('\n🔍 Allura Drift Detection — starting...\n');

  // 1. Read opencode.json agents
  const config_agents = read_opencode_agents();
  const config_names = config_agents.map(a => a.name);
  const config_files = config_agents.map(a =>
    a.file.startsWith('.') ? a.file : `./${a.file}`
  );

  console.log(`📋 Agents in opencode.json: ${config_names.length}`);
  config_names.forEach(n => console.log(`   ✓ ${n}`));

  // 2. List all .md files on disk
  const disk_files = collect_all_agent_files().map(relative_path);
  console.log(`\n📁 Agent .md files on disk: ${disk_files.length}`);
  disk_files.forEach(f => console.log(`   ✓ ${f}`));

  // 3. Find missing files (in config, no file on disk)
  const missing_files = config_files.filter(f => {
    const normalized = f.startsWith('./') ? f.slice(2) : f;
    return !disk_files.some(d => d.endsWith(normalized) || normalized.endsWith(d));
  });

  // 4. Find unregistered files (on disk, not in config)
  const unregistered_files = disk_files.filter(f => {
    return !config_files.some(cf => {
      const normalized = cf.startsWith('./') ? cf.slice(2) : cf;
      return f.endsWith(normalized) || normalized.endsWith(f);
    });
  });

  // 5. Identify ghost Notion slugs
  const ghost_notion_slugs = KNOWN_GHOST_SLUGS.filter(slug => {
    const agent_name = slug.replace('roninmemory-', '');
    return !config_names.includes(agent_name);
  });

  // 6. Build report
  const report: DriftReport = {
    timestamp: new Date().toISOString(),
    agents_in_config: config_names,
    files_on_disk: disk_files,
    missing_files,
    unregistered_files,
    ghost_notion_slugs,
    status: (missing_files.length + unregistered_files.length + ghost_notion_slugs.length) === 0
      ? 'clean'
      : 'drifted',
  };

  // 7. Report results
  console.log('\n' + '═'.repeat(60));
  console.log('DRIFT REPORT — ' + report.timestamp);
  console.log('═'.repeat(60));

  if (missing_files.length > 0) {
    console.log(`\n🔴 Missing files (${missing_files.length}) — in config, not on disk:`);
    missing_files.forEach(f => console.log(`   ✗ ${f}`));
  }

  if (unregistered_files.length > 0) {
    console.log(`\n🟡 Unregistered files (${unregistered_files.length}) — on disk, not in config:`);
    unregistered_files.forEach(f => console.log(`   ? ${f}`));
  }

  if (ghost_notion_slugs.length > 0) {
    await archive_ghost_notion_entries(ghost_notion_slugs);
  }

  if (report.status === 'clean') {
    console.log('\n✅ System is clean — no drift detected.');
  } else {
    console.log(`\n⚠️  Drift detected — status: drifted`);
    console.log('   Run `allura:drift` in OpenCode to resolve via MemoryOrganizer.');
  }

  console.log('═'.repeat(60) + '\n');
  return report;
}

// ── Entry point ───────────────────────────────────────────────────────────────

run_drift_detection()
  .then(report => {
    process.exit(report.status === 'clean' ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ Drift detection failed:', err);
    process.exit(2);
  });
