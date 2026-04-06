'use server';

/**
 * Platform Library Server Actions
 * Story 4-2: Platform Library
 * Epic 4: Cross-Organization Knowledge Sharing
 *
 * Server actions for platform library operations with revalidation
 * Pattern: ARCH-001 (group_id enforcement)
 */

import { revalidatePath } from 'next/cache';
import { getPlatformLibrary, PLATFORM_GROUP_ID } from '@/lib/platform/library';
import { validateGroupId, GroupIdValidationError } from '@/lib/validation/group-id';
import type {
  PlatformSearchParams,
  TrackAdoptionParams,
  CreateVersionParams,
  SubmitPromotionParams,
  ReviewPromotionParams,
} from '@/lib/platform/types';

/**
 * Search platform library for insights
 *
 * @param formData - Form data with search parameters
 * @returns Search results matching query
 */
export async function searchInsightsAction(formData: FormData) {
  try {
    // Extract search parameters
    const query = formData.get('query') as string | undefined;
    const category = formData.get('category') as string | undefined;
    const tagsParam = formData.get('tags') as string | undefined;
    const minConfidence = formData.get('minConfidence') as string | undefined;
    const minAdoption = formData.get('minAdoption') as string | undefined;
    const sortBy = formData.get('sortBy') as string | undefined;
    const limitParam = formData.get('limit') as string | undefined;
    const offsetParam = formData.get('offset') as string | undefined;

    // Build search params
    const params: PlatformSearchParams = {
      query: query || undefined,
      category: category as PlatformSearchParams['category'],
      tags: tagsParam ? tagsParam.split(',').map(t => t.trim()) : undefined,
      min_confidence: minConfidence ? parseFloat(minConfidence) : undefined,
      min_adoption: minAdoption ? parseInt(minAdoption, 10) : undefined,
      sort_by: sortBy as PlatformSearchParams['sort_by'],
      limit: limitParam ? parseInt(limitParam, 10) : 20,
      offset: offsetParam ? parseInt(offsetParam, 10) : 0,
    };

    // Platform library uses fixed group_id
    const library = getPlatformLibrary();
    const results = await library.search(params);

    return { success: true, ...results };
  } catch (error) {
    console.error('Failed to search platform library:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search platform library',
      results: [],
      total_count: 0,
      page: 1,
      page_size: 20,
      has_more: false,
    };
  }
}

/**
 * Track adoption of an insight by organization
 *
 * @param formData - Form data with insight_id, adopted_by_org, and optional metadata
 * @returns Success result
 */
export async function trackAdoptionAction(formData: FormData) {
  try {
    const insightId = formData.get('insightId') as string;
    const adoptedByOrg = formData.get('adoptedByOrg') as string;
    const adoptedByAgent = formData.get('adoptedByAgent') as string | undefined;
    const context = formData.get('context') as string | undefined;
    const outcome = formData.get('outcome') as TrackAdoptionParams['outcome'] | undefined;
    const metadataParam = formData.get('metadata') as string | undefined;

    // Validate group_id for adopting org (ARCH-001)
    const validatedOrgId = validateGroupId(adoptedByOrg);

    const params: TrackAdoptionParams = {
      insight_id: insightId,
      adopted_by_org: validatedOrgId,
      adopted_by_agent: adoptedByAgent,
      context: context,
      outcome: outcome,
      metadata: metadataParam ? JSON.parse(metadataParam) : undefined,
    };

    const library = getPlatformLibrary();
    await library.trackAdoption(params);

    // Revalidate cache
    revalidatePath('/dashboard/platform-library');

    return { success: true, insightId };
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      return { success: false, error: `Invalid group_id: ${error.message}` };
    }
    console.error('Failed to track adoption:', error);
    return { success: false, error: 'Failed to track adoption' };
  }
}

/**
 * Get version history for an insight
 *
 * @param formData - Form data with insightId
 * @returns Version history with lineage
 */
export async function getVersionHistoryAction(formData: FormData) {
  try {
    const insightId = formData.get('insightId') as string;

    const library = getPlatformLibrary();
    const history = await library.getVersionHistory(insightId);

    return { success: true, history };
  } catch (error) {
    console.error('Failed to get version history:', error);
    return { success: false, error: 'Failed to get version history' };
  }
}

/**
 * Get adoption metrics for an insight
 *
 * @param formData - Form data with insightId
 * @returns Adoption metrics
 */
export async function getAdoptionMetricsAction(formData: FormData) {
  try {
    const insightId = formData.get('insightId') as string;

    const library = getPlatformLibrary();
    const metrics = await library.getAdoptionMetrics(insightId);

    return { success: true, metrics };
  } catch (error) {
    console.error('Failed to get adoption metrics:', error);
    return { success: false, error: 'Failed to get adoption metrics' };
  }
}

/**
 * Submit insight for platform promotion (HITL queue)
 *
 * @param formData - Form data with promotion proposal details
 * @returns Success result with proposal
 */
export async function submitPromotionAction(formData: FormData) {
  try {
    const sourceGroupId = formData.get('sourceGroupId') as string;
    const sourceOrg = formData.get('sourceOrg') as string;
    const insightId = formData.get('insightId') as string;
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const category = formData.get('category') as SubmitPromotionParams['category'];
    const tagsParam = formData.get('tags') as string | undefined;
    const confidenceScore = formData.get('confidenceScore') as string | undefined;
    const submittedBy = formData.get('submittedBy') as string;

    // Validate source group_id (ARCH-001)
    const validatedGroupId = validateGroupId(sourceGroupId);

    const params: SubmitPromotionParams = {
      source_group_id: validatedGroupId,
      source_org: sourceOrg,
      insight_id: insightId,
      title: title,
      content: content,
      category: category,
      tags: tagsParam ? tagsParam.split(',').map(t => t.trim()) : undefined,
      confidence_score: confidenceScore ? parseFloat(confidenceScore) : undefined,
      submitted_by: submittedBy,
    };

    const library = getPlatformLibrary();
    const proposal = await library.submitForPromotion(params);

    // Revalidate promotion queue
    revalidatePath('/dashboard/platform-library/promotions');

    return { success: true, proposal };
  } catch (error) {
    if (error instanceof GroupIdValidationError) {
      return { success: false, error: `Invalid group_id: ${error.message}` };
    }
    console.error('Failed to submit promotion:', error);
    return { success: false, error: 'Failed to submit promotion' };
  }
}

/**
 * Approve promotion proposal (HITL approval)
 *
 * @param formData - Form data with proposalId and reviewerNotes
 * @returns Success result with approved proposal
 */
export async function approvePromotionAction(formData: FormData) {
  try {
    const proposalId = formData.get('proposalId') as string;
    const reviewerNotes = formData.get('reviewerNotes') as string | undefined;

    // TODO: Replace 'curator' with actual user context from session
    // See: Epic 3 auth implementation
    const reviewedBy = 'curator'; // Will be replaced with: session.user.id

    const params: ReviewPromotionParams = {
      proposal_id: proposalId,
      reviewed_by: reviewedBy,
      approve: true,
      review_notes: reviewerNotes,
    };

    const library = getPlatformLibrary();
    const result = await library.reviewPromotion(params);

    // Revalidate promotion queue
    revalidatePath('/dashboard/platform-library/promotions');

    return { success: true, proposal: result };
  } catch (error) {
    console.error('Failed to approve promotion:', error);
    return { success: false, error: 'Failed to approve promotion' };
  }
}

/**
 * Reject promotion proposal (HITL rejection)
 *
 * @param formData - Form data with proposalId and rejectionReason
 * @returns Success result with rejected proposal
 */
export async function rejectPromotionAction(formData: FormData) {
  try {
    const proposalId = formData.get('proposalId') as string;
    const rejectionReason = formData.get('rejectionReason') as string;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return { success: false, error: 'Rejection reason is required' };
    }

    // TODO: Replace 'curator' with actual user context from session
    // See: Epic 3 auth implementation
    const reviewedBy = 'curator'; // Will be replaced with: session.user.id

    const params: ReviewPromotionParams = {
      proposal_id: proposalId,
      reviewed_by: reviewedBy,
      approve: false,
      rejection_reason: rejectionReason,
    };

    const library = getPlatformLibrary();
    const result = await library.reviewPromotion(params);

    // Revalidate promotion queue
    revalidatePath('/dashboard/platform-library/promotions');

    return { success: true, proposal: result };
  } catch (error) {
    console.error('Failed to reject promotion:', error);
    return { success: false, error: 'Failed to reject promotion' };
  }
}

/**
 * Publish approved proposal to platform library
 *
 * @param formData - Form data with proposalId
 * @returns Success result with published insight
 */
export async function publishProposalAction(formData: FormData) {
  try {
    const proposalId = formData.get('proposalId') as string;

    const library = getPlatformLibrary();
    const insight = await library.publishApprovedProposal(proposalId);

    // Revalidate all platform library pages
    revalidatePath('/dashboard/platform-library');

    return { success: true, insight };
  } catch (error) {
    console.error('Failed to publish proposal:', error);
    return { success: false, error: 'Failed to publish proposal' };
  }
}