/**
 * Insight Card Component
 * Story 4-2: Platform Library
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { trackAdoptionAction, getAdoptionMetricsAction, getVersionHistoryAction } from '@/app/actions/platform-library';
import { Calendar, Tag, TrendingUp, User, ChevronDown, ChevronUp } from 'lucide-react';
import type { PlatformInsight } from '@/lib/platform/types';

interface InsightCardProps {
  insight: PlatformInsight;
  rank: number;
  matchReason: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  'architecture': 'Architecture',
  'pattern': 'Design Pattern',
  'best-practice': 'Best Practice',
  'lesson-learned': 'Lesson Learned',
  'anti-pattern': 'Anti-Pattern',
  'technique': 'Technique',
  'configuration': 'Configuration',
  'integration': 'Integration',
};

const CATEGORY_COLORS: Record<string, string> = {
  'architecture': 'bg-blue-500',
  'pattern': 'bg-purple-500',
  'best-practice': 'bg-green-500',
  'lesson-learned': 'bg-yellow-500',
  'anti-pattern': 'bg-red-500',
  'technique': 'bg-indigo-500',
  'configuration': 'bg-gray-500',
  'integration': 'bg-pink-500',
};

export function InsightCard({ insight, rank, matchReason }: InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTrackingAdoption, setIsTrackingAdoption] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleAdopt = async () => {
    setIsTrackingAdoption(true);
    try {
      // TODO: Get actual org ID from session
      // See: Epic 3 auth implementation
      const formData = new FormData();
      formData.append('insightId', insight.id);
      formData.append('adoptedByOrg', 'allura-demo-org');

      const result = await trackAdoptionAction(formData);

      if (result.success) {
        alert('✅ Insight adopted successfully! Track its usage in your dashboard.');
      } else {
        throw new Error(result.error || 'Failed to adopt insight');
      }
    } catch (error) {
      console.error('Failed to adopt insight:', error);
      alert('❌ Failed to adopt insight. Please try again.');
    } finally {
      setIsTrackingAdoption(false);
    }
  };

  const formattedDate = new Date(insight.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                Rank #{rank}
              </Badge>
              <Badge className={`${CATEGORY_COLORS[insight.category]} text-white text-xs`}>
                {CATEGORY_LABELS[insight.category] || insight.category}
              </Badge>
              {insight.version > 1 && (
                <Badge variant="outline" className="text-xs">
                  v{insight.version}
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg">{insight.title}</CardTitle>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              {insight.adoption_count} adoptions
            </div>
            {insight.confidence_score !== null && (
              <div className="mt-1">
                {Math.round(insight.confidence_score * 100)}% confidence
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Match Reason */}
        <div className="text-sm text-blue-600 dark:text-blue-400">
          Match: {matchReason}
        </div>

        {/* Content Preview */}
        <div className="text-sm text-gray-700 dark:text-gray-300">
          {isExpanded ? (
            <p>{insight.content}</p>
          ) : (
            <p className="line-clamp-3">{insight.content}</p>
          )}
        </div>

        {/* Tags */}
        {insight.tags && insight.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="h-4 w-4 text-muted-foreground" />
            {insight.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {insight.created_by}
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formattedDate}
          </div>
          {insight.source_org && (
            <div className="text-gray-500">
              Source: {insight.source_org}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleAdopt}
            disabled={isTrackingAdoption}
          >
            {isTrackingAdoption ? 'Tracking...' : 'Track Adoption'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide Details' : 'View Details'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show More
              </>
            )}
          </Button>
        </div>

        {/* Details Dialog */}
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{insight.title}</DialogTitle>
              <DialogDescription>
                Insight ID: {insight.id}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Content</h4>
                <p className="text-sm">{insight.content}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Metadata</h4>
                <ul className="text-sm space-y-1">
                  <li>Category: {CATEGORY_LABELS[insight.category] || insight.category}</li>
                  <li>Version: {insight.version}</li>
                  <li>Adoptions: {insight.adoption_count}</li>
                  {insight.confidence_score !== null && (
                    <li>Confidence: {Math.round(insight.confidence_score * 100)}%</li>
                  )}
                  {insight.source_org && <li>Source: {insight.source_org}</li>}
                </ul>
              </div>
              {insight.tags && insight.tags.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {insight.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <Button
                className="w-full"
                onClick={handleAdopt}
                disabled={isTrackingAdoption}
              >
                {isTrackingAdoption ? 'Tracking Adoption...' : 'Track Adoption for My Org'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}