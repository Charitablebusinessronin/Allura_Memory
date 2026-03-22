import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { AgentPostgresClient } from '../lib/agents/postgres-client';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

const TEST_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'memory',
  user: process.env.POSTGRES_USER || 'ronin4life',
  password: process.env.POSTGRES_PASSWORD || 'Kamina2025*'
};

let pool: Pool;
let client: AgentPostgresClient;
let testAgentId: string;

// Generate unique test ID with random suffix to avoid collisions in parallel tests
const generateUniqueTestId = () => `test-agent-${Date.now()}-${randomUUID().slice(0, 8)}`;

describe('Agent PostgreSQL Client (Story 6.2)', () => {
  beforeAll(async () => {
    pool = new Pool(TEST_CONFIG);
    client = new AgentPostgresClient(pool);
    
    // Initialize schema
    const schemaSql = fs.readFileSync('/home/ronin704/dev/projects/memory/src/lib/agents/schema.sql', 'utf-8');
    await pool.query(schemaSql);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query("DELETE FROM agents WHERE agent_id LIKE 'test-agent-%'");
    await pool.end();
  });

  beforeEach(() => {
    testAgentId = generateUniqueTestId();
  });

  it('should create a new agent', async () => {
    const agent = await client.createAgent({
      agent_id: testAgentId,
      name: 'Test Agent',
      description: 'A test agent for unit tests',
      module: 'BMM',
      platform: 'OpenCode',
      source_files: ['agents/test-agent.md'],
      capabilities: ['research', 'analysis']
    });

    expect(agent.agent_id).toBe(testAgentId);
    expect(agent.name).toBe('Test Agent');
    expect(agent.module).toBe('BMM');
    expect(agent.platform).toBe('OpenCode');
    expect(agent.status).toBe('Draft');
    expect(agent.confidence_score).toBe(0.0);
    expect(agent.source_files).toContain('agents/test-agent.md');
  });

  it('should retrieve an agent by ID', async () => {
    await client.createAgent({
      agent_id: testAgentId,
      name: 'Test Agent Get',
      module: 'CIS',
      platform: 'OpenClaw'
    });

    const agent = await client.getAgent(testAgentId);
    expect(agent).not.toBeNull();
    expect(agent?.agent_id).toBe(testAgentId);
    expect(agent?.module).toBe('CIS');
  });

  it('should return null for non-existent agent', async () => {
    const agent = await client.getAgent('non-existent-agent');
    expect(agent).toBeNull();
  });

  it('should update an agent', async () => {
    await client.createAgent({
      agent_id: testAgentId,
      name: 'Test Agent Update',
      module: 'GDS',
      platform: 'Fal.ai'
    });

    const updated = await client.updateAgent(testAgentId, {
      name: 'Updated Test Agent',
      status: 'Testing',
      confidence_score: 0.5
    });

    expect(updated.name).toBe('Updated Test Agent');
    expect(updated.status).toBe('Testing');
    expect(updated.confidence_score).toBe(0.5);
  });

  it('should list agents with filters', async () => {
    await client.createAgent({
      agent_id: testAgentId,
      name: 'Test Agent List',
      module: 'Core',
      platform: 'GPT-4',
      confidence_score: 0.8
    });

    const agents = await client.listAgents({
      module: 'Core',
      min_confidence: 0.5
    });

    expect(agents.length).toBeGreaterThan(0);
    const found = agents.find(a => a.agent_id === testAgentId);
    expect(found).toBeDefined();
  });

  it('should search agents by name/description', async () => {
    await client.createAgent({
      agent_id: testAgentId,
      name: 'Grant Researcher',
      description: 'Researches grants for nonprofits',
      module: 'BMM',
      platform: 'OpenCode'
    });

    const agents = await client.listAgents({
      search: 'grant'
    });

    const found = agents.find(a => a.agent_id === testAgentId);
    expect(found).toBeDefined();
  });

  it('should delete an agent', async () => {
    await client.createAgent({
      agent_id: testAgentId,
      name: 'Test Agent Delete',
      module: 'WDS',
      platform: 'Claude'
    });

    await client.deleteAgent(testAgentId);
    const agent = await client.getAgent(testAgentId);
    expect(agent).toBeNull();
  });

  it('should record usage and calculate stats', async () => {
    await client.createAgent({
      agent_id: testAgentId,
      name: 'Test Agent Usage',
      module: 'BMM',
      platform: 'OpenCode'
    });

    // Record some usage
    await client.recordUsage({
      agent_id: testAgentId,
      success: true,
      duration_ms: 1500,
      feedback_score: 1
    });

    await client.recordUsage({
      agent_id: testAgentId,
      success: true,
      duration_ms: 2000,
      feedback_score: 1
    });

    await client.recordUsage({
      agent_id: testAgentId,
      success: false,
      duration_ms: 500,
      error_message: 'Test error'
    });

    const stats = await client.getUsageStats(testAgentId);
    expect(stats.total_executions).toBe(3);
    expect(stats.successful_executions).toBe(2);
    expect(stats.avg_feedback).toBeCloseTo(1.0, 1);
  });

  it('should update confidence based on usage', async () => {
    await client.createAgent({
      agent_id: testAgentId,
      name: 'Test Agent Confidence',
      module: 'BMM',
      platform: 'OpenCode'
    });

    // Record successful usage
    for (let i = 0; i < 10; i++) {
      await client.recordUsage({
        agent_id: testAgentId,
        success: true,
        feedback_score: 1
      });
    }

    const confidence = await client.updateConfidence(testAgentId);
    expect(confidence).toBeGreaterThan(0.5);

    const agent = await client.getAgent(testAgentId);
    expect(agent?.confidence_score).toBeGreaterThan(0.5);
  });

  it('should prevent duplicate agent IDs', async () => {
    await client.createAgent({
      agent_id: testAgentId,
      name: 'Duplicate Test 1',
      module: 'BMM',
      platform: 'OpenCode'
    });

    let error: Error | null = null;
    try {
      await client.createAgent({
        agent_id: testAgentId,
        name: 'Duplicate Test 2',
        module: 'BMM',
        platform: 'OpenCode'
      });
    } catch (e) {
      error = e as Error;
    }

    expect(error).not.toBeNull();
    expect(error?.message).toContain('duplicate');
  });
});