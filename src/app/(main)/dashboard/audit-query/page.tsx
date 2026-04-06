'use client';

/**
 * Audit Query Interface
 * Story 5-1: Audit Query Interface
 * 
 * Query and export audit trail data with filters
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Download, FileJson, FileSpreadsheet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ProposalStatus } from '@/lib/promotions/types';

// TODO: Replace with real server action
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
    reason: 'Evidence meets confidence threshold',
  },
  {
    id: '2',
    timestamp: new Date('2026-04-06T11:30:00Z'),
    actor: 'memory-scout',
    actor_type: 'agent' as const,
    action: 'pending',
    entity_type: 'proposal' as const,
    entity_id: 'prop-001',
    from_state: 'draft' as ProposalStatus,
    to_state: 'pending' as ProposalStatus,
    outcome: 'success' as const,
  },
  {
    id: '3',
    timestamp: new Date('2026-04-06T10:00:00Z'),
    actor: 'curator@example.com',
    actor_type: 'human' as const,
    action: 'rejected',
    entity_type: 'proposal' as const,
    entity_id: 'prop-002',
    from_state: 'pending' as ProposalStatus,
    to_state: 'rejected' as ProposalStatus,
    outcome: 'success' as const,
    reason: 'Insufficient evidence quality',
  },
  {
    id: '4',
    timestamp: new Date('2026-04-05T15:00:00Z'),
    actor: 'memory-builder',
    actor_type: 'agent' as const,
    action: 'approved',
    entity_type: 'insight' as const,
    entity_id: 'ins-042',
    from_state: 'pending' as ProposalStatus,
    to_state: 'approved' as ProposalStatus,
    outcome: 'success' as const,
  },
];

export default function AuditQueryPage() {
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [filterActor, setFilterActor] = useState<string>('all');
  const [filterDecision, setFilterDecision] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

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
    if (startDate && entry.timestamp < startDate) return false;
    if (endDate && entry.timestamp > endDate) return false;
    if (filterActor !== 'all' && entry.actor_type !== filterActor) return false;
    if (filterDecision && entry.entity_id !== filterDecision) return false;
    return true;
  });

  const handleResetFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setFilterActor('all');
    setFilterDecision('');
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      // TODO: Replace with real server action
      // const csv = await exportAuditCSV({ 
      //   group_id: 'allura-system',
      //   start_date: startDate,
      //   end_date: endDate,
      //   agent_id: filterActor !== 'all' ? filterActor : undefined,
      //   decision_id: filterDecision || undefined,
      // });
      
      const blob = new Blob([JSON.stringify(filteredEntries, null, 2)], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      // TODO: Replace with real server action
      const blob = new Blob([JSON.stringify(filteredEntries, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Query Interface</h1>
        <p className="text-muted-foreground">
          Query and export audit trail data with filters
        </p>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription>Filter audit entries by date range, actor, or decision ID</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            {/* Date Range Picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !startDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Actor Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Actor Type</label>
              <Select value={filterActor} onValueChange={setFilterActor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select actor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actors</SelectItem>
                  <SelectItem value="human">Human</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Decision Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Decision ID</label>
              <input
                type="text"
                placeholder="Enter decision ID"
                value={filterDecision}
                onChange={(e) => setFilterDecision(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {/* Reset Button */}
            <div className="space-y-2">
              <label className="text-sm font-medium">&nbsp;</label>
              <Button variant="outline" onClick={handleResetFilters} className="w-full">
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Controls */}
      <div className="flex gap-2">
        <Button onClick={handleExportCSV} disabled={isExporting || filteredEntries.length === 0}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <Button onClick={handleExportJSON} disabled={isExporting || filteredEntries.length === 0}>
          <FileJson className="mr-2 h-4 w-4" />
          Export JSON
        </Button>
      </div>

      {/* Results Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Results</CardTitle>
          <CardDescription>
            Showing {filteredEntries.length} of {MOCK_AUDIT_ENTRIES.length} entries
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Audit Entries */}
      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No audit entries found matching filters
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
                  {entry.reason && (
                    <div className="col-span-2">
                      <span className="font-medium">Reason:</span> {entry.reason}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}