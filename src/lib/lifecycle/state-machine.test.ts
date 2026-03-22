/**
 * State Machine Tests
 * 
 * Tests for lifecycle state transitions and validation.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  LifecycleStateMachine,
  createStateMachine,
  isValidTransition,
  getAllowedReasons,
  isValidReason,
} from './state-machine'
import { LifecycleState, TransitionReason, LIFECYCLE_STATES } from './types'

// =============================================================================
// Test Fixtures
// =============================================================================

const ALL_STATES: LifecycleState[] = ['active', 'degraded', 'expired', 'superseded', 'deprecated', 'reverted']

// =============================================================================
// Transition Validation Tests
// =============================================================================

describe('Transition Validation', () => {
  describe('isValidTransition', () => {
    it('should allow initial transition to active', () => {
      expect(isValidTransition(null, 'active')).toBe(true)
    })

    it('should reject initial transition to non-active states', () => {
      expect(isValidTransition(null, 'degraded')).toBe(false)
      expect(isValidTransition(null, 'expired')).toBe(false)
      expect(isValidTransition(null, 'superseded')).toBe(false)
      expect(isValidTransition(null, 'deprecated')).toBe(false)
    })

    it('should allow valid transitions from active', () => {
      expect(isValidTransition('active', 'degraded')).toBe(true)
      expect(isValidTransition('active', 'expired')).toBe(true)
      expect(isValidTransition('active', 'superseded')).toBe(true)
      expect(isValidTransition('active', 'deprecated')).toBe(true)
    })

    it('should reject invalid transitions from active', () => {
      // Can't go back to active from active (no-op)
      expect(isValidTransition('active', 'active')).toBe(false)
      // Can't go to reverted directly
      expect(isValidTransition('active', 'reverted')).toBe(false)
    })

    it('should allow valid transitions from degraded', () => {
      expect(isValidTransition('degraded', 'active')).toBe(true)
      expect(isValidTransition('degraded', 'expired')).toBe(true)
      expect(isValidTransition('degraded', 'deprecated')).toBe(true)
    })

    it('should reject invalid transitions from degraded', () => {
      expect(isValidTransition('degraded', 'degraded')).toBe(false)
      expect(isValidTransition('degraded', 'superseded')).toBe(false)
      expect(isValidTransition('degraded', 'reverted')).toBe(false)
    })

    it('should allow valid transitions from expired', () => {
      expect(isValidTransition('expired', 'active')).toBe(true)
      expect(isValidTransition('expired', 'deprecated')).toBe(true)
    })

    it('should reject invalid transitions from expired', () => {
      expect(isValidTransition('expired', 'expired')).toBe(false)
      expect(isValidTransition('expired', 'degraded')).toBe(false)
      expect(isValidTransition('expired', 'superseded')).toBe(false)
    })

    it('should allow valid transitions from superseded', () => {
      expect(isValidTransition('superseded', 'active')).toBe(true)
      expect(isValidTransition('superseded', 'expired')).toBe(true)
      expect(isValidTransition('superseded', 'deprecated')).toBe(true)
    })

    it('should reject invalid transitions from superseded', () => {
      expect(isValidTransition('superseded', 'superseded')).toBe(false)
      expect(isValidTransition('superseded', 'degraded')).toBe(false)
    })

    it('should allow valid transitions from deprecated', () => {
      expect(isValidTransition('deprecated', 'active')).toBe(true)
    })

    it('should reject invalid transitions from deprecated', () => {
      expect(isValidTransition('deprecated', 'deprecated')).toBe(false)
      expect(isValidTransition('deprecated', 'expired')).toBe(false)
      expect(isValidTransition('deprecated', 'degraded')).toBe(false)
      expect(isValidTransition('deprecated', 'superseded')).toBe(false)
    })

    it('should allow transitions from reverted to various states', () => {
      expect(isValidTransition('reverted', 'active')).toBe(true)
      expect(isValidTransition('reverted', 'degraded')).toBe(true)
      expect(isValidTransition('reverted', 'expired')).toBe(true)
      expect(isValidTransition('reverted', 'superseded')).toBe(true)
    })
  })

  describe('getAllowedReasons', () => {
    it('should return empty array for invalid transitions', () => {
      expect(getAllowedReasons(null, 'expired')).toEqual([])
      expect(getAllowedReasons('active', 'active')).toEqual([])
    })

    it('should return allowed reasons for active -> degraded', () => {
      const reasons = getAllowedReasons('active', 'degraded')
      expect(reasons).toContain('confidence_drop')
      expect(reasons).toContain('policy_evaluation')
      expect(reasons).toContain('manual_override')
    })

    it('should return allowed reasons for active -> expired', () => {
      const reasons = getAllowedReasons('active', 'expired')
      expect(reasons).toContain('age_threshold')
      expect(reasons).toContain('policy_evaluation')
      expect(reasons).toContain('system_cleanup')
      expect(reasons).toContain('manual_override')
    })

    it('should return allowed reasons for degraded -> active', () => {
      const reasons = getAllowedReasons('degraded', 'active')
      expect(reasons).toContain('confidence_restore')
      expect(reasons).toContain('manual_restoration')
      expect(reasons).toContain('manual_override')
    })

    it('should return allowed reasons for superseded transition', () => {
      const reasons = getAllowedReasons('active', 'superseded')
      expect(reasons).toContain('superseded_by_newer')
      expect(reasons).toContain('manual_override')
    })
  })

  describe('isValidReason', () => {
    it('should return true for valid reasons', () => {
      expect(isValidReason('active', 'degraded', 'confidence_drop')).toBe(true)
      expect(isValidReason('active', 'expired', 'age_threshold')).toBe(true)
      expect(isValidReason('degraded', 'active', 'confidence_restore')).toBe(true)
      expect(isValidReason('deprecated', 'active', 'manual_restoration')).toBe(true)
    })

    it('should return false for invalid reasons', () => {
      // Wrong reason for transition
      expect(isValidReason('active', 'degraded', 'age_threshold')).toBe(false)
      // Manual override is valid for all
      expect(isValidReason('active', 'degraded', 'manual_override')).toBe(true)
    })
  })
})

// =============================================================================
// State Machine Tests
// =============================================================================

describe('LifecycleStateMachine', () => {
  let machine: LifecycleStateMachine

  beforeEach(() => {
    machine = createStateMachine()
  })

  describe('initialization', () => {
    it('should create a new state machine', () => {
      expect(machine).toBeDefined()
    })

    it('should start with no insights', () => {
      expect(machine.hasInsight('insight-1')).toBe(false)
      expect(machine.getCurrentState('insight-1')).toBe(null)
    })
  })

  describe('initializeInsight', () => {
    it('should initialize an insight to active state', () => {
      const result = machine.initializeInsight('insight-1')
      
      expect(result.success).toBe(true)
      expect(result.newState).toBe('active')
      expect(result.previousState).toBe(null)
      expect(result.event).toBeDefined()
      expect(result.event?.reason).toBe('manual_override')
    })

    it('should record initial transition in history', () => {
      machine.initializeInsight('insight-1')
      const history = machine.getHistory('insight-1')
      
      expect(history).toHaveLength(1)
      expect(history[0].fromState).toBe(null)
      expect(history[0].toState).toBe('active')
    })

    it('should allow custom triggeredBy', () => {
      const result = machine.initializeInsight('insight-1', { 
        triggeredBy: 'user-123',
        confidence: 85 
      })
      
      expect(result.event?.triggeredBy).toBe('user-123')
      expect(result.event?.confidence).toBe(85)
    })
  })

  describe('transition', () => {
    it('should transition from active to degraded', () => {
      machine.initializeInsight('insight-1')
      
      const result = machine.transition('insight-1', 'degraded', 'confidence_drop', {
        confidence: 25,
        triggeredBy: 'policy-engine',
      })
      
      expect(result.success).toBe(true)
      expect(result.newState).toBe('degraded')
      expect(result.previousState).toBe('active')
      expect(result.event?.confidence).toBe(25)
    })

    it('should transition from degraded back to active', () => {
      machine.initializeInsight('insight-1')
      machine.transition('insight-1', 'degraded', 'confidence_drop')
      
      const result = machine.transition('insight-1', 'active', 'confidence_restore', {
        confidence: 75,
      })
      
      expect(result.success).toBe(true)
      expect(result.newState).toBe('active')
    })

    it('should reject invalid transitions', () => {
      machine.initializeInsight('insight-1')
      
      const result = machine.transition('insight-1', 'active', 'manual_override')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid transition')
    })

    it('should reject transitions with wrong reason', () => {
      machine.initializeInsight('insight-1')
      
      // Try to use wrong reason for active -> degraded
      const result = machine.transition('insight-1', 'degraded', 'age_threshold')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid reason')
    })

    it('should allow manual override for any valid transition', () => {
      machine.initializeInsight('insight-1')
      
      const result = machine.transition('insight-1', 'deprecated', 'manual_override', {
        triggeredBy: 'admin',
      })
      
      expect(result.success).toBe(true)
      expect(result.newState).toBe('deprecated')
    })

    it('should track state changes across multiple transitions', () => {
      machine.initializeInsight('insight-1')
      
      // Active -> Degraded
      machine.transition('insight-1', 'degraded', 'confidence_drop')
      expect(machine.getCurrentState('insight-1')).toBe('degraded')
      
      // Degraded -> Expired
      machine.transition('insight-1', 'expired', 'age_threshold')
      expect(machine.getCurrentState('insight-1')).toBe('expired')
      
      // Expired -> Active (manual restoration)
      machine.transition('insight-1', 'active', 'manual_restoration')
      expect(machine.getCurrentState('insight-1')).toBe('active')
      
      // Check history
      const history = machine.getHistory('insight-1')
      expect(history).toHaveLength(4)
    })
  })

  describe('validateTransition', () => {
    it('should return valid for correct transitions', () => {
      machine.initializeInsight('insight-1')
      
      const validation = machine.validateTransition('insight-1', 'degraded', 'confidence_drop')
      
      expect(validation.valid).toBe(true)
      expect(validation.allowedReasons).toContain('confidence_drop')
    })

    it('should return invalid for incorrect transitions', () => {
      machine.initializeInsight('insight-1')
      
      const validation = machine.validateTransition('insight-1', 'active', 'manual_override')
      
      expect(validation.valid).toBe(false)
      expect(validation.error).toBeDefined()
    })

    it('should provide allowed reasons in validation', () => {
      machine.initializeInsight('insight-1')
      
      const validation = machine.validateTransition('insight-1', 'expired', 'wrong_reason')
      
      expect(validation.valid).toBe(false)
      expect(validation.allowedReasons.length).toBeGreaterThan(0)
      expect(validation.allowedReasons).toContain('age_threshold')
    })
  })

  describe('revertTransition', () => {
    it('should revert the last transition', () => {
      machine.initializeInsight('insight-1')
      machine.transition('insight-1', 'degraded', 'confidence_drop')
      
      const result = machine.revertTransition('insight-1')
      
      expect(result.success).toBe(true)
      expect(result.newState).toBe('active')
      expect(result.previousState).toBe('degraded')
    })

    it('should fail to revert initial transition', () => {
      machine.initializeInsight('insight-1')
      
      const result = machine.revertTransition('insight-1')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot revert')
    })

    it('should fail to revert with no history', () => {
      const result = machine.revertTransition('unknown-insight')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('No transitions')
    })
  })

  describe('getInsightsInState', () => {
    it('should return empty array when no insights', () => {
      expect(machine.getInsightsInState('active')).toEqual([])
    })

    it('should return insights in specific state', () => {
      machine.initializeInsight('insight-1')
      machine.initializeInsight('insight-2')
      machine.initializeInsight('insight-3')
      
      machine.transition('insight-2', 'degraded', 'confidence_drop')
      machine.transition('insight-3', 'expired', 'age_threshold')
      
      const activeInsights = machine.getInsightsInState('active')
      const degradedInsights = machine.getInsightsInState('degraded')
      const expiredInsights = machine.getInsightsInState('expired')
      
      expect(activeInsights).toEqual(['insight-1'])
      expect(degradedInsights).toEqual(['insight-2'])
      expect(expiredInsights).toEqual(['insight-3'])
    })
  })

  describe('history', () => {
    it('should record all transitions in history', () => {
      machine.initializeInsight('insight-1')
      machine.transition('insight-1', 'degraded', 'confidence_drop')
      machine.transition('insight-1', 'expired', 'age_threshold')
      
      const history = machine.getHistory('insight-1')
      
      expect(history).toHaveLength(3)
      expect(history[0].toState).toBe('active')
      expect(history[1].fromState).toBe('active')
      expect(history[1].toState).toBe('degraded')
      expect(history[2].fromState).toBe('degraded')
      expect(history[2].toState).toBe('expired')
    })

    it('should include all event details in history', () => {
      machine.initializeInsight('insight-1', { 
        triggeredBy: 'user-123',
        confidence: 90 
      })
      
      const history = machine.getHistory('insight-1')
      const event = history[0]
      
      expect(event.insightId).toBe('insight-1')
      expect(event.triggeredBy).toBe('user-123')
      expect(event.confidence).toBe(90)
      expect(event.timestamp).toBeInstanceOf(Date)
    })

    it('should preserve order of transitions', () => {
      machine.initializeInsight('insight-1')
      
      // Create multiple transitions with small delays
      const states: LifecycleState[] = ['degraded', 'active', 'expired', 'active', 'deprecated']
      for (const state of states) {
        machine.transition('insight-1', state, 'manual_override')
      }
      
      const history = machine.getHistory('insight-1')
      expect(history).toHaveLength(6) // initial + 5 transitions
      expect(history[0].toState).toBe('active') // initial
      expect(history[history.length - 1].toState).toBe('deprecated')
    })
  })

  describe('export/import', () => {
    it('should export state correctly', () => {
      machine.initializeInsight('insight-1')
      machine.transition('insight-1', 'degraded', 'confidence_drop')
      
      const exported = machine.export()
      
      expect(exported.states['insight-1']).toBe('degraded')
      expect(exported.history['insight-1']).toHaveLength(2)
    })

    it('should import state correctly', () => {
      // Create a machine with state
      machine.initializeInsight('insight-1')
      machine.transition('insight-1', 'degraded', 'confidence_drop')
      const exported = machine.export()
      
      // Create new machine and import
      const newMachine = createStateMachine()
      newMachine.import(exported)
      
      expect(newMachine.getCurrentState('insight-1')).toBe('degraded')
      expect(newMachine.getHistory('insight-1')).toHaveLength(2)
    })

    it('should clear state on clear', () => {
      machine.initializeInsight('insight-1')
      machine.transition('insight-1', 'degraded', 'confidence_drop')
      
      machine.clear()
      
      expect(machine.hasInsight('insight-1')).toBe(false)
      expect(machine.getHistory('insight-1')).toHaveLength(0)
    })
  })
})

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('createStateMachine', () => {
  it('should create a new state machine', () => {
    const machine = createStateMachine()
    expect(machine).toBeInstanceOf(LifecycleStateMachine)
  })

  it('should create independent machines', () => {
    const machine1 = createStateMachine()
    const machine2 = createStateMachine()
    
    machine1.initializeInsight('insight-1')
    
    expect(machine1.hasInsight('insight-1')).toBe(true)
    expect(machine2.hasInsight('insight-1')).toBe(false)
  })
})

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  let machine: LifecycleStateMachine

  beforeEach(() => {
    machine = createStateMachine()
  })

  it('should handle non-existent insight queries', () => {
    expect(machine.getCurrentState('non-existent')).toBe(null)
    expect(machine.getHistory('non-existent')).toEqual([])
    expect(machine.hasInsight('non-existent')).toBe(false)
  })

  it('should handle multiple rapid transitions', () => {
    machine.initializeInsight('insight-1')
    
    for (let i = 0; i < 100; i++) {
      machine.transition('insight-1', 'degraded', 'confidence_drop')
      machine.transition('insight-1', 'active', 'confidence_restore')
    }
    
    const history = machine.getHistory('insight-1')
    expect(history).toHaveLength(201) // initial + 200 transitions
  })

  it('should handle concurrent insights independently', () => {
    machine.initializeInsight('insight-1')
    machine.initializeInsight('insight-2')
    machine.initializeInsight('insight-3')
    
    machine.transition('insight-1', 'degraded', 'confidence_drop')
    machine.transition('insight-3', 'expired', 'age_threshold')
    
    expect(machine.getCurrentState('insight-1')).toBe('degraded')
    expect(machine.getCurrentState('insight-2')).toBe('active')
    expect(machine.getCurrentState('insight-3')).toBe('expired')
  })

  it('should handle transition with all optional fields', () => {
    machine.initializeInsight('insight-1')
    
    const result = machine.transition('insight-1', 'degraded', 'confidence_drop', {
      triggeredBy: 'policy-engine',
      details: { reason: 'Confidence dropped below threshold', previousConfidence: 80, newConfidence: 20 },
      policyId: 'policy-123',
      confidence: 20,
      ageDays: 30,
    })
    
    expect(result.success).toBe(true)
    expect(result.event?.triggeredBy).toBe('policy-engine')
    expect(result.event?.policyId).toBe('policy-123')
    expect(result.event?.confidence).toBe(20)
    expect(result.event?.ageDays).toBe(30)
    expect(result.event?.details).toBeDefined()
  })
})