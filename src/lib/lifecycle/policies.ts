/**
 * Lifecycle Policies
 * 
 * Evaluates policies for automatic state transitions.
 */

import {
  LifecycleState,
  LifecyclePolicy,
  LifecycleInsight,
  PolicyConfig,
  PolicyGroupConfig,
  TransitionRule,
  TransitionCondition,
  PolicyEvaluation,
  RecommendedTransition,
  BatchEvaluation,
  TransitionReason,
  TRANSITION_REASONS,
} from './types'

// =============================================================================
// Default Policy Configuration
// =============================================================================

/**
 * Default policy configuration
 */
export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  default: {
    expirationAgeDays: 90,
    degradationThreshold: 30,
    restorationThreshold: 50,
    enableAutoDegradation: true,
    enableAutoExpiration: true,
    enableSupersession: true,
  },
}

/**
 * Default policy rules generated from configuration
 */
function createDefaultRules(config: PolicyGroupConfig, groupId: string): TransitionRule[] {
  const rules: TransitionRule[] = []

  // Age-based expiration from active
  if (config.enableAutoExpiration) {
    rules.push({
      id: `${groupId}-expire-active`,
      fromState: 'active',
      toState: 'expired',
      conditions: [
        { type: 'age_days', operator: 'gte', value: config.expirationAgeDays },
      ],
      reason: 'age_threshold',
      enabled: true,
    })

    // Age-based expiration from degraded
    rules.push({
      id: `${groupId}-expire-degraded`,
      fromState: 'degraded',
      toState: 'expired',
      conditions: [
        { type: 'age_days', operator: 'gte', value: config.expirationAgeDays },
      ],
      reason: 'age_threshold',
      enabled: true,
    })

    // Age-based expiration from superseded
    if (config.enableSupersession) {
      rules.push({
        id: `${groupId}-expire-superseded`,
        fromState: 'superseded',
        toState: 'expired',
        conditions: [
          { type: 'age_days', operator: 'gte', value: config.expirationAgeDays },
        ],
        reason: 'age_threshold',
        enabled: true,
      })
    }
  }

  // Confidence-based degradation from active
  if (config.enableAutoDegradation) {
    rules.push({
      id: `${groupId}-degrade-active`,
      fromState: 'active',
      toState: 'degraded',
      conditions: [
        { type: 'confidence', operator: 'lt', value: config.degradationThreshold },
      ],
      reason: 'confidence_drop',
      enabled: true,
    })
  }

  // Confidence restoration from degraded
  rules.push({
    id: `${groupId}-restore-degraded`,
    fromState: 'degraded',
    toState: 'active',
    conditions: [
      { type: 'confidence', operator: 'gte', value: config.restorationThreshold },
    ],
    reason: 'confidence_restore',
    enabled: true,
  })

  return rules
}

// =============================================================================
// Policy Manager Class
// =============================================================================

/**
 * Policy Manager
 * 
 * Manages lifecycle policies and evaluates insights against them.
 */
export class PolicyManager {
  private policies: Map<string, LifecyclePolicy> = new Map()
  private config: PolicyConfig

  constructor(config: PolicyConfig = DEFAULT_POLICY_CONFIG) {
    this.config = config
    this.initializeDefaultPolicies()
  }

  /**
   * Initialize default policies from configuration
   */
  private initializeDefaultPolicies(): void {
    // Create default policy
    const defaultPolicy = this.createPolicyFromConfig(this.config.default, 'default')
    this.policies.set(defaultPolicy.id, defaultPolicy)

    // Create group-specific policies
    if (this.config.groups) {
      for (const [groupId, groupConfig] of Object.entries(this.config.groups)) {
        const policy = this.createPolicyFromConfig(groupConfig, groupId)
        this.policies.set(policy.id, policy)
      }
    }
  }

  /**
   * Create a policy from group configuration
   */
  private createPolicyFromConfig(config: PolicyGroupConfig, groupId: string): LifecyclePolicy {
    const rules = createDefaultRules(config, groupId)
    
    // Add custom rules
    if (config.customRules) {
      let ruleIndex = rules.length
      for (const rule of config.customRules) {
        rules.push({
          ...rule,
          id: `${groupId}-custom-${ruleIndex++}`,
          enabled: rule.enabled ?? true,
        })
      }
    }

    const policy: LifecyclePolicy = {
      id: `policy-${groupId}`,
      name: `Default Policy for ${groupId}`,
      description: `Auto-generated policy for group ${groupId}`,
      groupId,
      enabled: true,
      priority: groupId === 'default' ? 0 : 10,
      rules,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    return policy
  }

  /**
   * Get all policies
   */
  getPolicies(): LifecyclePolicy[] {
    return Array.from(this.policies.values())
  }

  /**
   * Get policy by ID
   */
  getPolicy(id: string): LifecyclePolicy | undefined {
    return this.policies.get(id)
  }

  /**
   * Get policy for a group
   */
  getPolicyForGroup(groupId: string): LifecyclePolicy {
    // Try group-specific policy first
    const groupPolicy = this.policies.get(`policy-${groupId}`)
    if (groupPolicy) return groupPolicy

    // Fall back to default
    const defaultPolicy = this.policies.get('policy-default')
    if (!defaultPolicy) {
      throw new Error('No default policy found')
    }
    return defaultPolicy
  }

  /**
   * Add or update a policy
   */
  setPolicy(policy: LifecyclePolicy): void {
    policy.updatedAt = new Date()
    this.policies.set(policy.id, policy)
  }

  /**
   * Remove a policy
   */
  removePolicy(id: string): boolean {
    // Don't allow removing default policy
    if (id === 'policy-default') {
      return false
    }
    return this.policies.delete(id)
  }

  /**
   * Evaluate a condition against an insight
   */
  private evaluateCondition(
    condition: TransitionCondition,
    insight: LifecycleInsight
  ): boolean {
    let result: boolean

    switch (condition.type) {
      case 'age_days': {
        const ageDays = this.calculateAgeDays(insight)
        result = this.compareValue(ageDays, condition.operator, condition.value as number)
        break
      }

      case 'confidence': {
        result = this.compareValue(
          insight.confidence,
          condition.operator,
          condition.value as number
        )
        break
      }

      case 'has_newer_version': {
        result = insight.supersededBy !== undefined
        break
      }

      case 'manual': {
        result = condition.value as boolean
        break
      }

      default:
        result = false
    }

    // Apply negation if specified
    if (condition.negate) {
      result = !result
    }

    return result
  }

  /**
   * Compare values with operator
   */
  private compareValue(
    actual: number,
    operator: TransitionCondition['operator'],
    expected: number
  ): boolean {
    switch (operator) {
      case 'gt': return actual > expected
      case 'gte': return actual >= expected
      case 'lt': return actual < expected
      case 'lte': return actual <= expected
      case 'eq': return actual === expected
      case 'neq': return actual !== expected
      default: return false
    }
  }

  /**
   * Calculate age in days for an insight
   */
  private calculateAgeDays(insight: LifecycleInsight): number {
    const now = Date.now()
    const created = insight.createdAt.getTime()
    return Math.floor((now - created) / (1000 * 60 * 60 * 24))
  }

  /**
   * Evaluate a rule against an insight
   */
  private evaluateRule(
    rule: TransitionRule,
    insight: LifecycleInsight
  ): boolean {
    if (!rule.enabled) return false
    if (rule.fromState !== insight.lifecycleState) return false

    // All conditions must be met
    return rule.conditions.every(condition => 
      this.evaluateCondition(condition, insight)
    )
  }

  /**
   * Evaluate an insight against its policy
   */
  evaluateInsight(insight: LifecycleInsight): PolicyEvaluation {
    const startTime = Date.now()
    const transitions: RecommendedTransition[] = []
    const policiesEvaluated: string[] = []

    // Get applicable policy
    const policy = this.getPolicyForGroup(insight.groupId)
    policiesEvaluated.push(policy.id)

    // Sort rules by priority (descending) and evaluate
    const sortedRules = [...policy.rules]
      .filter(r => r.enabled)
      .sort((a, b) => {
        // Prioritize transitions to more severe states
        const statePriority: Record<LifecycleState, number> = {
          'expired': 4,
          'superseded': 3,
          'deprecated': 2,
          'degraded': 1,
          'active': 0,
          'reverted': -1,
        }
        return (statePriority[b.toState] ?? 0) - (statePriority[a.toState] ?? 0)
      })

    for (const rule of sortedRules) {
      if (this.evaluateRule(rule, insight)) {
        transitions.push({
          toState: rule.toState,
          reason: rule.reason,
          policyId: policy.id,
          ruleId: rule.id,
          confidence: 1.0, // Full confidence for rule-based evaluation
          priority: policy.priority,
        })

        // Only return the highest priority transition
        break
      }
    }

    const durationMs = Date.now() - startTime

    return {
      insightId: insight.id,
      insight,
      policiesEvaluated,
      transitions,
      evaluatedAt: new Date(),
      durationMs,
    }
  }

  /**
   * Evaluate multiple insights
   */
  evaluateBatch(insights: LifecycleInsight[]): BatchEvaluation {
    const startTime = Date.now()
    const results: PolicyEvaluation[] = []
    const errors: Array<{ insightId: string; error: string }> = []
    let transitionsRecommended = 0

    for (const insight of insights) {
      try {
        const evaluation = this.evaluateInsight(insight)
        results.push(evaluation)
        if (evaluation.transitions.length > 0) {
          transitionsRecommended++
        }
      } catch (error) {
        errors.push({
          insightId: insight.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const durationMs = Date.now() - startTime

    return {
      totalEvaluated: insights.length,
      transitionsRecommended,
      errors,
      results,
      durationMs,
    }
  }

  /**
   * Update configuration and regenerate policies
   */
  updateConfig(config: PolicyConfig): void {
    this.config = config
    this.policies.clear()
    this.initializeDefaultPolicies()
  }

  /**
   * Get current configuration
   */
  getConfig(): PolicyConfig {
    return JSON.parse(JSON.stringify(this.config))
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a policy manager
 */
export function createPolicyManager(config?: PolicyConfig): PolicyManager {
  return new PolicyManager(config)
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a transition reason is automatic (not manual)
 */
export function isAutomaticTransition(reason: TransitionReason): boolean {
  const automaticReasons: TransitionReason[] = [
    'age_threshold',
    'confidence_drop',
    'confidence_restore',
    'superseded_by_newer',
    'policy_evaluation',
    'system_cleanup',
  ]
  return automaticReasons.includes(reason)
}

/**
 * Check if a transition is manual
 */
export function isManualTransition(reason: TransitionReason): boolean {
  return !isAutomaticTransition(reason)
}

/**
 * Get priority for a state (higher = more severe)
 */
export function getStatePriority(state: LifecycleState): number {
  const priorities: Record<LifecycleState, number> = {
    'expired': 100,
    'superseded': 80,
    'deprecated': 60,
    'degraded': 40,
    'reverted': 20,
    'active': 0,
  }
  return priorities[state] ?? 0
}

/**
 * Check if a state is terminal (no automatic exits)
 */
export function isTerminalState(state: LifecycleState): boolean {
  const terminalStates: LifecycleState[] = ['expired', 'deprecated']
  return terminalStates.includes(state)
}

/**
 * Check if a state requires manual intervention to exit
 */
export function requiresManualIntervention(state: LifecycleState): boolean {
  return isTerminalState(state)
}

// =============================================================================
// Default Export
// =============================================================================

export default PolicyManager