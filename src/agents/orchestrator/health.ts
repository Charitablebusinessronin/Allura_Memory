import type { AgentContainerManager, HealthCheckResult } from "../manager/container";

/**
 * Internal state for tracking container health
 */
export interface HealthState {
  containerId: string;
  healthy: boolean;
  status: string;
  consecutiveFailures: number;
  isUnhealthy?: boolean;
}

/**
 * Health summary for a container
 */
export interface HealthSummary extends HealthState {}

/**
 * Health Monitor for Agent Containers
 * Tracks health states, manages failure counts, and handles unhealthy containers
 */
export class HealthMonitor {
  private healthStates: Map<string, HealthState> = new Map();
  private containerManager: AgentContainerManager;
  private maxFailures: number;

  constructor(containerManager: AgentContainerManager, maxFailures: number = 3) {
    this.containerManager = containerManager;
    this.maxFailures = maxFailures;
  }

  /**
   * Check health of a specific container and update internal state
   */
  async checkContainerHealth(containerId: string): Promise<HealthState> {
    const result = await this.containerManager.healthCheck(containerId);
    const currentState = this.healthStates.get(containerId) || {
      containerId,
      healthy: true,
      status: "unknown",
      consecutiveFailures: 0,
    };

    let { healthy, status } = result;
    let consecutiveFailures = currentState.consecutiveFailures;

    if (healthy) {
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
    }

    const state: HealthState = {
      containerId,
      healthy,
      status,
      consecutiveFailures,
      isUnhealthy: consecutiveFailures >= this.maxFailures,
    };

    this.healthStates.set(containerId, state);
    return state;
  }

  /**
   * Handle an unhealthy container (e.g., restart it)
   */
  async handleUnhealthyContainer(containerId: string, timeout: number = 30000): Promise<void> {
    const state = this.healthStates.get(containerId);
    if (!state || !state.isUnhealthy) {
      return;
    }

    // Attempt to restart the container
    await this.containerManager.restartContainer(containerId);
    
    // We don't reset consecutiveFailures here, it will be reset on the next successful health check
  }

  /**
   * Start a monitoring loop for a set of containers
   * Returns a function to stop the loop
   */
  startMonitorLoop(intervalMs: number, containers: { id: string }[]): () => void {
    const interval = setInterval(async () => {
      for (const container of containers) {
        try {
          const state = await this.checkContainerHealth(container.id);
          if (state.isUnhealthy) {
            await this.handleUnhealthyContainer(container.id);
          }
        } catch (error) {
          console.error(`[HealthMonitor] Error checking container ${container.id}:`, error);
        }
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }

  /**
   * Get a summary of all tracked container health states
   */
  getHealthSummary(): HealthSummary[] {
    return Array.from(this.healthStates.values());
  }
}
