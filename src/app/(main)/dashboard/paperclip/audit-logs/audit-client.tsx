'use client';

/**
 * Audit Log Client Component
 * Story 3-2: Task 6 - Audit Trail Viewer
 */

import { useState } from 'react';
import { format } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProposalStatus } from '@/lib/promotions/types';

// TODO: Replace with real data fetch from audit-log.ts
const MOCK_AUDIT_ENTRIES = [
  {
    id: '1',
    timestamp: new Date('2026-04-06T12:00:00Z'),
    actor: 'curator@example.com',
    actor_type: 'human' as const,
    action: 'approved',
    entity_type: 'proposal' as const,
    entity_id: 'prop-001',
    from_state: 'pending' as ProposalStatus,
    to_state: 'approved' as ProposalStatus,
    outcome: 'success' as const,
  },
  {
    id: '2',
    timestamp: new Date('2026-04-06T11:30:00Z'),
    actor: 'system',
    actor_type: 'system' as const,
    action: 'pending',
    entity_type: 'proposal' as const,
    entity_id: 'prop-001',
    from_state: 'draft' as ProposalStatus,
    to_state: 'pending' as ProposalStatus,
    outcome: 'success' as const,
  },
];

interface AuditClientProps {
  groupId: string;
}

export function AuditClient({ groupId }: AuditClientProps) {
  const [filterActor, setFilterActor] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');

  const stateColorMap: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    superseded: 'bg-purple-100 text-purple-800',
    revoked: 'bg-gray-200 text-gray-800',
  };

  const actorTypeColorMap: Record<string, string> = {
    human: 'bg-blue-100 text-blue-800',
    agent: 'bg-purple-100 text-purple-800',
    system: 'bg-gray-100 text-gray-800',
  };

  const filteredEntries = MOCK_AUDIT_ENTRIES.filter((entry) => {
    if (filterActor !== 'all' && entry.actor_type !== filterActor) return false;
    if (filterAction !== 'all' && entry.to_state !== filterAction) return false;
    return true;
  });

  // Reset filters
  const handleResetFilters = () => {
    setFilterActor('all');
    setFilterAction('all');
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <Select value={filterActor} onValueChange={setFilterActor}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Actor type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actors</SelectItem>
            <SelectItem value="human">Human</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="pending">Submitted</SelectItem>
            <SelectItem value="superseded">Superseded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Audit Entries */}
      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No audit entries found
            </CardContent>
          </Card>
        ) : (
          filteredEntries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">
                      {entry.from_state ? `${entry.from_state} → ${entry.to_state}` : entry.to_state}
                    </CardTitle>
                    <Badge className={stateColorMap[entry.to_state]}>
                      {entry.to_state}
                    </Badge>
                  </div>
                  <Badge className={actorTypeColorMap[entry.actor_type]}>
                    {entry.actor_type}
                  </Badge>
                </div>
                <CardDescription>
                  {format(entry.timestamp, 'yyyy-MM-dd HH:mm:ss')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Actor:</span> {entry.actor}
                  </div>
                  <div>
                    <span className="font-medium">Entity:</span> {entry.entity_type}/{entry.entity_id}
                  </div>
                  <div>
                    <span className="font-medium">Outcome:</span>{' '}
                    <span className={entry.outcome === 'success' ? 'text-green-600' : 'text-red-600'}>
                      {entry.outcome}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}