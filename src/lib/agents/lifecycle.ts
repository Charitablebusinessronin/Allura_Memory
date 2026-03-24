/**
 * Agent Lifecycle State Machine
 * Epic 6, Story 6.5: Implement Agent Lifecycle State Machine
 */

import { AgentPostgresClient, getAgentClient, AgentRecord } from './postgres-client';

export type AgentState = 'Draft' | 'Testing' | 'Active' | 'Deprecated' | 'Archived';

export interface TransitionRecord {
  id: string;
  agent_id: string;
  from_state: AgentState;
  to_state: AgentState;
  reason: string;
  approved_by?: string;
  created_at: Date;
}

export interface TransitionResult {
  agent_id: string;
  previous_state: AgentState;
  new_state: AgentState;
  reason: string;
  auto: boolean;
}

// State transition rules
const ALLOWED_TRANSITIONS: Record<AgentState, AgentState[]> = {
  'Draft': ['Testing'],
  'Testing': ['Active', 'Draft'],
  'Active': ['Deprecated'],
  'Deprecated': ['Archived'],
  'Archived': [] // Terminal state
};

// Auto-transition conditions
const AUTO_TRANSITIONS: Record<AgentState, { target: AgentState; condition: (agent: AgentRecord) => boolean }> = {
  'Draft': {
    target: 'Testing',
    condition: (agent) => agent.confidence_score >= 0.3
  },
  'Testing': {
    target: 'Active',
    condition: (agent) => agent.confidence_score >= 0.7
  },
  'Active': {
    target: 'Deprecated', // Only via explicit action
    condition: () => false
  },
  'Deprecated': {
    target: 'Archived',
    condition: (agent) => {
      const daysSinceUpdate = (Date.now() - new Date(agent.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate >= 90;
    }
  },
  'Archived': {
    target: 'Archived', // Terminal
    condition: () => false
  }
};

export class AgentLifecycle {
  private pgClient: AgentPostgresClient;

  constructor(pgClient?: AgentPostgresClient) {
    this.pgClient = pgClient || getAgentClient();
  }

  async transition(
    agentId: string,
    targetState: AgentState,
    reason: string,
    approvedBy?: string
  ): Promise<TransitionResult> {
    // Get current agent
    const agent = await this.pgClient.getAgent(agentId);
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const currentState = agent.status as AgentState;

    // Validate transition
    if (!this.isValidTransition(currentState, targetState)) {
      throw new Error(
        `Invalid transition: ${currentState} → ${targetState}. ` +
        `Allowed transitions: ${ALLOWED_TRANSITIONS[currentState].join(', ')}`
      );
    }

    // Check for human approval requirement
    if (currentState === 'Testing' && targetState === 'Active') {
      if (!approvedBy) {
        throw new Error('Human approval required for Testing → Active transition');
      }
    }

    // Update agent status
    await this.pgClient.updateAgent(agentId, { status: targetState });

    // Log transition
    await this.logTransition(agentId, currentState, targetState, reason, approvedBy);

    return {
      agent_id: agentId,
      previous_state: currentState,
      new_state: targetState,
      reason,
      auto: false
    };
  }

  async canTransition(agentId: string, targetState: AgentState): Promise<boolean> {
    const agent = await this.pgClient.getAgent(agentId);
    
    if (!agent) {
      return false;
    }

    const currentState = agent.status as AgentState;
    return this.isValidTransition(currentState, targetState);
  }

  async checkAutoTransition(agentId: string): Promise<AgentState | null> {
    const agent = await this.pgClient.getAgent(agentId);
    
    if (!agent) {
      return null;
    }

    const currentState = agent.status as AgentState;
    const autoTransition = AUTO_TRANSITIONS[currentState];

    if (autoTransition && autoTransition.condition(agent)) {
      // Check if transition is valid
      if (this.isValidTransition(currentState, autoTransition.target)) {
        return autoTransition.target;
      }
    }

    return null;
  }

  async runAutoTransitions(): Promise<TransitionResult[]> {
    const results: TransitionResult[] = [];

    // Get all agents
    const agents = await this.pgClient.listAgents({});

    for (const agent of agents) {
      const targetState = await this.checkAutoTransition(agent.agent_id);
      
      if (targetState) {
        const currentState = agent.status as AgentState;
        
        // Perform auto-transition
        await this.pgClient.updateAgent(agent.agent_id, { status: targetState });
        await this.logTransition(agent.agent_id, currentState, targetState, 'Auto-transition', undefined);

        results.push({
          agent_id: agent.agent_id,
          previous_state: currentState,
          new_state: targetState,
          reason: 'Auto-transition',
          auto: true
        });
      }
    }

    return results;
  }

  async getTransitionHistory(agentId: string): Promise<TransitionRecord[]> {
    // Query transition history from agent_versions table
    const result = await (this.pgClient as any).pool.query(
      `SELECT * FROM agent_versions WHERE agent_id = $1 ORDER BY created_at DESC`,
      [agentId]
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      agent_id: row.agent_id,
      from_state: 'Unknown', // We don't store from_state in current schema
      to_state: row.status,
      reason: row.notes || '',
      created_at: row.created_at
    }));
  }

  async getAgentsByState(state: AgentState): Promise<AgentRecord[]> {
    return this.pgClient.listAgents({ status: state });
  }

  async getActiveAgents(): Promise<AgentRecord[]> {
    return this.getAgentsByState('Active');
  }

  async getDeprecatedAgents(): Promise<AgentRecord[]> {
    return this.getAgentsByState('Deprecated');
  }

  async getAgentsReadyForPromotion(): Promise<AgentRecord[]> {
    // Agents in Testing state with confidence >= 0.7
    const agents = await this.pgClient.listAgents({ status: 'Testing' });
    return agents.filter(a => a.confidence_score >= 0.7);
  }

  async getAgentsNeedingApproval(): Promise<AgentRecord[]> {
    return this.getAgentsReadyForPromotion();
  }

  private isValidTransition(from: AgentState, to: AgentState): boolean {
    return ALLOWED_TRANSITIONS[from]?.includes(to) || false;
  }

  private async logTransition(
    agentId: string,
    fromState: AgentState,
    toState: AgentState,
    reason: string,
    approvedBy?: string
  ): Promise<void> {
    // Log is handled by PostgreSQL trigger on agent_versions table
    // But we can add additional logging here if needed
    console.log(`[${new Date().toISOString()}] Agent ${agentId}: ${fromState} → ${toState} (${reason})${approvedBy ? ` approved by ${approvedBy}` : ''}`);
  }
}

// Singleton instance
let lifecycleInstance: AgentLifecycle | null = null;

export function getAgentLifecycle(): AgentLifecycle {
  if (!lifecycleInstance) {
    lifecycleInstance = new AgentLifecycle();
  }
  return lifecycleInstance;
}