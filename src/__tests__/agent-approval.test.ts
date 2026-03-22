import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { AgentPostgresClient } from '../lib/agents/postgres-client';
import { AgentApproval } from '../lib/agents/approval';
import { AgentLifecycle } from '../lib/agents/lifecycle';
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
let approval: AgentApproval;
let lifecycle: AgentLifecycle;
let testAgentId: string;

// Generate unique test ID with random suffix to avoid collisions in parallel tests
const generateUniqueTestId = () => `test-agent-${Date.now()}-${randomUUID().slice(0, 8)}`;

describe('Agent Approval (Story 6.9)', () => {
  beforeAll(async () => {
    pgPool = new Pool(PG_CONFIG);
    pgClient = new AgentPostgresClient(pgPool);
    
    try {
      await pgPool.query('SELECT 1 FROM agents LIMIT 1');
    } catch (e) {
      const schemaSql = fs.readFileSync('/home/ronin704/dev/projects/memory/src/lib/agents/schema.sql', 'utf-8');
      await pgPool.query(schemaSql);
    }

    lifecycle = new AgentLifecycle(pgClient);
    approval = new AgentApproval(pgClient, lifecycle);
    
    // Initialize approval table
    await approval.initialize();
  });

  afterAll(async () => {
    await pgPool.query("DELETE FROM agents WHERE agent_id LIKE 'test-agent-%'");
    await pgPool.end();
  });

  beforeEach(() => {
    testAgentId = generateUniqueTestId();
  });

  it('should create approval request for Testing agent', async () => {
    await pgClient.createAgent({
      agent_id: testAgentId,
      name: 'Test Approval Agent',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Testing',
      confidence_score: 0.8
    });

    const request = await approval.requestApproval(testAgentId, 'test-requester');

    expect(request.agent_id).toBe(testAgentId);
    expect(request.status).toBe('pending');
    expect(request.requested_by).toBe('test-requester');
  });

  it('should reject agents below confidence threshold', async () => {
    await pgClient.createAgent({
      agent_id: testAgentId,
      name: 'Low Confidence Agent',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Testing',
      confidence_score: 0.5
    });

    let error: Error | null = null;
    try {
      await approval.requestApproval(testAgentId, 'test-requester');
    } catch (e) {
      error = e as Error;
    }

    expect(error).not.toBeNull();
    expect(error?.message).toContain('below threshold');
  });

  it('should reject non-Testing agents', async () => {
    await pgClient.createAgent({
      agent_id: testAgentId,
      name: 'Draft Agent',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Draft',
      confidence_score: 0.9
    });

    let error: Error | null = null;
    try {
      await approval.requestApproval(testAgentId, 'test-requester');
    } catch (e) {
      error = e as Error;
    }

    expect(error).not.toBeNull();
    expect(error?.message).toContain('Testing state');
  });

  it('should approve agent', async () => {
    const uniqueId = `test-approve-${Date.now()}`;
    await pgClient.createAgent({
      agent_id: uniqueId,
      name: 'Approve Agent',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Testing',
      confidence_score: 0.85
    });

    await approval.requestApproval(uniqueId, 'test-requester');
    await approval.approve(uniqueId, 'test-approver', 'Good to go');

    const agent = await pgClient.getAgent(uniqueId);
    expect(agent?.status).toBe('Active');
  });

  it('should reject agent and return to Draft', async () => {
    await pgClient.createAgent({
      agent_id: testAgentId,
      name: 'Reject Agent',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Testing',
      confidence_score: 0.75
    });

    await approval.requestApproval(testAgentId, 'test-requester');
    await approval.reject(testAgentId, 'test-approver', 'Insufficient testing');

    const agent = await pgClient.getAgent(testAgentId);
    expect(agent?.status).toBe('Draft');
  });

  it('should get pending approvals', async () => {
    await pgClient.createAgent({
      agent_id: `${testAgentId}-pending-1`,
      name: 'Pending Agent 1',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Testing',
      confidence_score: 0.8
    });

    await pgClient.createAgent({
      agent_id: `${testAgentId}-pending-2`,
      name: 'Pending Agent 2',
      module: 'BMM',
      platform: 'OpenCode',
      status: 'Testing',
      confidence_score: 0.85
    });

    await approval.requestApproval(`${testAgentId}-pending-1`, 'test-requester');
    await approval.requestApproval(`${testAgentId}-pending-2`, 'test-requester');

    const pending = await approval.getPendingApprovals();
    expect(pending.length).toBeGreaterThanOrEqual(2);
    expect(pending.every(a => a.status === 'pending')).toBe(true);
  });

  it('should get approval stats', async () => {
    const stats = await approval.getApprovalStats();

    expect(stats.pending).toBeGreaterThanOrEqual(0);
    expect(stats.approved).toBeGreaterThanOrEqual(0);
    expect(stats.rejected).toBeGreaterThanOrEqual(0);
  });
});