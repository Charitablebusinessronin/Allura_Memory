#!/usr/bin/env bun
/**
 * Validate GitHub Agents Integration
 * 
 * Tests each agent to ensure they're working with GitHub events.
 */

import { getPool, closePool } from "../src/lib/postgres/connection";

const AGENTS = [
  { name: 'dijkstra', script: 'dijkstra-review.ts', testArg: '123' },
  { name: 'knuth', script: 'knuth-analyze.ts', testArg: 'abc123def' },
  { name: 'brooks', script: 'brooks-triage.ts', testArg: '456' },
];

interface ValidationResult {
  agent: string;
  status: 'PASS' | 'FAIL';
  responseTime: number;
  postgresLogged: boolean;
  error?: string;
}

async function validateAgents() {
  console.log('='.repeat(60));
  console.log('GitHub Agents Validation');
  console.log('='.repeat(60));
  console.log();
  
  const results: ValidationResult[] = [];
  
  for (const agent of AGENTS) {
    console.log(`[validate] Testing ${agent.name}...`);
    const startTime = Date.now();
    
    try {
      // Run agent script
      // @ts-ignore - Bun global type not available
      const proc = Bun.spawn(['bun', `scripts/agents/${agent.script}`, agent.testArg], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      // @ts-ignore - Bun global type not available
      const exitCode = await proc.exited;
      const responseTime = Date.now() - startTime;
      
      // Check PostgreSQL for logged event
      const pgPool = getPool();
      const pgResult = await pgPool.query(`
        SELECT * FROM events 
        WHERE agent_id = $1 
        ORDER BY created_at DESC 
        LIMIT 1
      `, [agent.name]);
      
      const postgresLogged = pgResult.rows.length > 0;
      
      results.push({
        agent: agent.name,
        status: exitCode === 0 ? 'PASS' : 'FAIL',
        responseTime,
        postgresLogged,
        error: exitCode !== 0 ? `Exit code: ${exitCode}` : undefined
      });
      
      console.log(`  Status: ${exitCode === 0 ? '✓ PASS' : '✗ FAIL'}`);
      console.log(`  Response time: ${responseTime}ms`);
      console.log(`  PostgreSQL logged: ${postgresLogged ? '✓' : '✗'}`);
      console.log();
      
    } catch (error) {
      results.push({
        agent: agent.name,
        status: 'FAIL',
        responseTime: Date.now() - startTime,
        postgresLogged: false,
        error: String(error)
      });
      console.log(`  Status: ✗ FAIL`);
      console.log(`  Error: ${error}`);
      console.log();
    }
  }
  
  // Summary
  console.log('='.repeat(60));
  console.log('Validation Summary');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log();
  
  results.forEach(r => {
    console.log(`${r.status === 'PASS' ? '✓' : '✗'} ${r.agent}: ${r.responseTime}ms ${r.postgresLogged ? '(logged)' : '(not logged)'}`);
  });
  
  await closePool();
  
  process.exit(failed > 0 ? 1 : 0);
}

validateAgents();
