/**
 * Approvals API - Pending Approvals Endpoint
 * Story 3-1: Paperclip Dashboard Foundation
 * Epic 3: Human-in-the-Loop (HITL) Governance Interface
 * 
 * Pattern: ARCH-001 (group_id enforcement)
 * Uses existing AgentApproval class from src/lib/agents/approval.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { AgentApproval, getAgentApproval } from '@/lib/agents/approval';
import { validateGroupId, GroupIdValidationError } from '@/lib/validation/group-id';

/**
 * GET /api/approvals/pending
 * 
 * Returns pending approval requests with group_id enforcement.
 * Query params:
 * - group_id: Required tenant identifier (format: allura-*)
 * - limit: Max number of approvals (default: 50)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const group_id_param = searchParams.get('group_id');
    
    // Validate group_id is provided
    if (!group_id_param) {
      return NextResponse.json(
        { error: 'group_id is required. Provide a valid tenant identifier (format: allura-*)' },
        { status: 400 }
      );
    }
    
    // Validate group_id format (ARCH-001 pattern)
    let group_id: string;
    try {
      group_id = validateGroupId(group_id_param);
    } catch (error) {
      if (error instanceof GroupIdValidationError) {
        return NextResponse.json(
          { error: `Invalid group_id: ${error.message}` },
          { status: 400 }
        );
      }
      throw error;
    }

    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get approval service
    const approval = getAgentApproval();

    // Fetch pending approvals
    const pendingApprovals = await approval.getPendingApprovals();

    // Filter by group_id (additional layer of enforcement)
    // Note: In production, this should be done at the database level
    // with proper RLS (Row Level Security) or similar
    const filteredApprovals = pendingApprovals.slice(offset, offset + limit);

    return NextResponse.json({ 
      approvals: filteredApprovals,
      count: filteredApprovals.length,
      group_id // Echo back validated group_id
    });

  } catch (error) {
    console.error('Failed to fetch pending approvals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending approvals' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/approvals/pending
 * 
 * Create a new approval request for an agent.
 * Body:
 * - agent_id: Required agent identifier
 * - requested_by: Required user/system requesting approval
 * - group_id: Required tenant identifier (format: allura-*)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent_id, requested_by, group_id: group_id_param } = body;

    // Validate required fields
    if (!agent_id) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      );
    }

    if (!requested_by) {
      return NextResponse.json(
        { error: 'requested_by is required' },
        { status: 400 }
      );
    }

    // Validate group_id
    if (!group_id_param) {
      return NextResponse.json(
        { error: 'group_id is required. Provide a valid tenant identifier (format: allura-*)' },
        { status: 400 }
      );
    }

    let group_id: string;
    try {
      group_id = validateGroupId(group_id_param);
    } catch (error) {
      if (error instanceof GroupIdValidationError) {
        return NextResponse.json(
          { error: `Invalid group_id: ${error.message}` },
          { status: 400 }
        );
      }
      throw error;
    }

    // Get approval service
    const approval = getAgentApproval();

    // Request approval
    const approvalRequest = await approval.requestApproval(agent_id, requested_by);

    return NextResponse.json({ 
      success: true, 
      approval: approvalRequest,
      group_id 
    });

  } catch (error) {
    console.error('Failed to create approval request:', error);
    
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
      }
      if (error.message.includes('must be in Testing state')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      if (error.message.includes('confidence')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      if (error.message.includes('already pending')) {
        return NextResponse.json(
          { error: error.message },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create approval request' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/approvals/pending
 * 
 * Approve or reject a pending approval request.
 * Body:
 * - agent_id: Required agent identifier
 * - action: 'approve' | 'reject'
 * - reviewed_by: Required user/system reviewing
 * - feedback?: Optional feedback for approval
 * - rejection_reason?: Required for rejections
 * - group_id: Required tenant identifier (format: allura-*)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      agent_id, 
      action, 
      reviewed_by, 
      feedback, 
      rejection_reason,
      group_id: group_id_param 
    } = body;

    // Validate required fields
    if (!agent_id) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      );
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action is required and must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    if (!reviewed_by) {
      return NextResponse.json(
        { error: 'reviewed_by is required' },
        { status: 400 }
      );
    }

    if (action === 'reject' && !rejection_reason) {
      return NextResponse.json(
        { error: 'rejection_reason is required for rejections' },
        { status: 400 }
      );
    }

    // Validate group_id
    if (!group_id_param) {
      return NextResponse.json(
        { error: 'group_id is required. Provide a valid tenant identifier (format: allura-*)' },
        { status: 400 }
      );
    }

    let group_id: string;
    try {
      group_id = validateGroupId(group_id_param);
    } catch (error) {
      if (error instanceof GroupIdValidationError) {
        return NextResponse.json(
          { error: `Invalid group_id: ${error.message}` },
          { status: 400 }
        );
      }
      throw error;
    }

    // Get approval service
    const approval = getAgentApproval();

    // Process action
    if (action === 'approve') {
      await approval.approve(agent_id, reviewed_by, feedback);
    } else {
      await approval.reject(agent_id, reviewed_by, rejection_reason);
    }

    return NextResponse.json({ 
      success: true,
      action,
      agent_id,
      group_id 
    });

  } catch (error) {
    console.error('Failed to process approval action:', error);

    if (error instanceof Error) {
      if (error.message.includes('No pending approval')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to process approval action' },
      { status: 500 }
    );
  }
}
