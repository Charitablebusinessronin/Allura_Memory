/**
 * Mission Control Escalation Service
 * Story 3.3: Implement Fail-Safe Termination and Escalation
 */

import type { Pool } from "pg";
import { getPool } from "../postgres/connection";
import type {
  EscalationTicket,
  EscalationConfig,
  EscalationChannel,
  NotificationRecord,
  ProgressSummary,
} from "./types";
import { DEFAULT_ESCALATION_CONFIG } from "./types";
import type { HaltReason, SessionId } from "../budget/types";
import type { SummaryGenerator } from "./summary-generator";

/**
 * Escalation service configuration
 */
export interface EscalationServiceConfig {
  /** Escalation configuration */
  escalation: EscalationConfig;
  /** Database table for tickets */
  ticketTable: string;
  /** Enable async notifications (don't block on send) */
  asyncNotifications: boolean;
  /** Notification timeout in milliseconds */
  notificationTimeoutMs: number;
}

/**
 * Default escalation service configuration
 */
const DEFAULT_SERVICE_CONFIG: EscalationServiceConfig = {
  escalation: DEFAULT_ESCALATION_CONFIG,
  ticketTable: "escalation_tickets",
  asyncNotifications: true,
  notificationTimeoutMs: 5000,
};

/**
 * In-memory ticket store (for testing)
 */
const ticketStore: Map<string, EscalationTicket> = new Map();

/**
 * Clear the ticket store (for testing)
 */
export function clearTicketStore(): void {
  ticketStore.clear();
}

/**
 * Notification handlers by channel type
 */
type NotificationHandler = (
  ticket: EscalationTicket,
  summary: ProgressSummary,
  config: Record<string, unknown>,
) => Promise<NotificationRecord>;

/**
 * Mission Control Escalation Service
 * Handles escalation tickets and notifications for terminated sessions
 */
export class EscalationService {
  private config: EscalationServiceConfig;
  private pool: Pool | null = null;
  private summaryGenerator: SummaryGenerator | null = null;
  private notificationHandlers: Map<string, NotificationHandler> = new Map();

  constructor(
    config?: Partial<EscalationServiceConfig>,
    summaryGenerator?: SummaryGenerator,
  ) {
    this.config = { ...DEFAULT_SERVICE_CONFIG, ...config };
    this.summaryGenerator = summaryGenerator ?? null;

    // Register default notification handlers
    this.registerNotificationHandler("in_app", this.sendInAppNotification.bind(this));
    this.registerNotificationHandler("email", this.sendEmailNotification.bind(this));
    this.registerNotificationHandler("slack", this.sendSlackNotification.bind(this));
    this.registerNotificationHandler("webhook", this.sendWebhookNotification.bind(this));
  }

  /**
   * Create an escalation ticket from a terminated session
   */
  async createTicket(
    sessionId: SessionId,
    haltReason: HaltReason,
    summary: ProgressSummary,
  ): Promise<EscalationTicket> {
    const id = this.generateTicketId();
    const priority = this.determinePriority(haltReason, summary);

    const ticket: EscalationTicket = {
      id,
      summaryId: summary.id,
      createdAt: new Date(),
      priority,
      title: this.generateTitle(haltReason, summary),
      description: this.generateDescription(haltReason, summary),
      session: {
        groupId: sessionId.groupId,
        agentId: sessionId.agentId,
        sessionId: sessionId.sessionId,
      },
      escalationReason: this.determineEscalationReason(haltReason, summary),
      traceRefs: [summary.traceRef],
      suggestedActions: this.generateSuggestedActions(haltReason, summary),
      status: "open",
      notifications: [],
    };

    // Persist ticket
    if (this.config.escalation.enabled && typeof window === "undefined") {
      await this.persistTicket(ticket);
    } else {
      ticketStore.set(ticket.id, ticket);
    }

    return ticket;
  }

  /**
   * Escalate to Mission Control with notifications
   */
  async escalate(
    ticket: EscalationTicket,
    summary: ProgressSummary,
  ): Promise<EscalationTicket> {
    if (!this.config.escalation.enabled) {
      return ticket;
    }

    // Send notifications via configured channels
    const notifications: NotificationRecord[] = [];

    for (const channel of this.config.escalation.channels) {
      if (!channel.enabled) continue;

      try {
        const handler = this.notificationHandlers.get(channel.type);
        if (!handler) {
          console.warn(`[EscalationService] No handler for channel type: ${channel.type}`);
          continue;
        }

        const notification = await this.sendWithTimeout(
          handler(ticket, summary, channel.config),
          this.config.notificationTimeoutMs,
        );

        notifications.push(notification);
      } catch (error) {
        notifications.push({
          channel: channel.type,
          recipient: this.getRecipient(channel),
          sentAt: new Date(),
          success: false,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Update ticket with notifications
    ticket.notifications = notifications;

    // Persist updated ticket
    if (this.config.escalation.enabled && typeof window === "undefined") {
      await this.persistTicket(ticket);
    } else {
      ticketStore.set(ticket.id, ticket);
    }

    return ticket;
  }

  /**
   * Resolve an escalation ticket
   */
  async resolveTicket(
    ticketId: string,
    resolution: EscalationTicket["resolution"],
  ): Promise<EscalationTicket | null> {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) return null;

    ticket.status = "resolved";
    ticket.resolution = resolution;

    if (this.config.escalation.enabled && typeof window === "undefined") {
      await this.persistTicket(ticket);
    } else {
      ticketStore.set(ticket.id, ticket);
    }

    return ticket;
  }

  /**
   * Get a ticket by ID
   */
  async getTicket(ticketId: string): Promise<EscalationTicket | null> {
    if (!this.config.escalation.enabled) {
      return ticketStore.get(ticketId) ?? null;
    }

    return this.loadTicket(ticketId);
  }

  /**
   * List tickets for a group (tenant)
   */
  async listTickets(groupId: string, status?: EscalationTicket["status"], limit: number = 50): Promise<EscalationTicket[]> {
    if (!this.config.escalation.enabled) {
      let tickets = Array.from(ticketStore.values()).filter(t => t.session.groupId === groupId);
      if (status) {
        tickets = tickets.filter(t => t.status === status);
      }
      return tickets.slice(0, limit);
    }

    return this.loadTicketsByGroup(groupId, status, limit);
  }

  /**
   * Acknowledge a ticket (mark as being worked on)
   */
  async acknowledgeTicket(ticketId: string, acknowledgedBy: string): Promise<EscalationTicket | null> {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) return null;

    ticket.status = "acknowledged";
    ticket.assignedTo = acknowledgedBy;

    if (this.config.escalation.enabled && typeof window === "undefined") {
      await this.persistTicket(ticket);
    } else {
      ticketStore.set(ticket.id, ticket);
    }

    return ticket;
  }

  /**
   * Check if a human can take over from where the session left off
   */
  canTakeOver(ticket: EscalationTicket): boolean {
    // Tickets that can be taken over must be open or acknowledged
    if (ticket.status === "resolved" || ticket.status === "dismissed") {
      return false;
    }

    // Critical errors need investigation before takeover
    const isCritical = ticket.escalationReason.toLowerCase().includes("critical");
    if (isCritical && ticket.status === "open") {
      return false; // Needs acknowledgment first
    }

    return true;
  }

  /**
   * Check if session can be restarted
   */
  canRestart(ticket: EscalationTicket): boolean {
    // Can't restart resolved or dismissed tickets
    if (ticket.status === "resolved" || ticket.status === "dismissed") {
      return false;
    }

    // Policy violations need policy adjustment before restart
    const isPolicyViolation = ticket.escalationReason.toLowerCase().includes("policy");
    if (isPolicyViolation) {
      return false;
    }

    return true;
  }

  /**
   * Get recommended actions for a ticket
   */
  getRecommendedActions(ticket: EscalationTicket): {
    canTakeOver: boolean;
    canRestart: boolean;
    canModifyBudget: boolean;
    canModifyPolicy: boolean;
    canCancel: boolean;
    recommendedAction: string;
  } {
    const isPolicyViolation = ticket.escalationReason.toLowerCase().includes("policy");
    const isBudgetExceeded = ticket.escalationReason.toLowerCase().includes("budget") || 
                             ticket.escalationReason.toLowerCase().includes("limit");

    return {
      canTakeOver: this.canTakeOver(ticket),
      canRestart: this.canRestart(ticket),
      canModifyBudget: isBudgetExceeded,
      canModifyPolicy: isPolicyViolation,
      canCancel: ticket.status === "open",
      recommendedAction: this.getRecommendedAction(ticket),
    };
  }

  /**
   * Register a custom notification handler
   */
  registerNotificationHandler(
    channelType: string,
    handler: NotificationHandler,
  ): void {
    this.notificationHandlers.set(channelType, handler);
  }

  // Private methods

  private generateTicketId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `esc_${timestamp}_${random}`;
  }

  private determinePriority(haltReason: HaltReason, summary: ProgressSummary): EscalationTicket["priority"] {
    // Critical errors always get high priority
    if (haltReason.type === "critical_error") {
      return "critical";
    }

    // Policy violations need human review
    if (haltReason.type === "policy_violation") {
      return "high";
    }

    // High bottleneck severity
    if (summary.bottlenecks.some(b => b.type === "policy_violation" || b.type === "state_corruption")) {
      return "high";
    }

    // Stuck patterns with high severity
    if (summary.stuckPatterns.some(p => p.severity >= 4)) {
      return "medium";
    }

    // High resource utilization
    if (summary.progress.budgetUtilization.tokens > 95 || 
        summary.progress.budgetUtilization.steps > 95) {
      return "medium";
    }

    return "low";
  }

  private generateTitle(haltReason: HaltReason, summary: ProgressSummary): string {
    const percentComplete = summary.progress.percentComplete;
    const reason = haltReason.type.replace(/_/g, " ");

    return `Session ${summary.sessionId.sessionId.slice(0, 8)} terminated (${reason}) at ${percentComplete}%`;
  }

  private generateDescription(haltReason: HaltReason, summary: ProgressSummary): string {
    const lines: string[] = [
      `Session terminated due to: ${haltReason.type}`,
      ``,
      `**Session Details:**`,
      `- Group: ${summary.sessionId.groupId}`,
      `- Agent: ${summary.sessionId.agentId}`,
      `- Session: ${summary.sessionId.sessionId}`,
      `- Progress: ${summary.progress.percentComplete}%`,
      `- Steps: ${summary.progress.stepsCompleted}/${summary.progress.stepBudget}`,
      ``,
      `**Termination Details:**`,
      summary.termination.explanation,
    ];

    if (summary.bottlenecks.length > 0) {
      lines.push(``, `**Bottlenecks:**`);
      for (const b of summary.bottlenecks) {
        lines.push(`- ${b.type}: ${b.description}`);
      }
    }

    if (summary.stuckPatterns.length > 0) {
      lines.push(``, `**Stuck Patterns:**`);
      for (const p of summary.stuckPatterns) {
        lines.push(`- ${p.type}: ${p.description}`);
      }
    }

    return lines.join("\n");
  }

  private determineEscalationReason(haltReason: HaltReason, summary: ProgressSummary): string {
    const reason: string[] = [];

    switch (haltReason.type) {
      case "kmax_exceeded":
        reason.push("Exceeded maximum step limit");
        if (summary.stuckPatterns.length > 0) {
          reason.push(`with ${summary.stuckPatterns.length} stuck pattern(s) detected`);
        }
        break;
      
      case "token_limit":
        reason.push("Exceeded token budget limit");
        break;
      
      case "tool_call_limit":
        reason.push("Exceeded tool call limit");
        break;
      
      case "time_limit":
        reason.push("Exceeded time limit");
        break;
      
      case "cost_limit":
        reason.push("Exceeded cost limit");
        break;
      
      case "policy_violation":
        reason.push(`Policy violation: ${haltReason.reason}`);
        break;
      
      case "critical_error":
        reason.push(`Critical error: ${haltReason.error}`);
        break;
      
      default:
        reason.push("Unknown termination reason");
    }

    if (summary.bottlenecks.length > 0) {
      reason.push(`. ${summary.bottlenecks.length} bottleneck(s) identified.`);
    }

    return reason.join(" ");
  }

  private generateSuggestedActions(haltReason: HaltReason, summary: ProgressSummary): string[] {
    const actions: string[] = [];

    // Start with recommendations from summary
    actions.push(...summary.recommendations);

    // Add escalation-specific actions
    if (haltReason.type === "policy_violation") {
      actions.push("Review and adjust policy constraints in Mission Control");
      actions.push("Verify action aligns with security requirements");
    }

    if (haltReason.type === "critical_error") {
      actions.push("Check system logs for error details");
      actions.push("Verify external service availability");
      actions.push("Consider rollback or state reset");
    }

    if (haltReason.type === "kmax_exceeded" || haltReason.type === "token_limit" || haltReason.type === "time_limit") {
      actions.push("Consider increasing resource limits");
      actions.push("Break task into smaller subtasks");
    }

    if (summary.stuckPatterns.length > 0) {
      actions.push("Investigate stuck patterns before retrying");
    }

    // Deduplicate
    return [...new Set(actions)].slice(0, 10);
  }

  private getRecommendedAction(ticket: EscalationTicket): string {
    if (ticket.priority === "critical") {
      return "Immediate investigation required. Acknowledge ticket and assign team member.";
    }

    if (ticket.escalationReason.toLowerCase().includes("policy")) {
      return "Review policy constraints before resuming. Manual override may be required.";
    }

    if (ticket.escalationReason.toLowerCase().includes("budget") || 
        ticket.escalationReason.toLowerCase().includes("limit")) {
      return "Consider increasing limits or adjusting goal scope. Session can be restarted.";
    }

    if (ticket.escalationReason.toLowerCase().includes("error")) {
      return "Investigate error cause before proceeding. May require debug session.";
    }

    return "Review termination summary and take appropriate action.";
  }

  private getRecipient(channel: EscalationChannel): string {
    switch (channel.type) {
      case "email":
        return (channel.config.recipient as string) ?? "oncall@example.com";
      case "slack":
        return (channel.config.channel as string) ?? "#escalations";
      case "webhook":
        return (channel.config.url as string) ?? "webhook endpoint";
      case "in_app":
        return "Mission Control Dashboard";
      default:
        return "unknown";
    }
  }

  private async sendWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    if (!this.config.asyncNotifications) {
      return promise;
    }

    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Notification timeout")), timeoutMs);
    });

    return Promise.race([promise, timeout]);
  }

  // Notification handlers

  private async sendInAppNotification(
    ticket: EscalationTicket,
    summary: ProgressSummary,
    config: Record<string, unknown>,
  ): Promise<NotificationRecord> {
    // In-app notifications are stored in database for Mission Control dashboard
    const record: NotificationRecord = {
      channel: "in_app",
      recipient: "Mission Control Dashboard",
      sentAt: new Date(),
      success: true,
    };

    // In production, this would push to a real-time notification system
    // For now, the ticket persistence serves as the notification
    console.log(`[EscalationService] In-app notification for ticket ${ticket.id}: ${ticket.title}`);

    return record;
  }

  private async sendEmailNotification(
    ticket: EscalationTicket,
    summary: ProgressSummary,
    config: Record<string, unknown>,
  ): Promise<NotificationRecord> {
    const recipient = (config.recipient as string) ?? "oncall@example.com";
    
    // In production, integrate with email service
    // For now, log the email content
    console.log(`[EscalationService] Email to ${recipient}:`);
    console.log(`  Subject: [${ticket.priority.toUpperCase()}] ${ticket.title}`);
    console.log(`  Body: ${ticket.description}`);

    return {
      channel: "email",
      recipient,
      sentAt: new Date(),
      success: true,
    };
  }

  private async sendSlackNotification(
    ticket: EscalationTicket,
    summary: ProgressSummary,
    config: Record<string, unknown>,
  ): Promise<NotificationRecord> {
    const channel = (config.channel as string) ?? "#escalations";
    const webhookUrl = config.webhookUrl as string | undefined;

    // In production, would call Slack API
    // For now, log the Slack message
    const slackMessage = this.formatSlackMessage(ticket, summary);
    console.log(`[EscalationService] Slack ${channel}:`);
    console.log(slackMessage);

    // If webhook URL provided, would POST to it
    if (webhookUrl && this.config.asyncNotifications) {
      try {
        // Simulated webhook call - in production, use fetch
        console.log(`[EscalationService] Would POST to webhook: ${webhookUrl}`);
      } catch (error) {
        return {
          channel: "slack",
          recipient: channel,
          sentAt: new Date(),
          success: false,
          errorMessage: error instanceof Error ? error.message : "Webhook failed",
        };
      }
    }

    return {
      channel: "slack",
      recipient: channel,
      sentAt: new Date(),
      success: true,
    };
  }

  private formatSlackMessage(ticket: EscalationTicket, summary: ProgressSummary): string {
    const priorityEmoji = {
      critical: "🔴",
      high: "🟠",
      medium: "🟡",
      low: "🟢",
    };

    const emoji = priorityEmoji[ticket.priority];
    
    const lines: string[] = [
      `${emoji} *ESCALATION: ${ticket.priority.toUpperCase()}*`,
      ``,
      `*${ticket.title}*`,
      ``,
      `Session: \`${ticket.session.sessionId}\``,
      `Group: ${ticket.session.groupId}`,
      `Progress: ${summary.progress.percentComplete}%`,
      ``,
      `*Reason:* ${ticket.escalationReason}`,
      ``,
      `*Suggested Actions:*`,
      ...ticket.suggestedActions.slice(0, 3).map(a => `• ${a}`),
      ``,
      `Trace: ${summary.traceRef}`,
    ];

    return lines.join("\n");
  }

  private async sendWebhookNotification(
    ticket: EscalationTicket,
    summary: ProgressSummary,
    config: Record<string, unknown>,
  ): Promise<NotificationRecord> {
    const url = config.url as string;
    
    if (!url) {
      return {
        channel: "webhook",
        recipient: "unknown",
        sentAt: new Date(),
        success: false,
        errorMessage: "No webhook URL configured",
      };
    }

    // In production, would POST to webhook
    console.log(`[EscalationService] Webhook to ${url}:`);
    console.log(JSON.stringify({ ticket, summary }, null, 2));

    return {
      channel: "webhook",
      recipient: url,
      sentAt: new Date(),
      success: true,
    };
  }

  // Persistence methods

  private async persistTicket(ticket: EscalationTicket): Promise<void> {
    try {
      const pool = await this.getPoolConnection();

      const query = `
        INSERT INTO ${this.config.ticketTable} (
          id,
          summary_id,
          created_at,
          priority,
          title,
          description,
          session,
          escalation_reason,
          trace_refs,
          suggested_actions,
          status,
          assigned_to,
          notifications
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          assigned_to = EXCLUDED.assigned_to,
          notifications = EXCLUDED.notifications
      `;

      const sessionIdStr = `${ticket.session.groupId}:${ticket.session.agentId}:${ticket.session.sessionId}`;

      await pool.query(query, [
        ticket.id,
        ticket.summaryId,
        ticket.createdAt,
        ticket.priority,
        ticket.title,
        ticket.description,
        JSON.stringify(sessionIdStr),
        ticket.escalationReason,
        JSON.stringify(ticket.traceRefs),
        JSON.stringify(ticket.suggestedActions),
        ticket.status,
        ticket.assignedTo ?? null,
        JSON.stringify(ticket.notifications),
      ]);
    } catch (error) {
      console.error("[EscalationService] Failed to persist ticket:", error);
      // Don't throw - notifications should not block
    }
  }

  private async loadTicket(ticketId: string): Promise<EscalationTicket | null> {
    try {
      const pool = await this.getPoolConnection();

      const query = `SELECT * FROM ${this.config.ticketTable} WHERE id = $1`;
      const result = await pool.query(query, [ticketId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToTicket(result.rows[0]);
    } catch (error) {
      console.error("[EscalationService] Failed to load ticket:", error);
      return null;
    }
  }

  private async loadTicketsByGroup(
    groupId: string,
    status: EscalationTicket["status"] | undefined,
    limit: number,
  ): Promise<EscalationTicket[]> {
    try {
      const pool = await this.getPoolConnection();

      let query = `SELECT * FROM ${this.config.ticketTable} WHERE session->>'groupId' = $1`;
      const params: unknown[] = [groupId];

      if (status) {
        query += ` AND status = $2`;
        params.push(status);
      }

      query += ` ORDER BY created_at DESC LIMIT ${limit}`;

      const result = await pool.query(query, params);

      return result.rows.map(row => this.rowToTicket(row));
    } catch (error) {
      console.error("[EscalationService] Failed to load tickets:", error);
      return [];
    }
  }

  private async getPoolConnection(): Promise<Pool> {
    if (!this.pool) {
      this.pool = getPool();
    }
    return this.pool;
  }

  private rowToTicket(row: Record<string, unknown>): EscalationTicket {
    const sessionIdStr = row.session as string;
    const sessionIdParts = sessionIdStr.split(":");

    return {
      id: row.id as string,
      summaryId: row.summary_id as string,
      createdAt: row.created_at as Date,
      priority: row.priority as EscalationTicket["priority"],
      title: row.title as string,
      description: row.description as string,
      session: {
        groupId: sessionIdParts[0] ?? "",
        agentId: sessionIdParts[1] ?? "",
        sessionId: sessionIdParts[2] ?? "",
      },
      escalationReason: row.escalation_reason as string,
      traceRefs: (row.trace_refs as string[]) ?? [],
      suggestedActions: (row.suggested_actions as string[]) ?? [],
      status: row.status as EscalationTicket["status"],
      assignedTo: row.assigned_to as string | undefined,
      notifications: (row.notifications as NotificationRecord[]) ?? [],
    };
  }
}

/**
 * Create an escalation service instance
 */
export function createEscalationService(
  config?: Partial<EscalationServiceConfig>,
  summaryGenerator?: SummaryGenerator,
): EscalationService {
  return new EscalationService(config, summaryGenerator);
}

/**
 * Convenience function to escalate a terminated session
 */
export async function escalateTerminatedSession(
  sessionId: SessionId,
  haltReason: HaltReason,
  state: { groupId: string; agentId: string; sessionId: string },
  config?: Partial<EscalationServiceConfig>,
): Promise<EscalationTicket | null> {
  const service = createEscalationService(config);

  // Create minimal summary for escalation
  const summary: ProgressSummary = {
    id: `sum_${Date.now()}`,
    sessionId: state,
    generatedAt: new Date(),
    goal: {
      description: "Session terminated",
      type: "unknown",
      successCriteria: [],
      constraints: [],
    },
    progress: {
      stepsCompleted: 0,
      stepBudget: 0,
      percentComplete: 0,
      tokensUsed: 0,
      tokenBudget: 0,
      timeElapsedMs: 0,
      timeBudgetMs: 0,
      budgetUtilization: { tokens: 0, toolCalls: 0, time: 0, cost: 0, steps: 0 },
    },
    bottlenecks: [],
    attemptedSteps: [],
    stuckPatterns: [],
    partialResults: [],
    termination: {
      reason: haltReason,
      expected: haltReason.type !== "critical_error",
      resumable: haltReason.type !== "critical_error" && haltReason.type !== "policy_violation",
      explanation: `Session terminated due to ${haltReason.type}`,
    },
    recommendations: [],
    traceRef: `events:${Date.now()}`,
    groupId: state.groupId,
  };

  const ticket = await service.createTicket(sessionId, haltReason, summary);
  return service.escalate(ticket, summary);
}