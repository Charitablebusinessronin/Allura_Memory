/**
 * Platform Library Page
 * Story 4-2: Platform Library
 * Epic 4: Cross-Organization Knowledge Sharing
 *
 * Server Component - Fetches data server-side
 * Pattern: ARCH-001 (group_id enforcement - uses PLATFORM_GROUP_ID)
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { PlatformLibraryClient } from './platform-library-client';
import { getPlatformLibrary } from '@/lib/platform/library';

/**
 * Fetch initial insights for server-side rendering
 */
async function fetchInitialInsights() {
  try {
    const library = getPlatformLibrary();
    const result = await library.search({
      sort_by: 'adoption',
      limit: 20,
    });
    return result.results;
  } catch (error) {
    console.error('Failed to fetch initial insights:', error);
    return [];
  }
}

export default async function PlatformLibraryPage() {
  // Server-side data fetch
  const initialInsights = await fetchInitialInsights();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Library</h1>
          <p className="text-muted-foreground">
            Discover and adopt cross-organization knowledge
          </p>
        </div>
      </div>

      {/* Category Summary */}
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">Popular Insights</h2>
        <Badge variant="secondary">
          {initialInsights.length} insights loaded
        </Badge>
      </div>

      {/* Search Interface - Client Component for Interactivity */}
      <PlatformLibraryClient initialInsights={initialInsights} />

      {/* Info Banner */}
      <div className="border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-4 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Platform Library:</strong> Browse curated insights shared across organizations.
          Track adoption metrics, view version history, and discover best practices from the community.
          Insights are anonymized and sanitized before sharing.
        </p>
      </div>
    </div>
  );
}