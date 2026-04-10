'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface Trace {
  id: string;
  group_id: string;
  type: 'memory' | 'decision' | 'action' | 'prompt';
  content: string;
  agent: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

interface Insight {
  id: string;
  group_id: string;
  type: 'pattern' | 'decision' | 'adr' | 'best-practice';
  content: string;
  version: number;
  previous_versions: string[];
  created_at: string;
  promoted_at: string;
  promoted_by: string;
  tags: string[];
}

interface PromotionProposal {
  id: string;
  group_id: string;
  trace_id: string;
  content: string;
  proposed_by: string;
  proposed_at: string;
  status: 'pending' | 'approved' | 'rejected';
  votes: { approver: string; vote: 'approve' | 'reject'; reason: string }[];
}

export default function MemoryDashboardPage() {
  const [activeTab, setActiveTab] = useState('traces');
  const [group_id, setGroup_id] = useState('allura-default');
  const [traces, setTraces] = useState<Trace[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [proposals, setProposals] = useState<PromotionProposal[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch traces from PostgreSQL
  const fetchTraces = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/memory/traces?group_id=${group_id}&limit=50`);
      const data = await response.json();
      setTraces(data.traces || []);
    } catch (error) {
      console.error('Failed to fetch traces:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch insights from Neo4j
  const fetchInsights = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/memory/insights?group_id=${group_id}&limit=50`);
      const data = await response.json();
      setInsights(data.insights || []);
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch pending promotions
  const fetchProposals = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/memory/promotions?group_id=${group_id}&status=pending`);
      const data = await response.json();
      setProposals(data.proposals || []);
    } catch (error) {
      console.error('Failed to fetch proposals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Search memories
  const searchMemories = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/memory/search?group_id=${group_id}&query=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setTraces(data.results?.traces || []);
      setInsights(data.results?.insights || []);
    } catch (error) {
      console.error('Failed to search:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'traces') fetchTraces();
    else if (activeTab === 'insights') fetchInsights();
    else if (activeTab === 'promotions') fetchProposals();
  }, [activeTab, group_id]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Allura Memory Dashboard</h1>
          <p className="text-muted-foreground">
            PostgreSQL Raw Traces • Neo4j Promoted Insights • HITL Governance
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Input
            placeholder="Enter group_id"
            value={group_id}
            onChange={(e) => setGroup_id(e.target.value)}
            className="w-48"
          />
          <Button onClick={() => fetchTraces()}>Refresh</Button>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Input
              placeholder="Search memories, insights, decisions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchMemories()}
              className="flex-1"
            />
            <Button onClick={searchMemories}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="traces">
            Raw Traces
            <Badge variant="secondary" className="ml-2">{traces.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="insights">
            Promoted Insights
            <Badge variant="secondary" className="ml-2">{insights.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="promotions">
            HITL Queue
            <Badge variant="destructive" className="ml-2">{proposals.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Raw Traces Tab */}
        <TabsContent value="traces">
          <Card>
            <CardHeader>
              <CardTitle>PostgreSQL Raw Traces</CardTitle>
              <CardDescription>
                Append-only execution logs (6-12 month retention)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                {traces.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No traces found for group_id: {group_id}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {traces.map((trace) => (
                      <Card key={trace.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">{trace.type}</Badge>
                                <Badge variant="secondary">{trace.agent}</Badge>
                                <span className="text-sm text-muted-foreground">
                                  {new Date(trace.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm">{trace.content}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => proposePromotion(trace.id)}
                            >
                              Promote
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Promoted Insights Tab */}
        <TabsContent value="insights">
          <Card>
            <CardHeader>
              <CardTitle>Neo4j Promoted Insights</CardTitle>
              <CardDescription>
                Curated knowledge with Steel Frame versioning (SUPERSEDES)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                {insights.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No insights found for group_id: {group_id}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {insights.map((insight) => (
                      <Card key={insight.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge>{insight.type}</Badge>
                              <Badge variant="outline">v{insight.version}</Badge>
                              {insight.previous_versions.length > 0 && (
                                <Badge variant="secondary">
                                  {insight.previous_versions.length} previous versions
                                </Badge>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              Promoted: {new Date(insight.promoted_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm mb-3">{insight.content}</p>
                          <div className="flex gap-2">
                            {insight.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          {insight.previous_versions.length > 0 && (
                            <details className="mt-3">
                              <summary className="text-sm cursor-pointer text-muted-foreground">
                                View version history
                              </summary>
                              <div className="mt-2 pl-4 space-y-2">
                                {insight.previous_versions.map((prev, idx) => (
                                  <div key={idx} className="text-sm text-muted-foreground border-l-2 pl-3">
                                    Version {insight.version - (idx + 1)}: {prev.substring(0, 100)}...
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HITL Promotion Queue */}
        <TabsContent value="promotions">
          <Card>
            <CardHeader>
              <CardTitle>Human-in-the-Loop Promotion Queue</CardTitle>
              <CardDescription>
                Review and approve knowledge promotions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                {proposals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending promotions
                  </div>
                ) : (
                  <div className="space-y-4">
                    {proposals.map((proposal) => (
                      <Card key={proposal.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="destructive">Pending Approval</Badge>
                                <span className="text-sm text-muted-foreground">
                                  Proposed: {new Date(proposal.proposed_at).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm">{proposal.content}</p>
                            </div>
                          </div>
                          <Separator className="my-4" />
                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => voteOnProposal(proposal.id, 'approve')}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => voteOnProposal(proposal.id, 'reject')}
                            >
                              Reject
                            </Button>
                          </div>
                          {proposal.votes.length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-sm font-medium mb-2">Votes:</p>
                              {proposal.votes.map((vote, idx) => (
                                <div key={idx} className="text-sm mb-1">
                                  <Badge variant={vote.vote === 'approve' ? 'default' : 'destructive'} className="mr-2">
                                    {vote.vote}
                                  </Badge>
                                  <span className="text-muted-foreground">
                                    {vote.approver}: {vote.reason}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );

  async function proposePromotion(trace_id: string) {
    try {
      await fetch('/api/memory/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id, trace_id })
      });
      fetchProposals();
    } catch (error) {
      console.error('Failed to propose promotion:', error);
    }
  }

  async function voteOnProposal(proposal_id: string, vote: 'approve' | 'reject') {
    try {
      await fetch(`/api/memory/promotions/${proposal_id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote })
      });
      fetchProposals();
      fetchInsights();
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  }
}