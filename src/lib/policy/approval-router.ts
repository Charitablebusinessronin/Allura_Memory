/**
 * Approval Router - Human-in-the-Loop Queue
 * Story 3.1: Mediate Tool Calls via Policy Gateway
 *
 * Manages approval requests for blocked actions, queuing them for
 * Mission Control review and supporting approval/denial workflow.
 */

import type {
  ApprovalRequest,
  ApprovalStatus,
  ApprovalResolution,
  ExecutionContext,
  RiskLevel,
} from "./types";
import type { ApprovalRouterInterface } from "./gateway";
import { randomUUID } from "crypto";

/**
 * In-memory storage for approval requests
 * In production, this would be backed by PostgreSQL
 */
class ApprovalStore {
  private requests: Map<string, ApprovalRequest> = new Map();
  private pendingQueue: string[] = [];

  add(request: ApprovalRequest): void {
    this.requests.set(request.id, request);
    this.pendingQueue.push(request.id);
  }

  get(id: string): ApprovalRequest | undefined {
    return this.requests.get(id);
  }

  getPending(): ApprovalRequest[] {
    return this.pendingQueue
      .map((id) => this.requests.get(id))
      .filter((r): r is ApprovalRequest => r !== undefined)
      .filter((r) => r.status === "pending");
  }

  getAll(): ApprovalRequest[] {
    return Array.from(this.requests.values());
  }

  update(id: string, updates: Partial<ApprovalRequest>): void {
    const request = this.requests.get(id);
    if (request) {
      this.requests.set(id, { ...request, ...updates });

      if (updates.status && updates.status !== "pending") {
        this.pendingQueue = this.pendingQueue.filter((qId) => qId !== id);
      }
    }
  }

  remove(id: string): void {
    this.requests.delete(id);
    this.pendingQueue = this.pendingQueue.filter((qId) => qId !== id);
  }

  clear(): void {
    this.requests.clear();
    this.pendingQueue = [];
  }
}

/**
 * Approval Router configuration
 */
export interface ApprovalRouterConfig {
  maxPendingApprovals: number;
  approvalTimeoutMs: number;
  enableExpiry: boolean;
  persistenceEnabled: boolean;
}

const DEFAULT_CONFIG: ApprovalRouterConfig = {
  maxPendingApprovals: 100,
  approvalTimeoutMs: 300000,
  enableExpiry: true,
  persistenceEnabled: false,
};

/**
 * Approval Router Implementation
 * Queues blocked actions for Mission Control review
 */
export class ApprovalRouter implements ApprovalRouterInterface {
  private store: ApprovalStore;
  private config: ApprovalRouterConfig;
  private expiryTimers: Map<string, NodeJS.Timeout> = new Map();
  private listeners: Set<ApprovalEventListener> = new Set();

  constructor(config: Partial<ApprovalRouterConfig> = {}) {
    this.store = new ApprovalStore();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Queue an action for approval
   */
  async queueApproval(request: {
    toolName: string;
    input: Record<string, unknown>;
    context: ExecutionContext;
    riskLevel: RiskLevel;
    reason: string;
  }): Promise<string> {
    const pending = this.store.getPending();
    if (pending.length >= this.config.maxPendingApprovals) {
      throw new Error(
        `Maximum pending approvals (${this.config.maxPendingApprovals}) reached`,
      );
    }

    const id = randomUUID();
    const approvalRequest: ApprovalRequest = {
      id,
      toolName: request.toolName,
      input: request.input,
      context: request.context,
      riskLevel: request.riskLevel,
      reason: request.reason,
      status: "pending",
      createdAt: new Date(),
    };

    this.store.add(approvalRequest);

    if (this.config.enableExpiry) {
      this.setExpiryTimer(id);
    }

    this.emit({
      type: "approval_requested",
      request: approvalRequest,
    });

    return id;
  }

  /**
   * Get all pending approvals
   */
  getPendingApprovals(): ApprovalRequest[] {
    return this.store.getPending();
  }

  /**
   * Get all approval requests (including resolved)
   */
  getAllApprovals(): ApprovalRequest[] {
    return this.store.getAll();
  }

  /**
   * Get a specific approval request
   */
  getApproval(id: string): ApprovalRequest | undefined {
    return this.store.get(id);
  }

  /**
   * Resolve an approval request
   */
  async resolveApproval(resolution: {
    requestId: string;
    approved: boolean;
    resolvedBy: string;
    justification: string;
  }): Promise<boolean> {
    const request = this.store.get(resolution.requestId);
    if (!request) {
      return false;
    }

    if (request.status !== "pending") {
      return false;
    }

    const status: ApprovalStatus = resolution.approved ? "approved" : "denied";
    const resolvedAt = new Date();

    this.store.update(resolution.requestId, {
      status,
      resolvedAt,
      resolvedBy: resolution.resolvedBy,
      justification: resolution.justification,
    });

    this.clearExpiryTimer(resolution.requestId);

    this.emit({
      type: resolution.approved ? "approval_granted" : "approval_denied",
      request: this.store.get(resolution.requestId)!,
      resolution: {
        requestId: resolution.requestId,
        approved: resolution.approved,
        resolvedBy: resolution.resolvedBy,
        justification: resolution.justification,
        resolvedAt,
      },
    });

    return true;
  }

  /**
   * Approve a request (convenience method)
   */
  async approve(
    requestId: string,
    resolvedBy: string,
    justification: string,
  ): Promise<boolean> {
    return this.resolveApproval({
      requestId,
      approved: true,
      resolvedBy,
      justification,
    });
  }

  /**
   * Deny a request (convenience method)
   */
  async deny(
    requestId: string,
    resolvedBy: string,
    justification: string,
  ): Promise<boolean> {
    return this.resolveApproval({
      requestId,
      approved: false,
      resolvedBy,
      justification,
    });
  }

  /**
   * Cancel a pending approval
   */
  cancelApproval(requestId: string): boolean {
    const request = this.store.get(requestId);
    if (!request || request.status !== "pending") {
      return false;
    }

    this.store.update(requestId, { status: "expired" });
    this.clearExpiryTimer(requestId);

    this.emit({
      type: "approval_expired",
      request: this.store.get(requestId)!,
    });

    return true;
  }

  /**
   * Get pending approvals by risk level
   */
  getPendingByRiskLevel(riskLevel: RiskLevel): ApprovalRequest[] {
    return this.store
      .getPending()
      .filter((r) => r.riskLevel === riskLevel);
  }

  /**
   * Get pending approvals by agent
   */
  getPendingByAgent(agentId: string): ApprovalRequest[] {
    return this.store
      .getPending()
      .filter((r) => r.context.agentId === agentId);
  }

  /**
   * Get pending approvals by group
   */
  getPendingByGroup(groupId: string): ApprovalRequest[] {
    return this.store
      .getPending()
      .filter((r) => r.context.groupId === groupId);
  }

  /**
   * Subscribe to approval events
   */
  subscribe(listener: ApprovalEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Clear all approval requests (for testing)
   */
  clear(): void {
    for (const timer of this.expiryTimers.values()) {
      clearTimeout(timer);
    }
    this.expiryTimers.clear();
    this.store.clear();
  }

  /**
   * Get pending count
   */
  getPendingCount(): number {
    return this.store.getPending().length;
  }

  /**
   * Export approvals for audit
   */
  exportAuditLog(): ApprovalRequest[] {
    return this.store.getAll().map((r) => ({ ...r }));
  }

  /**
   * Set expiry timer for approval request
   */
  private setExpiryTimer(id: string): void {
    const timer = setTimeout(() => {
      this.cancelApproval(id);
    }, this.config.approvalTimeoutMs);

    this.expiryTimers.set(id, timer);
  }

  /**
   * Clear expiry timer
   */
  private clearExpiryTimer(id: string): void {
    const timer = this.expiryTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.expiryTimers.delete(id);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: ApprovalEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("[ApprovalRouter] Event listener error:", error);
      }
    }
  }
}

/**
 * Approval event types
 */
export type ApprovalEventType =
  | "approval_requested"
  | "approval_granted"
  | "approval_denied"
  | "approval_expired";

/**
 * Approval event
 */
export interface ApprovalEvent {
  type: ApprovalEventType;
  request: ApprovalRequest;
  resolution?: ApprovalResolution;
}

/**
 * Event listener type
 */
export type ApprovalEventListener = (event: ApprovalEvent) => void;

/**
 * Create an approval router instance
 */
export function createApprovalRouter(
  config?: Partial<ApprovalRouterConfig>,
): ApprovalRouter {
  return new ApprovalRouter(config);
}

/**
 * Check if an approval request is pending
 */
export function isPendingApproval(request: ApprovalRequest): boolean {
  return request.status === "pending";
}

/**
 * Check if an approval request is resolved
 */
export function isResolvedApproval(request: ApprovalRequest): boolean {
  return request.status === "approved" || request.status === "denied";
}

/**
 * Check if an approval request has expired
 */
export function isExpiredApproval(request: ApprovalRequest): boolean {
  return request.status === "expired";
}