'use server';

/**
 * Approval Server Actions
 * Story 3-1: Paperclip Dashboard Foundation
 * Epic 3: Human-in-the-Loop (HITL) Governance Interface
 * 
 * Server actions for approval mutations with revalidation
 * Pattern: ARCH-001 (group_id enforcement)
 */

import { revalidatePath } from 'next/cache';
import { getAgentApproval } from '@/lib/agents/approval';
import { validateGroupId, GroupIdValidationError } from '@/lib/validation/group-id';

/**
 * Approve an agent promotion request
 * 
 * @param formData - Form data with agentId, reviewerNotes, and groupId
 * @returns Success result with approval details
 */
export async function approveAction(formData: FormData) {
  try {
    const agentId = formData.get('agentId') as string;
    const reviewerNotes = formData.get('notes') as string | undefined;
    const groupIdParam = formData.get('groupId') as string;
    
    // Validate group_id (ARCH-001)
    const groupId = validateGroupId(groupIdParam);
    
    // TODO: Replace 'curator' with actual user context from session
    // See: Epic 3 auth implementation
    const reviewerId = 'curator'; // Will be replaced with: session.user.id
    
    // Business logic
    const approval = getAgentApproval();
    const result = await approval.approve(agentId, reviewerId, reviewerNotes);
    
    // Revalidate cache
    revalidatePath('/dashboard/paperclip/approvals');
    
    return { success: true, approval: result, groupId };
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      return { success: false, error: `Invalid group_id: ${error.message}` };
    }
    console.error('Failed to approve agent:', error);
    return { success: false, error: 'Failed to approve agent' };
  }
}

/**
 * Reject an agent promotion request
 * 
 * @param formData - Form data with agentId, rejectionReason, and groupId
 * @returns Success result with rejection details
 */
export async function rejectAction(formData: FormData) {
  try {
    const agentId = formData.get('agentId') as string;
    const rejectionReason = formData.get('reason') as string;
    const groupIdParam = formData.get('groupId') as string;
    
    // Validate group_id (ARCH-001)
    const groupId = validateGroupId(groupIdParam);
    
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return { success: false, error: 'Rejection reason is required' };
    }
    
    // TODO: Replace 'curator' with actual user context from session
    // See: Epic 3 auth implementation
    const reviewerId = 'curator'; // Will be replaced with: session.user.id
    
    // Business logic
    const approval = getAgentApproval();
    const result = await approval.reject(agentId, reviewerId, rejectionReason);
    
    // Revalidate cache
    revalidatePath('/dashboard/paperclip/approvals');
    
    return { success: true, rejection: result, groupId };
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      return { success: false, error: `Invalid group_id: ${error.message}` };
    }
    console.error('Failed to reject agent:', error);
    return { success: false, error: 'Failed to reject agent' };
  }
}

/**
 * Fetch pending approvals for display
 * 
 * @param groupId - Validated tenant identifier
 * @returns Array of pending approval requests
 */
export async function fetchApprovalsAction(groupId: string) {
  try {
    // Validate group_id (ARCH-001)
    const validatedGroupId = validateGroupId(groupId);
    
    const approval = getAgentApproval();
    const pending = await approval.getPendingApprovals();
    
    return { success: true, approvals: pending, groupId: validatedGroupId };
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      return { success: false, error: `Invalid group_id: ${error.message}`, approvals: [] };
    }
    console.error('Failed to fetch approvals:', error);
    return { success: false, error: 'Failed to fetch approvals', approvals: [] };
  }
}