import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { AgentPostgresClient } from '../lib/agents/postgres-client';
import { AgentLifecycle } from '../lib/agents/lifecycle';
import { AgentConfidence } from '../lib/agents/confidence';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

// Load .env.local for test credentials
config({ path: '.env.local' });
config(); // fallback to .env

const PG_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'memory',
  user: process.env.POSTGRES_USER || 'ronin4life',
  password: process.env.POSTGRES_PASSWORD || 'Kamina2025*'
};

let pgPool: Pool;
let pgClient: AgentPostgresClient;
let lifecycle: AgentLifecycle;
let confidence: AgentConfidence;
let testAgentId: string;

// Generate unique test ID with random suffix to avoid collisions in parallel tests
const generateUniqueTestId = () => `test-agent-${Date.now()}-${randomUUID().slice(0, 8)}`;

describe('Agent Lifecycle and Confidence (Stories 6.5 & 6.6)', () => {
  beforeAll(async () => {
    pgPool = new Pool(PG_CONFIG);
    pgClient = new AgentPostgresClient(pgPool);
    
    // Verify schema exists
    try {
      await pgPool.query('SELECT 1 FROM agents LIMIT 1');
    } catch (e) {
      const schemaSql = fs.readFileSync('./src/lib/agents/schema.sql', 'utf-8');
      await pgPool.query(schemaSql);
    }

    lifecycle = new AgentLifecycle(pgClient);
    confidence = new AgentConfidence(pgClient);
  });

  afterAll(async () => {
    await pgPool.query("DELETE FROM agents WHERE agent_id LIKE 'test-agent-%'");
    await pgPool.end();
  });

  beforeEach(() => {
    testAgentId = generateUniqueTestId();
  });

  // Story 6.5: Lifecycle State Machine Tests
  describe('Story 6.5: Lifecycle State Machine', () => {
    it('should transition from Draft to Testing', async () => {
      await pgClient.createAgent({
        agent_id: testAgentId,
        name: 'Draft Agent',
        module: 'BMM',
        platform: 'OpenCode',
        status: 'Draft'
      });

      const canTransition = await lifecycle.canTransition(testAgentId, 'Testing');
      expect(canTransition).toBe(true);

      const result = await lifecycle.transition(testAgentId, 'Testing', 'Initial tests passed');
      expect(result.previous_state).toBe('Draft');
      expect(result.new_state).toBe('Testing');
      expect(result.auto).toBe(false);
    });

    it('should transition from Testing to Active with approval', async () => {
      await pgClient.createAgent({
        agent_id: testAgentId,
        name: 'Testing Agent',
        module: 'BMM',
        platform: 'OpenCode',
        status: 'Testing',
        confidence_score: 0.75
      });

      const result = await lifecycle.transition(
        testAgentId,
        'Active',
        'Approved after testing',
        'test-approver'
      );

      expect(result.previous_state).toBe('Testing');
      expect(result.new_state).toBe('Active');
    });

    it('should require human approval for Testing to Active', async () => {
      await pgClient.createAgent({
        agent_id: testAgentId,
        name: 'Testing Agent No Approval',
        module: 'BMM',
        platform: 'OpenCode',
        status: 'Testing',
        confidence_score: 0.75
      });

      let error: Error | null = null;
      try {
        await lifecycle.transition(testAgentId, 'Active', 'Missing approval');
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Human approval required');
    });

    it('should transition from Active to Deprecated', async () => {
      await pgClient.createAgent({
        agent_id: testAgentId,
        name: 'Active Agent',
        module: 'BMM',
        platform: 'OpenCode',
        status: 'Active'
      });

      const result = await lifecycle.transition(
        testAgentId,
        'Deprecated',
        'Superseded by v2'
      );

      expect(result.previous_state).toBe('Active');
      expect(result.new_state).toBe('Deprecated');
    });

    it('should transition from Deprecated to Archived', async () => {
      await pgClient.createAgent({
        agent_id: testAgentId,
        name: 'Deprecated Agent',
        module: 'BMM',
        platform: 'OpenCode',
        status: 'Deprecated'
      });

      const canTransition = await lifecycle.canTransition(testAgentId, 'Archived');
      expect(canTransition).toBe(true);

      const result = await lifecycle.transition(testAgentId, 'Archived', '90 days elapsed');
      expect(result.new_state).toBe('Archived');
    });

    it('should reject invalid transitions', async () => {
      await pgClient.createAgent({
        agent_id: testAgentId,
        name: 'Draft Agent',
        module: 'BMM',
        platform: 'OpenCode',
        status: 'Draft'
      });

      let error: Error | null = null;
      try {
        await lifecycle.transition(testAgentId, 'Active', 'Invalid jump');
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Invalid transition');
    });

    it('should detect auto-transition for confident agents', async () => {
      await pgClient.createAgent({
        agent_id: testAgentId,
        name: 'Confident Agent',
        module: 'BMM',
        platform: 'OpenCode',
        status: 'Testing',
        confidence_score: 0.8
      });

      const targetState = await lifecycle.checkAutoTransition(testAgentId);
      expect(targetState).toBe('Active');
    });

    it('should get agents ready for promotion', async () => {
      // Create testing agent with high confidence
      await pgClient.createAgent({
        agent_id: `${testAgentId}-ready`,
        name: 'Ready for Promotion',
        module: 'BMM',
        platform: 'OpenCode',
        status: 'Testing',
        confidence_score: 0.75
      });

      // Create testing agent with low confidence
      await pgClient.createAgent({
        agent_id: `${testAgentId}-not-ready`,
        name: 'Not Ready',
        module: 'BMM',
        platform: 'OpenCode',
        status: 'Testing',
        confidence_score: 0.4
      });

      const readyAgents = await lifecycle.getAgentsReadyForPromotion();
      const found = readyAgents.find(a => a.agent_id === `${testAgentId}-ready`);
      expect(found).toBeDefined();
    });
  });

  // Story 6.6: Confidence Tracking Tests
  describe('Story 6.6: Confidence Tracking', () => {
    it('should record successful execution', async () => {
      await pgClient.createAgent({
        agent_id: testAgentId,
        name: 'Test Confidence Agent',
        module: 'BMM',
        platform: 'OpenCode'
      });

      await confidence.recordExecution(testAgentId, true, {
        durationMs: 1500,
        feedbackScore: 1
      });

      const agent = await pgClient.getAgent(testAgentId);
      expect(agent?.confidence_score).toBeGreaterThan(0);
    });

    it('should calculate confidence correctly', async () => {
      await pgClient.createAgent({
        agent_id: testAgentId,
        name: 'Confidence Calc Agent',
        module: 'BMM',
        platform: 'OpenCode'
      });

      // Record multiple successful executions with positive feedback
      for (let i = 0; i < 10; i++) {
        await confidence.recordExecution(testAgentId, true, { feedbackScore: 1 });
      }

      const calculated = await confidence.calculateConfidence(testAgentId);
      expect(calculated).toBeGreaterThan(0.5); // Should be high with 10 successes
    });

    it('should penalize failures', async () => {
      await pgClient.createAgent({
        agent_id: testAgentId,
        name: 'Failure Penalize Agent',
        module: 'BMM',
        platform: 'OpenCode'
      });

      // Record failures
      for (let i = 0; i < 5; i++) {
        await confidence.recordExecution(testAgentId, false, {
          errorMessage: 'Test error'
        });
      }

      const confidence_value = await confidence.calculateConfidence(testAgentId);
      expect(confidence_value).toBeLessThan(0.5); // Should be low with 5 failures
    });

    it('should factor in negative feedback', async () => {
      await pgClient.createAgent({
        agent_id: testAgentId,
        name: 'Negative Feedback Agent',
        module: 'BMM',
        platform: 'OpenCode'
      });

      // Record multiple executions with thumbs down
      for (let i = 0; i < 10; i++) {
        await confidence.recordExecution(testAgentId, true, { feedbackScore: -1 });
      }

      const confidence_value = await confidence.calculateConfidence(testAgentId);
      // With negative feedback, feedback_factor = 0, so confidence is lower
      // (success_rate * 0.5) + (usage * 0.3) + (0 * 0.2) = ~0.8 with 10 executions
      expect(confidence_value).toBeLessThanOrEqual(0.85);
    });

    it('should recalculate all agent confidence', async () => {
      // Create multiple agents
      await pgClient.createAgent({
        agent_id: `${testAgentId}-1`,
        name: 'Agent 1',
        module: 'BMM',
        platform: 'OpenCode'
      });

      await pgClient.createAgent({
        agent_id: `${testAgentId}-2`,
        name: 'Agent 2',
        module: 'BMM',
        platform: 'OpenCode'
      });

      const results = await confidence.recalculateAllConfidence();
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('should get top agents by confidence', async () => {
      await pgClient.createAgent({
        agent_id: `${testAgentId}-top`,
        name: 'Top Agent',
        module: 'BMM',
        platform: 'OpenCode',
        status: 'Active',
        confidence_score: 0.95
      });

      const topAgents = await confidence.getTopAgents(5);
      expect(topAgents.length).toBeGreaterThan(0);
    });

    it('should get confidence distribution', async () => {
      await pgClient.createAgent({
        agent_id: `${testAgentId}-high`,
        name: 'High Confidence',
        module: 'BMM',
        platform: 'OpenCode',
        confidence_score: 0.85
      });

      await pgClient.createAgent({
        agent_id: `${testAgentId}-medium`,
        name: 'Medium Confidence',
        module: 'BMM',
        platform: 'OpenCode',
        confidence_score: 0.55
      });

      await pgClient.createAgent({
        agent_id: `${testAgentId}-low`,
        name: 'Low Confidence',
        module: 'BMM',
        platform: 'OpenCode',
        confidence_score: 0.25
      });

      const dist = await confidence.getConfidenceDistribution();
      expect(dist.high).toBeGreaterThanOrEqual(1);
      expect(dist.medium).toBeGreaterThanOrEqual(1);
      expect(dist.low).toBeGreaterThanOrEqual(1);
    });
  });
});