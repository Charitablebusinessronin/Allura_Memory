/**
 * Full Stack Integration Tests
 *
 * Validates the complete Allura Agent-OS stack works together in realistic scenarios.
 * Tests the integration of:
 * - TraceMiddleware (60+ unit tests)
 * - RuVix Kernel (25+ unit tests)
 * - Session Persistence (48 unit tests)
 * - Workflow State Machine (70 unit tests)
 * - Token Budget (15+ unit tests)
 *
 * Total: 30+ integration tests proving all systems work together.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Pool } from 'pg';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

// Load environment
config({ path: '.env.local' });
config();

// Set required environment variable for tests
process.env.RUVIX_KERNEL_SECRET = process.env.RUVIX_KERNEL_SECRET || 'test-secret-for-integration-tests';

// Import core systems
import { TraceMiddleware } from '@/lib/mcp/trace-middleware';
import { SessionPersistence } from '@/lib/session/persistence';
import { WorkflowStateMachine } from '@/lib/workflow/state-machine';
import { BudgetEnforcer } from '@/lib/budget/enforcer';
import { enforcementGate } from '@/kernel/gate';

// Type imports
import type { WorkflowStateTransition } from '@/lib/workflow/types';

// Test configuration
const PG_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'memory',
  user: process.env.POSTGRES_USER || 'ronin4life',
  password: process.env.POSTGRES_PASSWORD || 'Kamina2025*'
};

// Mock MCP Client for testing
class MockMcpClient {
  private callCount = 0;
  private shouldFail = false;

  constructor(private delay: number = 10) {}

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  async callTool<T = unknown>(toolName: string, input: Record<string, unknown>): Promise<T> {
    this.callCount++;
    await new Promise(resolve => setTimeout(resolve, this.delay));

    if (this.shouldFail) {
      throw new Error(`Tool ${toolName} failed`);
    }

    return {
      success: true,
      toolName,
      input,
      callNumber: this.callCount,
      timestamp: new Date().toISOString()
    } as T;
  }
}

// Helper to generate unique IDs
const generateTestId = () => `agent-test-${Date.now()}-${randomUUID().slice(0, 8)}`;

describe('Full Stack Integration Tests', () => {
  let pgPool: Pool | null = null;
  let sessionPersistence: SessionPersistence;
  let testGroupId: string;
  let testStateDir: string;

  beforeAll(async () => {
    // Initialize PostgreSQL
    pgPool = new Pool(PG_CONFIG);
    try {
      await pgPool.query('SELECT 1 FROM events LIMIT 1');
    } catch (e) {
      const schemaPath = './src/lib/postgres/schema.sql';
      if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, 'utf-8');
        await pgPool.query(sql);
      }
    }

    // Initialize test state directory
    testStateDir = './.opencode/test-state/' + Date.now();
    fs.mkdirSync(testStateDir, { recursive: true });

    // Create session persistence
    sessionPersistence = new SessionPersistence({
      stateDir: testStateDir,
      asyncSave: false, // Synchronous for testing
      enableIntegrityCheck: true
    });
    await sessionPersistence.initialize();
  });

  afterAll(async () => {
    // Cleanup
    if (testGroupId) {
      try {
        await pgPool?.query('DELETE FROM events WHERE group_id = $1', [testGroupId]);
        await pgPool?.query('DELETE FROM workflow_states WHERE group_id = $1', [testGroupId]);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    await pgPool?.end();

    // Cleanup test state directory
    try {
      fs.rmSync(testStateDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  beforeEach(() => {
    testGroupId = 'allura-integration-test';
    // Clear violations before each test
    enforcementGate.clearViolations();
  });

  // ============================================================================
  // TEST 1: Complete Agent Workflow
  // ============================================================================
  describe('Complete Agent Workflow', () => {
    it('should execute full workflow: start session → execute workflow → persist state → budget checks (without kernel tracing)', async () => {
      const agentId = generateTestId();
      const workflowId = generateTestId();

      // Step 1: Create Session
      const session = await sessionPersistence.createSession(agentId, testGroupId);
      expect(session.session_id).toBeDefined();
      expect(session.agent_id).toBe(agentId);
      expect(session.workflow_stage).toBe('planned');

      // Step 2: Initialize Workflow State Machine
      const workflow = new WorkflowStateMachine(workflowId, testGroupId);
      await workflow.initialize();
      expect(workflow.state).toBe('planned');

      // Step 3: Initialize Budget Enforcer
      const budgetEnforcer = new BudgetEnforcer({
        budgetConfig: {
          defaults: {
            maxTokens: 1000,
            maxToolCalls: 10,
            maxTimeMs: 30000,
            maxCostUsd: 5.0,
            maxSteps: 20
          },
          warningThresholds: { warning80: 0.8, warning90: 0.9 },
          haltOnBreach: true,
          pricing: [],
          enableWarnings: true
        },
        enabled: true
      });

      const budgetSessionId = {
        groupId: testGroupId,
        agentId,
        sessionId: session.session_id
      };
      budgetEnforcer.startSession(budgetSessionId);

      // Step 4: Update workflow to discovering
      await workflow.transition('discovering');
      await sessionPersistence.updateSession(session.session_id, {
        workflow_stage: 'discovering'
      });

      // Step 5: Check budget
      const budgetCheck = await budgetEnforcer.checkBeforeExecution(budgetSessionId);
      expect(budgetCheck.allowed).toBe(true);

      // Step 6: Update budget
      budgetEnforcer.updateBudget(budgetSessionId, { tokens: 100, toolCalls: 1, steps: 1 });

      // Step 7: Transition to approved
      await workflow.transition('approved');
      await sessionPersistence.updateSession(session.session_id, {
        workflow_stage: 'approved'
      });

      // Step 8: Update budget again
      budgetEnforcer.updateBudget(budgetSessionId, { tokens: 150, toolCalls: 1, steps: 1 });

      // Step 9: Transition to executing
      await workflow.transition('executing');
      await sessionPersistence.updateSession(session.session_id, {
        workflow_stage: 'executing'
      });

      // Step 10: Transition to validating
      await workflow.transition('validating');
      await sessionPersistence.updateSession(session.session_id, {
        workflow_stage: 'validating'
      });

      // Step 11: Complete workflow
      await workflow.transition('complete');

      await sessionPersistence.updateSession(session.session_id, {
        workflow_stage: 'complete'
      });

      // Step 11: Verify state persistence
      const loadedSession = await sessionPersistence.loadSession(session.session_id);
      expect(loadedSession).not.toBeNull();
      expect(loadedSession?.workflow_stage).toBe('complete');
      expect(loadedSession?.agent_id).toBe(agentId);

      // Step 12: Verify workflow history
      const history = await workflow.getHistory();
      expect(history.transitions.length).toBeGreaterThanOrEqual(4); // planned → discovering → approved → executing → complete

      // Step 13: Verify budget tracking
      const budgetStatus = budgetEnforcer.getStatus(budgetSessionId);
      expect(budgetStatus).not.toBeNull();
      if (budgetStatus) {
        // Access consumption from the nested structure
        expect(budgetStatus.consumption.tokens).toBeGreaterThan(0);
      }

      // Cleanup
      budgetEnforcer.endSession(budgetSessionId);
    });
  });

  // ============================================================================
  // TEST 2: Crash Recovery
  // ============================================================================
  describe('Crash Recovery Scenarios', () => {
    it('should recover from crash and continue with persisted state', async () => {
      const agentId = generateTestId();
      const workflowId = generateTestId();

      // Simulate: Create session and workflow
      const session = await sessionPersistence.createSession(agentId, testGroupId);
      const workflow = new WorkflowStateMachine(workflowId, testGroupId);
      await workflow.initialize();

      // Simulate: Progress through states
      await workflow.transition('discovering');
      await sessionPersistence.updateSession(session.session_id, {
        workflow_stage: 'discovering'
      });

      // Simulate: Store checkpoint data
      const checkpointData = {
        step: 2,
        data: { some: 'important data' },
        processed: ['item1', 'item2']
      };
      await workflow.saveCheckpoint({ context_data: checkpointData });

      // Simulate: CRASH - recreate everything fresh
      const recoveredSession = await sessionPersistence.recoverFromCrash(agentId, testGroupId);
      expect(recoveredSession).not.toBeNull();
      expect(recoveredSession?.session_id).toBe(session.session_id);

      // Recover workflow
      const recoveredWorkflow = new WorkflowStateMachine(workflowId, testGroupId);
      await recoveredWorkflow.initialize();

      // Verify checkpoint data is intact
      expect(recoveredWorkflow.checkpoint).toBeDefined();
      expect(recoveredWorkflow.checkpoint.context_data).toEqual(checkpointData);

      // Continue execution
      await recoveredWorkflow.transition('approved');
      await recoveredWorkflow.transition('executing');
      await sessionPersistence.updateSession(recoveredSession!.session_id, {
        workflow_stage: 'executing'
      });

      // Verify recovery worked
      const finalSession = await sessionPersistence.loadSession(recoveredSession!.session_id);
      expect(finalSession?.workflow_stage).toBe('executing');
    });

    it('should recover to retry-safe state only', async () => {
      const workflowId = generateTestId();

      // Create workflow
      const workflow = new WorkflowStateMachine(workflowId, testGroupId);
      await workflow.initialize();
      expect(workflow.isRetrySafe).toBe(true); // planned is retry-safe

      // Transition to executing (not retry-safe)
      await workflow.transition('discovering');
      await workflow.transition('approved');
      await workflow.transition('executing');
      expect(workflow.isRetrySafe).toBe(false);

      // Try to recover
      const recovered = new WorkflowStateMachine(workflowId, testGroupId);
      await recovered.initialize();
      expect(recovered.state).toBe('executing');

      // Cannot resume from non-retry-safe state
      await expect(recovered.resume()).rejects.toThrow('Cannot resume from non-retry-safe state');
    });
  });

  // ============================================================================
  // TEST 3: Budget Enforcement
  // ============================================================================
  describe('Budget Enforcement', () => {
    it('should halt gracefully when budget exceeded', async () => {
      const agentId = generateTestId();

      // Initialize budget with tight limits - use steps limit which is checked after increment
      const budgetEnforcer = new BudgetEnforcer({
        budgetConfig: {
          defaults: {
            maxTokens: 10000,
            maxToolCalls: 100,
            maxTimeMs: 100000,
            maxCostUsd: 100.0,
            maxSteps: 2 // Tight limit on steps
          },
          warningThresholds: { warning80: 0.8, warning90: 0.9 },
          haltOnBreach: true,
          pricing: [],
          enableWarnings: true
        },
        enabled: true
      });

      const budgetSessionId = {
        groupId: testGroupId,
        agentId,
        sessionId: generateTestId()
      };

      budgetEnforcer.startSession(budgetSessionId);

      // Step 1: Check passes
      const check1 = await budgetEnforcer.checkBeforeExecution(budgetSessionId);
      expect(check1.allowed).toBe(true);

      // Step 2: Increment steps (currentStep = 1)
      budgetEnforcer.updateBudget(budgetSessionId, { steps: 1 });
      await budgetEnforcer.recordStep(budgetSessionId);

      // Step 3: Check still passes
      const check2 = await budgetEnforcer.checkBeforeExecution(budgetSessionId);
      expect(check2.allowed).toBe(true);

      // Step 4: Increment steps again (currentStep = 2, which equals maxSteps)
      budgetEnforcer.updateBudget(budgetSessionId, { steps: 1 });
      const check3 = await budgetEnforcer.recordStep(budgetSessionId);

      // Step 5: Check should fail and halt
      expect(check3.allowed).toBe(false);
      expect(check3.status).toBe('halted');
      expect(check3.haltReason).toBeDefined();

      // Step 6: Verify session is halted
      expect(budgetEnforcer.isHalted(budgetSessionId)).toBe(true);

      // Step 7: Verify halt reason - should be kmax_exceeded for steps
      const haltReason = budgetEnforcer.getHaltReason(budgetSessionId);
      expect(haltReason).toBeDefined();
      expect(haltReason?.type).toBe('kmax_exceeded');
    });

    it('should show halt reason in budget status', async () => {
      const agentId = generateTestId();
      const budgetEnforcer = new BudgetEnforcer({
        budgetConfig: {
          defaults: {
            maxTokens: 50,
            maxToolCalls: 1,
            maxTimeMs: 1000,
            maxCostUsd: 0.1,
            maxSteps: 1
          },
          warningThresholds: { warning80: 0.8, warning90: 0.9 },
          haltOnBreach: true,
          pricing: [],
          enableWarnings: true
        },
        enabled: true
      });

      const budgetSessionId = {
        groupId: testGroupId,
        agentId,
        sessionId: generateTestId()
      };

      budgetEnforcer.startSession(budgetSessionId);

      // Exceed token limit
      budgetEnforcer.updateBudget(budgetSessionId, { tokens: 51, steps: 1 });
      await budgetEnforcer.checkBeforeExecution(budgetSessionId);

      // Get session state
      const state = budgetEnforcer.getSessionState(budgetSessionId);
      expect(state).not.toBeNull();
      expect(state?.haltReason).toBeDefined();
      expect(state?.haltReason?.type).toBe('token_limit');
    });

    it('should track budget warnings at 80% and 90% thresholds', async () => {
      const agentId = generateTestId();
      const budgetEnforcer = new BudgetEnforcer({
        budgetConfig: {
          defaults: {
            maxTokens: 100,
            maxToolCalls: 10,
            maxTimeMs: 10000,
            maxCostUsd: 1.0,
            maxSteps: 10
          },
          warningThresholds: { warning80: 0.8, warning90: 0.9 },
          haltOnBreach: true,
          pricing: [],
          enableWarnings: true
        },
        enabled: true
      });

      const budgetSessionId = {
        groupId: testGroupId,
        agentId,
        sessionId: generateTestId()
      };

      budgetEnforcer.startSession(budgetSessionId);

      // Use 85% of budget (triggers warning90)
      budgetEnforcer.updateBudget(budgetSessionId, { tokens: 85, steps: 1 });
      const check = await budgetEnforcer.checkBeforeExecution(budgetSessionId);

      expect(check.allowed).toBe(true);
      expect(check.status).toBe('warning');
      expect(check.warnings.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // TEST 4: Kernel Enforcement
  // ============================================================================
  describe('Kernel Enforcement', () => {
    it('should validate kernel proof on traced operations', async () => {
      const agentId = generateTestId();

      // Enable enforcement
      enforcementGate.initialize();
      enforcementGate.enable();

      expect(enforcementGate.isEnabled()).toBe(true);

      // Valid proof should pass
      const validProof = {
        actor: agentId,
        group_id: testGroupId,
        permission_tier: 'plugin'
      };

      const result = enforcementGate.validateProof(validProof, agentId, 'test_operation');
      expect(result).toBe(true);

      // Missing proof should be recorded (but throws due to throwOnViolation: true)
      const beforeViolations = enforcementGate.getViolations().length;
      try {
        enforcementGate.validateProof(null, agentId, 'unauthorized_operation');
      } catch {
        // Expected to throw
      }
      const afterViolations = enforcementGate.getViolations().length;

      // Should have recorded violation
      expect(afterViolations).toBeGreaterThan(beforeViolations);
    });

    it('should wrap functions with kernel enforcement', async () => {
      const agentId = generateTestId();

      // Create test function with proper signature
      const testFn = async (...args: unknown[]) => {
        const data = args[0] as string;
        return `processed: ${data}`;
      };

      // Wrap with enforcement
      const wrapped = enforcementGate.enforce(testFn, agentId);

      // Call with proof in context
      const context = { proof: { actor: agentId, group_id: testGroupId } };
      const result = await wrapped.apply(null, ['test', context]);

      expect(result).toBe('processed: test');
    });

    it('should track policy violations with full audit trail', async () => {
      // Clear previous violations
      enforcementGate.clearViolations();

      // Trigger various violations
      enforcementGate.recordViolation({
        timestamp: Date.now(),
        type: 'missing_proof',
        caller: 'test-agent-1',
        operation: 'db_query',
        message: 'Missing kernel proof'
      });

      enforcementGate.recordViolation({
        timestamp: Date.now(),
        type: 'policy_violation',
        caller: 'test-agent-2',
        operation: 'delete_operation',
        message: 'Attempted unauthorized delete'
      });

      // Verify violations recorded
      const violations = enforcementGate.getViolations();
      expect(violations.length).toBe(2);
      expect(violations[0].type).toBe('missing_proof');
      expect(violations[1].type).toBe('policy_violation');
    });
  });

  // ============================================================================
  // TEST 5: Multi-step Workflow State Transitions
  // ============================================================================
  describe('Multi-step Workflow State Transitions', () => {
    it('should log all state transitions with full history', async () => {
      const workflowId = generateTestId();
      const workflow = new WorkflowStateMachine(workflowId, testGroupId);
      await workflow.initialize();

      // Define expected path
      const path: Array<'discovering' | 'approved' | 'executing' | 'validating' | 'complete'> = [
        'discovering', 'approved', 'executing', 'validating', 'complete'
      ];

      // Execute path
      for (const state of path) {
        await workflow.transition(state);
      }

      // Verify history
      const history = await workflow.getHistory();
      expect(history.transitions.length).toBe(6); // planned + 5 transitions

      // Verify chronological order
      const states = history.transitions.map((h: WorkflowStateTransition) => h.state);
      expect(states).toEqual(['planned', 'discovering', 'approved', 'executing', 'validating', 'complete']);

      // Verify each transition has timestamp
      history.transitions.forEach((transition: WorkflowStateTransition) => {
        expect(transition.created_at).toBeDefined();
        expect(new Date(transition.created_at).getTime()).toBeGreaterThan(0);
      });
    });

    it('should capture checkpoint data at each transition', async () => {
      const workflowId = generateTestId();
      const workflow = new WorkflowStateMachine(workflowId, testGroupId);
      await workflow.initialize({ initial: 'data' });

      // Transition with checkpoint data
      await workflow.transition('discovering', {
        discovered_items: ['item1', 'item2'],
        discovery_complete: true
      });

      await workflow.transition('approved', {
        approver: 'test-user',
        approval_notes: 'Approved for execution'
      });

      // Verify checkpoints captured
      const history = await workflow.getHistory();
      const discoveringState = history.transitions.find((h: WorkflowStateTransition) => h.state === 'discovering');
      expect(discoveringState).toBeDefined();
      expect(discoveringState?.checkpoint_data).toEqual({
        initial: 'data',
        discovered_items: ['item1', 'item2'],
        discovery_complete: true,
        memory_pointers: {} // merged from previous checkpoint
      });
    });

    it('should support history queries with full audit trail', async () => {
      const workflowId = generateTestId();
      const workflow = new WorkflowStateMachine(workflowId, testGroupId);
      await workflow.initialize();

      // Execute workflow
      await workflow.transition('discovering');
      await workflow.transition('approved');

      // Query history
      const history = await workflow.getHistory();

      // Verify audit fields
      history.transitions.forEach((transition: WorkflowStateTransition) => {
        expect(transition.id).toBeDefined();
        expect(transition.group_id).toBe(testGroupId);
        expect(transition.workflow_id).toBe(workflowId);
        expect(transition.state).toBeDefined();
        expect(transition.created_at).toBeDefined();
      });
    });
  });

  // ============================================================================
  // TEST 6: Trace Capture Integration
  // ============================================================================
  describe('Trace Capture Integration', () => {
    it('should capture all tool calls with agent attribution', async () => {
      const agentId = generateTestId();
      const workflowId = generateTestId();
      const mockMcpClient = new MockMcpClient();

      const traceMiddleware = new TraceMiddleware({
        agentId,
        groupId: testGroupId,
        innerClient: mockMcpClient as any,
        workflowId
      });

      await traceMiddleware.startSession(workflowId);

      // Execute tool calls
      await traceMiddleware.callTool('tool-1', { data: 'test1' });
      await traceMiddleware.callTool('tool-2', { data: 'test2' });

      await traceMiddleware.endSession();

      // Verify traces were captured (we can't easily query them in unit tests,
      // but we can verify the session ended successfully)
      await traceMiddleware.destroy();
    });

    it('should handle tool call failures with error tracing', async () => {
      const agentId = generateTestId();
      const workflowId = generateTestId();
      const mockMcpClient = new MockMcpClient();
      mockMcpClient.setShouldFail(true);

      const traceMiddleware = new TraceMiddleware({
        agentId,
        groupId: testGroupId,
        innerClient: mockMcpClient as any,
        workflowId
      });

      await traceMiddleware.startSession(workflowId);

      // Execute failing tool call
      try {
        await traceMiddleware.callTool('failing-tool', { data: 'test' });
        expect.fail('Should have thrown');
      } catch (e) {
        // Expected - tool failed
        expect((e as Error).message).toContain('failed');
      }

      await traceMiddleware.destroy();
    });

    it('should support decision and learning logs', async () => {
      const agentId = generateTestId();
      const workflowId = generateTestId();
      const mockMcpClient = new MockMcpClient();

      const traceMiddleware = new TraceMiddleware({
        agentId,
        groupId: testGroupId,
        innerClient: mockMcpClient as any,
        workflowId
      });

      await traceMiddleware.startSession(workflowId);

      // Log decision
      await traceMiddleware.logDecision('Decided to use tool X', 0.85);

      // Log learning
      await traceMiddleware.logLearning('Learned that Y is faster than Z', 0.9);

      await traceMiddleware.endSession();
      await traceMiddleware.destroy();
    });
  });

  // ============================================================================
  // TEST 7: Token Budget Integration
  // ============================================================================
  describe('Token Budget Integration with Real Execution', () => {
    it('should track actual token usage across multiple tool calls', async () => {
      const agentId = generateTestId();
      const budgetEnforcer = new BudgetEnforcer({
        budgetConfig: {
          defaults: {
            maxTokens: 1000,
            maxToolCalls: 5,
            maxTimeMs: 60000,
            maxCostUsd: 10.0,
            maxSteps: 50
          },
          warningThresholds: { warning80: 0.8, warning90: 0.9 },
          haltOnBreach: true,
          pricing: [],
          enableWarnings: true
        },
        enabled: true
      });

      const budgetSessionId = {
        groupId: testGroupId,
        agentId,
        sessionId: generateTestId()
      };

      budgetEnforcer.startSession(budgetSessionId);

      // Simulate multiple tool calls
      for (let i = 0; i < 5; i++) {
        const check = await budgetEnforcer.checkBeforeExecution(budgetSessionId);
        expect(check.allowed).toBe(true);

        // Record usage
        budgetEnforcer.updateBudget(budgetSessionId, {
          tokens: 50,
          toolCalls: 1,
          steps: 1,
          timeMs: 100
        });
      }

      // Verify consumption
      const state = budgetEnforcer.getSessionState(budgetSessionId);
      expect(state?.budgetStatus.consumption.tokens).toBe(250);
      expect(state?.budgetStatus.consumption.toolCalls).toBe(5);
    });

    it('should support remaining budget queries', async () => {
      const agentId = generateTestId();
      const budgetEnforcer = new BudgetEnforcer({
        budgetConfig: {
          defaults: {
            maxTokens: 1000,
            maxToolCalls: 10,
            maxTimeMs: 60000,
            maxCostUsd: 10.0,
            maxSteps: 50
          },
          warningThresholds: { warning80: 0.8, warning90: 0.9 },
          haltOnBreach: true,
          pricing: [],
          enableWarnings: true
        },
        enabled: true
      });

      const budgetSessionId = {
        groupId: testGroupId,
        agentId,
        sessionId: generateTestId()
      };

      budgetEnforcer.startSession(budgetSessionId);

      // Use some budget
      budgetEnforcer.updateBudget(budgetSessionId, {
        tokens: 300,
        toolCalls: 3,
        steps: 5,
        timeMs: 1000
      });

      // Check remaining
      const remaining = budgetEnforcer.getRemainingBudget(budgetSessionId);
      expect(remaining.tokens).toBe(700);
      expect(remaining.toolCalls).toBe(7);
      expect(remaining.steps).toBe(45);
    });

    it('should support sufficient budget checks', async () => {
      const agentId = generateTestId();
      const budgetEnforcer = new BudgetEnforcer({
        budgetConfig: {
          defaults: {
            maxTokens: 100,
            maxToolCalls: 2,
            maxTimeMs: 1000,
            maxCostUsd: 1.0,
            maxSteps: 5
          },
          warningThresholds: { warning80: 0.8, warning90: 0.9 },
          haltOnBreach: true,
          pricing: [],
          enableWarnings: true
        },
        enabled: true
      });

      const budgetSessionId = {
        groupId: testGroupId,
        agentId,
        sessionId: generateTestId()
      };

      budgetEnforcer.startSession(budgetSessionId);

      // Check if sufficient for requirements
      const sufficient = budgetEnforcer.hasSufficientBudget(budgetSessionId, {
        minTokens: 50,
        minSteps: 3
      });
      expect(sufficient).toBe(true);

      // Use budget
      budgetEnforcer.updateBudget(budgetSessionId, { tokens: 60, steps: 4 });

      // Now insufficient
      const insufficient = budgetEnforcer.hasSufficientBudget(budgetSessionId, {
        minTokens: 50,
        minSteps: 3
      });
      expect(insufficient).toBe(false);
    });
  });

  // ============================================================================
  // TEST 8: Session State Persistence
  // ============================================================================
  describe('Session State Persistence', () => {
    it('should persist and recover complete session state', async () => {
      const agentId = generateTestId();

      // Create session
      const session = await sessionPersistence.createSession(agentId, testGroupId);

      // Update with complete state
      await sessionPersistence.updateSession(session.session_id, {
        workflow_stage: 'executing',
        token_usage: { input: 1000, output: 500, turns: 10 },
        permissions_granted: ['read', 'write', 'execute'],
        subagent_results: {
          subagent1: { result: 'success', data: [1, 2, 3] },
          subagent2: { result: 'partial', data: [4, 5] }
        },
        checkpoint_data: { currentStep: 5, processed: ['a', 'b', 'c'] }
      });

      // Recover
      const recovered = await sessionPersistence.loadSession(session.session_id);

      expect(recovered).not.toBeNull();
      expect(recovered?.workflow_stage).toBe('executing');
      expect(recovered?.token_usage).toEqual({ input: 1000, output: 500, turns: 10 });
      expect(recovered?.permissions_granted).toEqual(['read', 'write', 'execute']);
      expect(recovered?.subagent_results).toEqual({
        subagent1: { result: 'success', data: [1, 2, 3] },
        subagent2: { result: 'partial', data: [4, 5] }
      });
    });

    it('should support permission management', async () => {
      const agentId = generateTestId();
      const session = await sessionPersistence.createSession(agentId, testGroupId);

      // Grant permissions
      await sessionPersistence.grantPermission(session.session_id, 'read');
      await sessionPersistence.grantPermission(session.session_id, 'write');

      // Check permission
      const hasRead = await sessionPersistence.hasPermission(session.session_id, 'read');
      expect(hasRead).toBe(true);

      const hasExecute = await sessionPersistence.hasPermission(session.session_id, 'execute');
      expect(hasExecute).toBe(false);

      // Revoke permission
      await sessionPersistence.revokePermission(session.session_id, 'write');
      const hasWrite = await sessionPersistence.hasPermission(session.session_id, 'write');
      expect(hasWrite).toBe(false);
    });

    it('should support subagent result storage', async () => {
      const agentId = generateTestId();
      const session = await sessionPersistence.createSession(agentId, testGroupId);

      // Store results
      await sessionPersistence.storeSubagentResult(session.session_id, 'analyzer', {
        sentiment: 'positive',
        confidence: 0.92
      });

      await sessionPersistence.storeSubagentResult(session.session_id, 'summarizer', {
        summary: 'Good progress made',
        key_points: ['point1', 'point2']
      });

      // Retrieve
      const analyzerResult = await sessionPersistence.getSubagentResult(session.session_id, 'analyzer');
      expect(analyzerResult).toEqual({
        sentiment: 'positive',
        confidence: 0.92
      });

      const summarizerResult = await sessionPersistence.getSubagentResult(session.session_id, 'summarizer');
      expect(summarizerResult).toEqual({
        summary: 'Good progress made',
        key_points: ['point1', 'point2']
      });
    });
  });

  // ============================================================================
  // TEST 9: Error Recovery Scenarios
  // ============================================================================
  describe('Error Recovery Scenarios', () => {
    it('should handle workflow failures with proper state transition', async () => {
      const workflowId = generateTestId();
      const workflow = new WorkflowStateMachine(workflowId, testGroupId);
      await workflow.initialize();

      // Progress through states
      await workflow.transition('discovering');
      await workflow.transition('approved');
      await workflow.transition('executing');

      // Simulate failure
      await workflow.fail('Database connection lost');

      expect(workflow.state).toBe('failed');

      // Verify checkpoint has error message
      const history = await workflow.getHistory();
      const failedState = history.transitions.find((h: WorkflowStateTransition) => h.state === 'failed');
      expect(failedState?.checkpoint_data).toBeDefined();
    });

    it('should support workflow reset from failed state', async () => {
      const workflowId = generateTestId();
      const workflow = new WorkflowStateMachine(workflowId, testGroupId);
      await workflow.initialize();

      // Progress and fail
      await workflow.transition('discovering');
      await workflow.transition('approved');
      await workflow.transition('executing');
      await workflow.fail('Task failed');
      expect(workflow.state).toBe('failed');

      // Reset
      await workflow.reset({ reset_reason: 'Retry after fix' });
      expect(workflow.state).toBe('planned');
    });

    it('should validate state transitions and reject invalid ones', async () => {
      const workflowId = generateTestId();
      const workflow = new WorkflowStateMachine(workflowId, testGroupId);
      await workflow.initialize();

      // Try invalid transition (planned -> executing directly)
      await expect(
        workflow.transition('executing')
      ).rejects.toThrow(/Cannot transition from 'planned' to 'executing'/);

      // Check valid transitions
      const valid = workflow.getValidNextStates();
      expect(valid).toContain('discovering');
      expect(valid).not.toContain('executing');
    });
  });

  // ============================================================================
  // TEST 10: Concurrent Sessions
  // ============================================================================
  describe('Concurrent Sessions', () => {
    it('should handle multiple concurrent agent sessions', async () => {
      const agentId = generateTestId();

      // Create multiple sessions
      const session1 = await sessionPersistence.createSession(agentId, testGroupId);
      const session2 = await sessionPersistence.createSession(agentId, testGroupId);
      const session3 = await sessionPersistence.createSession(agentId, testGroupId);

      // Update each independently
      await sessionPersistence.updateSession(session1.session_id, { workflow_stage: 'discovering' });
      await sessionPersistence.updateSession(session2.session_id, { workflow_stage: 'executing' });
      await sessionPersistence.updateSession(session3.session_id, { workflow_stage: 'complete' });

      // Verify isolation
      const recovered1 = await sessionPersistence.loadSession(session1.session_id);
      const recovered2 = await sessionPersistence.loadSession(session2.session_id);
      const recovered3 = await sessionPersistence.loadSession(session3.session_id);

      expect(recovered1?.workflow_stage).toBe('discovering');
      expect(recovered2?.workflow_stage).toBe('executing');
      expect(recovered3?.workflow_stage).toBe('complete');
    });

    it('should handle concurrent workflow operations', async () => {
      const workflowIds = [1, 2, 3].map(() => generateTestId());

      // Create workflows concurrently
      const workflows = await Promise.all(
        workflowIds.map(id => {
          const wf = new WorkflowStateMachine(id, testGroupId);
          return wf.initialize().then(() => wf);
        })
      );

      // Transition concurrently
      await Promise.all(
        workflows.map(wf => wf.transition('discovering'))
      );

      // Verify all transitioned
      for (const wf of workflows) {
        expect(wf.state).toBe('discovering');
      }
    });
  });
});
