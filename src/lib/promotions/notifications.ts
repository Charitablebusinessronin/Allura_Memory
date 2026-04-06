/**
 * Notification Service
 * Story 3-2: Approval Workflow Implementation
 * Epic 3: Human-in-the-Loop (HITL) Governance Interface
 * 
 * Handles notification dispatch for approval state changes
 * Pattern: ARCH-001 (group_id enforcement)
 */

import { getPool } from '@/lib/postgres/connection';
import { validateGroupId } from '@/lib/validation/group-id';
import type { NotificationEvent } from './types';

export type NotificationChannel = 'in_app' | 'email' | 'slack' | 'webhook';

export interface NotificationPayload {
  group_id: string;
  transition_id?: string;
  event_type: NotificationEvent['event_type'];
  entity_type: string;
  entity_id: string;
  channel: NotificationChannel;
  recipient: string;
  payload: Record<string, unknown>;
}

/**
 * NotificationService
 * 
 * Dispatches notifications for approval events
 */
export class NotificationService {
  /**
   * Send notification
   */
  async sendNotification(input: NotificationPayload): Promise<NotificationEvent> {
    const groupId = validateGroupId(input.group_id);
    
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO approval_notifications (
        group_id, transition_id, event_type, entity_type, entity_id,
        channel, recipient, sent_at, success, payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), true, $8)
      RETURNING *`,
      [
        groupId,
        input.transition_id || null,
        input.event_type,
        input.entity_type,
        input.entity_id,
        input.channel,
        input.recipient,
        JSON.stringify(input.payload),
      ]
    );
    
    // TODO: Integrate with actual notification handlers (email, slack, webhook)
    // For now, just log to database
    
    return this.mapRowToNotification(result.rows[0]);
  }

  /**
   * Get notifications for group
   */
  async getNotifications(
    groupId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<NotificationEvent[]> {
    const validatedGroupId = validateGroupId(groupId);
    
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM approval_notifications
       WHERE group_id = $1
       ORDER BY sent_at DESC
       LIMIT $2 OFFSET $3`,
      [validatedGroupId, limit, offset]
    );
    
    return result.rows.map(row => this.mapRowToNotification(row));
  }

  /**
   * Map database row to NotificationEvent
   */
  private mapRowToNotification(row: Record<string, unknown>): NotificationEvent {
    return {
      id: row.id as string,
      group_id: row.group_id as string,
      transition_id: row.transition_id as string | undefined,
      event_type: row.event_type as NotificationEvent['event_type'],
      entity_type: row.entity_type as NotificationEvent['entity_type'],
      entity_id: row.entity_id as string,
      channel: row.channel as NotificationChannel,
      recipient: row.recipient as string,
      sent_at: row.sent_at as Date,
      success: row.success as boolean,
      error_message: row.error_message as string | undefined,
      payload: JSON.parse(row.payload as string || '{}'),
    };
  }
}

/**
 * Singleton instance
 */
let instance: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!instance) {
    instance = new NotificationService();
  }
  return instance;
}