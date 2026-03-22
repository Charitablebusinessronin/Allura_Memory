/**
 * Circuit Breaker Alerting - Mission Control Integration
 * Story 3.6: Implement Circuit Breakers for Operational Safety
 *
 * Handles alerting and logging for circuit breaker events:
 * - Trip alerts to Mission Control
 * - Reset notifications
 * - PostgreSQL logging for audit trail
 */

import type {
  BreakerTripEvent,
  BreakerResetEvent,
  BreakerStateChangeEvent,
  BreakerTripCallback,
  BreakerResetCallback,
  BreakerStateChangeCallback,
  BreakerStateSnapshot,
} from "./types";
import { insertEvent, type EventInsert } from "../postgres/queries/insert-trace";

/**
 * Alert severity levels for Mission Control
 */
export type AlertSeverity = "info" | "warning" | "critical";

/**
 * Mission Control alert payload
 */
export interface MissionControlAlert {
  /** Alert ID */
  id: string;
  /** Breaker name */
  breakerName: string;
  /** Group/tenant ID */
  groupId: string;
  /** Alert type */
  type: "trip" | "reset" | "state_change";
  /** Severity */
  severity: AlertSeverity;
  /** Alert message */
  message: string;
  /** When alert was created */
  timestamp: Date;
  /** Additional context */
  context: {
    errorCount?: number;
    errorRate?: number;
    reason?: string;
    lastError?: string;
    resetBy?: string;
    justification?: string;
    stateSnapshot: BreakerStateSnapshot;
  };
  /** Acknowledgment status */
  acknowledged: boolean;
  /** Who acknowledged (if applicable) */
  acknowledgedBy?: string;
  /** When acknowledged */
  acknowledgedAt?: Date;
}

/**
 * Alert callback type
 */
export type AlertCallback = (alert: MissionControlAlert) => Promise<void> | void;

/**
 * In-memory alert queue for Mission Control
 * In production, this would integrate with a real-time notification system
 */
class AlertQueue {
  private alerts: Map<string, MissionControlAlert> = new Map();
  private callbacks: Set<AlertCallback> = new Set();
  private maxQueueSize: number;

  constructor(maxQueueSize: number = 1000) {
    this.maxQueueSize = maxQueueSize;
  }

  /**
   * Add an alert to the queue
   */
  async addAlert(alert: MissionControlAlert): Promise<void> {
    this.alerts.set(alert.id, alert);

    if (this.alerts.size > this.maxQueueSize) {
      const oldestKey = this.alerts.keys().next().value;
      if (oldestKey) {
        this.alerts.delete(oldestKey);
      }
    }

    for (const callback of this.callbacks) {
      try {
        await Promise.resolve(callback(alert));
      } catch (error) {
        console.error(`[AlertQueue] Callback error:`, error);
      }
    }
  }

  /**
   * Get all pending alerts
   */
  getPendingAlerts(): MissionControlAlert[] {
    return Array.from(this.alerts.values()).filter((a) => !a.acknowledged);
  }

  /**
   * Get all alerts (including acknowledged)
   */
  getAllAlerts(): MissionControlAlert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get alert by ID
   */
  getAlert(id: string): MissionControlAlert | undefined {
    return this.alerts.get(id);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    id: string,
    acknowledgedBy: string,
  ): Promise<boolean> {
    const alert = this.alerts.get(id);
    if (!alert) {
      return false;
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    return true;
  }

  /**
   * Register callback for alerts
   */
  onAlert(callback: AlertCallback): void {
    this.callbacks.add(callback);
  }

  /**
   * Remove callback
   */
  offAlert(callback: AlertCallback): void {
    this.callbacks.delete(callback);
  }
}

/**
 * Global alert queue instance
 */
const alertQueue = new AlertQueue();

/**
 * Generate unique alert ID
 */
function generateAlertId(): string {
  return `cb-alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Determine severity based on event type and context
 */
function determineSeverity(
  type: "trip" | "reset" | "state_change",
  event: BreakerTripEvent | BreakerResetEvent | BreakerStateChangeEvent,
): AlertSeverity {
  if (type === "trip") {
    const tripEvent = event as BreakerTripEvent;
    if (tripEvent.errorRate >= 80) return "critical";
    if (tripEvent.errorRate >= 50) return "warning";
    return "warning";
  }

  if (type === "reset") {
    return "info";
  }

  return "info";
}

/**
 * Generate human-readable alert message
 */
function generateAlertMessage(
  type: "trip" | "reset" | "state_change",
  event: BreakerTripEvent | BreakerResetEvent | BreakerStateChangeEvent,
): string {
  if (type === "trip") {
    const tripEvent = event as BreakerTripEvent;
    return `Circuit breaker "${tripEvent.name}" tripped for group "${tripEvent.groupId}". Error rate: ${tripEvent.errorRate.toFixed(1)}%, Consecutive errors: ${tripEvent.errorCount}`;
  }

  if (type === "reset") {
    const resetEvent = event as BreakerResetEvent;
    const resetBy = resetEvent.resetBy ? ` by ${resetEvent.resetBy}` : "";
    return `Circuit breaker "${resetEvent.name}" reset successfully${resetBy}.`;
  }

  const stateEvent = event as BreakerStateChangeEvent;
  return `Circuit breaker "${stateEvent.name}" state changed from ${stateEvent.fromState} to ${stateEvent.toState}`;
}

/**
 * Create a Mission Control alert from a trip event
 */
export function createTripAlert(event: BreakerTripEvent): MissionControlAlert {
  return {
    id: generateAlertId(),
    breakerName: event.name,
    groupId: event.groupId,
    type: "trip",
    severity: determineSeverity("trip", event),
    message: generateAlertMessage("trip", event),
    timestamp: event.timestamp,
    context: {
      errorCount: event.errorCount,
      errorRate: event.errorRate,
      reason: event.reason,
      lastError: event.lastError?.message,
      stateSnapshot: event.stateSnapshot,
    },
    acknowledged: false,
  };
}

/**
 * Create a Mission Control alert from a reset event
 */
export function createResetAlert(event: BreakerResetEvent): MissionControlAlert {
  return {
    id: generateAlertId(),
    breakerName: event.name,
    groupId: event.groupId,
    type: "reset",
    severity: determineSeverity("reset", event),
    message: generateAlertMessage("reset", event),
    timestamp: event.timestamp,
    context: {
      reason: event.reason,
      resetBy: event.resetBy,
      justification: event.justification,
      stateSnapshot: event.stateSnapshot,
    },
    acknowledged: false,
  };
}

/**
 * Create a Mission Control alert from a state change event
 */
export function createStateChangeAlert(event: BreakerStateChangeEvent): MissionControlAlert {
  return {
    id: generateAlertId(),
    breakerName: event.name,
    groupId: event.groupId,
    type: "state_change",
    severity: determineSeverity("state_change", event),
    message: generateAlertMessage("state_change", event),
    timestamp: event.timestamp,
    context: {
      reason: event.reason,
      stateSnapshot: {
        ...event,
        state: event.toState,
        name: event.name,
        groupId: event.groupId,
        consecutiveErrors: 0,
        consecutiveSuccesses: 0,
        totalCalls: 0,
        totalFailures: 0,
        totalSuccesses: 0,
        errorRate: 0,
        slowCalls: 0,
        tripCount: 0,
        config: {} as BreakerStateSnapshot["config"],
      },
    },
    acknowledged: false,
  };
}

/**
 * Log circuit breaker event to PostgreSQL for audit trail
 */
export async function logBreakerEventToPostgres(
  event: BreakerTripEvent | BreakerResetEvent | BreakerStateChangeEvent,
  eventType: "trip" | "reset" | "state_change",
): Promise<void> {
  try {
    const eventInsert: EventInsert = {
      group_id: event.groupId,
      event_type: `circuit_breaker_${eventType}`,
      agent_id: "circuit-breaker",
      metadata: {
        breakerName: event.name,
        eventType,
        reason: event.reason,
        timestamp: event.timestamp.toISOString(),
        stateSnapshot: "stateSnapshot" in event ? event.stateSnapshot : undefined,
      },
      status: "completed",
    };

    if (eventType === "trip") {
      const tripEvent = event as BreakerTripEvent;
      eventInsert.metadata = {
        ...eventInsert.metadata!,
        errorCount: tripEvent.errorCount,
        errorRate: tripEvent.errorRate,
        lastError: tripEvent.lastError?.message,
      };
    }

    if (eventType === "reset") {
      const resetEvent = event as BreakerResetEvent;
      eventInsert.metadata = {
        ...eventInsert.metadata!,
        resetBy: resetEvent.resetBy,
        justification: resetEvent.justification,
      };
    }

    await insertEvent(eventInsert);
  } catch (error) {
    console.error(`[CircuitBreaker] Failed to log event to PostgreSQL:`, error);
    throw error;
  }
}

/**
 * Create trip callback for Mission Control integration
 */
export function createTripAlertCallback(): BreakerTripCallback {
  return async (event: BreakerTripEvent): Promise<void> => {
    const alert = createTripAlert(event);
    await alertQueue.addAlert(alert);

    console.warn(
      `[CircuitBreaker] BREAKER TRIPPED: ${event.name} (group: ${event.groupId})`,
      `Error rate: ${event.errorRate.toFixed(1)}%`,
      `Consecutive errors: ${event.errorCount}`,
    );

    try {
      await logBreakerEventToPostgres(event, "trip");
    } catch (error) {
      console.error(`[CircuitBreaker] Failed to log trip event:`, error);
    }
  };
}

/**
 * Create reset callback for Mission Control integration
 */
export function createResetAlertCallback(): BreakerResetCallback {
  return async (event: BreakerResetEvent): Promise<void> => {
    const alert = createResetAlert(event);
    await alertQueue.addAlert(alert);

    console.info(
      `[CircuitBreaker] BREAKER RESET: ${event.name} (group: ${event.groupId})`,
      event.resetBy ? `by ${event.resetBy}` : "automatic",
    );

    try {
      await logBreakerEventToPostgres(event, "reset");
    } catch (error) {
      console.error(`[CircuitBreaker] Failed to log reset event:`, error);
    }
  };
}

/**
 * Create state change callback for Mission Control integration
 */
export function createStateChangeAlertCallback(): BreakerStateChangeCallback {
  return async (event: BreakerStateChangeEvent): Promise<void> => {
    const alert = createStateChangeAlert(event);
    await alertQueue.addAlert(alert);

    console.info(
      `[CircuitBreaker] STATE CHANGE: ${event.name}`,
      `${event.fromState} → ${event.toState}`,
      `reason: ${event.reason}`,
    );

    try {
      await logBreakerEventToPostgres(event, "state_change");
    } catch (error) {
      console.error(`[CircuitBreaker] Failed to log state change event:`, error);
    }
  };
}

/**
 * Get pending alerts from queue
 */
export function getPendingAlerts(): MissionControlAlert[] {
  return alertQueue.getPendingAlerts();
}

/**
 * Get all alerts from queue
 */
export function getAllAlerts(): MissionControlAlert[] {
  return alertQueue.getAllAlerts();
}

/**
 * Get specific alert by ID
 */
export function getAlert(id: string): MissionControlAlert | undefined {
  return alertQueue.getAlert(id);
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(
  id: string,
  acknowledgedBy: string,
): Promise<boolean> {
  return alertQueue.acknowledgeAlert(id, acknowledgedBy);
}

/**
 * Register callback for new alerts
 */
export function onAlert(callback: AlertCallback): void {
  alertQueue.onAlert(callback);
}

/**
 * Remove callback
 */
export function offAlert(callback: AlertCallback): void {
  alertQueue.offAlert(callback);
}

export { alertQueue };