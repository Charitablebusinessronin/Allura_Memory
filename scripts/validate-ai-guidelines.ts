#!/usr/bin/env bun
/**
 * AI-Guidelines Compliance Validation
 * 
 * Tests all three harnesses (Claude, Copilot, OpenCode) for compliance.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface ValidationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
}

const results: ValidationResult[] = [];

function checkFile(path: string, description: string): boolean {
  const exists = existsSync(path);
  results.push({
    check: description,
    status: exists ? 'PASS' : 'FAIL',
    message: exists ? `Found: ${path}` : `Missing: ${path}`
  });
  return exists;
}

function checkContains(path: string, pattern: string, description: string): boolean {
  if (!existsSync(path)) {
    results.push({
      check: description,
      status: 'FAIL',
      message: `File not found: ${path}`
    });
    return false;
  }
  
  const content = readFileSync(path, 'utf-8');
  const found = content.includes(pattern);
  results.push({
    check: description,
    status: found ? 'PASS' : 'FAIL',
    message: found ? `Found "${pattern}" in ${path}` : `Missing "${pattern}" in ${path}`
  });
  return found;
}

console.log('='.repeat(70));
console.log('AI-Guidelines Compliance Validation');
console.log('='.repeat(70));
console.log();

// Phase 1: Check disclosure blocks in .opencode/
console.log('Phase 1: Disclosure Blocks in .opencode/');
console.log('-'.repeat(70));

const opencodeFiles = [
  '.opencode/command/curator-team-promote.md',
  '.opencode/agent/core/AGENT-REGISTRY.md',
  '.opencode/agent/core/brooks.md',
  '.opencode/agent/core/knuth.md',
  '.opencode/agent/core/turing.md',
  '.opencode/agent/core/berners-lee.md',
  '.opencode/agent/subagents/hopper.md',
  '.opencode/agent/subagents/cerf.md',
  '.opencode/agent/subagents/torvalds.md',
  '.opencode/agent/subagents/liskov.md',
  '.opencode/agent/subagents/dijkstra.md',
  '.opencode/agent/subagents/hinton.md',
  '.opencode/plugin/allura-memory.md'
];

let disclosureCount = 0;
for (const file of opencodeFiles) {
  const fullPath = join(process.cwd(), file);
  if (checkContains(fullPath, 'AI-Assisted Documentation', `${file} has disclosure`)) {
    disclosureCount++;
  }
}

console.log();

// Phase 2: Check GitHub Copilot Instructions
console.log('Phase 2: GitHub Copilot Instructions');
console.log('-'.repeat(70));

checkFile('.github/copilot-instructions.md', 'Copilot instructions file exists');
checkContains('.github/copilot-instructions.md', 'AI-Assisted Documentation Policy', 'Copilot has AI policy');
checkContains('.github/copilot-instructions.md', 'Brooksian principles', 'Copilot has Brooksian principles');
checkContains('.github/copilot-instructions.md', 'AI-GUIDELINES.md', 'Copilot references AI-GUIDELINES');

console.log();

// Phase 3: Check OpenCode Config
console.log('Phase 3: OpenCode Configuration');
console.log('-'.repeat(70));

checkFile('.opencode/config.json', 'OpenCode config exists');
checkContains('.opencode/config.json', 'AI-GUIDELINES.md', 'OpenCode references AI-GUIDELINES');
checkContains('.opencode/config.json', '"aiPolicy"', 'OpenCode has aiPolicy section');
checkContains('.opencode/config.json', '"disclosureRequired": true', 'OpenCode requires disclosure');

console.log();

// Phase 4: Check GitHub Actions
console.log('Phase 4: GitHub Actions Validation');
console.log('-'.repeat(70));

checkFile('.github/workflows/ai-guidelines-check.yml', 'GitHub Actions workflow exists');
checkContains('.github/workflows/ai-guidelines-check.yml', 'AI-Assisted disclosure', 'Workflow checks disclosure');
checkContains('.github/workflows/ai-guidelines-check.yml', 'Brooksian principles', 'Workflow validates Brooksian');

console.log();

// Phase 5: Check Agent Harness Sync
console.log('Phase 5: Agent Harness Synchronization');
console.log('-'.repeat(70));

const harnesses = [
  { name: 'OpenCode', path: '.opencode/config.json' },
  { name: 'GitHub Copilot', path: '.github/copilot-instructions.md' },
  { name: 'Claude Code', path: 'CLAUDE.md' }
];

let syncedCount = 0;
for (const harness of harnesses) {
  if (existsSync(harness.path)) {
    const content = readFileSync(harness.path, 'utf-8');
    const referencesAI = content.includes('AI-GUIDELINES') || content.includes('AI-Guidelines');
    results.push({
      check: `${harness.name} references AI-GUIDELINES`,
      status: referencesAI ? 'PASS' : 'WARN',
      message: referencesAI ? `${harness.name} ✓` : `${harness.name} ⚠️ (may reference indirectly)`
    });
    if (referencesAI) syncedCount++;
  }
}

console.log();

// Phase 6: Check Brooks Agent
console.log('Phase 6: Brooks Agent (Architect)');
console.log('-'.repeat(70));

checkContains('.opencode/agent/core/brooks.md', 'AI-Guidelines Compliance', 'Brooks has compliance section');
checkContains('.opencode/agent/core/brooks.md', 'AI assists implementation, not architecture', 'Brooks enforces AI boundaries');

console.log();

// Summary
console.log('='.repeat(70));
console.log('Validation Summary');
console.log('='.repeat(70));

const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
const warnings = results.filter(r => r.status === 'WARN').length;

console.log(`Total Checks: ${results.length}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`⚠️  Warnings: ${warnings}`);
console.log();

// Detailed results
console.log('Detailed Results:');
console.log('-'.repeat(70));
results.forEach(r => {
  const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${r.check}`);
  console.log(`   ${r.message}`);
});

console.log();
console.log('='.repeat(70));

// Final score
const score = Math.round((passed / results.length) * 100);
console.log(`Compliance Score: ${score}/100`);

if (score >= 90) {
  console.log('🎉 Excellent! All harnesses are synchronized and compliant.');
} else if (score >= 70) {
  console.log('✅ Good. Most checks passed. Review warnings.');
} else {
  console.log('🔴 Needs work. Fix failed checks before proceeding.');
}

console.log('='.repeat(70));

process.exit(failed > 0 ? 1 : 0);
