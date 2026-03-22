/**
 * Lifecycle State Machine Validator
 * 
 * Enforces valid state transitions for insight lifecycle.
 * Prevents corrupt state transitions like Proposed→Revoked or Rejected→Approved.
 */

import type { InsightStatus } from "./types";

export type { InsightStatus };

/**
 * Valid state transitions for insight lifecycle.
 * 
 * Key invariants:
 * - Only Approved insights can be revoked
 * - Terminal states (Rejected, Superseded, Revoked) have no outgoing transitions
 * - Proposed can only transition to Pending Review (via promotion)
 */
const VALID_TRANSITIONS: Record<InsightStatus, InsightStatus[]> = {
  "Proposed": ["Pending Review"],
  "Pending Review": ["Approved", "Rejected", "Superseded"],
  "Approved": ["Superseded", "Revoked"],
  "Rejected": [], // Terminal
  "Superseded": [], // Terminal
  "Revoked": [], // Terminal
};

/**
 * Checks if a transition from currentStatus to targetStatus is valid.
 */
export function isValidTransition(
  currentStatus: InsightStatus,
  targetStatus: InsightStatus,
): boolean {
  const allowedTargets = VALID_TRANSITIONS[currentStatus];
  if (!allowedTargets) {
    return false;
  }
  return allowedTargets.includes(targetStatus);
}

/**
 * Returns all valid target states from the given current state.
 */
export function getValidTransitions(currentStatus: InsightStatus): InsightStatus[] {
  return [...VALID_TRANSITIONS[currentStatus]];
}

/**
 * Validates a transition and throws with helpful context if invalid.
 * 
 * @throws Error with message explaining why transition is invalid
 */
export function validateTransition(
  currentStatus: InsightStatus,
  targetStatus: InsightStatus,
): void {
  if (isValidTransition(currentStatus, targetStatus)) {
    return;
  }

  const validTargets = VALID_TRANSITIONS[currentStatus];
  
  if (validTargets.length === 0) {
    throw new Error(
      `Invalid transition: Cannot change status from terminal state '${currentStatus}' to '${targetStatus}'. ` +
      `'${currentStatus}' is a terminal state with no valid outgoing transitions.`
    );
  }

  throw new Error(
    `Invalid transition: Cannot change status from '${currentStatus}' to '${targetStatus}'. ` +
      `Valid transitions from '${currentStatus}' are: ${validTargets.join(", ")}. ` +
      `To reach '${targetStatus}', the insight must first be in one of the states that can transition to it.`
  );
}

/**
 * Checks if a status is a terminal state (no transitions out).
 */
export function isTerminalStatus(status: InsightStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

/**
 * Checks if a status allows revocation (only Approved does).
 */
export function canBeRevoked(status: InsightStatus): boolean {
  return isValidTransition(status, "Revoked");
}

/**
 * Checks if a status allows superseding (Pending Review and Approved).
 */
export function canBeSuperseded(status: InsightStatus): boolean {
  return isValidTransition(status, "Superseded");
}

/**
 * Checks if a status allows approval (only Pending Review).
 */
export function canBeApproved(status: InsightStatus): boolean {
  return isValidTransition(status, "Approved");
}

/**
 * Checks if a status allows rejection (only Pending Review).
 */
export function canBeRejected(status: InsightStatus): boolean {
  return isValidTransition(status, "Rejected");
}

/**
 * Returns a human-readable description of the lifecycle state machine.
 */
export function getLifecycleDescription(): string {
  return `
Insight Lifecycle State Machine:

Proposed → Pending Review (via promotion to Notion)
  └─ Insights start here when created in Neo4j

Pending Review → Approved | Rejected | Superseded
  └─ Human review decides final state

Approved → Superseded | Revoked
  └─ Active knowledge can be replaced or withdrawn

Rejected → (terminal)
  └─ Rejected insights cannot transition

Superseded → (terminal)
  └─ Replaced insights cannot transition

Revoked → (terminal)
  └─ Withdrawn insights cannot transition
`.trim();
}