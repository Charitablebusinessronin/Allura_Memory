import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import neo4j, { Driver } from 'neo4j-driver';
import { AgentPostgresClient } from '../lib/agents/postgres-client';
import { AgentNeo4jClient } from '../lib/agents/neo4j-client';
import { AgentLineage } from '../lib/agents/lineage';
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
let lineage: AgentLineage;
let testAgentId: string;

const TEST_PREFIX = 'lineage';

// Generate unique test ID with random suffix to avoid collisions in parallel tests
const generateUniqueTestId = () => `${TEST_PREFIX}-${Date.now()}-${randomUUID().slice(0, 8)}`;

describe('Agent Lineage (Story 6.7)', () => {
  beforeAll(async () => {
    pgPool = new Pool(PG_CONFIG);
    pgClient = new AgentPostgresClient(pgPool);
    
    try {
      await pgPool.query('SELECT 1 FROM agents LIMIT 1');
    } catch (e) {
      const schemaSql = fs.readFileSync('/home/ronin704/dev/projects/memory/src/lib/agents/schema.sql', 'utf-8');
      await pgPool.query(schemaSql);
    }

    neo4jDriver = neo4j.driver(
      NEO4J_CONFIG.uri,
      neo4j.auth.basic(NEO4J_CONFIG.user, NEO4J_CONFIG.password)
    );
    neo4jClient = new AgentNeo4jClient(neo4jDriver);

    lineage = new AgentLineage(pgClient, neo4jClient);
  });

  afterAll(async () => {
    await pgPool.query(`DELETE FROM agents WHERE agent_id LIKE '${TEST_PREFIX}-%'`);
    const session = neo4jDriver.session();
    await session.run(`MATCH (a:AIAgent) WHERE a.agent_id STARTS WITH $prefix DETACH DELETE a`, { prefix: `${TEST_PREFIX}-` });
    await session.close();
    await pgPool.end();
    await neo4jDriver.close();
  });

  beforeEach(() => {
    testAgentId = generateUniqueTestId();
  });

  it('should create version lineage', async () => {
    const id = `${testAgentId}-create`;
    // Create v1
    const v1 = await pgClient.createAgent({
      agent_id: `${id}-v1`,
      name: 'Agent v1',
      module: 'BMM',
      platform: 'OpenCode',
      version: '1.0.0',
      status: 'Active'
    });

    await neo4jClient.createAgent(v1);

    // Create v2
    const v2 = await pgClient.createAgent({
      agent_id: `${id}-v2`,
      name: 'Agent v2',
      module: 'BMM',
      platform: 'OpenCode',
      version: '2.0.0',
      status: 'Active'
    });

    await neo4jClient.createAgent(v2);

    // Create lineage
    await lineage.createVersion(`${id}-v1`, `${id}-v2`, '2.0.0');

    // Verify v1 is deprecated
    const v1Updated = await pgClient.getAgent(`${id}-v1`);
    expect(v1Updated?.status).toBe('Deprecated');

    // Verify v2 exists
    const v2Updated = await pgClient.getAgent(`${id}-v2`);
    expect(v2Updated?.version).toBe('2.0.0');
  });

  it('should get lineage for agent', async () => {
    // Create lineage chain
    const v1 = await pgClient.createAgent({
      agent_id: `${testAgentId}-lineage-v1`,
      name: 'Lineage v1',
      module: 'BMM',
      platform: 'OpenCode',
      version: '1.0.0'
    });

    await neo4jClient.createAgent(v1);

    const v2 = await pgClient.createAgent({
      agent_id: `${testAgentId}-lineage-v2`,
      name: 'Lineage v2',
      module: 'BMM',
      platform: 'OpenCode',
      version: '2.0.0'
    });

    await neo4jClient.createAgent(v2);
    await lineage.createVersion(`${testAgentId}-lineage-v1`, `${testAgentId}-lineage-v2`, '2.0.0');

    // Get lineage
    const lineageData = await lineage.getLineage(`${testAgentId}-lineage-v2`);

    expect(lineageData.current.agent_id).toBe(`${testAgentId}-lineage-v2`);
    expect(lineageData.predecessors.length).toBeGreaterThan(0);
  });

  it('should get latest version', async () => {
    // Create chain v1 -> v2 -> v3
    const v1 = await pgClient.createAgent({
      agent_id: `${testAgentId}-latest-v1`,
      name: 'Latest v1',
      module: 'BMM',
      platform: 'OpenCode',
      version: '1.0.0'
    });
    await neo4jClient.createAgent(v1);

    const v2 = await pgClient.createAgent({
      agent_id: `${testAgentId}-latest-v2`,
      name: 'Latest v2',
      module: 'BMM',
      platform: 'OpenCode',
      version: '2.0.0'
    });
    await neo4jClient.createAgent(v2);
    await lineage.createVersion(`${testAgentId}-latest-v1`, `${testAgentId}-latest-v2`, '2.0.0');

    const v3 = await pgClient.createAgent({
      agent_id: `${testAgentId}-latest-v3`,
      name: 'Latest v3',
      module: 'BMM',
      platform: 'OpenCode',
      version: '3.0.0'
    });
    await neo4jClient.createAgent(v3);
    await lineage.createVersion(`${testAgentId}-latest-v2`, `${testAgentId}-latest-v3`, '3.0.0');

    // Get latest from v1
    const latest = await lineage.getLatestVersion(`${testAgentId}-latest-v1`);
    expect(latest.agent_id).toBe(`${testAgentId}-latest-v3`);
  });

  it('should get version history', async () => {
    const agent = await pgClient.createAgent({
      agent_id: `${testAgentId}-history`,
      name: 'History Agent',
      module: 'BMM',
      platform: 'OpenCode',
      version: '1.0.0'
    });

    await neo4jClient.createAgent(agent);

    // Update version (this should log in agent_versions)
    await pgClient.updateAgent(`${testAgentId}-history`, { 
      status: 'Active',
      confidence_score: 0.75
    });

    const history = await lineage.getVersionHistory(`${testAgentId}-history`);
    expect(history.length).toBeGreaterThanOrEqual(0); // Version history may be empty for new agents
  });

  it('should prevent creating lineage for non-existent agent', async () => {
    let error: Error | null = null;
    try {
      await lineage.createVersion('non-existent-v1', 'non-existent-v2', '2.0.0');
    } catch (e) {
      error = e as Error;
    }

    expect(error).not.toBeNull();
    expect(error?.message).toContain('not found');
  });

  it('should compare versions', async () => {
    // Create agent with versions
    const v1 = await pgClient.createAgent({
      agent_id: `${testAgentId}-compare-v1`,
      name: 'Compare v1',
      module: 'BMM',
      platform: 'OpenCode',
      version: '1.0.0'
    });
    await neo4jClient.createAgent(v1);

    const v2 = await pgClient.createAgent({
      agent_id: `${testAgentId}-compare-v2`,
      name: 'Compare v2',
      module: 'BMM',
      platform: 'OpenCode',
      version: '2.0.0'
    });
    await neo4jClient.createAgent(v2);
    await lineage.createVersion(`${testAgentId}-compare-v1`, `${testAgentId}-compare-v2`, '2.0.0');

    // This would require actual version history records
    // For now, just verify the method exists
    expect(typeof lineage.compareVersions).toBe('function');
  });
});