import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { AgentPostgresClient } from '../lib/agents/postgres-client';
import { AgentDiscovery } from '../lib/agents/discovery';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

const PG_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'memory',
  user: process.env.POSTGRES_USER || 'ronin4life',
  password: process.env.POSTGRES_PASSWORD || 'Kamina2025*'
};

let pgPool: Pool;
let pgClient: AgentPostgresClient;
let discovery: AgentDiscovery;
let testAgentId: string;

// Generate unique test ID with random suffix to avoid collisions in parallel tests
const generateUniqueTestId = () => `test-agent-${Date.now()}-${randomUUID().slice(0, 8)}`;

describe('Agent Discovery (Story 6.8)', () => {
  beforeAll(async () => {
    pgPool = new Pool(PG_CONFIG);
    pgClient = new AgentPostgresClient(pgPool);
    
    try {
      await pgPool.query('SELECT 1 FROM agents LIMIT 1');
    } catch (e) {
      const schemaSql = fs.readFileSync('/home/ronin704/dev/projects/memory/src/lib/agents/schema.sql', 'utf-8');
      await pgPool.query(schemaSql);
    }

    discovery = new AgentDiscovery(pgClient);
  });

  afterAll(async () => {
    await pgPool.query("DELETE FROM agents WHERE agent_id LIKE 'test-agent-%'");
    await pgPool.end();
  });

  beforeEach(() => {
    testAgentId = generateUniqueTestId();
  });

  it('should search agents by name', async () => {
    await pgClient.createAgent({
      agent_id: `${testAgentId}-grant`,
      name: 'Grant Researcher',
      description: 'Researches grants for nonprofits',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Active',
      confidence_score: 0.85,
      capabilities: ['research', 'grants']
    });

    const results = await discovery.search('grant');

    expect(results.length).toBeGreaterThan(0);
    const found = results.find(r => r.agent.agent_id === `${testAgentId}-grant`);
    expect(found).toBeDefined();
    expect(found?.matched_fields).toContain('name');
  });

  it('should search agents by description', async () => {
    await pgClient.createAgent({
      agent_id: `${testAgentId}-desc`,
      name: 'Test Agent',
      description: 'Specializes in nonprofit fundraising and grant applications',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Active',
      confidence_score: 0.75,
      capabilities: []
    });

    const results = await discovery.search('fundraising');

    expect(results.length).toBeGreaterThan(0);
    const found = results.find(r => r.agent.agent_id === `${testAgentId}-desc`);
    expect(found).toBeDefined();
    expect(found?.matched_fields).toContain('description');
  });

  it('should search agents by capability', async () => {
    await pgClient.createAgent({
      agent_id: `${testAgentId}-cap`,
      name: 'Capability Agent',
      description: 'Agent with specific capabilities',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Active',
      confidence_score: 0.8,
      capabilities: ['data-analysis', 'reporting', 'visualization']
    });

    const results = await discovery.search('visualization');

    expect(results.length).toBeGreaterThan(0);
    const found = results.find(r => r.agent.agent_id === `${testAgentId}-cap`);
    expect(found).toBeDefined();
    expect(found?.matched_fields).toContain('capabilities');
  });

  it('should filter by module', async () => {
    await pgClient.createAgent({
      agent_id: `${testAgentId}-cis`,
      name: 'CIS Agent',
      description: 'CIS module agent',
      module: 'CIS',
      platform: 'OpenClaw',
      status: 'Active',
      confidence_score: 0.9
    });

    const results = await discovery.search('', { module: 'CIS' });

    expect(results.length).toBeGreaterThan(0);
    results.forEach(r => {
      expect(r.agent.module).toBe('CIS');
    });
  });

  it('should filter by platform', async () => {
    await pgClient.createAgent({
      agent_id: `${testAgentId}-platform`,
      name: 'OpenCode Agent',
      description: 'OpenCode platform agent',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Active',
      confidence_score: 0.85
    });

    const results = await discovery.search('', { platform: 'OpenCode' });

    expect(results.length).toBeGreaterThan(0);
    results.forEach(r => {
      expect(r.agent.platform).toBe('OpenCode');
    });
  });

  it('should rank by confidence score', async () => {
    await pgClient.createAgent({
      agent_id: `${testAgentId}-high`,
      name: 'High Confidence Agent',
      description: 'Search test agent',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Active',
      confidence_score: 0.95
    });

    await pgClient.createAgent({
      agent_id: `${testAgentId}-low`,
      name: 'Low Confidence Agent',
      description: 'Search test agent',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Active',
      confidence_score: 0.45
    });

    const results = await discovery.search('search test');

    const highResult = results.find(r => r.agent.agent_id === `${testAgentId}-high`);
    const lowResult = results.find(r => r.agent.agent_id === `${testAgentId}-low`);

    expect(highResult).toBeDefined();
    expect(lowResult).toBeDefined();
    expect(highResult!.score).toBeGreaterThan(lowResult!.score);
  });

  it('should apply min_confidence filter', async () => {
    await pgClient.createAgent({
      agent_id: `${testAgentId}-conf-high`,
      name: 'High Conf Agent',
      description: 'High confidence',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Active',
      confidence_score: 0.9
    });

    await pgClient.createAgent({
      agent_id: `${testAgentId}-conf-low`,
      name: 'Low Conf Agent',
      description: 'Low confidence',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Active',
      confidence_score: 0.3
    });

    const results = await discovery.search('', { min_confidence: 0.8 });

    expect(results.every(r => r.agent.confidence_score >= 0.8)).toBe(true);
  });

  it('should find agents by module', async () => {
    await pgClient.createAgent({
      agent_id: `${testAgentId}-bmm`,
      name: 'BMM Agent',
      description: 'BMM module agent',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Active',
      confidence_score: 0.8
    });

    const agents = await discovery.findByModule('BMM');

    expect(agents.length).toBeGreaterThan(0);
    expect(agents.some(a => a.agent_id === `${testAgentId}-bmm`)).toBe(true);
  });

  it('should find agents by platform', async () => {
    await pgClient.createAgent({
      agent_id: `${testAgentId}-openclaw`,
      name: 'OpenClaw Agent',
      description: 'OpenClaw platform agent',
      module: 'CIS',
      platform: 'OpenClaw',
      status: 'Active',
      confidence_score: 0.8
    });

    const agents = await discovery.findByPlatform('OpenClaw');

    expect(agents.length).toBeGreaterThan(0);
    expect(agents.some(a => a.agent_id === `${testAgentId}-openclaw`)).toBe(true);
  });

  it('should get agent stats', async () => {
    const stats = await discovery.getAgentStats();

    expect(stats.total).toBeGreaterThan(0);
    expect(stats.by_module).toBeDefined();
    expect(stats.by_platform).toBeDefined();
    expect(stats.by_status).toBeDefined();
    expect(stats.avg_confidence).toBeGreaterThanOrEqual(0);
  });

  it('should get similar agents', async () => {
    await pgClient.createAgent({
      agent_id: `${testAgentId}-sim1`,
      name: 'Similar Agent 1',
      description: 'Research agent for grants',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Active',
      confidence_score: 0.85,
      capabilities: ['research', 'analysis']
    });

    await pgClient.createAgent({
      agent_id: `${testAgentId}-sim2`,
      name: 'Similar Agent 2',
      description: 'Research agent for grants',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Active',
      confidence_score: 0.75,
      capabilities: ['research', 'writing']
    });

    const similar = await discovery.getSimilarAgents(`${testAgentId}-sim1`, 5);

    expect(similar.length).toBeLessThanOrEqual(5);
    // Should not include self
    expect(similar.find(s => s.agent.agent_id === `${testAgentId}-sim1`)).toBeUndefined();
  });
});