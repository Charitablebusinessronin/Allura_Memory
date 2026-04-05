/**
 * Workflow State Machine Tests
 * 
 * Comprehensive test suite for workflow state machine.
 * Tests: valid transitions, invalid transitions, append-only semantics,
 * group isolation, retry-safe detection, and state history queries.
 * 
 * @module workflow/state-machine.test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getPool, closePool } from '../postgres/connection';
import {
  WorkflowStateMachine,
  createStateMachine,
  loadStateMachine,
  recoverWorkflow,
} from './state-machine';
import type {
  WorkflowState,
  WorkflowCheckpointData,
  WorkflowStateTransition,
} from './types';
import {
  validateTransition,
  isValidTransition,
  isTerminalState,
  isRetrySafeState,
  getValidNextStates,
  getPreviousStates,
  getHappyPath,
  getProgressPercentage,
  VALID_TRANSITIONS,
  TERMINAL_STATES,
  RETRY_SAFE_STATES,
} from './transitions';
import {
  createStateTransition,
  getCurrentState,
  getWorkflowHistory,
  getWorkflowStateHistory,
  initializeWorkflow,
  workflowExists,
  queryWorkflowStates,
  getWorkflowsByState,
  getRetrySafeWorkflows,
} from './queries';

describe('Workflow State Machine', () => {
  // Test data
  const TEST_GROUP_ID = 'allura-test-group';
  const TEST_WORKFLOW_ID = `test-workflow-${Date.now()}`;
  
  beforeAll(async () => {
    // Ensure environment is configured for tests
    process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
    process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || '5432';
    process.env.POSTGRES_DB = process.env.POSTGRES_DB || 'memory';
    process.env.POSTGRES_USER = process.env.POSTGRES_USER || 'ronin4life';
    process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'KaminaTHC*';
    
    // Create workflow_states table if it doesn't exist
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workflow_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('planned', 'discovering', 'approved', 'executing', 'validating', 'complete', 'failed')),
        checkpoint_data JSONB DEFAULT '{}',
        retry_safe BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_states_workflow ON workflow_states(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_states_group ON workflow_states(group_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_states_state ON workflow_states(state);
      CREATE INDEX IF NOT EXISTS idx_workflow_states_created ON workflow_states(created_at DESC);
    `);
  });
  
  afterAll(async () => {
    // Cleanup test data
    const pool = getPool();
    await pool.query(
      'DELETE FROM workflow_states WHERE group_id = $1 OR group_id LIKE $2',
      [TEST_GROUP_ID, 'allura-test-%']
    );
    await closePool();
  });
  
  beforeEach(async () => {
    // Cleanup before each test
    const pool = getPool();
    await pool.query(
      'DELETE FROM workflow_states WHERE group_id = $1',
      [TEST_GROUP_ID]
    );
  });
  
  // ================================================================================
  // TEST 1: Transition Validation
  // ================================================================================
  describe('Transition Validation', () => {
    it('should validate planned -> discovering transition', () => {
      const result = validateTransition('planned', 'discovering');
      expect(result.valid).toBe(true);
    });
    
    it('should validate discovering -> approved transition', () => {
      const result = validateTransition('discovering', 'approved');
      expect(result.valid).toBe(true);
    });
    
    it('should validate approved -> executing transition', () => {
      const result = validateTransition('approved', 'executing');
      expect(result.valid).toBe(true);
    });
    
    it('should validate executing -> validating transition', () => {
      const result = validateTransition('executing', 'validating');
      expect(result.valid).toBe(true);
    });
    
    it('should validate validating -> complete transition', () => {
      const result = validateTransition('validating', 'complete');
      expect(result.valid).toBe(true);
    });
    
    it('should validate any -> failed transitions', () => {
      // Test transitions from each state to failed
      const states: WorkflowState[] = ['planned', 'discovering', 'approved', 'executing', 'validating'];
      
      for (const state of states) {
        const result = validateTransition(state, 'failed');
        expect(result.valid).toBe(true);
      }
    });
    
    it('should validate failed -> planned transition (reset)', () => {
      const result = validateTransition('failed', 'planned');
      expect(result.valid).toBe(true);
    });
    
    it('should consider same state transition valid (idempotent)', () => {
      const states: WorkflowState[] = ['planned', 'discovering', 'approved', 'executing', 'validating', 'complete', 'failed'];
      
      for (const state of states) {
        const result = validateTransition(state, state);
        expect(result.valid).toBe(true);
      }
    });
  });
  
  // ================================================================================
  // TEST 2: Invalid Transitions
  // ================================================================================
  describe('Invalid Transitions', () => {
    it('should reject planned -> approved (skipping discovering)', () => {
      const result = validateTransition('planned', 'approved');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Cannot transition');
    });
    
    it('should reject planned -> executing (skipping phases)', () => {
      const result = validateTransition('planned', 'executing');
      expect(result.valid).toBe(false);
    });
    
    it('should reject complete -> any transition', () => {
      const states: WorkflowState[] = ['planned', 'discovering', 'approved', 'executing', 'validating'];
      
      for (const state of states) {
        const result = validateTransition('complete', state);
        expect(result.valid).toBe(false);
      }
    });
    
    it('should reject discovering -> executing (skipping approved)', () => {
      const result = validateTransition('discovering', 'executing');
      expect(result.valid).toBe(false);
    });
    
    it('should reject approved -> validating (skipping executing)', () => {
      const result = validateTransition('approved', 'validating');
      expect(result.valid).toBe(false);
    });
    
    it('should reject failed -> complete (must reset first)', () => {
      const result = validateTransition('failed', 'complete');
      expect(result.valid).toBe(false);
    });
    
    it('should reject failed -> discovering (must go through planned)', () => {
      const result = validateTransition('failed', 'discovering');
      expect(result.valid).toBe(false);
    });
    
    it('should provide helpful error messages for invalid transitions', () => {
      const result = validateTransition('planned', 'complete');
      expect(result.reason).toContain('planned');
      expect(result.reason).toContain('complete');
      expect(result.reason).toContain('Allowed');
    });
  });
  
  // ================================================================================
  // TEST 3: State Machine Class - Valid Transitions
  // ================================================================================
  describe('State Machine Class - Valid Transitions', () => {
    it('should create new workflow in planned state', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-1`,
        TEST_GROUP_ID
      );
      
      expect(machine.state).toBe('planned');
      expect(machine.transitionCount).toBe(1);
    });
    
    it('should transition planned -> discovering', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-2`,
        TEST_GROUP_ID
      );
      
      await machine.transition('discovering');
      
      expect(machine.state).toBe('discovering');
      expect(machine.transitionCount).toBe(2);
    });
    
    it('should transition through full happy path', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-3`,
        TEST_GROUP_ID
      );
      
      // Full happy path
      await machine.transition('discovering');
      await machine.transition('approved');
      await machine.transition('executing');
      await machine.transition('validating');
      await machine.transition('complete');
      
      expect(machine.state).toBe('complete');
      expect(machine.transitionCount).toBe(6);
    });
    
    it('should transition to failed from any state', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-4`,
        TEST_GROUP_ID
      );
      
      await machine.transition('discovering');
      await machine.transition('failed');
      
      expect(machine.state).toBe('failed');
    });
    
    it('should reset failed -> planned', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-5`,
        TEST_GROUP_ID
      );
      
      await machine.transition('discovering');
      await machine.transition('failed');
      await machine.reset();
      
      expect(machine.state).toBe('planned');
    });
  });
  
  // ================================================================================
  // TEST 4: State Machine Class - Invalid Transitions
  // ================================================================================
  describe('State Machine Class - Invalid Transitions', () => {
    it('should throw on invalid transition', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-6`,
        TEST_GROUP_ID
      );
      
      await expect(machine.transition('approved')).rejects.toThrow("Cannot transition from 'planned' to 'approved'");
    });
    
    it('should throw on complete -> any transition', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-7`,
        TEST_GROUP_ID
      );
      
      // Get to complete
      await machine.transition('discovering');
      await machine.transition('approved');
      await machine.transition('executing');
      await machine.transition('validating');
      await machine.transition('complete');
      
      // Should not be able to transition from complete
      await expect(machine.transition('failed')).rejects.toThrow();
    });
    
    it('should throw on reset when not in failed state', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-8`,
        TEST_GROUP_ID
      );
      
      await machine.transition('discovering');
      
      await expect(machine.reset()).rejects.toThrow('Can only reset from');
    });
    
    it('should prevent operations before initialization', async () => {
      const machine = new WorkflowStateMachine(
        `${TEST_WORKFLOW_ID}-9`,
        TEST_GROUP_ID
      );
      
      expect(() => machine.state).toThrow('not initialized');
      expect(() => machine.checkpoint).toThrow('not initialized');
    });
  });
  
  // ================================================================================
  // TEST 5: Append-Only Semantics
  // ================================================================================
  describe('Append-Only Semantics', () => {
    it('should create new record on each transition', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-10`;
      const machine = await createStateMachine(workflowId, TEST_GROUP_ID);
      
      // Make 3 transitions
      await machine.transition('discovering');
      await machine.transition('approved');
      await machine.transition('failed');
      
      // Check database directly
      const pool = getPool();
      const result = await pool.query(
        'SELECT * FROM workflow_states WHERE workflow_id = $1 ORDER BY created_at ASC',
        [workflowId]
      );
      
      // Should have 4 records (initial + 3 transitions)
      expect(result.rows.length).toBe(4);
      
      // Each should have unique ID
      const ids = result.rows.map(r => r.id);
      expect(new Set(ids).size).toBe(4);
    });
    
    it('should preserve all transition history', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-11`;
      const machine = await createStateMachine(workflowId, TEST_GROUP_ID);
      
      await machine.transition('discovering');
      await machine.transition('approved');
      
      const history = await machine.getHistory();
      
      expect(history.transitions.length).toBe(3);
      expect(history.transitions[0].state).toBe('planned');
      expect(history.transitions[1].state).toBe('discovering');
      expect(history.transitions[2].state).toBe('approved');
    });
    
    it('should never update existing records', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-12`;
      const machine = await createStateMachine(workflowId, TEST_GROUP_ID);
      
      const pool = getPool();
      
      // Get initial record
      const initialResult = await pool.query(
        'SELECT id, created_at FROM workflow_states WHERE workflow_id = $1 ORDER BY created_at ASC LIMIT 1',
        [workflowId]
      );
      const initialId = initialResult.rows[0].id;
      const initialCreatedAt = initialResult.rows[0].created_at;
      
      // Make transitions
      await machine.transition('discovering');
      await machine.transition('failed');
      
      // Verify initial record unchanged
      const finalResult = await pool.query(
        'SELECT id, created_at FROM workflow_states WHERE id = $1',
        [initialId]
      );
      
      expect(finalResult.rows[0].id).toBe(initialId);
      expect(finalResult.rows[0].created_at).toEqual(initialCreatedAt);
    });
    
    it('should have sequential timestamps', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-13`;
      const machine = await createStateMachine(workflowId, TEST_GROUP_ID);
      
      await machine.transition('discovering');
      await machine.transition('approved');
      
      const pool = getPool();
      const result = await pool.query(
        'SELECT created_at FROM workflow_states WHERE workflow_id = $1 ORDER BY created_at ASC',
        [workflowId]
      );
      
      // Each timestamp should be >= previous
      for (let i = 1; i < result.rows.length; i++) {
        const prev = new Date(result.rows[i - 1].created_at);
        const curr = new Date(result.rows[i].created_at);
        expect(curr.getTime()).toBeGreaterThanOrEqual(prev.getTime());
      }
    });
  });
  
  // ================================================================================
  // TEST 6: Group Isolation
  // ================================================================================
  describe('Group Isolation', () => {
    it('should isolate workflows by group_id', async () => {
      const group1 = 'allura-test-group-1';
      const group2 = 'allura-test-group-2';
      const workflowId = 'shared-workflow-id';
      
      // Create same workflow ID in two different groups
      const machine1 = await createStateMachine(workflowId, group1);
      const machine2 = await createStateMachine(workflowId, group2);
      
      // Transition group1
      await machine1.transition('discovering');
      
      // Group2 should still be planned
      await machine2.refresh();
      expect(machine2.state).toBe('planned');
      
      // Cleanup
      const pool = getPool();
      await pool.query(
        'DELETE FROM workflow_states WHERE group_id IN ($1, $2)',
        [group1, group2]
      );
    });
    
    it('should query only workflows in specified group', async () => {
      const group1 = 'allura-test-query-1';
      const group2 = 'allura-test-query-2';
      
      // Create workflows in different groups
      await createStateMachine('wf-1', group1);
      await createStateMachine('wf-2', group1);
      await createStateMachine('wf-3', group2);
      
      // Query group1
      const result = await queryWorkflowStates({ group_id: group1 });
      
      // Should only get group1 workflows
      expect(result.transitions.every(t => t.group_id === group1)).toBe(true);
      
      // Cleanup
      const pool = getPool();
      await pool.query(
        'DELETE FROM workflow_states WHERE group_id IN ($1, $2)',
        [group1, group2]
      );
    });
    
    it('should prevent cross-group workflow loading', async () => {
      const group1 = 'allura-test-load-1';
      const group2 = 'allura-test-load-2';
      const workflowId = 'test-workflow';
      
      // Create in group1
      await createStateMachine(workflowId, group1);
      
      // Try to load from group2 - should fail (workflow doesn't exist for this group)
      await expect(loadStateMachine(workflowId, group2)).rejects.toThrow('not found');
      
      // Cleanup
      const pool = getPool();
      await pool.query(
        'DELETE FROM workflow_states WHERE group_id IN ($1, $2)',
        [group1, group2]
      );
    });
    
    it('should getWorkflowsByState respect group isolation', async () => {
      const group1 = 'allura-test-by-state-1';
      const group2 = 'allura-test-by-state-2';
      
      // Create workflows in both groups, transition some to discovering
      const m1 = await createStateMachine('wf-1', group1);
      const m2 = await createStateMachine('wf-2', group1);
      await createStateMachine('wf-3', group2);
      
      await m1.transition('discovering');
      await m2.transition('discovering');
      
      // Get discovering workflows in group1
      const result = await getWorkflowsByState('discovering', group1);
      
      expect(result.length).toBe(2);
      expect(result.every(w => w.group_id === group1)).toBe(true);
      
      // Cleanup
      const pool = getPool();
      await pool.query(
        'DELETE FROM workflow_states WHERE group_id IN ($1, $2)',
        [group1, group2]
      );
    });
  });
  
  // ================================================================================
  // TEST 7: Retry-Safe Detection
  // ================================================================================
  describe('Retry-Safe Detection', () => {
    it('should mark planned as retry-safe', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-14`,
        TEST_GROUP_ID
      );
      
      expect(machine.isRetrySafe).toBe(true);
    });
    
    it('should mark approved as retry-safe', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-15`,
        TEST_GROUP_ID
      );
      
      await machine.transition('discovering');
      await machine.transition('approved');
      
      expect(machine.isRetrySafe).toBe(true);
    });
    
    it('should mark failed as retry-safe', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-16`,
        TEST_GROUP_ID
      );
      
      await machine.transition('discovering');
      await machine.transition('failed');
      
      expect(machine.isRetrySafe).toBe(true);
    });
    
    it('should NOT mark discovering as retry-safe', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-17`,
        TEST_GROUP_ID
      );
      
      await machine.transition('discovering');
      
      expect(machine.isRetrySafe).toBe(false);
    });
    
    it('should NOT mark executing as retry-safe', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-18`,
        TEST_GROUP_ID
      );
      
      await machine.transition('discovering');
      await machine.transition('approved');
      await machine.transition('executing');
      
      expect(machine.isRetrySafe).toBe(false);
    });
    
    it('should NOT mark validating as retry-safe', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-19`,
        TEST_GROUP_ID
      );
      
      await machine.transition('discovering');
      await machine.transition('approved');
      await machine.transition('executing');
      await machine.transition('validating');
      
      expect(machine.isRetrySafe).toBe(false);
    });
    
    it('should NOT mark complete as retry-safe', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-20`,
        TEST_GROUP_ID
      );
      
      await machine.transition('discovering');
      await machine.transition('approved');
      await machine.transition('executing');
      await machine.transition('validating');
      await machine.transition('complete');
      
      expect(machine.isRetrySafe).toBe(false);
    });
    
    it('should getRetrySafeWorkflows return only retry-safe workflows', async () => {
      const group = 'allura-test-retry-safe';
      
      // Create workflows in various states
      const planned = await createStateMachine('planned-wf', group);
      const discovering = await createStateMachine('discovering-wf', group);
      await discovering.transition('discovering');
      
      const approved = await createStateMachine('approved-wf', group);
      await approved.transition('discovering');
      await approved.transition('approved');
      
      const executing = await createStateMachine('executing-wf', group);
      await executing.transition('discovering');
      await executing.transition('approved');
      await executing.transition('executing');
      
      const result = await getRetrySafeWorkflows(group);
      
      // Should only include planned, approved (failed would also count)
      expect(result.every(w => ['planned', 'approved', 'failed'].includes(w.state))).toBe(true);
      
      // Cleanup
      const pool = getPool();
      await pool.query('DELETE FROM workflow_states WHERE group_id = $1', [group]);
    });
  });
  
  // ================================================================================
  // TEST 8: State History Querying
  // ================================================================================
  describe('State History Querying', () => {
    it('should getWorkflowHistory return ordered transitions', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-21`;
      const machine = await createStateMachine(workflowId, TEST_GROUP_ID);
      
      await machine.transition('discovering');
      await machine.transition('approved');
      
      const history = await getWorkflowHistory(workflowId, TEST_GROUP_ID);
      
      expect(history.length).toBe(3);
      expect(history[0].state).toBe('planned');
      expect(history[1].state).toBe('discovering');
      expect(history[2].state).toBe('approved');
      expect(history[0].created_at <= history[1].created_at).toBe(true);
      expect(history[1].created_at <= history[2].created_at).toBe(true);
    });
    
    it('should getWorkflowStateHistory include current state', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-22`;
      const machine = await createStateMachine(workflowId, TEST_GROUP_ID);
      
      await machine.transition('discovering');
      
      const history = await getWorkflowStateHistory(workflowId, TEST_GROUP_ID);
      
      expect(history).not.toBeNull();
      expect(history!.workflow_id).toBe(workflowId);
      expect(history!.group_id).toBe(TEST_GROUP_ID);
      expect(history!.current_state.state).toBe('discovering');
      expect(history!.transitions.length).toBe(2);
    });
    
    it('should include checkpoint data in history', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-23`;
      const checkpointData: WorkflowCheckpointData = {
        last_turn: 5,
        context: { step: 'test' },
        tool_calls: [{ id: 't1', tool: 'test', parameters: {}, status: 'completed' }],
      };
      
      const machine = await createStateMachine(workflowId, TEST_GROUP_ID);
      await machine.transition('discovering', checkpointData);
      
      const history = await getWorkflowHistory(workflowId, TEST_GROUP_ID);
      const discoveringTransition = history.find(h => h.state === 'discovering');
      
      expect(discoveringTransition).toBeDefined();
      expect(discoveringTransition!.checkpoint_data.last_turn).toBe(5);
      expect(discoveringTransition!.checkpoint_data.context).toEqual({ step: 'test' });
    });
    
    it('should workflowExists return correct value', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-24`;
      
      expect(await workflowExists(workflowId, TEST_GROUP_ID)).toBe(false);
      
      await createStateMachine(workflowId, TEST_GROUP_ID);
      
      expect(await workflowExists(workflowId, TEST_GROUP_ID)).toBe(true);
    });
    
    it('should getCurrentState return latest state', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-25`;
      const machine = await createStateMachine(workflowId, TEST_GROUP_ID);
      
      await machine.transition('discovering');
      await machine.transition('approved');
      
      const currentState = await getCurrentState(workflowId, TEST_GROUP_ID);
      
      expect(currentState).not.toBeNull();
      expect(currentState!.state).toBe('approved');
      expect(currentState!.transition_count).toBe(3);
    });
    
    it('should queryWorkflowStates support pagination', async () => {
      // Create multiple workflows
      for (let i = 0; i < 5; i++) {
        await createStateMachine(`paginated-wf-${i}`, TEST_GROUP_ID);
      }
      
      const page1 = await queryWorkflowStates({ group_id: TEST_GROUP_ID, limit: 2 });
      expect(page1.transitions.length).toBe(2);
      expect(page1.has_more).toBe(true);
      
      const page2 = await queryWorkflowStates({ group_id: TEST_GROUP_ID, limit: 2, offset: 2 });
      expect(page2.transitions.length).toBe(2);
      
      // Total should count all, not just this page
      expect(page1.total).toBeGreaterThanOrEqual(5);
    });
    
    it('should support filtering by state in queryWorkflowStates', async () => {
      const discoveringMachine = await createStateMachine('filter-wf-1', TEST_GROUP_ID);
      await discoveringMachine.transition('discovering');
      
      await createStateMachine('filter-wf-2', TEST_GROUP_ID);
      
      const result = await queryWorkflowStates({
        group_id: TEST_GROUP_ID,
        state: 'discovering',
      });
      
      expect(result.transitions.every(t => t.state === 'discovering')).toBe(true);
    });
  });
  
  // ================================================================================
  // TEST 9: Checkpoint Data
  // ================================================================================
  describe('Checkpoint Data', () => {
    it('should persist checkpoint data on transition', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-26`;
      const checkpoint: WorkflowCheckpointData = {
        last_turn: 10,
        context: { key: 'value' },
        memory_pointers: {
          postgres_trace_ids: ['trace-1'],
          neo4j_node_ids: ['node-1'],
        },
      };
      
      const machine = await createStateMachine(workflowId, TEST_GROUP_ID);
      await machine.transition('discovering', checkpoint);
      
      const retrieved = await getCurrentState(workflowId, TEST_GROUP_ID);
      
      expect(retrieved!.checkpoint_data.last_turn).toBe(10);
      expect(retrieved!.checkpoint_data.context).toEqual({ key: 'value' });
      expect(retrieved!.checkpoint_data.memory_pointers?.postgres_trace_ids).toEqual(['trace-1']);
    });
    
    it('should merge checkpoint data on subsequent transitions', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-27`;
      const checkpoint1: WorkflowCheckpointData = {
        last_turn: 5,
        context: { key1: 'value1' },
      };
      const checkpoint2: WorkflowCheckpointData = {
        last_turn: 10,
        context: { key2: 'value2' },
      };
      
      const machine = await createStateMachine(workflowId, TEST_GROUP_ID);
      await machine.transition('discovering', checkpoint1);
      await machine.transition('approved', checkpoint2);
      
      const retrieved = await getCurrentState(workflowId, TEST_GROUP_ID);
      
      // Should have merged values
      expect(retrieved!.checkpoint_data.last_turn).toBe(10);
      // Context is spread, so key2 should win
      expect(retrieved!.checkpoint_data.context).toEqual({ key2: 'value2' });
    });
    
    it('should saveCheckpoint create transition without state change', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-28`;
      const machine = await createStateMachine(workflowId, TEST_GROUP_ID);
      
      const checkpoint: WorkflowCheckpointData = { last_turn: 3 };
      await machine.saveCheckpoint(checkpoint);
      
      // State should still be planned
      expect(machine.state).toBe('planned');
      expect(machine.transitionCount).toBe(2);
      
      // But checkpoint data should be updated
      const currentState = await getCurrentState(workflowId, TEST_GROUP_ID);
      expect(currentState!.checkpoint_data.last_turn).toBe(3);
    });
  });
  
  // ================================================================================
  // TEST 10: Utility Functions
  // ================================================================================
  describe('Utility Functions', () => {
    it('should isValidTransition return boolean', () => {
      expect(isValidTransition('planned', 'discovering')).toBe(true);
      expect(isValidTransition('planned', 'complete')).toBe(false);
    });
    
    it('should isTerminalState identify complete', () => {
      expect(isTerminalState('complete')).toBe(true);
      expect(isTerminalState('planned')).toBe(false);
      expect(isTerminalState('failed')).toBe(false);
    });
    
    it('should isRetrySafeState identify retry-safe states', () => {
      expect(isRetrySafeState('planned')).toBe(true);
      expect(isRetrySafeState('approved')).toBe(true);
      expect(isRetrySafeState('failed')).toBe(true);
      expect(isRetrySafeState('discovering')).toBe(false);
    });
    
    it('should getValidNextStates return allowed transitions', () => {
      const nextStates = getValidNextStates('planned');
      expect(nextStates).toContain('discovering');
      expect(nextStates).toContain('failed');
      expect(nextStates).not.toContain('approved');
    });
    
    it('should getPreviousStates return entry points', () => {
      const prevStates = getPreviousStates('failed');
      expect(prevStates).toContain('planned');
      expect(prevStates).toContain('discovering');
      expect(prevStates).toContain('approved');
      expect(prevStates).toContain('executing');
      expect(prevStates).toContain('validating');
    });
    
    it('should getHappyPath return ordered states', () => {
      const happyPath = getHappyPath();
      expect(happyPath).toEqual([
        'planned',
        'discovering',
        'approved',
        'executing',
        'validating',
        'complete',
      ]);
    });
    
    it('should getProgressPercentage calculate correctly', () => {
      expect(getProgressPercentage('planned')).toBe(0);
      expect(getProgressPercentage('discovering')).toBe(20);
      expect(getProgressPercentage('approved')).toBe(40);
      expect(getProgressPercentage('executing')).toBe(60);
      expect(getProgressPercentage('validating')).toBe(80);
      expect(getProgressPercentage('complete')).toBe(100);
      expect(getProgressPercentage('failed')).toBe(0);
    });
  });
  
  // ================================================================================
  // TEST 11: State Machine Convenience Methods
  // ================================================================================
  describe('State Machine Convenience Methods', () => {
    it('should complete() transition to complete state', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-29`,
        TEST_GROUP_ID
      );
      
      await machine.transition('discovering');
      await machine.transition('approved');
      await machine.transition('executing');
      await machine.transition('validating');
      
      const transition = await machine.complete({ result: 'success' });
      
      expect(machine.state).toBe('complete');
      expect(machine.isTerminal).toBe(true);
    });
    
    it('should fail() transition to failed state', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-30`,
        TEST_GROUP_ID
      );
      
      await machine.transition('discovering');
      
      const transition = await machine.fail('Something went wrong');
      
      expect(machine.state).toBe('failed');
      expect(machine.checkpoint.error_message).toBe('Something went wrong');
    });
    
    it('should assertState throw on mismatch', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-31`,
        TEST_GROUP_ID
      );
      
      // Should not throw for correct state
      machine.assertState('planned');
      
      // Should throw for incorrect state
      expect(() => machine.assertState('discovering')).toThrow("Expected state 'discovering'");
    });
    
    it('should canTransitionTo return expected values', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-32`,
        TEST_GROUP_ID
      );
      
      expect(machine.canTransitionTo('discovering')).toBe(true);
      expect(machine.canTransitionTo('approved')).toBe(false);
      expect(machine.canTransitionTo('failed')).toBe(true);
    });
    
    it('should loadStateMachine load existing workflow', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-33`;
      await createStateMachine(workflowId, TEST_GROUP_ID);
      
      const loaded = await loadStateMachine(workflowId, TEST_GROUP_ID);
      
      expect(loaded.state).toBe('planned');
      expect(loaded.workflowId).toBe(workflowId);
    });
    
    it('should recoverWorkflow return state machine if retry-safe', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-34`;
      const machine = await createStateMachine(workflowId, TEST_GROUP_ID);
      
      const recovered = await recoverWorkflow(workflowId, TEST_GROUP_ID);
      
      expect(recovered).not.toBeNull();
      expect(recovered!.state).toBe('planned');
    });
    
    it('should recoverWorkflow return null if not retry-safe', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-35`;
      const machine = await createStateMachine(workflowId, TEST_GROUP_ID);
      await machine.transition('discovering'); // Not retry-safe
      
      const recovered = await recoverWorkflow(workflowId, TEST_GROUP_ID);
      
      expect(recovered).toBeNull();
    });
  });
  
  // ================================================================================
  // TEST 12: Idempotency
  // ================================================================================
  describe('Idempotency', () => {
    it('should handle same-state transition gracefully', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-36`;
      const machine = await createStateMachine(workflowId, TEST_GROUP_ID);
      
      // Transition to same state with different checkpoint
      const checkpoint: WorkflowCheckpointData = { last_turn: 1 };
      await machine.transition('planned', checkpoint);
      
      // Should create a new record with same state
      const history = await getWorkflowHistory(workflowId, TEST_GROUP_ID);
      expect(history.length).toBe(2);
      expect(history[0].state).toBe('planned');
      expect(history[1].state).toBe('planned');
    });
    
    it('should handle identical checkpoint idempotently', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-37`;
      const machine = await createStateMachine(workflowId, TEST_GROUP_ID);
      
      const checkpoint: WorkflowCheckpointData = { last_turn: 1 };
      await machine.transition('planned', checkpoint);
      await machine.transition('planned', checkpoint); // Same checkpoint
      
      // Should still create records (append-only)
      const history = await getWorkflowHistory(workflowId, TEST_GROUP_ID);
      expect(history.length).toBe(3);
    });
  });
  
  // ================================================================================
  // TEST 13: Error Handling
  // ================================================================================
  describe('Error Handling', () => {
    it('should throw WorkflowStateError with code for invalid transition', async () => {
      const machine = await createStateMachine(
        `${TEST_WORKFLOW_ID}-38`,
        TEST_GROUP_ID
      );
      
      try {
        await machine.transition('complete');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).name).toBe('WorkflowStateError');
        expect((error as { code: string }).code).toBe('WS-001');
      }
    });
    
    it('should throw WorkflowStateError when loading non-existent workflow', async () => {
      try {
        await loadStateMachine('non-existent', TEST_GROUP_ID);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).name).toBe('WorkflowStateError');
        expect((error as { code: string }).code).toBe('WS-007');
      }
    });
    
    it('should include workflow_id and group_id in error details', async () => {
      const workflowId = `${TEST_WORKFLOW_ID}-39`;
      const machine = await createStateMachine(workflowId, TEST_GROUP_ID);
      
      try {
        await machine.transition('complete');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as { details?: { workflow_id: string; group_id: string } }).details?.workflow_id).toBe(workflowId);
        expect((error as { details?: { workflow_id: string; group_id: string } }).details?.group_id).toBe(TEST_GROUP_ID);
      }
    });
  });
});