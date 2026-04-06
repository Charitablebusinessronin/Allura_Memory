/**
 * Approval Queue Utilities
 * Story 3-1: Paperclip Dashboard Foundation
 * Epic 3: Human-in-the-Loop (HITL) Governance Interface
 * 
 * Server-side utilities for approval queue data fetching
 * Pattern: ARCH-001 (group_id enforcement)
 */

import { validateGroupId, GroupIdValidationError } from '@/lib/validation/group-id';

/**
 * Extract valid group_id from request headers
 * 
 * @param headers - Request headers
 * @returns Validated group_id
 * @throws Error if group_id is missing or invalid
 */
export function getGroupIdFromHeaders(headers: Headers): string {
  const groupIdParam = headers.get('x-group-id');
  
  // Check if provided
  if (!groupIdParam) {
    throw new Error('group_id is required. Provide a valid tenant identifier (format: allura-*)');
  }
  
  // Validate format (ARCH-001 pattern)
  try {
    return validateGroupId(groupIdParam);
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      throw new Error(`Invalid group_id: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Fetch pending approvals from database
 * 
 * TODO: Implement server-side pagination and filtering
 * Currently fetches all and slices client-side for demo
 * Phase 2: Add WHERE clause to Postgres query for group_id filtering
 * 
 * @param groupId - Validated tenant identifier
 * @param limit - Max number of approvals to fetch
 * @param offset - Pagination offset
 * @returns Array of approval requests
 */
export async function fetchPendingApprovals(
  groupId: string, 
  limit: number = 50, 
  offset: number = 0
): Promise<ApprovalRequest[]> {
  const { getAgentApproval } = await import('@/lib/agents/approval');
  const approval = getAgentApproval();
  
  const pendingApprovals = await approval.getPendingApprovals();
  
  // TODO: Move filtering to database level with proper RLS
  // Phase 2: SELECT * FROM agent_approvals WHERE group_id = $1 LIMIT $2 OFFSET $3
  return pendingApprovals.slice(offset, offset + limit);
}

/**
 * Approval request type (re-exported from approval.ts)
 */
export interface ApprovalRequest {
  id: string;
  agent_id: string;
  agent_name: string;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected';
  confidence_score: number;
  reviewed_by?: string;
  reviewed_at?: Date;
  feedback?: string;
  rejection_reason?: string;
  created_at: Date;
}