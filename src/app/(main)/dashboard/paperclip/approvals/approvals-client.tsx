'use client';

/**
 * Approvals Client Component
 * Story 3-1: Paperclip Dashboard Foundation
 * 
 * Client-side interactivity for approval actions
 */

import { useState } from 'react';
import { ApprovalCard } from './_components/approval-card';
import { approveAction, rejectAction } from '@/app/actions/approvals';
import type { ApprovalRequest } from './approval-utils';

interface ApprovalsClientProps {
  initialApprovals: ApprovalRequest[];
  groupId: string;
}

export function ApprovalsClient({ initialApprovals, groupId }: ApprovalsClientProps) {
  const [approvals, setApprovals] = useState(initialApprovals);

  const handleApprove = async (id: string) => {
    const formData = new FormData();
    formData.append('agentId', id);
    formData.append('groupId', groupId);
    
    const result = await approveAction(formData);
    
    if (result.success) {
      // Remove approved item from list
      setApprovals(approvals.filter(a => a.id !== id));
    } else {
      throw new Error(result.error || 'Failed to approve');
    }
  };

  const handleReject = async (id: string, reason: string) => {
    const formData = new FormData();
    formData.append('agentId', id);
    formData.append('reason', reason);
    formData.append('groupId', groupId);
    
    const result = await rejectAction(formData);
    
    if (result.success) {
      // Remove rejected item from list
      setApprovals(approvals.filter(a => a.id !== id));
    } else {
      throw new Error(result.error || 'Failed to reject');
    }
  };

  if (approvals.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No pending approvals</p>
        <p className="text-sm text-muted-foreground mt-2">
          All agents have been reviewed
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {approvals.map((approval) => (
        <ApprovalCard
          key={approval.id}
          approval={approval}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      ))}
    </div>
  );
}