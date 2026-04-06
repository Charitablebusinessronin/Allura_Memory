/**
 * Search Bar Component
 * Story 4-2: Platform Library
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Loader2 } from 'lucide-react';
import type { InsightCategory } from '@/lib/platform/types';

interface SearchBarProps {
  onSearch: (query: string, category?: string, tags?: string[]) => void;
  isSearching: boolean;
}

const CATEGORIES: Array<{ value: InsightCategory; label: string }> = [
  { value: 'architecture', label: 'Architecture' },
  { value: 'pattern', label: 'Design Pattern' },
  { value: 'best-practice', label: 'Best Practice' },
  { value: 'lesson-learned', label: 'Lesson Learned' },
  { value: 'anti-pattern', label: 'Anti-Pattern' },
  { value: 'technique', label: 'Technique' },
  { value: 'configuration', label: 'Configuration' },
  { value: 'integration', label: 'Integration' },
];

export function SearchBar({ onSearch, isSearching }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('');
  const [tags, setTags] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tagArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined;
    onSearch(query, category || undefined, tagArray);
  };

  const handleClear = () => {
    setQuery('');
    setCategory('');
    setTags('');
    onSearch('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search insights by title or content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={isSearching}>
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching
            </>
          ) : (
            'Search'
          )}
        </Button>
        {(query || category || tags) && (
          <Button type="button" variant="outline" onClick={handleClear}>
            Clear
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Categories</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="text"
          placeholder="Tags (comma-separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-[250px]"
        />
      </div>
    </form>
  );
}