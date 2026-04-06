/**
 * Proposal Server Actions
 * Story 3-2: Approval Workflow Implementation
 */

'use server';

import { revalidatePath } from 'next/cache';
import { getProposalManager, PromotionProposalManager } from '@/lib/promotions/proposal';
import { validateGroupId } from '@/lib/validation/group-id';

/**
 * Create a new promotion proposal
 */
export async function createProposalAction(formData: FormData) {
  try {
    const groupIdParam = formData.get('groupId') as string;
    const groupId = validateGroupId(groupIdParam);
    
    const proposal = await getProposalManager().createProposal({
      group_id: groupId,
      entity_type: formData.get('entityType') as 'agent' | 'insight' | 'design' | 'knowledge',
      entity_id: formData.get('entityId') as string,
      confidence_score: parseFloat(formData.get('confidenceScore') as string),
      evidence_refs: JSON.parse(formData.get('evidenceRefs') as string || '[]'),
      metadata: JSON.parse(formData.get('metadata') as string || '{}'),
      proposed_by: formData.get('proposedBy') as string,
    });
    
    revalidatePath('/dashboard/paperclip/approvals');
    
    return { success: true, proposal };
  } catch (error) {
    console.error('Failed to create proposal:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create proposal' 
    };
  }
}

/**
 * Submit proposal for review (draft → pending)
 */
export async function submitForReviewAction(formData: FormData) {
  try {
    const proposalId = formData.get('proposalId') as string;
    const groupId = validateGroupId(formData.get('groupId') as string);
    
    const proposal = await getProposalManager().submitForReview(proposalId, groupId);
    
    revalidatePath('/dashboard/paperclip/approvals');
    revalidatePath(`/dashboard/paperclip/reviews/${proposalId}`);
    
    return { success: true, proposal };
  } catch (error) {
    console.error('Failed to submit for review:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to submit for review' 
    };
  }
}

/**
 * Approve a proposal
 */
export async function approveProposalAction(formData: FormData) {
  try {
    const proposalId = formData.get('proposalId') as string;
    const groupId = validateGroupId(formData.get('groupId') as string);
    const actorId = formData.get('actorId') as string; // TODO: Get from session
    
    const proposal = await getProposalManager().approveProposal({
      proposal_id: proposalId,
      group_id: groupId,
      to_state: 'approved',
      actor_id: actorId,
      actor_type: 'human',
      reason: formData.get('reason') as string | undefined,
    });
    
    revalidatePath('/dashboard/paperclip/approvals');
    revalidatePath(`/dashboard/paperclip/reviews/${proposalId}`);
    revalidatePath('/dashboard/paperclip/audit-logs');
    
    return { success: true, proposal };
  } catch (error) {
    console.error('Failed to approve proposal:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to approve proposal' 
    };
  }
}

/**
 * Reject a proposal
 */
export async function rejectProposalAction(formData: FormData) {
  try {
    const proposalId = formData.get('proposalId') as string;
    const groupId = validateGroupId(formData.get('groupId') as string);
    const actorId = formData.get('actorId') as string; // TODO: Get from session
    const reason = formData.get('reason') as string;
    
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: 'Rejection reason is required' };
    }
    
    const proposal = await getProposalManager().rejectProposal({
      proposal_id: proposalId,
      group_id: groupId,
      to_state: 'rejected',
      actor_id: actorId,
      actor_type: 'human',
      reason,
    });
    
    revalidatePath('/dashboard/paperclip/approvals');
    revalidatePath(`/dashboard/paperclip/reviews/${proposalId}`);
    revalidatePath('/dashboard/paperclip/audit-logs');
    
    return { success: true, proposal };
  } catch (error) {
    console.error('Failed to reject proposal:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to reject proposal' 
    };
  }
}