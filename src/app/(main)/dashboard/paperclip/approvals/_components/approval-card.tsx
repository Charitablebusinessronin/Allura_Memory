/**
 * Approval Card Component
 * Story 3-1: Paperclip Dashboard Foundation
 * Epic 3: Human-in-the-Loop (HITL) Governance Interface
 * 
 * Reusable approval card with actions
 */

'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

import type { ApprovalRequest } from '../approval-utils';

interface ApprovalCardProps {
  approval: ApprovalRequest;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string, reason: string) => Promise<void>;
}

export function ApprovalCard({ approval, onApprove, onReject }: ApprovalCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const handleApprove = async () => {
    if (!onApprove) return;
    
    setIsApproving(true);
    try {
      await onApprove(approval.id);
      toast.success(`Approved ${approval.agent_name}`);
    } catch (error) {
      toast.error(`Failed to approve: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    
    setIsRejecting(true);
    try {
      await onReject(approval.id, rejectionReason);
      toast.success(`Rejected ${approval.agent_name}`);
      setShowRejectDialog(false);
      setRejectionReason('');
    } catch (error) {
      toast.error(`Failed to reject: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRejecting(false);
    }
  };

  const confidenceColor = approval.confidence_score >= 0.9 
    ? 'text-green-600' 
    : approval.confidence_score >= 0.8 
    ? 'text-yellow-600' 
    : 'text-red-600';

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <Card className="border-l-4 border-l-yellow-500">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">
              Agent Promotion: {approval.agent_name}
            </CardTitle>
            <CardDescription>
              Requested {timeAgo(approval.created_at)}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-500" />
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              Pending
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm">
              <span className="font-medium">Proposed by:</span> {approval.requested_by}
            </p>
            <p className="text-sm">
              <span className="font-medium">Confidence:</span>{' '}
              <span className={`font-mono ${confidenceColor}`}>
                {(approval.confidence_score * 100).toFixed(0)}%
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              ID: {approval.agent_id}
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  View Details
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Approval Request Details</DialogTitle>
                  <DialogDescription>
                    Review the agent execution record before approving
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">Agent Name</p>
                      <p className="text-sm text-muted-foreground">{approval.agent_name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Agent ID</p>
                      <p className="text-sm font-mono text-muted-foreground">{approval.agent_id}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Confidence Score</p>
                      <p className={`text-sm font-mono ${confidenceColor}`}>
                        {(approval.confidence_score * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Requested By</p>
                      <p className="text-sm text-muted-foreground">{approval.requested_by}</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-sm text-muted-foreground">
                      <strong>Note:</strong> Full AER (Agent Execution Record) view coming in Phase 2.
                      This placeholder shows key details for approval decision.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setShowRejectDialog(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Button 
              variant="default" 
              size="sm" 
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={isApproving}
            >
              <CheckCircle className="mr-1 h-4 w-4" />
              {isApproving ? 'Approving...' : 'Approve'}
            </Button>
            
            <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  Reject
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reject Agent Promotion</DialogTitle>
                  <DialogDescription>
                    Please provide a reason for rejecting this approval request.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Textarea
                    placeholder="Rejection reason (required)"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                  />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => {
                    setShowRejectDialog(false);
                    setRejectionReason('');
                  }}>
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleReject}
                    disabled={isRejecting || !rejectionReason.trim()}
                  >
                    {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}