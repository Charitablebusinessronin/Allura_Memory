'use client';

/**
 * Platform Library Client Component
 * Story 4-2: Platform Library
 *
 * Client-side interactivity for search and adoption
 */

import { useState } from 'react';
import { SearchBar } from './_components/search-bar';
import { InsightCard } from './_components/insight-card';
import { searchInsightsAction } from '@/app/actions/platform-library';
import type { PlatformInsight } from '@/lib/platform/types';

interface PlatformLibraryClientProps {
  initialInsights: Array<{
    insight: PlatformInsight;
    rank: number;
    match_reason: string;
  }>;
}

export function PlatformLibraryClient({ initialInsights }: PlatformLibraryClientProps) {
  const [results, setResults] = useState(initialInsights);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = async (query: string, category?: string, tags?: string[]) => {
    setIsSearching(true);
    try {
      const formData = new FormData();
      if (query) formData.append('query', query);
      if (category) formData.append('category', category);
      if (tags && tags.length > 0) formData.append('tags', tags.join(','));
      formData.append('sortBy', 'adoption');
      formData.append('limit', '20');

      const result = await searchInsightsAction(formData);

      if (result.success) {
        setResults(result.results);
        setSearchQuery(query);
      } else {
        console.error('Search failed:', result.error);
      }
    } catch (error) {
      console.error('Failed to search:', error);
    } finally {
      setIsSearching(false);
    }
  };

  if (results.length === 0 && !isSearching) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No platform insights found</p>
        <p className="text-sm text-muted-foreground mt-2">
          Try adjusting your search criteria
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SearchBar onSearch={handleSearch} isSearching={isSearching} />

      {searchQuery && (
        <div className="text-sm text-muted-foreground">
          Showing results for "{searchQuery}" ({results.length} found)
        </div>
      )}

      <div className="space-y-4">
        {isSearching ? (
          <div className="text-center py-12">
            <div className="animate-pulse">
              <p className="text-muted-foreground">Searching...</p>
            </div>
          </div>
        ) : (
          results.map((result) => (
            <InsightCard
              key={result.insight.id}
              insight={result.insight}
              rank={result.rank}
              matchReason={result.match_reason}
            />
          ))
        )}
      </div>
    </div>
  );
}