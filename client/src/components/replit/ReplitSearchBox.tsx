import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  X, 
  ChevronUp, 
  ChevronDown, 
  Settings,
  FileText,
  Code,
  Folder,
  ArrowUpDown,
  Filter,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  file: string;
  line: number;
  column: number;
  text: string;
  preview: string;
  type: 'match' | 'context';
}

interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  include: string;
  exclude: string;
}

interface ReplitSearchBoxProps {
  onSearch?: (query: string, options: SearchOptions) => void;
  onResultClick?: (result: SearchResult) => void;
  results?: SearchResult[];
  isLoading?: boolean;
  className?: string;
}

export function ReplitSearchBox({
  onSearch,
  onResultClick,
  results = [],
  isLoading = false,
  className
}: ReplitSearchBoxProps) {
  const [query, setQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    include: '',
    exclude: ''
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query && onSearch) {
      const debounceTimer = setTimeout(() => {
        onSearch(query, options);
      }, 300);
      
      return () => clearTimeout(debounceTimer);
    }
  }, [query, options, onSearch]);

  const handleSearch = () => {
    if (query.trim() && onSearch) {
      onSearch(query, options);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        navigateResults('prev');
      } else {
        navigateResults('next');
      }
    } else if (e.key === 'Escape') {
      setQuery('');
      setSelectedIndex(0);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateResults('next');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateResults('prev');
    }
  };

  const navigateResults = (direction: 'next' | 'prev') => {
    if (results.length === 0) return;
    
    let newIndex = selectedIndex;
    if (direction === 'next') {
      newIndex = (selectedIndex + 1) % results.length;
    } else {
      newIndex = selectedIndex === 0 ? results.length - 1 : selectedIndex - 1;
    }
    
    setSelectedIndex(newIndex);
    if (onResultClick && results[newIndex]) {
      onResultClick(results[newIndex]);
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800/50 px-0.5 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css'].includes(ext || '')) {
      return <Code className="h-3 w-3" />;
    }
    return <FileText className="h-3 w-3" />;
  };

  const matchCount = results.filter(r => r.type === 'match').length;
  const fileCount = [...new Set(results.map(r => r.file))].length;

  return (
    <div className={cn(
      "w-80 bg-[var(--ecode-surface)] border-r border-[var(--ecode-border)] flex flex-col h-full",
      className
    )}>
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">Search</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            onClick={() => setShowReplace(!showReplace)}
            title="Toggle replace"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            onClick={() => setShowOptions(!showOptions)}
            title="Search options"
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="px-2.5 py-1.5 border-b border-[var(--ecode-border)] shrink-0">
        <div className="relative">
          <Input
            ref={searchInputRef}
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pr-20 h-7 text-xs bg-[var(--ecode-sidebar-hover)] border-[var(--ecode-border)]"
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => navigateResults('prev')}
              disabled={results.length === 0}
              title="Previous match"
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => navigateResults('next')}
              disabled={results.length === 0}
              title="Next match"
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setQuery('');
                  setSelectedIndex(0);
                }}
                title="Clear search"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Replace input */}
        {showReplace && (
          <div className="relative mb-2">
            <Input
              ref={replaceInputRef}
              placeholder="Replace"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              className="pr-16 text-[13px]"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Replace"
              >
                <ArrowUpDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Replace all"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Search options */}
        {showOptions && (
          <div className="space-y-2 mb-2">
            <div className="flex flex-wrap gap-1">
              <Button
                variant={options.caseSensitive ? "default" : "outline"}
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => setOptions(prev => ({ ...prev, caseSensitive: !prev.caseSensitive }))}
              >
                Aa
              </Button>
              <Button
                variant={options.wholeWord ? "default" : "outline"}
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => setOptions(prev => ({ ...prev, wholeWord: !prev.wholeWord }))}
              >
                Ab
              </Button>
              <Button
                variant={options.regex ? "default" : "outline"}
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => setOptions(prev => ({ ...prev, regex: !prev.regex }))}
              >
                .*
              </Button>
            </div>
            
            <Input
              placeholder="files to include"
              value={options.include}
              onChange={(e) => setOptions(prev => ({ ...prev, include: e.target.value }))}
              className="text-[11px] h-7"
            />
            
            <Input
              placeholder="files to exclude"
              value={options.exclude}
              onChange={(e) => setOptions(prev => ({ ...prev, exclude: e.target.value }))}
              className="text-[11px] h-7"
            />
          </div>
        )}

        {/* Results summary */}
        {query && (
          <div className="flex items-center gap-2 text-[11px] text-[var(--ecode-text-secondary)]">
            {isLoading ? (
              <span>Searching...</span>
            ) : (
              <>
                <span>{matchCount} results</span>
                <span>•</span>
                <span>{fileCount} files</span>
                {selectedIndex < results.length && (
                  <>
                    <span>•</span>
                    <span>{selectedIndex + 1} of {matchCount}</span>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {results.length === 0 && query && !isLoading && (
            <div className="text-center py-8 text-[var(--ecode-text-secondary)]">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-[13px]">No results found</p>
            </div>
          )}

          {results.map((result, index) => (
            <div
              key={result.id}
              className={cn(
                "p-2 rounded cursor-pointer border mb-1 transition-colors",
                selectedIndex === index 
                  ? "bg-[var(--ecode-accent)] text-white border-[var(--ecode-accent)]"
                  : "hover:bg-[var(--ecode-sidebar-hover)] border-transparent"
              )}
              onClick={() => {
                setSelectedIndex(index);
                onResultClick?.(result);
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                {getFileIcon(result.file)}
                <span className="text-[13px] font-medium truncate">{result.file}</span>
                <Badge variant="outline" className="ml-auto text-[11px]">
                  {result.line}:{result.column}
                </Badge>
              </div>
              
              <div className="text-[11px] font-mono bg-black/5 dark:bg-white/5 p-1 rounded">
                {highlightMatch(result.preview, query)}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}