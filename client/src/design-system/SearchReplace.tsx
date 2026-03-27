/**
 * SearchReplace Component
 * Provides find and replace functionality for code editors
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, ChevronDown, ChevronUp, ReplaceAll } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SearchOptions = {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
};

export type SearchResult = {
  match: string;
  line: number;
  column: number;
  endColumn: number;
};

interface SearchReplaceProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch?: (query: string, options: SearchOptions) => SearchResult[];
  onReplace?: (query: string, replacement: string) => void;
  onReplaceAll?: (query: string, replacement: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchReplace({
  isOpen,
  onClose,
  onSearch,
  onReplace,
  onReplaceAll,
  placeholder = 'Find...',
  className = '',
}: SearchReplaceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
  });

  if (!isOpen) return null;

  return (
    <div className={cn(
      'absolute top-0 right-0 w-80 bg-white border border-gray-300 rounded shadow-lg p-3 z-50',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Find and Replace</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search Input */}
      <div className="space-y-2 mb-2">
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-sm"
          autoFocus
        />

        {/* Navigation Buttons */}
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-6 px-2">
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" className="h-6 px-2">
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Options */}
      <div className="flex gap-1 mb-2 flex-wrap text-xs">
        <Button
          size="sm"
          variant={options.caseSensitive ? 'default' : 'outline'}
          onClick={() => setOptions(o => ({ ...o, caseSensitive: !o.caseSensitive }))}
          className="h-6 px-2"
        >
          Aa
        </Button>
        <Button
          size="sm"
          variant={options.wholeWord ? 'default' : 'outline'}
          onClick={() => setOptions(o => ({ ...o, wholeWord: !o.wholeWord }))}
          className="h-6 px-2"
        >
          Ab
        </Button>
        <Button
          size="sm"
          variant={options.regex ? 'default' : 'outline'}
          onClick={() => setOptions(o => ({ ...o, regex: !o.regex }))}
          className="h-6 px-2"
        >
          .*
        </Button>
      </div>

      {/* Replace Section */}
      {showReplace && (
        <div className="space-y-2 mb-2 border-t pt-2">
          <Input
            placeholder="Replace with..."
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-6 text-xs"
              onClick={() => onReplace?.(searchQuery, replaceQuery)}
            >
              Replace
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-6 text-xs"
              onClick={() => onReplaceAll?.(searchQuery, replaceQuery)}
            >
              Replace All
            </Button>
          </div>
        </div>
      )}

      {/* Toggle Replace Button */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setShowReplace(!showReplace)}
        className="h-6 text-xs w-full"
      >
        <ReplaceAll className="h-3 w-3 mr-1" />
        {showReplace ? 'Hide Replace' : 'Show Replace'}
      </Button>
    </div>
  );
}
