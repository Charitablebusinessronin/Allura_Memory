import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import neo4j, { Driver } from 'neo4j-driver';
import { AgentPostgresClient } from '../lib/agents/postgres-client';
import { AgentNeo4jClient } from '../lib/agents/neo4j-client';
import { AgentPromotionPipeline } from '../lib/agents/promotion';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

const PG_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'memory',
  user: process.env.POSTGRES_USER || 'ronin4life',
  password: process.env.POSTGRES_PASSWORD || 'Kamina2025*'
};

const NEO4J_CONFIG = {
  uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
  user: process.env.NEO4J_USER || 'neo4j',
  password: process.env.NEO4J_PASSWORD || 'Kamina2025*'
};

let pgPool: Pool;
let neo4jDriver: Driver;
let pgClient: AgentPostgresClient;
let neo4jClient: AgentNeo4jClient;
let promotionPipeline: AgentPromotionPipeline;
let testAgentId: string;

// Generate unique test ID with random suffix to avoid collisions in parallel tests
const generateUniqueTestId = () => `test-agent-${Date.now()}-${randomUUID().slice(0, 8)}`;

describe('Agent Neo4j Client (Story 6.3)', () => {
  beforeAll(async () => {
    // Setup PostgreSQL
    pgPool = new Pool(PG_CONFIG);
    pgClient = new AgentPostgresClient(pgPool);
    
    // Schema should already exist from previous tests, just verify tables exist
    try {
      await pgPool.query('SELECT 1 FROM agents LIMIT 1');
    } catch (e) {
      // If table doesn't exist, create schema
      const schemaSql = fs.readFileSync('/home/ronin704/dev/projects/memory/src/lib/agents/schema.sql', 'utf-8');
      await pgPool.query(schemaSql);
    }

    // Setup Neo4j
    neo4jDriver = neo4j.driver(
      NEO4J_CONFIG.uri,
      neo4j.auth.basic(NEO4J_CONFIG.user, NEO4J_CONFIG.password)
    );
    neo4jClient = new AgentNeo4jClient(neo4jDriver);

    // Setup promotion pipeline
    promotionPipeline = new AgentPromotionPipeline(pgClient, neo4jClient);
  });

  afterAll(async () => {
    // Clean up test data
    await pgPool.query("DELETE FROM agents WHERE agent_id LIKE 'test-agent-%'");
    
    if (neo4jDriver) {
      const session = neo4jDriver.session();
      await session.run("MATCH (a:AIAgent) WHERE a.agent_id CONTAINS 'test-agent-' DETACH DELETE a");
      await session.run("MATCH (c:Capability) WHERE c.name CONTAINS 'test-' DETACH DELETE c");
      await session.close();
      await neo4jDriver.close();
    }
    
    await pgPool.end();
  });

  beforeEach(() => {
    testAgentId = generateUniqueTestId();
  });

  it('should create agent in Neo4j', async () => {
    const agent = await pgClient.createAgent({
      agent_id: testAgentId,
      name: 'Test Neo4j Agent',
      description: 'Test agent for Neo4j',
      module: 'BMM',
      platform: 'OpenCode',
      capabilities: ['research', 'analysis']
    });

    const neo4jAgent = await neo4jClient.createAgent(agent);

    expect(neo4jAgent.agent_id).toBe(testAgentId);
    expect(neo4jAgent.name).toBe('Test Neo4j Agent');
    expect(neo4jAgent.module).toBe('BMM');
    expect(neo4jAgent.platform).toBe('OpenCode');
  });

  it('should get agent from Neo4j', async () => {
    const agent = await pgClient.createAgent({
      agent_id: testAgentId,
      name: 'Test Get Agent',
      module: 'CIS',
      platform: 'OpenClaw'
    });

    await neo4jClient.createAgent(agent);
    const retrieved = await neo4jClient.getAgent(testAgentId);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.agent_id).toBe(testAgentId);
  });

  it('should return null for non-existent agent', async () => {
    const agent = await neo4jClient.getAgent('non-existent-agent');
    expect(agent).toBeNull();
  });

  it('should update agent in Neo4j', async () => {
    const agent = await pgClient.createAgent({
      agent_id: testAgentId,
      name: 'Test Update Agent',
      module: 'GDS',
      platform: 'Fal.ai'
    });

    await neo4jClient.createAgent(agent);
    
    const updated = await neo4jClient.updateAgent(testAgentId, {
      name: 'Updated Agent Name',
      status: 'Testing',
      confidence_score: 0.5
    });

    expect(updated.name).toBe('Updated Agent Name');
    expect(updated.status).toBe('Testing');
    expect(updated.confidence_score).toBe(0.5);
  });

  it('should link agent to module', async () => {
    const agent = await pgClient.createAgent({
      agent_id: testAgentId,
      name: 'Test Module Link',
      module: 'Core',
      platform: 'GPT-4'
    });

    await neo4jClient.createAgent(agent);
    await neo4jClient.linkToModule(testAgentId, 'Core');

    const session = neo4jDriver.session();
    const result = await session.run(
      `MATCH (a:AIAgent {agent_id: $agent_id})-[:BELONGS_TO]->(m:Module)
       RETURN m.name as module`,
      { agent_id: testAgentId }
    );
    await session.close();

    expect(result.records[0].get('module')).toBe('Core');
  });

  it('should link agent to platform', async () => {
    const agent = await pgClient.createAgent({
      agent_id: testAgentId,
      name: 'Test Platform Link',
      module: 'BMM',
      platform: 'OpenCode'
    });

    await neo4jClient.createAgent(agent);
    await neo4jClient.linkToPlatform(testAgentId, 'OpenCode');

    const session = neo4jDriver.session();
    const result = await session.run(
      `MATCH (a:AIAgent {agent_id: $agent_id})-[:SUPPORTS]->(p:Platform)
       RETURN p.name as platform`,
      { agent_id: testAgentId }
    );
    await session.close();

    expect(result.records[0].get('platform')).toBe('OpenCode');
  });

  it('should link agent to capabilities', async () => {
    const agent = await pgClient.createAgent({
      agent_id: testAgentId,
      name: 'Test Capability Link',
      module: 'BMM',
      platform: 'OpenCode'
    });

    await neo4jClient.createAgent(agent);
    await neo4jClient.linkToCapability(testAgentId, 'test-capability-1');
    await neo4jClient.linkToCapability(testAgentId, 'test-capability-2');

    const capabilities = await neo4jClient.getAgentCapabilities(testAgentId);
    expect(capabilities).toContain('test-capability-1');
    expect(capabilities).toContain('test-capability-2');
  });

  it('should search agents by module', async () => {
    const agent = await pgClient.createAgent({
      agent_id: testAgentId,
      name: 'Test Search Module',
      module: 'WDS',
      platform: 'Claude'
    });

    await neo4jClient.createAgent(agent);
    await neo4jClient.linkToModule(testAgentId, 'WDS');

    const agents = await neo4jClient.getAgentsByModule('WDS');
    const found = agents.find(a => a.agent_id === testAgentId);
    expect(found).toBeDefined();
  });

  it('should create lineage between agents', async () => {
    const oldAgent = await pgClient.createAgent({
      agent_id: `test-agent-old-${Date.now()}`,
      name: 'Test Old Agent',
      module: 'BMM',
      platform: 'OpenCode'
    });

    const newAgent = await pgClient.createAgent({
      agent_id: testAgentId,
      name: 'Test New Agent',
      module: 'BMM',
      platform: 'OpenCode'
    });

    await neo4jClient.createAgent(oldAgent);
    await neo4jClient.createAgent(newAgent);

    await neo4jClient.createLineage(oldAgent.agent_id, testAgentId);

    const lineage = await neo4jClient.getAgentLineage(testAgentId);
    expect(lineage.length).toBeGreaterThan(0);
    expect(lineage[0].agent_id).toBe(oldAgent.agent_id);
  });

  it('should promote agent via pipeline', async () => {
    const agent = await pgClient.createAgent({
      agent_id: testAgentId,
      name: 'Test Promotion Pipeline',
      module: 'CIS',
      platform: 'OpenClaw',
      capabilities: ['test-promo-cap']
    });

    const result = await promotionPipeline.promoteAgent(testAgentId);

    expect(result.agent_id).toBe(testAgentId);
    expect(result.status).toBe('created');
    expect(result.capabilities_linked).toBe(1);
    expect(result.module_linked).toBe(true);
    expect(result.platform_linked).toBe(true);
  });

  it('should delete agent from Neo4j', async () => {
    const agent = await pgClient.createAgent({
      agent_id: testAgentId,
      name: 'Test Delete Agent',
      module: 'BMM',
      platform: 'OpenCode'
    });

    await neo4jClient.createAgent(agent);
    await neo4jClient.deleteAgent(testAgentId);

    const deleted = await neo4jClient.getAgent(testAgentId);
    expect(deleted).toBeNull();
  });
});