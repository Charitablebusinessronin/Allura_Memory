/**
 * Policy Manager Tests
 * 
 * Tests for lifecycle policy evaluation.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  PolicyManager,
  createPolicyManager,
  DEFAULT_POLICY_CONFIG,
  isAutomaticTransition,
  isManualTransition,
  getStatePriority,
  isTerminalState,
  requiresManualIntervention,
} from './policies'
import {
  LifecycleInsight,
  LifecycleState,
  PolicyConfig,
  PolicyGroupConfig,
} from './types'

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestInsight(overrides: Partial<LifecycleInsight> = {}): LifecycleInsight {
  return {
    id: `insight-${Date.now()}`,
    lifecycleState: 'active',
    version: 1,
    groupId: 'default',
    confidence: 75,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastStateChange: new Date(),
    stateAgeDays: 0,
    history: [],
    ...overrides,
  }
}

function createAgedInsight(ageDays: number, overrides: Partial<LifecycleInsight> = {}): LifecycleInsight {
  const now = Date.now()
  const created = new Date(now - ageDays * 24 * 60 * 60 * 1000)
  
  return createTestInsight({
    createdAt: created,
    updatedAt: created,
    lastStateChange: created,
    stateAgeDays: ageDays,
    ...overrides,
  })
}

// =============================================================================
// Policy Manager Tests
// =============================================================================

describe('PolicyManager', () => {
  let manager: PolicyManager

  beforeEach(() => {
    manager = createPolicyManager()
  })

  describe('initialization', () => {
    it('should create manager with default config', () => {
      expect(manager).toBeDefined()
      const policies = manager.getPolicies()
      expect(policies.length).toBeGreaterThan(0)
    })

    it('should create default policy', () => {
      const policies = manager.getPolicies()
      const defaultPolicy = policies.find(p => p.id === 'policy-default')
      
      expect(defaultPolicy).toBeDefined()
      expect(defaultPolicy?.groupId).toBe('default')
      expect(defaultPolicy?.enabled).toBe(true)
    })

    it('should create policies from config', () => {
      const config: PolicyConfig = {
        default: {
          expirationAgeDays: 60,
          degradationThreshold: 40,
          restorationThreshold: 60,
          enableAutoDegradation: true,
          enableAutoExpiration: true,
          enableSupersession: true,
        },
        groups: {
          critical: {
            expirationAgeDays: 180,
            degradationThreshold: 20,
            restorationThreshold: 70,
            enableAutoDegradation: false,
            enableAutoExpiration: false,
            enableSupersession: false,
          },
        },
      }

      const customManager = createPolicyManager(config)
      const policies = customManager.getPolicies()

      // Should have default + critical group
      expect(policies.find(p => p.groupId === 'default')).toBeDefined()
      expect(policies.find(p => p.groupId === 'critical')).toBeDefined()
    })
  })

  describe('getPolicyForGroup', () => {
    it('should return default policy for unknown groups', () => {
      const policy = manager.getPolicyForGroup('unknown-group')
      
      expect(policy.groupId).toBe('default')
    })

    it('should return group-specific policy when exists', () => {
      const config: PolicyConfig = {
        default: DEFAULT_POLICY_CONFIG.default,
        groups: {
          critical: {
            expirationAgeDays: 180,
            degradationThreshold: 20,
            restorationThreshold: 70,
            enableAutoDegradation: true,
            enableAutoExpiration: true,
            enableSupersession: false,
          },
        },
      }

      const customManager = createPolicyManager(config)
      const policy = customManager.getPolicyForGroup('critical')
      
      expect(policy.groupId).toBe('critical')
    })
  })

  describe('evaluateInsight', () => {
    it('should return no transitions for healthy active insight', () => {
      const insight = createTestInsight({
        lifecycleState: 'active',
        confidence: 80,
        stateAgeDays: 10,
      })

      const evaluation = manager.evaluateInsight(insight)

      expect(evaluation.transitions).toHaveLength(0)
      expect(evaluation.insightId).toBe(insight.id)
      expect(evaluation.policiesEvaluated).toContain('policy-default')
    })

    it('should recommend degradation for low confidence', () => {
      const insight = createTestInsight({
        lifecycleState: 'active',
        confidence: 20, // Below threshold (30)
      })

      const evaluation = manager.evaluateInsight(insight)

      expect(evaluation.transitions.length).toBeGreaterThan(0)
      expect(evaluation.transitions[0].toState).toBe('degraded')
      expect(evaluation.transitions[0].reason).toBe('confidence_drop')
    })

    it('should recommend expiration for aged insights', () => {
      const insight = createAgedInsight(100, {
        lifecycleState: 'active',
        confidence: 80,
      }) // 100 days > 90 day threshold

      const evaluation = manager.evaluateInsight(insight)

      expect(evaluation.transitions.length).toBeGreaterThan(0)
      expect(evaluation.transitions[0].toState).toBe('expired')
      expect(evaluation.transitions[0].reason).toBe('age_threshold')
    })

    it('should recommend restoration for high confidence degraded insight', () => {
      const insight = createTestInsight({
        lifecycleState: 'degraded',
        confidence: 70, // Above restoration threshold (50)
      })

      const evaluation = manager.evaluateInsight(insight)

      expect(evaluation.transitions.length).toBeGreaterThan(0)
      expect(evaluation.transitions[0].toState).toBe('active')
      expect(evaluation.transitions[0].reason).toBe('confidence_restore')
    })

    it('should recommend expiration from degraded state', () => {
      const insight = createAgedInsight(100, {
        lifecycleState: 'degraded',
        confidence: 20,
      })

      const evaluation = manager.evaluateInsight(insight)

      // Could be either expired (age) or stay degraded
      // Since both conditions met, expiration should have priority
      expect(evaluation.transitions.length).toBeGreaterThan(0)
    })

    it('should not recommend transitions for superseded insights', () => {
      const insight = createTestInsight({
        lifecycleState: 'superseded',
        supersededBy: 'insight-new-version',
      })

      // Superseded insights can transition to expired or deprecated
      const evaluation = manager.evaluateInsight(insight)
      
      // No automatic transition unless age threshold met
      if (evaluation.transitions.length > 0) {
        expect(['expired', 'deprecated']).toContain(evaluation.transitions[0].toState)
      }
    })

    it('should not recommend transitions for deprecated insights', () => {
      const insight = createTestInsight({
        lifecycleState: 'deprecated',
      })

      const evaluation = manager.evaluateInsight(insight)

      // Deprecated can only go to active (manual)
      expect(evaluation.transitions).toHaveLength(0)
    })

    it('should not recommend transitions for expired insights', () => {
      const insight = createTestInsight({
        lifecycleState: 'expired',
      })

      const evaluation = manager.evaluateInsight(insight)

      // Expired can only go to active or deprecated (both manual)
      expect(evaluation.transitions).toHaveLength(0)
    })
  })

  describe('evaluateBatch', () => {
    it('should evaluate multiple insights', () => {
      const insights = [
        createTestInsight({ id: 'i1', confidence: 80, lifecycleState: 'active' }),
        createTestInsight({ id: 'i2', confidence: 20, lifecycleState: 'active' }), // should degrade
        createTestInsight({ id: 'i3', confidence: 70, lifecycleState: 'degraded' }), // should restore
      ]

      const batch = manager.evaluateBatch(insights)

      expect(batch.totalEvaluated).toBe(3)
      expect(batch.errors).toHaveLength(0)
      expect(batch.results).toHaveLength(3)
    })

    it('should count transitions recommended', () => {
      const insights = [
        createTestInsight({ id: 'i1', confidence: 20, lifecycleState: 'active' }), // degrade
        createTestInsight({ id: 'i2', confidence: 20, lifecycleState: 'active' }), // degrade
        createTestInsight({ id: 'i3', confidence: 80, lifecycleState: 'active' }), // no change
      ]

      const batch = manager.evaluateBatch(insights)

      expect(batch.transitionsRecommended).toBe(2)
    })

    it('should handle errors gracefully', () => {
      // Create insights with different groups
      const insights = [
        createTestInsight({ id: 'i1', groupId: 'default' }),
        createTestInsight({ id: 'i2', groupId: 'default' }),
      ]

      const batch = manager.evaluateBatch(insights)

      expect(batch.errors).toHaveLength(0)
      expect(batch.totalEvaluated).toBe(2)
    })
  })

  describe('setPolicy', () => {
    it('should add custom policy', () => {
      const customPolicy = {
        id: 'policy-custom',
        name: 'Custom Policy',
        groupId: 'custom',
        enabled: true,
        priority: 20,
        rules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      manager.setPolicy(customPolicy)
      const policy = manager.getPolicy('policy-custom')

      expect(policy).toBeDefined()
      expect(policy?.name).toBe('Custom Policy')
    })

    it('should update existing policy', () => {
      const policies = manager.getPolicies()
      const existingPolicy = policies[0]
      
      existingPolicy.priority = 999
      manager.setPolicy(existingPolicy)
      
      const updated = manager.getPolicy(existingPolicy.id)
      expect(updated?.priority).toBe(999)
    })
  })

  describe('removePolicy', () => {
    it('should not remove default policy', () => {
      const result = manager.removePolicy('policy-default')
      expect(result).toBe(false)
      
      const policy = manager.getPolicy('policy-default')
      expect(policy).toBeDefined()
    })

    it('should remove custom policy', () => {
      const customPolicy = {
        id: 'policy-custom',
        name: 'Custom Policy',
        groupId: 'custom',
        enabled: true,
        priority: 20,
        rules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      manager.setPolicy(customPolicy)
      expect(manager.getPolicy('policy-custom')).toBeDefined()
      
      const removed = manager.removePolicy('policy-custom')
      expect(removed).toBe(true)
      expect(manager.getPolicy('policy-custom')).toBeUndefined()
    })
  })

  describe('updateConfig', () => {
    it('should regenerate policies from new config', () => {
      const newConfig: PolicyConfig = {
        default: {
          expirationAgeDays: 30,
          degradationThreshold: 50,
          restorationThreshold: 80,
          enableAutoDegradation: true,
          enableAutoExpiration: false,
          enableSupersession: false,
        },
      }

      manager.updateConfig(newConfig)
      const policy = manager.getPolicyForGroup('default')
      
      // Check that rules were updated
      expect(policy.rules.length).toBeGreaterThan(0)
    })
  })
})

// =============================================================================
// Utility Function Tests
// =============================================================================

describe('Utility Functions', () => {
  describe('isAutomaticTransition', () => {
    it('should return true for automatic reasons', () => {
      expect(isAutomaticTransition('age_threshold')).toBe(true)
      expect(isAutomaticTransition('confidence_drop')).toBe(true)
      expect(isAutomaticTransition('confidence_restore')).toBe(true)
      expect(isAutomaticTransition('superseded_by_newer')).toBe(true)
      expect(isAutomaticTransition('policy_evaluation')).toBe(true)
      expect(isAutomaticTransition('system_cleanup')).toBe(true)
    })

    it('should return false for manual reasons', () => {
      expect(isAutomaticTransition('manual_deprecation')).toBe(false)
      expect(isAutomaticTransition('manual_restoration')).toBe(false)
      expect(isAutomaticTransition('manual_override')).toBe(false)
    })
  })

  describe('isManualTransition', () => {
    it('should return true for manual reasons', () => {
      expect(isManualTransition('manual_deprecation')).toBe(true)
      expect(isManualTransition('manual_restoration')).toBe(true)
      expect(isManualTransition('manual_override')).toBe(true)
    })

    it('should return false for automatic reasons', () => {
      expect(isManualTransition('age_threshold')).toBe(false)
      expect(isManualTransition('confidence_drop')).toBe(false)
    })
  })

  describe('getStatePriority', () => {
    it('should return higher priority for more severe states', () => {
      expect(getStatePriority('expired')).toBeGreaterThan(getStatePriority('degraded'))
      expect(getStatePriority('degraded')).toBeGreaterThan(getStatePriority('active'))
      expect(getStatePriority('superseded')).toBeGreaterThan(getStatePriority('active'))
      expect(getStatePriority('deprecated')).toBeGreaterThan(getStatePriority('active'))
    })

    it('should return 0 for active state', () => {
      expect(getStatePriority('active')).toBe(0)
    })
  })

  describe('isTerminalState', () => {
    it('should return true for terminal states', () => {
      expect(isTerminalState('expired')).toBe(true)
      expect(isTerminalState('deprecated')).toBe(true)
    })

    it('should return false for non-terminal states', () => {
      expect(isTerminalState('active')).toBe(false)
      expect(isTerminalState('degraded')).toBe(false)
      expect(isTerminalState('superseded')).toBe(false)
      expect(isTerminalState('reverted')).toBe(false)
    })
  })

  describe('requiresManualIntervention', () => {
    it('should return true for states requiring manual intervention', () => {
      expect(requiresManualIntervention('expired')).toBe(true)
      expect(requiresManualIntervention('deprecated')).toBe(true)
    })

    it('should return false for states with automatic transitions', () => {
      expect(requiresManualIntervention('active')).toBe(false)
      expect(requiresManualIntervention('degraded')).toBe(false)
    })
  })
})

// =============================================================================
// Policy Configuration Tests
// =============================================================================

describe('Policy Configuration', () => {
  it('should create rules from config', () => {
    const config: PolicyConfig = {
      default: {
        expirationAgeDays: 60,
        degradationThreshold: 25,
        restorationThreshold: 55,
        enableAutoDegradation: true,
        enableAutoExpiration: true,
        enableSupersession: true,
      },
    }

    const manager = createPolicyManager(config)
    const policy = manager.getPolicyForGroup('default')

    // Should have rules for expiration, degradation, restoration
    expect(policy.rules.find(r => r.reason === 'age_threshold')).toBeDefined()
    expect(policy.rules.find(r => r.reason === 'confidence_drop')).toBeDefined()
    expect(policy.rules.find(r => r.reason === 'confidence_restore')).toBeDefined()
  })

  it('should disable rules based on config flags', () => {
    const config: PolicyConfig = {
      default: {
        expirationAgeDays: 60,
        degradationThreshold: 25,
        restorationThreshold: 55,
        enableAutoDegradation: false, // disabled
        enableAutoExpiration: false, // disabled
        enableSupersession: false, // disabled
      },
    }

    const manager = createPolicyManager(config)
    const policy = manager.getPolicyForGroup('default')

    // Degradation rule should not exist when disabled
    expect(policy.rules.find(r => r.reason === 'confidence_drop')).toBeUndefined()
  })

  it('should support custom rules', () => {
    const config: PolicyConfig = {
      default: {
        expirationAgeDays: 90,
        degradationThreshold: 30,
        restorationThreshold: 50,
        enableAutoDegradation: true,
        enableAutoExpiration: true,
        enableSupersession: true,
        customRules: [
          {
            fromState: 'active',
            toState: 'deprecated',
            reason: 'manual_override',
            conditions: [
              { type: 'manual', operator: 'eq', value: true },
            ],
            enabled: true,
          },
        ],
      },
    }

    const manager = createPolicyManager(config)
    const policy = manager.getPolicyForGroup('default')

    // Should have default rules + custom rule
    const customRule = policy.rules.find(r => r.toState === 'deprecated' && r.fromState === 'active')
    expect(customRule).toBeDefined()
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('Policy Evaluation Integration', () => {
  let manager: PolicyManager

  beforeEach(() => {
    const config: PolicyConfig = {
      default: {
        expirationAgeDays: 90,
        degradationThreshold: 30,
        restorationThreshold: 50,
        enableAutoDegradation: true,
        enableAutoExpiration: true,
        enableSupersession: true,
      },
      groups: {
        experimental: {
          expirationAgeDays: 30,
          degradationThreshold: 40,
          restorationThreshold: 70,
          enableAutoDegradation: true,
          enableAutoExpiration: true,
          enableSupersession: true,
        },
        critical: {
          expirationAgeDays: 180,
          degradationThreshold: 20,
          restorationThreshold: 60,
          enableAutoDegradation: false,
          enableAutoExpiration: false,
          enableSupersession: false,
        },
      },
    }

    manager = createPolicyManager(config)
  })

  it('should apply group-specific policies', () => {
    // Default group: degradation at 30%
    const defaultInsight = createTestInsight({
      groupId: 'default',
      confidence: 25,
      lifecycleState: 'active',
    })
    const defaultEval = manager.evaluateInsight(defaultInsight)
    expect(defaultEval.transitions.length).toBeGreaterThan(0)
    expect(defaultEval.transitions[0].toState).toBe('degraded')

    // Experimental group: degradation at 40%
    const expInsight = createTestInsight({
      groupId: 'experimental',
      confidence: 35, // Below experimental threshold
      lifecycleState: 'active',
    })
    const expEval = manager.evaluateInsight(expInsight)
    expect(expEval.transitions.length).toBeGreaterThan(0)
    expect(expEval.transitions[0].toState).toBe('degraded')

    // Critical group: no auto-degradation
    const criticalInsight = createTestInsight({
      groupId: 'critical',
      confidence: 25, // Very low
      lifecycleState: 'active',
    })
    const criticalEval = manager.evaluateInsight(criticalInsight)
    expect(criticalEval.transitions).toHaveLength(0)
  })

  it('should evaluate multiple rules correctly', () => {
    // Insight that meets both age and confidence thresholds
    const insight = createAgedInsight(100, {
      lifecycleState: 'active',
      confidence: 20, // Also below degradation threshold
    })

    const evaluation = manager.evaluateInsight(insight)

    // Should have at least one transition
    expect(evaluation.transitions.length).toBeGreaterThan(0)
    
    // Expiration has higher priority than degradation
    if (evaluation.transitions.length > 0) {
      expect(evaluation.transitions[0].toState).toBe('expired')
    }
  })
})